import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function isMissingTableOrCol(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = String(err.code || '').trim();
  const msg = String(err.message || '');
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    /relation .* does not exist/i.test(msg) ||
    /could not find the table/i.test(msg)
  );
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('team_meetings')
      .select('*')
      .order('scheduled_at', { ascending: false })
      .limit(100);

    if (error) {
      if (isMissingTableOrCol(error)) {
        return NextResponse.json({ meetings: [], schema_migration_pending: true });
      }
      return NextResponse.json(
        { error: `تعذر جلب سجل الاجتماعات: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ meetings: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'تعذر جلب الاجتماعات';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'غير مصرح بإنشاء اجتماع بدون جلسة مستخدم موثقة' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || '').trim();
    const meetUrl = String(body?.meet_url || '').trim();
    const isInstant = Boolean(body?.is_instant);
    const scheduledAt =
      isInstant || !body?.scheduled_at
        ? new Date().toISOString()
        : new Date(String(body.scheduled_at)).toISOString();

    if (!title) {
      return NextResponse.json({ error: 'يرجى إدخال موضوع الاجتماع' }, { status: 400 });
    }
    if (!meetUrl || !/^https?:\/\/.+/i.test(meetUrl)) {
      return NextResponse.json(
        { error: 'يجب حفظ رابط Google Meet الدائم الخاص بك أولاً قبل بدء أو جدولة الاجتماع' },
        { status: 400 }
      );
    }

    const participantIds = Array.isArray(body?.participant_ids)
      ? body.participant_ids.map((v: unknown) => String(v || '').trim()).filter(Boolean)
      : [];
    const participantNames = Array.isArray(body?.participant_names)
      ? body.participant_names.map((v: unknown) => String(v || '').trim()).filter(Boolean)
      : [];
    const participantEmails = Array.isArray(body?.participant_emails)
      ? body.participant_emails.map((v: unknown) => String(v || '').trim()).filter(Boolean)
      : [];
    const reminderMinutes = Array.isArray(body?.reminder_minutes)
      ? body.reminder_minutes
          .map((v: unknown) => Number(v))
          .filter((n: number) => Number.isFinite(n) && n > 0)
      : [];

    const hostId = String(body?.host_id || session.user.id || session.user.username || 'host').trim();
    const hostName = String(
      body?.host_name || session.user.name_ar || session.user.name || session.user.username || 'المضيف'
    ).trim();
    const hostEmail = typeof body?.host_email === 'string' ? body.host_email.trim() || null : null;

    const payload = {
      title,
      host_id: hostId,
      host_name: hostName,
      host_email: hostEmail,
      meet_url: meetUrl,
      participant_ids: participantIds,
      participant_names: participantNames,
      participant_emails: participantEmails,
      is_instant: isInstant,
      scheduled_at: scheduledAt,
      status: isInstant ? 'active' : 'scheduled',
      reminder_minutes: isInstant ? [] : reminderMinutes,
      sent_reminders: [] as number[],
    };

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('team_meetings')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      if (isMissingTableOrCol(error)) {
        return NextResponse.json({
          success: true,
          schema_migration_pending: true,
          meeting: {
            id: `local-meet-${Date.now()}`,
            ...payload,
            created_at: new Date().toISOString(),
          },
        });
      }
      return NextResponse.json(
        { error: `تعذر حفظ الاجتماع في قاعدة البيانات: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, meeting: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'تعذر إنشاء الاجتماع';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'غير مصرح بتحديث الاجتماع بدون جلسة مستخدم موثقة' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'معرف الاجتماع مطلوب للتحديث' }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.status === 'string' && ['scheduled', 'active', 'completed', 'cancelled'].includes(body.status)) {
      updatePayload.status = body.status;
    }
    if (Array.isArray(body.sent_reminders)) {
      updatePayload.sent_reminders = body.sent_reminders
        .map((n: unknown) => Number(n))
        .filter((n: number) => Number.isFinite(n));
    }
    if (body.ai_transcript !== undefined) {
      updatePayload.ai_transcript = typeof body.ai_transcript === 'string' ? body.ai_transcript : null;
    }
    if (body.ai_minutes !== undefined) {
      updatePayload.ai_minutes = typeof body.ai_minutes === 'string' ? body.ai_minutes : null;
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('team_meetings')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      if (isMissingTableOrCol(error)) {
        return NextResponse.json({
          success: true,
          schema_migration_pending: true,
          meeting: { id, ...updatePayload },
        });
      }
      return NextResponse.json(
        { error: `تعذر تحديث الاجتماع: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, meeting: data || { id, ...updatePayload } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'تعذر تحديث الاجتماع';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'غير مصرح بحذف الاجتماع بدون جلسة مستخدم موثقة' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = (searchParams.get('id') || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'معرف الاجتماع مطلوب للحذف' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.from('team_meetings').delete().eq('id', id);

    if (error && !isMissingTableOrCol(error)) {
      return NextResponse.json(
        { error: `تعذر حذف الاجتماع: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'تعذر حذف الاجتماع';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
