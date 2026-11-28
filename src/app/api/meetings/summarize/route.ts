import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function toEnglishDigitsText(text: string): string {
  return String(text || '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
}

function cleanPlainTextMinutes(text: string): string {
  return toEnglishDigitsText(text)
    .replace(/\*\*/g, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .trim();
}

function formatCurrentDateTimeEnglish(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

const EXECUTIVE_SECRETARY_SYSTEM_PROMPT = `أنت سكرتير تنفيذي محترف تفهم اللهجة السعودية والخليجية العامية بدقة. حوّل النص التالي إلى محضر اجتماع رسمي باللغة العربية الفصحى، وتجاهل تماماً عبارات الترحيب والوداع والحشو (مثل: يا شباب، شكراً، بالتوفيق).

قواعد صارمة للتنسيق والبيانات:
- استخدم اسم المضيف وتاريخ ووقت الاجتماع وأسماء الحضور المعطاة في المدخلات حرفياً كما هي تماماً.
- يُمنع منعاً باتاً كتابة أي أقواس تعبئة أو نصوص افتراضية مثل [يُضاف تاريخ الاجتماع] أو [اسم المضيف].
- يُمنع منعاً باتاً ترجمة أو تعريب الأسماء الإنجليزية (مثال: إذا كان اسم المضيف abdullatif mahdi يجب كتابته abdullatif mahdi حرفياً كما هو).
- اكتب نصاً صافياً تماماً (Plain Text) بدون أي رموز Markdown نهائياً (ممنوع استخدام ** أو * أو #).
- استخدم الأرقام الإنجليزية (0-9) فقط في جميع التواريخ والأوقات والأرقام.

اكتب المخرجات بهذه البنية الواضحة:
محضر اجتماع رسمي
موضوع الاجتماع: [الموضوع الفعلي]
تاريخ ووقت الاجتماع: [التاريخ والوقت المعطى حرفياً]
المضيف: [اسم المضيف المعطى حرفياً دون ترجمة]
الحضور: [أسماء الحضور المعطاة]

1. ملخص ما دار في الاجتماع:
(نقاط موجزة بأسلوب إداري تبدأ بـ -)

2. القرارات المعتمدة:
(كل ما تم الاتفاق على اعتماده بنقاط تبدأ بـ -)

3. المهام المطلوبة والمسؤولين:
(اكتب كل مهمة في سطر مستقل بصيغة: - [وصف المهمة] — المسؤول: [الاسم] — الموعد: [الوقت/التاريخ])`;

interface ProviderResult {
  text: string | null;
  errorDetails?: string;
}

async function callOpenAICompatible(
  providerName: string,
  endpoint: string,
  apiKey: string,
  model: string,
  userMessage: string,
  extraHeaders?: Record<string, string>
): Promise<ProviderResult> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(extraHeaders || {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature: 0.2,
        messages: [
          { role: 'system', content: EXECUTIVE_SECRETARY_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const apiMsg =
        json?.error?.message ||
        (typeof json?.error === 'string' ? json.error : '') ||
        `HTTP ${res.status}`;
      return { text: null, errorDetails: `${providerName}: ${apiMsg}` };
    }

    const text = json?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { text: null, errorDetails: `${providerName}: استجابة فارغة من النموذج` };
    }
    return { text };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { text: null, errorDetails: `${providerName}: ${msg}` };
  }
}

async function callGeminiDirect(apiKey: string, userMessage: string): Promise<ProviderResult> {
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: EXECUTIVE_SECRETARY_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const apiMsg = json?.error?.message || `HTTP ${res.status}`;
      return { text: null, errorDetails: `Gemini: ${apiMsg}` };
    }

    const text = json?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p?.text || '')
      .join('')
      .trim();

    if (!text) {
      return { text: null, errorDetails: 'Gemini: استجابة فارغة من النموذج' };
    }
    return { text };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { text: null, errorDetails: `Gemini: ${msg}` };
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'غير مصرح باستخدام محضر الاجتماع الذكي بدون تسجيل دخول' },
        { status: 401 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const role = String(session.user.role || '').trim().toUpperCase();
    let hasPermission = role === 'ADMIN' || role === 'SUPERADMIN';

    if (!hasPermission) {
      const userId = String(session.user.id || '').trim();
      const username = String(session.user.username || '').trim();
      let userQuery = supabaseAdmin.from('app_users').select('can_use_ai_minutes');
      if (userId) {
        userQuery = userQuery.eq('id', userId);
      } else if (username) {
        userQuery = userQuery.eq('username', username);
      }
      const { data: dbUser } = await userQuery.maybeSingle();
      if (dbUser?.can_use_ai_minutes === true) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'عفواً، لا تملك صلاحية استخدام أداة محضر الاجتماع الذكي (AI).' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const transcript = String(body?.transcript || '').trim();
    const title = String(body?.title || 'اجتماع فريق العمل').trim();
    const hostName = String(
      body?.host_name ||
        session.user.name_en ||
        session.user.name_ar ||
        session.user.username ||
        session.user.name ||
        'Host'
    ).trim();
    const meetingDate = toEnglishDigitsText(
      String(body?.meeting_date || '').trim() || formatCurrentDateTimeEnglish()
    );
    const participants: string[] = Array.isArray(body?.participants)
      ? body.participants.map((p: unknown) => String(p || '').trim()).filter(Boolean)
      : [];
    const meetingId = typeof body?.meeting_id === 'string' ? body.meeting_id.trim() : '';

    if (!transcript) {
      return NextResponse.json(
        { error: 'يرجى تسجيل أو لصق نص الاجتماع أولاً قبل توليد المحضر' },
        { status: 400 }
      );
    }

    const userPrompt = [
      `موضوع الاجتماع: ${title}`,
      `تاريخ ووقت الاجتماع: ${meetingDate}`,
      `المضيف (يُكتب حرفياً دون ترجمة): ${hostName}`,
      `الحضور: ${participants.length > 0 ? participants.join('، ') : 'فريق العمل'}`,
      '',
      'النص الخام للاجتماع:',
      transcript,
    ].join('\n');

    const openrouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
    const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
    const deepseekKey = (process.env.DEEPSEEK_API_KEY || '').trim();

    let generatedMinutes = '';
    let engineUsed: 'openrouter' | 'gemini-2.5-flash' | 'deepseek-chat' | null = null;
    const errorReasons: string[] = [];

    // 1) First try OPENROUTER_API_KEY with max_tokens: 1500 and automatic model fallback
    if (openrouterKey) {
      const openrouterModels = [
        'google/gemini-2.5-flash',
        'deepseek/deepseek-chat',
        'openrouter/auto',
      ];
      for (const model of openrouterModels) {
        const res = await callOpenAICompatible(
          `OpenRouter (${model})`,
          'https://openrouter.ai/api/v1/chat/completions',
          openrouterKey,
          model,
          userPrompt,
          {
            'HTTP-Referer': 'https://zahi-control-tower.local',
            'X-Title': 'Zahi Control Tower',
          }
        );
        if (res.text) {
          generatedMinutes = cleanPlainTextMinutes(res.text);
          engineUsed = 'openrouter';
          break;
        } else if (res.errorDetails) {
          errorReasons.push(res.errorDetails);
        }
      }
    }

    // 2) Next try GEMINI_API_KEY strictly if it starts with AIza
    if (!generatedMinutes && geminiKey && geminiKey.startsWith('AIza')) {
      const res = await callGeminiDirect(geminiKey, userPrompt);
      if (res.text) {
        generatedMinutes = cleanPlainTextMinutes(res.text);
        engineUsed = 'gemini-2.5-flash';
      } else if (res.errorDetails) {
        errorReasons.push(res.errorDetails);
      }
    }

    // 3) Next try DEEPSEEK_API_KEY
    if (!generatedMinutes && deepseekKey) {
      const res = await callOpenAICompatible(
        'DeepSeek',
        'https://api.deepseek.com/chat/completions',
        deepseekKey,
        'deepseek-chat',
        userPrompt
      );
      if (res.text) {
        generatedMinutes = cleanPlainTextMinutes(res.text);
        engineUsed = 'deepseek-chat';
      } else if (res.errorDetails) {
        errorReasons.push(res.errorDetails);
      }
    }

    // Strictly fail with clear JSON error (NO naive line-splitting fallback)
    if (!generatedMinutes) {
      const details =
        errorReasons.length > 0
          ? errorReasons.join(' | ')
          : 'لم يتم العثور على مفتاح AI صالح (OPENROUTER_API_KEY أو GEMINI_API_KEY يبدأ بـ AIza أو DEEPSEEK_API_KEY) في ملف البيئة .env';
      return NextResponse.json(
        { error: `فشل الاتصال بالذكاء الاصطناعي: ${details}` },
        { status: 500 }
      );
    }

    // Persist to public.team_meetings if meeting_id was supplied
    if (meetingId && !meetingId.startsWith('local-meet-')) {
      await supabaseAdmin
        .from('team_meetings')
        .update({
          ai_transcript: transcript,
          ai_minutes: generatedMinutes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', meetingId)
        .then(() => undefined, () => undefined);
    }

    return NextResponse.json({
      success: true,
      engine: engineUsed,
      ai_transcript: transcript,
      ai_minutes: generatedMinutes,
    });
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : 'خطأ غير متوقع';
    return NextResponse.json(
      { error: `فشل الاتصال بالذكاء الاصطناعي: ${details}` },
      { status: 500 }
    );
  }
}
