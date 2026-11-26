import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'غير مصرح بتعديل أسعار الموردين بدون جلسة مستخدم موثقة' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    const supplierId = typeof body?.supplier_id === 'string' ? body.supplier_id.trim() : '';
    const itemCode = typeof body?.item_code === 'string' ? body.item_code.trim().toUpperCase() : '';
    const rawPrice = parseFloat(String(body?.price ?? ''));

    if ((!id && (!supplierId || !itemCode)) || isNaN(rawPrice) || rawPrice < 0) {
      return NextResponse.json(
        { error: 'بيانات تعديل السعر غير صالحة' },
        { status: 400 }
      );
    }

    const parsedPrice = Number(rawPrice.toFixed(4));
    const supabaseAdmin = getSupabaseAdmin();

    let query = supabaseAdmin
      .from('supplier_items')
      .update({ price: parsedPrice });

    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('supplier_id', supplierId).eq('inventory_item_code', itemCode);
    }

    const { data, error } = await query.select('*').maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: `تعذر تحديث السعر في قاعدة البيانات: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, item: data, price: parsedPrice });
  } catch (error: unknown) {
    console.error('[PATCH /api/suppliers/items] Error:', error);
    const message = error instanceof Error ? error.message : 'تعذر تعديل سعر الصنف';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'غير مصرح بحذف أصناف المورد بدون جلسة مستخدم موثقة' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    let id = (searchParams.get('id') || '').trim();
    let supplierId = (searchParams.get('supplier_id') || '').trim();
    let itemCode = (searchParams.get('item_code') || '').trim().toUpperCase();

    if (!id && (!supplierId || !itemCode)) {
      const body = await req.json().catch(() => null);
      id = String(body?.id || '').trim();
      supplierId = String(body?.supplier_id || '').trim();
      itemCode = String(body?.item_code || '').trim().toUpperCase();
    }

    if (!id && (!supplierId || !itemCode)) {
      return NextResponse.json(
        { error: 'معرف الصنف أو المورد مطلوب للحذف' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin.from('supplier_items').delete();

    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('supplier_id', supplierId).eq('inventory_item_code', itemCode);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json(
        { error: `تعذر حذف الصنف من قائمة المورد: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[DELETE /api/suppliers/items] Error:', error);
    const message = error instanceof Error ? error.message : 'تعذر حذف الصنف من المورد';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
