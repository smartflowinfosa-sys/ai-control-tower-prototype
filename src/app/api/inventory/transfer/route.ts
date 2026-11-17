import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { CARTON_SIZES } from '@/constants/inventoryCodes';

const ALLOWED_DESTINATIONS = new Set(['production_stock']);
const ALLOWED_ROLES = new Set(['ADMIN', 'SUPERADMIN', 'INVENTORY', 'STAFF']);

interface TransferRequestBody {
  item_code?: unknown;
  quantity_cartons?: unknown;
  destination?: unknown;
  notes?: unknown;
}

function getSessionActor(session: { user?: Record<string, unknown> } | null): {
  authorized: boolean;
  actorName: string;
  role: string;
} {
  if (!session?.user) {
    return { authorized: false, actorName: '', role: '' };
  }

  const user = session.user;
  const role = String(user.role || '').trim().toUpperCase();
  const actorName = String(
    user.username || user.name_ar || user.name_en || user.name || 'warehouse_manager'
  ).trim();

  if (role && !ALLOWED_ROLES.has(role)) {
    return { authorized: false, actorName, role };
  }

  return { authorized: true, actorName, role };
}

function isMissingFunctionError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.code === 'PGRST202' ||
    err.code === '42883' ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist')
  );
}

export async function GET() {
  try {
    const session = (await getServerSession(authOptions).catch(() => null)) as
      | { user?: Record<string, unknown> }
      | null;
    const actor = getSessionActor(session);
    if (!actor.authorized) {
      return NextResponse.json(
        { error: 'غير مصرح لك بعرض سجل التحويلات الداخلية.' },
        { status: 401 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('internal_transfers_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { error: `تعذر جلب سجل التحويلات الداخلية: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions).catch(() => null)) as
      | { user?: Record<string, unknown> }
      | null;
    const actor = getSessionActor(session);

    if (!actor.authorized) {
      return NextResponse.json(
        { error: 'غير مصرح لك بإجراء عمليات نقل المخزون. يرجى تسجيل الدخول أولاً.' },
        { status: 401 }
      );
    }

    let body: TransferRequestBody;
    try {
      body = (await req.json()) as TransferRequestBody;
    } catch {
      return NextResponse.json({ error: 'صيغة البيانات المرسلة غير صالحة.' }, { status: 400 });
    }

    const itemCode = typeof body.item_code === 'string' ? body.item_code.trim().toUpperCase() : '';
    const rawCartons = Number(body.quantity_cartons);
    const destination =
      typeof body.destination === 'string' ? body.destination.trim().toLowerCase() : 'production_stock';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    if (!itemCode) {
      return NextResponse.json({ error: 'يرجى اختيار الصنف المراد نقله.' }, { status: 400 });
    }

    if (!Number.isFinite(rawCartons) || !Number.isInteger(rawCartons) || rawCartons <= 0) {
      return NextResponse.json(
        { error: 'يرجى إدخال عدد كراتين صحيح أكبر من الصفر.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_DESTINATIONS.has(destination)) {
      return NextResponse.json(
        { error: `الوجهة المستهدفة غير مدعومة: ${destination}` },
        { status: 400 }
      );
    }

    const unitsPerCarton = CARTON_SIZES[itemCode] || 1;
    const quantityUnits = rawCartons * unitsPerCarton;
    const supabaseAdmin = getSupabaseAdmin();

    // Try atomic PostgreSQL RPC first
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      'process_internal_inventory_transfer',
      {
        p_item_code: itemCode,
        p_quantity_cartons: rawCartons,
        p_units_per_carton: unitsPerCarton,
        p_destination: destination,
        p_transferred_by: actor.actorName,
        p_notes: notes || null,
      }
    );

    if (!rpcError && rpcData) {
      const { data: refreshedItem } = await supabaseAdmin
        .from('inventory_items')
        .select('item_code, item_name_ar, item_name_en, current_stock, main_stock, production_stock')
        .eq('item_code', itemCode)
        .maybeSingle();

      return NextResponse.json(
        {
          success: true,
          item: refreshedItem || {
            item_code: itemCode,
            main_stock: rpcData.main_stock_after,
            production_stock: rpcData.production_stock_after,
          },
          transfer: rpcData,
          message: `تم نقل ${rawCartons} كرتون (${quantityUnits} وحدة) من المخزون الرئيسي إلى مخزون الإنتاج بنجاح.`,
        },
        { status: 200 }
      );
    }

    // If RPC returned a domain validation error (not a missing function error), surface it directly
    if (rpcError && !isMissingFunctionError(rpcError)) {
      const msg = rpcError.message || 'تعذر تنفيذ عملية نقل المخزون.';
      const status = msg.toLowerCase().includes('insufficient') ? 400 : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    // Fallback when RPC is not yet deployed: optimistic update + internal_transfers_log insert with rollback
    const { data: existingItem, error: fetchError } = await supabaseAdmin
      .from('inventory_items')
      .select('item_code, item_name_ar, item_name_en, current_stock, main_stock, production_stock')
      .eq('item_code', itemCode)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        {
          error: `تعذر قراءة أرصدة الصنف من قاعدة البيانات (${fetchError.message}). تأكد من تطبيق ترحيل قاعدة البيانات الخاص بأعمدة main_stock و production_stock.`,
        },
        { status: 500 }
      );
    }

    if (!existingItem) {
      return NextResponse.json(
        { error: `لم يتم العثور على الصنف (${itemCode}) في جدول المخزون.` },
        { status: 404 }
      );
    }

    const mainBefore = Number(existingItem.main_stock ?? 0);
    const prodBefore = Number(existingItem.production_stock ?? 0);

    if (mainBefore < quantityUnits) {
      return NextResponse.json(
        {
          error: `الرصيد المتاح في المخزون الرئيسي (${mainBefore} وحدة) غير كافٍ لنقل ${quantityUnits} وحدة (${rawCartons} كرتون).`,
        },
        { status: 400 }
      );
    }

    const mainAfter = mainBefore - quantityUnits;
    const prodAfter = prodBefore + quantityUnits;

    const { data: updatedItem, error: updateError } = await supabaseAdmin
      .from('inventory_items')
      .update({
        main_stock: mainAfter,
        production_stock: prodAfter,
      })
      .eq('item_code', itemCode)
      .eq('main_stock', mainBefore)
      .select('item_code, item_name_ar, item_name_en, current_stock, main_stock, production_stock')
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { error: `فشل تحديث أرصدة المخزون للصنف (${itemCode}): ${updateError.message}` },
        { status: 500 }
      );
    }

    if (!updatedItem) {
      return NextResponse.json(
        { error: 'تم تعديل رصيد المخزون من عملية أخرى متزامنة. يرجى المحاولة مرة أخرى.' },
        { status: 409 }
      );
    }

    const { data: logRow, error: logError } = await supabaseAdmin
      .from('internal_transfers_log')
      .insert({
        item_code: itemCode,
        quantity_cartons: rawCartons,
        units_per_carton: unitsPerCarton,
        quantity_units: quantityUnits,
        destination,
        main_stock_before: mainBefore,
        main_stock_after: mainAfter,
        production_stock_before: prodBefore,
        production_stock_after: prodAfter,
        transferred_by: actor.actorName,
        notes: notes || null,
      })
      .select('*')
      .single();

    if (logError) {
      // Roll back balance update so inventory_items and internal_transfers_log remain consistent
      await supabaseAdmin
        .from('inventory_items')
        .update({
          main_stock: mainBefore,
          production_stock: prodBefore,
        })
        .eq('item_code', itemCode);

      return NextResponse.json(
        {
          error: `فشل تسجيل عملية النقل في جدول internal_transfers_log: ${logError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        item: updatedItem,
        transfer: logRow,
        message: `تم نقل ${rawCartons} كرتون (${quantityUnits} وحدة) من المخزون الرئيسي إلى مخزون الإنتاج بنجاح.`,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء نقل المخزون.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
