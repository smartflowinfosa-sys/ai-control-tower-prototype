import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
      model: 'gemini-1.5-flash',
      systemInstruction: `أنت AI Operations Agent متطور مسؤول عن مراقبة عمليات مطاعم (زاهي) و(موزون). مدير العمليات يسألك الآن.
استخدم البيانات التشغيلية المرفقة للإجابة بدقة، باختصار، وباحترافية شديدة.
القواعد:
1. لا تهلوس ببيانات غير موجودة. اعتمد فقط على الـ contextData المرفق.
2. إذا سألك عن الحالات أو المشاكل، اذكر أرقام الطلبات (مثل ZH-2481) ومستوى الخطورة بوضوح.
3. استخدم تنسيق Markdown لدعم الروابط الغامقة وتوضيح النص.
4. استخدم نبرة رسمية ومباشرة.

البيانات التشغيلية الحالية (Context):
${JSON.stringify(contextData)}
`,
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return NextResponse.json({ reply: responseText });
  } catch (error) {
    console.error('Gemini API Error:', error);
    return NextResponse.json({ error: 'Failed to generate response from Gemini API.' }, { status: 500 });
  }
}
