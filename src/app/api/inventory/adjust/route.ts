import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'بيانات الطلب غير صالحة' },
        { status: 400 }
      );
    }

    let { item_code, adjustment_type, quantity, reason, notes } = body;

    // Validate item_code
    item_code = typeof item_code === 'string' ? item_code.trim().toUpperCase() : '';
    if (!item_code) {
      return NextResponse.json(
        { success: false, error: 'يرجى تحديد رمز الصنف (item_code)' },
        { status: 400 }
      );
    }

    // Normalize and validate adjustment_type
    const rawType = typeof adjustment_type === 'string' ? adjustment_type.trim().toLowerCase() : '';
    let normalizedType: 'add' | 'deduct';
    if (rawType === 'add' || rawType === 'إضافة' || rawType === 'إضافة رصيد') {
      normalizedType = 'add';
    } else if (rawType === 'deduct' || rawType === 'خصم' || rawType === 'خصم رصيد') {
      normalizedType = 'deduct';
    } else {
      return NextResponse.json(
        { success: false, error: 'نوع التسوية غير صالح (يجب أن يكون إضافة أو خصم)' },
        { status: 400 }
      );
    }

    // Validate quantity (must be a positive number > 0)
    const numQuantity = Number(quantity);
    if (!Number.isFinite(numQuantity) || numQuantity <= 0) {
      return NextResponse.json(
        { success: false, error: 'الكمية يجب أن تكون رقماً موجباً أكبر من صفر' },
        { status: 400 }
      );
    }

    // Validate reason
    reason = typeof reason === 'string' ? reason.trim() : '';
    if (!reason) {
      return NextResponse.json(
        { success: false, error: 'يرجى تحديد سبب التسوية' },
        { status: 400 }
      );
    }

    // Notes (optional)
    notes = typeof notes === 'string' ? notes.trim() : '';

    const supabaseAdmin = getSupabaseAdmin();

    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('process_manual_adjustment', {
      p_adj_type: normalizedType,
      p_item_code: item_code,
      p_quantity: Math.floor(numQuantity),
      p_reason: reason,
      p_notes: notes,
    });

    if (rpcError) {
      console.error('[POST /api/inventory/adjust] RPC error:', rpcError);
      return NextResponse.json(
        {
          success: false,
          error: rpcError.message || 'حدث خطأ أثناء تنفيذ التسوية المخزنية في قاعدة البيانات',
        },
        { status: 400 }
      );
    }

    // Fetch the updated item stock to return to caller
    const { data: updatedItem } = await supabaseAdmin
      .from('inventory_items')
      .select('item_code, item_name_ar, current_stock')
      .eq('item_code', item_code)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      message: `تمت تسوية رصيد الصنف (${item_code}) بنجاح`,
      data: {
        item_code,
        adjustment_type: normalizedType,
        quantity: Math.floor(numQuantity),
        reason,
        notes,
        updatedItem,
        rpcData,
      },
    });
  } catch (error: unknown) {
    console.error('[POST /api/inventory/adjust] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع في الخادم';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

