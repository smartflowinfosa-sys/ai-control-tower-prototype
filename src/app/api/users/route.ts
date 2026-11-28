import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function isMissingColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = String(err.code || '').trim();
  const msg = String(err.message || '');
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    /column .* does not exist/i.test(msg) ||
    /could not find the .* column/i.test(msg)
  );
}

const VALID_SECTION_KEYS = new Set([
  'dashboard',
  'reports_quantity',
  'reports_packaging',
  'production',
  'inventory',
  'tickets',
  'communications',
  'suppliers',
]);

function sanitizeAllowedSections(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((item) => String(item || '').trim())
        .filter((k) => VALID_SECTION_KEYS.has(k))
    )
  );
}

/**
 * GET /api/users
 * Fetches user accounts from `app_users` including safe communication metadata
 * and `allowed_sections`, excluding password hashes.
 */
export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    let { data, error } = await supabaseAdmin
      .from('app_users')
      .select(
        'id, username, role, name_ar, name_en, job_title, email, personal_meet_url, can_use_ai_minutes, allowed_sections'
      )
      .order('username', { ascending: true });

    if (error && isMissingColumnError(error)) {
      const fallback = await supabaseAdmin
        .from('app_users')
        .select('id, username, role, name_ar, name_en, job_title, email, personal_meet_url, can_use_ai_minutes')
        .order('username', { ascending: true });

      if (fallback.error && isMissingColumnError(fallback.error)) {
        const minimal = await supabaseAdmin
          .from('app_users')
          .select('id, username, role, name_ar, name_en, job_title')
          .order('username', { ascending: true });
        data = (minimal.data || []).map((u) => ({
          ...u,
          email: null,
          personal_meet_url: null,
          can_use_ai_minutes: false,
          allowed_sections: ['inventory'],
        }));
        error = minimal.error;
      } else {
        data = (fallback.data || []).map((u) => ({
          ...u,
          allowed_sections: ['inventory'],
        }));
        error = fallback.error;
      }
    }

    if (error) {
      console.error('[GET /api/users] Supabase error:', error.message);
      return NextResponse.json(
        {
          success: false,
          error: 'Database Error',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        users: data || [],
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'digest' in err &&
      typeof (err as { digest?: string }).digest === 'string' &&
      (err as { digest: string }).digest.startsWith('NEXT_')
    ) {
      throw err;
    }

    const message = err instanceof Error ? err.message : 'Unexpected server error';
    console.error('[GET /api/users] Exception:', message);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users
 * Allows any authenticated user to update their own `email` and `personal_meet_url`,
 * and allows ADMIN / SUPERADMIN to update any user's `email`, `personal_meet_url`,
 * and `can_use_ai_minutes` permission.
 */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'غير مصرح بالتعديل بدون جلسة مستخدم موثقة' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const callerRole = String(session.user.role || '').trim().toUpperCase();
    const isAdmin = callerRole === 'ADMIN' || callerRole === 'SUPERADMIN';

    // Batch update of per-user `allowed_sections` (strictly ADMIN / SUPERADMIN only)
    if (Array.isArray(body?.permissions_updates)) {
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'فقط المدير (Admin) يمكنه تعديل صلاحيات الأقسام للمستخدمين' },
          { status: 403 }
        );
      }

      const supabaseAdmin = getSupabaseAdmin();
      const results: Array<{ id: string; allowed_sections: string[] }> = [];

      for (const entry of body.permissions_updates) {
        const uid = String(entry?.id || '').trim();
        if (!uid) continue;
        const cleanSections = sanitizeAllowedSections(entry?.allowed_sections);
        const { error: updErr } = await supabaseAdmin
          .from('app_users')
          .update({ allowed_sections: cleanSections })
          .eq('id', uid);

        if (updErr) {
          return NextResponse.json(
            { success: false, error: `تعذر تحديث صلاحيات المستخدم: ${updErr.message}` },
            { status: 500 }
          );
        }
        results.push({ id: uid, allowed_sections: cleanSections });
      }

      return NextResponse.json({ success: true, updated: results });
    }

    const targetUserId = String(body?.id || '').trim();
    const targetUsername = String(body?.username || '').trim();

    if (!targetUserId && !targetUsername) {
      return NextResponse.json(
        { success: false, error: 'معرف المستخدم مطلوب للتحديث' },
        { status: 400 }
      );
    }

    const callerId = String(session.user.id || '').trim();
    const callerUsername = String(session.user.username || '').trim().toLowerCase();

    const isSelf =
      (callerId && targetUserId && callerId === targetUserId) ||
      (callerUsername && targetUsername && callerUsername === targetUsername.toLowerCase());

    if (!isAdmin && !isSelf) {
      return NextResponse.json(
        { success: false, error: 'غير مصرح لك بتعديل بيانات مستخدم آخر' },
        { status: 403 }
      );
    }

    const updatePayload: Record<string, unknown> = {};

    if (body.email !== undefined) {
      updatePayload.email = typeof body.email === 'string' ? body.email.trim() || null : null;
    }

    if (body.personal_meet_url !== undefined) {
      const rawUrl = typeof body.personal_meet_url === 'string' ? body.personal_meet_url.trim() : '';
      if (rawUrl && !/^https?:\/\/.+/i.test(rawUrl)) {
        return NextResponse.json(
          { success: false, error: 'يرجى إدخال رابط Google Meet صحيح يبدأ بـ https://' },
          { status: 400 }
        );
      }
      updatePayload.personal_meet_url = rawUrl || null;
    }

    if (body.can_use_ai_minutes !== undefined) {
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'فقط المدير (Admin) يمكنه تعديل صلاحية محضر الاجتماع الذكي' },
          { status: 403 }
        );
      }
      updatePayload.can_use_ai_minutes = Boolean(body.can_use_ai_minutes);
    }

    if (body.allowed_sections !== undefined) {
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'فقط المدير (Admin) يمكنه تعديل صلاحيات الأقسام للمستخدمين' },
          { status: 403 }
        );
      }
      updatePayload.allowed_sections = sanitizeAllowedSections(body.allowed_sections);
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { success: false, error: 'لا توجد بيانات لتحديثها' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin.from('app_users').update(updatePayload);
    if (targetUserId) {
      query = query.eq('id', targetUserId);
    } else {
      query = query.eq('username', targetUsername);
    }

    const { data, error } = await query
      .select(
        'id, username, role, name_ar, name_en, job_title, email, personal_meet_url, can_use_ai_minutes, allowed_sections'
      )
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error)) {
        return NextResponse.json({
          success: true,
          schema_migration_pending: true,
          user: {
            id: targetUserId || targetUsername,
            username: targetUsername,
            ...updatePayload,
          },
        });
      }
      return NextResponse.json(
        { success: false, error: `تعذر تحديث بيانات المستخدم: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'تعذر تحديث بيانات المستخدم';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
