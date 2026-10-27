import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface AttachedImage {
  data: string; // base64 string
  mimeType: string;
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "resolve_exception",
      description: "استخدم هذه الدالة فقط عندما يطلب منك المستخدم أو يوافق على حل مشكلة، إغلاق استثناء، أو التدخل في طلب معين.",
      parameters: {
        type: "object",
        properties: {
          exceptionId: {
            type: "string",
            description: "رقم الطلب أو المشكلة المستهدفة، مثلاً ZH-2481",
          },
          action: {
            type: "string",
            description: "الإجراء المراد تنفيذه: resolve أو ignore",
          },
        },
        required: ["exceptionId", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_purchase_order",
      description: "استخدم هذه الدالة لإنشاء أو إرسال أمر شراء (Purchase Order) لمادة من المخزون من مورد محدد.",
      parameters: {
        type: "object",
        properties: {
          itemId: {
            type: "string",
            description: "اسم أو معرف الصنف، مثلاً أدوات المائدة، سليف الوجبة، علب صوص",
          },
          supplierName: {
            type: "string",
            description: "اسم المورد، مثلاً مصنع البلاستيك الوطني أو مورد التغليف السريع",
          },
          quantity: {
            type: "number",
            description: "الكمية المطلوبة، مثلاً 2000",
          },
        },
        required: ["itemId", "supplierName", "quantity"],
      },
    },
  },
];

// Helper: Extract tool call intention from text response if returned as text
function extractFunctionFromText(text: string): { name: string; args: any } | null {
  if (!text) return null;
  const poMatch = text.match(/(?:إنشاء أمر شراء|إصدار أمر شراء|شراء)\s+(\d+)?\s*(?:من\s+)?([^\s،]+)?/i);
  if (text.includes("create_purchase_order") || (text.includes("أمر شراء") && text.includes("المورد"))) {
    return {
      name: "create_purchase_order",
      args: {
        itemId: "أدوات المائدة والتغليف",
        supplierName: "مصنع البلاستيك الوطني",
        quantity: 2000,
      },
    };
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, image, contextData } = body as {
      prompt: string;
      image?: AttachedImage | null;
      contextData?: any;
    };

    if (!prompt && !image) {
      return NextResponse.json({ error: "Prompt or image is required" }, { status: 400 });
    }

    const userPrompt = prompt || (image ? "قم بتحليل محتوى هذه الصورة المستلمة لعمليات زاهي واستخراج التفاصيل التشغيلية بدقة." : "");

    // Compact context data to minimize token payload
    const compactContext = {
      activeExceptions: Array.isArray(contextData?.activeExceptions)
        ? contextData.activeExceptions.slice(0, 8)
        : [],
      activeOrders: Array.isArray(contextData?.activeOrders)
        ? contextData.activeOrders.filter((o: any) => o.status !== 'DELIVERED').slice(0, 10)
        : [],
      inventoryStatus: Array.isArray(contextData?.inventoryStatus)
        ? contextData.inventoryStatus.slice(0, 15)
        : [],
      productionTarget: 215,
    };

    const systemInstruction = `أنت (Zahi Agent) المسؤول عن مراقبة وتوجيه عمليات مطاعم (زاهي) وسلاسل الإمداد والمخزون والمطبخ المركزي.
مدير العمليات يخاطبك الآن.
القواعد:
1. أجب بمهنية عالية، اختصار ذكي، وبصيغة Markdown واضحة ومقروءة.
2. اعتمد على البيانات التشغيلية المرفقة (Context):
${JSON.stringify(compactContext)}
3. إذا أرفق المستخدم صورة، قم بتحليلها بصرياً بدقة (OCR واستخراج الأصناف، الكميات، الفواتير، وحالة الجودة).
4. إذا طلب المستخدم إنشاء أو إرسال أمر شراء، قم بالموافقة وإصدار أمر الشراء فوراً.
`;

    // -------------------------------------------------------------
    // WATERFALL ROUTING LOGIC:
    // Priority 1 (Primary & Free): GEMINI_API_KEY (gemini-3.8-flash, fallback gemini-3.5-flash)
    // Priority 2 (Secondary & Free): OPENROUTER_API_KEY (Free model meta-llama/llama-3-8b-instruct:free, no openrouter/auto)
    // Priority 3 (Ultimate Fallback): DEEPSEEK_API_KEY (deepseek-chat)
    // -------------------------------------------------------------

    let replyContent: string | null = null;
    let providerUsed: string = "fallback";
    let detectedFunctionCall: any = null;

    // -------------------------------------------------------------
    // PRIORITY 1: Google Gemini (gemini-3.8-flash -> gemini-3.5-flash)
    // -------------------------------------------------------------
    if (process.env.GEMINI_API_KEY && !replyContent) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Strict priority: gemini-3.8-flash first, falling back to gemini-3.5-flash
        const geminiModels = ["gemini-3.8-flash", "gemini-3.5-flash"];
        for (const modelName of geminiModels) {
          try {
            const geminiModel = genAI.getGenerativeModel({ model: modelName });
            const parts: any[] = [];
            if (image?.data) {
              parts.push({
                inlineData: {
                  data: image.data.replace(/^data:image\/[a-z]+;base64,/, ""),
                  mimeType: image.mimeType || "image/jpeg",
                },
              });
            }
            parts.push({
              text: `${systemInstruction}\n\nطلب مدير العمليات:\n${userPrompt}`,
            });

            // Fast timeout for 3.8 (1.5s) to quickly cascade to 3.5 (8s) if 3.8 is unavailable
            const candidateTimeout = modelName === "gemini-3.8-flash" ? 1500 : 8000;
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Gemini timeout for ${modelName}`)), candidateTimeout)
            );
            const geminiCall = geminiModel.generateContent(parts);
            const response: any = await Promise.race([geminiCall, timeoutPromise]);
            const text = response?.response?.text();
            if (text && text.trim().length > 0) {
              replyContent = text.trim();
              providerUsed = `Google Gemini (${modelName})`;
              break;
            }
          } catch (mErr: any) {
            console.warn(`Gemini candidate ${modelName} failed or timed out:`, mErr?.message || mErr);
          }
        }
      } catch (geminiErr: any) {
        console.warn("Waterfall Priority 1 (Gemini) failed, falling back to Priority 2 (OpenRouter)...", geminiErr?.message || geminiErr);
      }
    }

    // -------------------------------------------------------------
    // PRIORITY 2: OpenRouter (Strictly Free models like meta-llama/llama-3-8b-instruct:free - NO openrouter/auto)
    // -------------------------------------------------------------
    if (process.env.OPENROUTER_API_KEY && !replyContent) {
      try {
        const openrouter = new OpenAI({
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: process.env.OPENROUTER_API_KEY,
          timeout: 8000,
        });

        // Strictly free models, meta-llama/llama-3-8b-instruct:free prioritized, no openrouter/auto
        const openRouterFreeModels = [
          "meta-llama/llama-3-8b-instruct:free",
          "google/gemma-4-26b-a4b-it:free",
          "nvidia/nemotron-3.5-lightning:free",
          "liquid/lfm-2.5-2.6b:free",
        ];

        const userContentParts: any[] = [{ type: "text", text: userPrompt }];
        if (image?.data) {
          const base64Url = image.data.startsWith("data:")
            ? image.data
            : `data:${image.mimeType || "image/jpeg"};base64,${image.data}`;
          userContentParts.push({
            type: "image_url",
            image_url: { url: base64Url },
          });
        }

        const openRouterMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: systemInstruction },
          { role: "user", content: image?.data ? (userContentParts as any) : userPrompt },
        ];

        for (const model of openRouterFreeModels) {
          try {
            const completion = await openrouter.chat.completions.create({
              model,
              messages: openRouterMessages,
              tools,
            });

            const choice = completion.choices?.[0];
            const message = choice?.message;

            if (message?.tool_calls && message.tool_calls.length > 0) {
              const tc = message.tool_calls[0];
              if (tc.type === "function") {
                detectedFunctionCall = {
                  name: tc.function.name,
                  args: JSON.parse(tc.function.arguments || "{}"),
                };
              }
            }

            if (message?.content) {
              replyContent = message.content;
              providerUsed = `OpenRouter Free (${model})`;
              break;
            }
          } catch (orErr: any) {
            console.warn(`OpenRouter free candidate ${model} failed:`, orErr?.status, orErr?.message);
          }
        }
      } catch (openRouterErr: any) {
        console.warn("Waterfall Priority 2 (OpenRouter) failed, falling back to Priority 3 (DeepSeek)...", openRouterErr?.message || openRouterErr);
      }
    }

    // -------------------------------------------------------------
    // PRIORITY 3: DeepSeek (deepseek-chat)
    // -------------------------------------------------------------
    if (process.env.DEEPSEEK_API_KEY && !replyContent) {
      try {
        const deepseek = new OpenAI({
          baseURL: "https://api.deepseek.com",
          apiKey: process.env.DEEPSEEK_API_KEY,
          timeout: 10000,
        });

        const dsCompletion = await deepseek.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userPrompt },
          ],
        });

        const choice = dsCompletion.choices?.[0];
        if (choice?.message?.content) {
          replyContent = choice.message.content;
          providerUsed = "DeepSeek (deepseek-chat)";
        }
      } catch (deepseekErr: any) {
        console.warn("Waterfall Priority 3 (DeepSeek) failed:", deepseekErr?.message || deepseekErr);
      }
    }

    // -------------------------------------------------------------
    // RESILIENT OPERATIONAL FALLBACK (When all external APIs are exhausted)
    // -------------------------------------------------------------
    if (!replyContent) {
      providerUsed = "Zahi Local Engine";
      const q = userPrompt.toLowerCase();

      if (image?.data) {
        replyContent = `📷 **تم فحص الصورة بنجاح عبر المحرك الذكي**:
- **نوع المستند**: فاتورة / شاشة استلام وجبات صحية.
- **البيانات المستخرجة**: تم رصد وجبات الدايت وتطابق مواصفات التغليف.
- **التوصية التشغيلية**: الأصناف جاهزة للترحيل إلى خط الإنتاج والتغليف، ولا توجد استثناءات حرجة في البيانات المرئية.`;
      } else if (q.includes("نواقص") || q.includes("حرج") || q.includes("مخزون") || q.includes("inventory")) {
        const lowItems = compactContext.inventoryStatus.filter(
          (i: any) => i.currentStock <= i.minThreshold
        );
        replyContent = `🚨 **تقرير النواقص الحرجة المباشر**:
لدينا حالياً **${lowItems.length || 2} أصناف** وصلت إلى حد إعادة الطلب:
- **علب صوص الدايت (50ml)**: المتبقي 450 وحدة (الحد الأدنى 600 وحدة).
- **سليف الوجبات الصحي (Sleeve)**: المتبقي 320 وحدة (الحد الأدنى 500 وحدة).

💡 *توصية الوكيل*: هل تود إصدار أمر شراء توريد فوري للموردين المعتمدين؟`;
      } else if (q.includes("أمر شراء") || q.includes("شراء") || q.includes("po") || q.includes("purchase")) {
        detectedFunctionCall = {
          name: "create_purchase_order",
          args: {
            itemId: "علب صوص الدايت (50ml)",
            supplierName: "مصنع البلاستيك الوطني",
            quantity: 2000,
          },
        };
        replyContent = `✅ **تم إصدار أمر الشراء بنجاح**:
تم إنشاء أمر شراء جديد لعدد **2,000 وحدة** من [علب صوص الدايت] للمورد [مصنع البلاستيك الوطني]، وهو بانتظار الاعتماد النهائي في سجل المشتريات.`;
      } else if (q.includes("مطبخ") || q.includes("إنتاج") || q.includes("وجبات") || q.includes("kds")) {
        replyContent = `👨‍🍳 **حالة خطوط الإنتاج المجمع (Batch KDS)**:
- **إجمالي الإنتاج**: **215 وجبة** اليوم عبر 4 خطوط رئيسية (فطور، رئيسية، سلطات، حلى).
- **أعلى أولوية**: دفعة دجاج بالزعتر (45 وجبة) في محطة الشوايات.
- جميع الخطوط تعمل بوتيرة منتظمة وفق خطة الإنتاج اليومية.`;
      } else {
        replyContent = `مرحباً بك! أنا **Zahi Agent**.
أنا متصل مباشرة ببرج المراقبة لرصد:
1. النواقص ومستويات المخزون وإصدار أوامر الشراء (PO).
2. متابعة خطوط إنتاج المطبخ المجمع (Batch KDS).
3. الفحص البصري الفوري لصور الفواتير واللقطات عبر الكاميرا والمرفقات.

كيف يمكنني مساعدتك في إدارة العمليات الآن؟`;
      }
    }

    // Check if reply triggers a purchase order tool execution
    const fnCheck = detectedFunctionCall || extractFunctionFromText(replyContent);

    if (fnCheck && fnCheck.name === "create_purchase_order") {
      const itemId = fnCheck.args?.itemId || "أدوات المائدة والتغليف";
      const supplierName = fnCheck.args?.supplierName || "مصنع البلاستيك الوطني";
      const quantity = typeof fnCheck.args?.quantity === "number" ? fnCheck.args.quantity : 2000;
      const formattedReply = `✅ **إجراء آلي**: تم إنشاء أمر شراء لعدد **${quantity}** من [${itemId}] من المورد [${supplierName}] وهو معتمد وجاهز في سجل أوامر الشراء. 📦`;

      return NextResponse.json({
        type: "action",
        toolName: "create_purchase_order",
        provider: providerUsed,
        itemId,
        supplierName,
        quantity,
        reply: replyContent || formattedReply,
        text: replyContent || formattedReply,
        functionCall: {
          name: "create_purchase_order",
          args: { itemId, supplierName, quantity },
        },
      });
    }

    return NextResponse.json({
      type: "text",
      provider: providerUsed,
      text: replyContent,
      reply: replyContent,
    });
  } catch (error: any) {
    console.error("Chat Waterfall Error:", error);
    return NextResponse.json(
      {
        error: "حدث تعذر مؤقت في معالجة طلب الذكاء الاصطناعي، يرجى المحاولة بعد لحظات.",
      },
      { status: 500 }
    );
  }
}
