import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, type Tool } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const resolveExceptionTool: Tool = {
  functionDeclarations: [
    {
      name: "resolve_exception",
      description: "استخدم هذه الدالة فقط عندما يطلب منك المستخدم أو يوافق على حل مشكلة، إغلاق استثناء، أو التدخل في طلب معين.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          exceptionId: { type: SchemaType.STRING, description: "رقم الطلب أو المشكلة المستهدفة، مثلاً ZH-2481" },
          action: { type: SchemaType.STRING, description: "الإجراء المراد تنفيذه: resolve أو ignore" }
        },
        required: ["exceptionId", "action"]
      }
    }
  ]
};

export async function POST(req: NextRequest) {
  console.log("Key exists:", !!process.env.GEMINI_API_KEY);
  
  try {
    const body = await req.json();
    const { prompt, contextData } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing in .env' }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.8-flash',
      tools: [resolveExceptionTool],
      systemInstruction: `أنت AI Operations Agent متطور مسؤول عن مراقبة عمليات مطاعم (زاهي) و(موزون). مدير العمليات يسألك الآن.
استخدم البيانات التشغيلية المرفقة للإجابة بدقة، باختصار، وباحترافية شديدة.
القواعد:
1. لا تهلوس ببيانات غير موجودة. اعتمد فقط على الـ contextData المرفق.
2. إذا سألك عن الحالات أو المشاكل، اذكر أرقام الطلبات (مثل ZH-2481) ومستوى الخطورة بوضوح.
3. استخدم تنسيق Markdown لدعم الروابط الغامقة وتوضيح النص.
4. استخدم نبرة رسمية ومباشرة.
5. إذا طلب المستخدم حل مشكلة، إغلاق استثناء، أو التدخل في طلب معين، قم باستدعاء أداة resolve_exception مع البيانات المطلوبة.

البيانات التشغيلية الحالية (Context):
${JSON.stringify(contextData)}
`,
    });

    const result = await model.generateContent(prompt);

    const functionCalls = result.response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const exceptionId = (call.args as any)?.exceptionId || '';
      const action = (call.args as any)?.action || 'resolve';
      return NextResponse.json({
        type: 'action',
        action: action,
        exceptionId: exceptionId,
        reply: `تم توجيه أمر لتنفيذ الإجراء \`${call.name}\` للطلب \`${exceptionId}\` (الإجراء: ${action}). ⚡`,
        functionCall: call,
        functionCalls: functionCalls
      });
    }

    const responseText = result.response.text();

    return NextResponse.json({ reply: responseText });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ غير معروف في خوادم الذكاء الاصطناعي." },
      { status: 500 }
    );
  }
}
