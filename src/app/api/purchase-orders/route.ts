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

