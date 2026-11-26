import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'غير مصرح بتحديث بنود الاتفاق بدون جلسة مستخدم موثقة' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const supplierId = String(body?.supplier_id || body?.id || '').trim();
    if (!supplierId) {
      return NextResponse.json({ error: 'معرف المورد مطلوب لتحديث بنود الاتفاق' }, { status: 400 });
    }

    const updatedAt =
      typeof body?.agreement_updated_at === 'string' && body.agreement_updated_at.trim()
        ? body.agreement_updated_at.trim()
        : new Date().toISOString();
    const updatedBy =
      typeof body?.agreement_updated_by === 'string' && body.agreement_updated_by.trim()
        ? body.agreement_updated_by.trim()
        : String(session.user.name || session.user.email || 'مدير المشتريات');

    const payload = {
      agreement_payment_terms:
        body?.agreement_payment_terms !== undefined
          ? String(body.agreement_payment_terms || '').trim() || null
          : null,
      agreement_delivery_terms:
        body?.agreement_delivery_terms !== undefined
          ? String(body.agreement_delivery_terms || '').trim() || null
          : null,
      agreement_notes:
        body?.agreement_notes !== undefined
          ? String(body.agreement_notes || '').trim() || null
          : null,
      agreement_updated_at: updatedAt,
      agreement_updated_by: updatedBy,
    };

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .update(payload)
      .eq('id', supplierId)
      .select('*')
      .maybeSingle();

    if (error) {
      // If schema migration hasn't been applied in Supabase yet, return clean payload with schema_migration_pending flag
      const isMissingCol =
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        /column .* does not exist/i.test(error.message) ||
        /could not find the .* column/i.test(error.message);

      if (isMissingCol) {
        return NextResponse.json({
          success: true,
          schema_migration_pending: true,
          agreement: { id: supplierId, ...payload },
        });
      }

      return NextResponse.json(
        { error: `تعذر تحديث بنود الاتفاق في قاعدة البيانات: ${error.message}` },
        { status: 500 }
      );
    }

    revalidateTag('suppliers', 'max');
    return NextResponse.json({
      success: true,
      supplier: data || { id: supplierId, ...payload },
    });
  } catch (error: unknown) {
    console.error('[PATCH /api/suppliers/agreement] Error:', error);
    const message = error instanceof Error ? error.message : 'تعذر تحديث بنود الاتفاق للمورد';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
