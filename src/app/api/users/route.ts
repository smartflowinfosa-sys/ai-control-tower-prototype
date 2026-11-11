import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/users
 * Dynamically fetches user accounts from `app_users` (specifically the `username` column
 * and safe profile metadata, excluding password hashes).
 */
export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('app_users')
      .select('id, username, role, name_ar, name_en, job_title')
      .order('username', { ascending: true });

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

