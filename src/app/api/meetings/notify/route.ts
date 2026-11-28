import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

function formatEnglishDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return iso;
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'غير مصرح بإرسال إشعارات الاجتماعات بدون جلسة مستخدم موثقة' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const notifyType = body?.type === 'minutes' ? 'minutes' : 'invite';
    const title = String(body?.title || 'اجتماع فريق العمل').trim();
    const hostName = String(body?.host_name || session.user.name_ar || session.user.name || 'المضيف').trim();
    const meetUrl = String(body?.meet_url || '').trim();
    const isInstant = Boolean(body?.is_instant);
    const isReminder = Boolean(body?.is_reminder);
    const reminderLabel = typeof body?.reminder_label === 'string' ? body.reminder_label.trim() : '';
    const scheduledAtIso = String(body?.scheduled_at || new Date().toISOString());
    const formattedDateTime = formatEnglishDateTime(scheduledAtIso);

    const emails: string[] = Array.isArray(body?.participant_emails)
      ? Array.from(
          new Set(
            body.participant_emails
              .map((e: unknown) => String(e || '').trim())
              .filter((e: string) => e.includes('@'))
          )
        )
      : [];

    const customSubject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const minutesText = typeof body?.minutes_text === 'string' ? body.minutes_text.trim() : '';

    const subject =
      notifyType === 'minutes'
        ? customSubject || `محضر اجتماع: ${title} — برج مراقبة زاهي`
        : isReminder
        ? `تذكير اجتماع (${reminderLabel || 'قريباً'}): ${title} — برج مراقبة زاهي`
        : isInstant
        ? `دعوة اجتماع فوري الآن: ${title} — برج مراقبة زاهي`
        : `دعوة اجتماع مجدول: ${title} (${formattedDateTime}) — برج مراقبة زاهي`;

    const plainTextBody =
      notifyType === 'minutes'
        ? [
            'السلام عليكم ورحمة الله وبركاته،',
            '',
            'مرفق لكم محضر الاجتماع الرسمي:',
            '',
            minutesText,
            '',
            'تحياتنا — نظام برج مراقبة زاهي (Zahi Control Tower)',
          ].join('\n')
        : [
            'السلام عليكم ورحمة الله وبركاته،',
            '',
            isReminder
              ? `هذا تذكير بموعد الاجتماع (${reminderLabel || 'المجدول'}):`
              : isInstant
              ? 'يدعوك المضيف للانضمام إلى اجتماع فوري الآن:'
              : 'تمت دعوتك لحضور اجتماع مجدول عبر Google Meet:',
            '',
            `• موضوع الاجتماع: ${title}`,
            `• المضيف: ${hostName}`,
            `• الموعد: ${isInstant ? 'الآن فوراً (' + formattedDateTime + ')' : formattedDateTime}`,
            `• رابط الدخول (Google Meet): ${meetUrl}`,
            '',
            'تحياتنا — نظام برج مراقبة زاهي (Zahi Control Tower)',
          ].join('\n');

    const safeMinutesHtml = minutesText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    const htmlBody =
      notifyType === 'minutes'
        ? `
      <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background:#071412; color:#ffffff; padding:24px; border-radius:16px; max-width:680px; margin:auto; border:1px solid #14b8a6;">
        <h2 style="color:#5eead4; margin-top:0;">${subject}</h2>
        <p style="color:#e2e8f0; font-size:14px;">السلام عليكم ورحمة الله وبركاته،</p>
        <div style="background:#0d2622; border:1px solid rgba(94,234,212,0.3); border-radius:12px; padding:18px; margin:16px 0; line-height:1.8; font-size:14px; color:#f1f5f9;">
          ${safeMinutesHtml}
        </div>
        <hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:20px 0;" />
        <p style="font-size:11px; color:#94a3b8;">برج مراقبة زاهي — Zahi Control Tower</p>
      </div>
    `
        : `
      <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background:#071412; color:#ffffff; padding:24px; border-radius:16px; max-width:600px; margin:auto; border:1px solid #14b8a6;">
        <h2 style="color:#5eead4; margin-top:0;">${isReminder ? 'تذكير بموعد الاجتماع' : isInstant ? 'دعوة اجتماع فوري الآن' : 'دعوة اجتماع مجدول'}</h2>
        <p style="color:#e2e8f0; font-size:14px;">السلام عليكم ورحمة الله وبركاته،</p>
        <div style="background:#0d2622; border:1px solid rgba(94,234,212,0.3); border-radius:12px; padding:16px; margin:16px 0;">
          <p style="margin:6px 0;"><strong>موضوع الاجتماع:</strong> ${title}</p>
          <p style="margin:6px 0;"><strong>المضيف:</strong> ${hostName}</p>
          <p style="margin:6px 0;"><strong>الموعد:</strong> <span dir="ltr">${formattedDateTime}</span></p>
        </div>
        ${
          meetUrl
            ? `<div style="text-align:center; margin:24px 0;">
                <a href="${meetUrl}" style="display:inline-block; background:#0d9488; color:#ffffff; text-decoration:none; font-weight:bold; padding:12px 28px; border-radius:10px;">
                  الانضمام عبر Google Meet
                </a>
              </div>
              <p style="font-size:12px; color:#94a3b8; word-break:break-all;">الرابط المباشر: <a href="${meetUrl}" style="color:#5eead4;">${meetUrl}</a></p>`
            : ''
        }
        <hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:20px 0;" />
        <p style="font-size:11px; color:#94a3b8;">برج مراقبة زاهي — Zahi Control Tower</p>
      </div>
    `;

    const mailtoUrl = `mailto:${encodeURIComponent(emails.join(','))}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(plainTextBody)}`;

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      emails.join(',')
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainTextBody)}`;

    // 1. Try Resend API if RESEND_API_KEY is configured in .env
    const resendKey = (process.env.RESEND_API_KEY || '').trim();
    if (resendKey && emails.length > 0) {
      const fromEmail =
        (process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM || '').trim() ||
        'Zahi Control Tower <onboarding@resend.dev>';

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: emails,
          subject,
          html: htmlBody,
          text: plainTextBody,
        }),
      });

      if (resendRes.ok) {
        const resendData = await resendRes.json().catch(() => ({}));
        return NextResponse.json({
          success: true,
          deliveredVia: 'resend',
          emailId: resendData?.id || null,
          recipientsCount: emails.length,
          mailtoUrl,
          gmailUrl,
        });
      }
    }

    // 2. Fallback: return instant mailto + Gmail compose URLs so user can dispatch with 1 click
    return NextResponse.json({
      success: true,
      deliveredVia: 'fallback',
      recipientsCount: emails.length,
      mailtoUrl,
      gmailUrl,
      subject,
      plainTextBody,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'تعذر تجهيز إشعار الإيميل';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
