import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  timeout: 15000, // 15s timeout to eliminate hanging requests
});

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, contextData } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "خدمة الذكاء الاصطناعي غير متوفرة حالياً (يرجى التحقق من مفتاح الخدمة في البيئة)." },
        { status: 500 }
      );
    }

    // Compact context data to minimize token payload and latency
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
    };

    const systemInstruction = `أنت AI Operations Agent متطور مسؤول عن مراقبة وتوجيه عمليات مطاعم (زاهي) وإدارة سلسلة الإمداد والمخزون. مدير العمليات يسألك الآن.
استخدم البيانات التشغيلية المرفقة للإجابة بدقة، باختصار، وباحترافية شديدة.
القواعد:
1. لا تهلوس ببيانات غير موجودة. اعتمد فقط على الـ contextData المرفق.
2. إذا سألك عن الحالات أو المشاكل، اذكر أرقام الطلبات ومستوى الخطورة بوضوح.
3. استخدم تنسيق Markdown لدعم الروابط الغامقة وتوضيح النص.
4. استخدم نبرة رسمية ومباشرة.
5. إذا طلب المستخدم حل مشكلة، إغلاق استثناء، أو التدخل في طلب معين، قم باستدعاء أداة resolve_exception مع البيانات المطلوبة.
6. إذا طلب المستخدم إنشاء أو إرسال أمر شراء لمادة من المخزون أو الموافقة على توريد، قم باستدعاء أداة create_purchase_order مع (itemId, supplierName, quantity).

البيانات التشغيلية الحالية (Context):
${JSON.stringify(compactContext)}
`;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt },
    ];

    // Priority model: fast Flash tier first for sub-second latency, then fallback
    const modelCandidates = [
      process.env.OPENROUTER_MODEL || "google/gemini-1.5-flash:free",
      "google/gemini-1.5-pro:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "openrouter/free",
    ];

    let completion: OpenAI.Chat.Completions.ChatCompletion | null = null;
    let lastError: any = null;

    for (const model of modelCandidates) {
      try {
        completion = await openai.chat.completions.create({
          model,
          messages,
          tools,
        });
        if (completion) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed on OpenRouter (${err?.status || err?.message}), attempting fallback...`);
        // Fallback on 400 (invalid model), 429 (rate limit), 502/503/504 (gateway), or timeout
        if (
          err?.status === 400 ||
          err?.status === 404 ||
          err?.status === 429 ||
          err?.status === 502 ||
          err?.status === 503 ||
          err?.status === 504 ||
          err?.name === "APIConnectionTimeoutError" ||
          err?.code === "ETIMEDOUT"
        ) {
          continue;
        }
        throw err;
      }
    }

    if (!completion) {
      throw lastError || new Error("Failed to get completion from OpenRouter");
    }

    const choice = completion.choices[0];
    const message = choice?.message;

    // Handle tool call (function call)
    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      if (toolCall.type === "function") {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const fnName = toolCall.function.name;

        if (fnName === "create_purchase_order") {
          const itemId = args.itemId || "أدوات المائدة";
          const supplierName = args.supplierName || "مصنع البلاستيك الوطني";
          const quantity = typeof args.quantity === "number" ? args.quantity : 2000;
          const reply = `✅ إجراء آلي: تم إنشاء أمر شراء لعدد ${quantity} من [${itemId}] من المورد [${supplierName}] بانتظار الموافقة النهائية.`;
          return NextResponse.json({
            type: "action",
            toolName: fnName,
            itemId,
            supplierName,
            quantity,
            reply,
            text: reply,
            functionCall: {
              name: fnName,
              args,
            },
          });
        }

        const exceptionId = args.exceptionId || "";
        const action = args.action || "resolve";
        const reply = `تم توجيه أمر لتنفيذ الإجراء \`${fnName}\` للطلب \`${exceptionId}\` (الإجراء: ${action}). ⚡`;

        return NextResponse.json({
          type: "action",
          action,
          exceptionId,
          reply,
          text: reply,
          functionCall: {
            name: fnName,
            args,
          },
        });
      }
    }

    const content = message?.content || "";
    return NextResponse.json({
      type: "text",
      text: content,
      reply: content,
    });
  } catch (error: any) {
    console.error("OpenRouter API Error:", error);
    // Sanitize user-facing error to protect internal architecture details
    const safeMessage = error?.status === 429
      ? "الخدمة تشهد ضغطاً عالياً حالياً، يرجى المحاولة بعد لحظات."
      : error?.name === "APIConnectionTimeoutError"
      ? "استغرقت استجابة الذكاء الاصطناعي وقتاً أطول من المعتاد، يرجى إعادة المحاولة."
      : "حدث تعذر مؤقت في معالجة طلب الذكاء الاصطناعي.";

    return NextResponse.json(
      { error: safeMessage },
      { status: error?.status && error.status >= 400 && error.status < 600 ? error.status : 500 }
    );
  }
}
