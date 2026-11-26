import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createPurchaseOrderServer, fetchPurchaseOrdersServer } from '@/lib/purchaseOrdersServer';
import { sanitizeCreatorName } from '@/lib/poAuth';

export async function GET() {
  try {
    const purchaseOrders = await fetchPurchaseOrdersServer();
    return NextResponse.json({ purchaseOrders });
  } catch (error: unknown) {
    console.error('[GET /api/purchase-orders] Error:', error);
    const message = error instanceof Error ? error.message : 'تعذر جلب أوامر الشراء';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (!session.user.id && !session.user.username)) {
      return NextResponse.json(
        { error: 'غير مصرح بإنشاء أمر شراء بدون جلسة مستخدم موثقة' },
        { status: 401 }
      );
    }

    let userId = session.user.id ? String(session.user.id).trim() : '';
    let fallbackName = sanitizeCreatorName(
      session.user.name_en || session.user.name_ar || session.user.name || session.user.username
    );

    if (!userId && session.user.username) {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: dbUser } = await supabaseAdmin
        .from('app_users')
        .select('id, name_en, name_ar')
        .eq('username', session.user.username)
        .maybeSingle();
      if (dbUser?.id) {
        userId = String(dbUser.id);
        fallbackName = sanitizeCreatorName(dbUser.name_en || dbUser.name_ar || fallbackName);
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'تعذر التحقق من معرف المستخدم (user.id)' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { po_number, supplier_id, inventory_item_code, quantity, total_cost, status } = body || {};

    if (!inventory_item_code || !quantity || Number(quantity) <= 0) {
      return NextResponse.json(
        { error: 'بيانات أمر الشراء غير مكتملة' },
        { status: 400 }
      );
    }

    const purchaseOrder = await createPurchaseOrderServer(
      {
        po_number,
        supplier_id,
        inventory_item_code: String(inventory_item_code),
        quantity: Number(quantity),
        total_cost: Number(total_cost) || 0,
        status,
      },
      userId,
      fallbackName
    );

    revalidateTag('purchase-orders', 'max');
    return NextResponse.json({ purchaseOrder });
  } catch (error: unknown) {
    console.error('[POST /api/purchase-orders] Error:', error);
    const message = error instanceof Error ? error.message : 'تعذر حفظ أمر الشراء';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'غير مصرح بتعديل أمر الشراء بدون جلسة مستخدم موثقة' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const poNumber = String(body?.po_number || body?.id || '').trim();
    if (!poNumber) {
      return NextResponse.json({ error: 'رقم أمر الشراء مطلوب للتعديل' }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {};
    if (body.quantity !== undefined && Number.isFinite(Number(body.quantity))) {
      updatePayload.quantity = Math.max(1, Math.round(Number(body.quantity)));
    }
    if (body.total_cost !== undefined && Number.isFinite(Number(body.total_cost))) {
      updatePayload.total_cost = Number(Number(body.total_cost).toFixed(4));
    }
    if (body.supplier_id !== undefined) {
      updatePayload.supplier_id = body.supplier_id || null;
    }
    if (body.status !== undefined && typeof body.status === 'string' && body.status.trim()) {
      updatePayload.status = body.status.trim();
    }
    if (body.receiver_signature !== undefined && typeof body.receiver_signature === 'string') {
      updatePayload.receiver_signature = body.receiver_signature.trim() || null;
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .update(updatePayload)
      .eq('po_number', poNumber)
      .select('*')
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: `تعذر تحديث أمر الشراء في قاعدة البيانات: ${error.message}` },
        { status: 500 }
      );
    }

    // Best-effort update of received_at if the column exists in public.purchase_orders
    if (body.received_at !== undefined && typeof body.received_at === 'string' && body.received_at.trim()) {
      await supabaseAdmin
        .from('purchase_orders')
        .update({ received_at: body.received_at.trim() })
        .eq('po_number', poNumber)
        .then(() => undefined, () => undefined);
    }

    revalidateTag('purchase-orders', 'max');
    return NextResponse.json({ success: true, purchaseOrder: data });
  } catch (error: unknown) {
    console.error('[PATCH /api/purchase-orders] Error:', error);
    const message = error instanceof Error ? error.message : 'تعذر تعديل أمر الشراء';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'غير مصرح بحذف أمر الشراء بدون جلسة مستخدم موثقة' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    let poNumber = (searchParams.get('po_number') || '').trim();
    if (!poNumber) {
      const body = await req.json().catch(() => null);
      poNumber = String(body?.po_number || body?.id || '').trim();
    }

    if (!poNumber) {
      return NextResponse.json({ error: 'رقم أمر الشراء مطلوب للحذف' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from('purchase_orders')
      .delete()
      .eq('po_number', poNumber);

    if (error) {
      return NextResponse.json(
        { error: `تعذر حذف أمر الشراء من قاعدة البيانات: ${error.message}` },
        { status: 500 }
      );
    }

    revalidateTag('purchase-orders', 'max');
    return NextResponse.json({ success: true, deletedPoNumber: poNumber });
  } catch (error: unknown) {
    console.error('[DELETE /api/purchase-orders] Error:', error);
    const message = error instanceof Error ? error.message : 'تعذر حذف أمر الشراء';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

