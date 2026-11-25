import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { CARTON_SIZES } from '@/constants/inventoryCodes';

const ALLOWED_ROLES = new Set(['ADMIN', 'SUPERADMIN', 'INVENTORY', 'STAFF']);

interface ReceiveItemInput {
  item_code?: unknown;
  itemCode?: unknown;
  cartons?: unknown;
  quantityCartons?: unknown;
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
    user.username || user.name_ar || user.name_en || user.name || 'أيمن'
  ).trim();

  if (role && !ALLOWED_ROLES.has(role)) {
    return { authorized: false, actorName, role };
  }

  return { authorized: true, actorName, role };
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions).catch(() => null)) as
      | { user?: Record<string, unknown> }
      | null;
    const actor = getSessionActor(session);

    if (!actor.authorized) {
      return NextResponse.json(
        { error: 'غير مصرح لك باستلام المخزون. يرجى تسجيل الدخول أولاً.' },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'صيغة البيانات المرسلة غير صالحة.' }, { status: 400 });
    }

    const mode = body.mode === 'po' ? 'po' : 'direct';
    const poNumber = typeof body.po_number === 'string' ? body.po_number.trim() : '';
    const supplierName = typeof body.supplier_name === 'string' ? body.supplier_name.trim() : '';
    const invoiceNumber =
      typeof body.invoice_number === 'string' ? body.invoice_number.trim() : '';
    const extraNotes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const receiverSignature =
      typeof body.receiver_signature === 'string' ? body.receiver_signature.trim() : '';
    const invoiceUrl = typeof body.invoice_url === 'string' ? body.invoice_url.trim() : '';

    const rawItems = Array.isArray(body.items) ? (body.items as ReceiveItemInput[]) : [];

    const validInputs = rawItems
      .map((row) => {
        const code = String(row.item_code ?? row.itemCode ?? '')
          .trim()
          .toUpperCase();
        const rawCartons = row.cartons !== undefined ? row.cartons : row.quantityCartons;
        const cartons = Number(rawCartons);
        return { code, cartons };
      })
      .filter((row) => row.code && Number.isFinite(row.cartons) && row.cartons > 0);

    if (validInputs.length === 0) {
      return NextResponse.json(
        { error: 'يرجى إدخال كمية مستلمة (بالكرتون) أكبر من الصفر لصنف واحد على الأقل.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const itemCodes = Array.from(new Set(validInputs.map((i) => i.code)));

    const { data: dbItems, error: fetchError } = await supabaseAdmin
      .from('inventory_items')
      .select('item_code, item_name_ar, main_stock, production_stock, current_stock, units_per_carton')
      .in('item_code', itemCodes);

    if (fetchError) {
      return NextResponse.json(
        { error: `تعذر جلب بيانات الأصناف من قاعدة البيانات: ${fetchError.message}` },
        { status: 500 }
      );
    }

    const dbMap = new Map<
      string,
      {
        item_code: string;
        item_name_ar: string;
        main_stock: number;
        production_stock: number;
        current_stock: number;
        units_per_carton: number;
      }
    >();

    for (const row of dbItems || []) {
      const cUpper = String(row.item_code || '').trim().toUpperCase();
      if (!cUpper) continue;
      dbMap.set(cUpper, {
        item_code: row.item_code,
        item_name_ar: String(row.item_name_ar || cUpper),
        main_stock:
          row.main_stock !== null && row.main_stock !== undefined
            ? Number(row.main_stock)
            : Number(row.current_stock ?? 0),
        production_stock: Number(row.production_stock ?? 0),
        current_stock: Number(row.current_stock ?? 0),
        units_per_carton:
          row.units_per_carton !== null &&
          row.units_per_carton !== undefined &&
          Number(row.units_per_carton) > 0
            ? Number(row.units_per_carton)
            : (CARTON_SIZES[cUpper] || 1),
      });
    }

    // Aggregate cartons if the same item code appears multiple times in the payload
    const aggregatedCartons = new Map<string, number>();
    for (const entry of validInputs) {
      aggregatedCartons.set(entry.code, (aggregatedCartons.get(entry.code) || 0) + entry.cartons);
    }

    const updatedItems: Array<{
      item_code: string;
      cartons_received: number;
      units_per_carton: number;
      incoming_units: number;
      main_stock_before: number;
      main_stock: number;
      production_stock: number;
      current_stock: number;
    }> = [];

    const adjustmentLogRows: Array<{
      item_code: string;
      adjustment_type: 'add';
      quantity: number;
      reason: string;
      notes: string;
      reference_id: string | null;
      employee_name: string;
    }> = [];

    for (const [code, totalCartons] of aggregatedCartons.entries()) {
      const dbItem = dbMap.get(code);
      if (!dbItem) {
        return NextResponse.json(
          { error: `لم يتم العثور على الصنف (${code}) في جدول المخزون.` },
          { status: 404 }
        );
      }

      const unitsPerCarton = dbItem.units_per_carton;
      const incomingUnits = Math.round(totalCartons * unitsPerCarton);
      const mainBefore = dbItem.main_stock;
      const existingProd = dbItem.production_stock;

      // ADDITION (+): add incoming_units to main_stock and recalculate current_stock without modifying production_stock
      const newMainStock = mainBefore + incomingUnits;
      const newCurrentStock = newMainStock + existingProd;

      const { error: updateError } = await supabaseAdmin
        .from('inventory_items')
        .update({
          main_stock: newMainStock,
          current_stock: newCurrentStock,
        })
        .eq('item_code', dbItem.item_code);

      if (updateError) {
        return NextResponse.json(
          { error: `فشل تحديث رصيد الصنف (${code}): ${updateError.message}` },
          { status: 500 }
        );
      }

      updatedItems.push({
        item_code: code,
        cartons_received: totalCartons,
        units_per_carton: unitsPerCarton,
        incoming_units: incomingUnits,
        main_stock_before: mainBefore,
        main_stock: newMainStock,
        production_stock: existingProd,
        current_stock: newCurrentStock,
      });

      const noteParts: string[] = [
        `استلام ${totalCartons} كرتون (× ${unitsPerCarton} = +${incomingUnits} وحدة للمخزون الرئيسي)`,
      ];
      if (supplierName) noteParts.push(`المورد: ${supplierName}`);
      if (invoiceNumber) noteParts.push(`فاتورة/مرجع: ${invoiceNumber}`);
      if (poNumber) noteParts.push(`أمر شراء: ${poNumber}`);
      if (extraNotes) noteParts.push(`ملاحظات: ${extraNotes}`);

      adjustmentLogRows.push({
        item_code: code,
        adjustment_type: 'add',
        quantity: incomingUnits,
        reason: mode === 'po' && poNumber ? 'استلام أمر شراء' : 'استلام مخزون مباشر',
        notes: noteParts.join(' | '),
        reference_id: invoiceNumber || poNumber || null,
        employee_name: receiverSignature || actor.actorName || 'أيمن',
      });
    }

    // Record receipt transactions in manual_adjustments_log so they appear in تقرير التعديلات
    if (adjustmentLogRows.length > 0) {
      const { error: logErr } = await supabaseAdmin
        .from('manual_adjustments_log')
        .insert(adjustmentLogRows);

      if (logErr) {
        console.warn('[POST /api/inventory/receive] Failed to insert into manual_adjustments_log:', logErr.message);
      }
    }

    // If linked to an existing Purchase Order, mark PO as received
    if (mode === 'po' && poNumber) {
      try {
        await supabaseAdmin
          .from('purchase_orders')
          .update({
            status: 'تم الاستلام',
            receiver_signature: receiverSignature || actor.actorName || null,
            invoice_url: invoiceUrl || null,
          })
          .eq('po_number', poNumber);
      } catch (poErr) {
        console.warn('[POST /api/inventory/receive] Failed to update purchase_orders status:', poErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        mode,
        updatedItems,
        message:
          updatedItems.length === 1
            ? `تم استلام وإضافة +${updatedItems[0].incoming_units} وحدة (${updatedItems[0].cartons_received} كرتون) للصنف ${updatedItems[0].item_code} في المخزون الرئيسي بنجاح ✅`
            : `تم استلام المخزون وإضافة الكميات لعدد (${updatedItems.length}) أصناف في المخزون الرئيسي بنجاح ✅`,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء استلام المخزون.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
