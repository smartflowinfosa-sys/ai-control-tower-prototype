import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { CARTON_SIZES } from '@/constants/inventoryCodes';

const ALLOWED_ROLES = new Set(['ADMIN', 'SUPERADMIN', 'INVENTORY', 'STAFF']);

export interface InventoryCountItemPayload {
  code: string;
  item_code: string;
  name: string;
  item_name_ar: string;
  cartons: number;
  carton_count: number;
  units_per_carton: number;
  actual_units: number;
  total_units: number;
  system_stock_before: number;
  system_stock: number;
  variance: number;
}

function getSessionActor(session: { user?: Record<string, unknown> } | null): {
  authorized: boolean;
  username: string;
  role: string;
} {
  if (!session?.user) {
    return { authorized: false, username: '', role: '' };
  }

  const user = session.user;
  const role = String(user.role || '').trim().toUpperCase();
  const username = String(user.username || user.name || '').trim();

  if (role && !ALLOWED_ROLES.has(role)) {
    return { authorized: false, username, role };
  }

  return { authorized: true, username, role };
}

export async function GET() {
  try {
    const session = (await getServerSession(authOptions).catch(() => null)) as
      | { user?: Record<string, unknown> }
      | null;
    const actor = getSessionActor(session);

    if (!actor.authorized) {
      return NextResponse.json(
        { error: 'غير مصرح لك بعرض سجل الجرد الإلكتروني.' },
        { status: 401 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('inventory_counts')
      .select('*')
      .order('count_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { error: `تعذر جلب سجل الجرد الإلكتروني: ${error.message}` },
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
        { error: 'غير مصرح لك بحفظ الجرد الإلكتروني. يرجى تسجيل الدخول أولاً.' },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'صيغة البيانات المرسلة غير صالحة.' }, { status: 400 });
    }

    const rawDate = typeof body.count_date === 'string' ? body.count_date.trim() : '';
    const countDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : new Date().toISOString().split('T')[0];

    // Restricted strictly to Main Inventory and fixed keeper 'أيمن'
    const keeperName = 'أيمن';
    const warehouseSection = 'المخزون الرئيسي';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    if (!Array.isArray(body.items_data) || body.items_data.length === 0) {
      return NextResponse.json(
        { error: 'يرجى إدخال بيانات الجرد للأصناف قبل الحفظ.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Capture pre-count system balances from public.inventory_items BEFORE updating
    const { data: liveDbItems, error: fetchError } = await supabaseAdmin
      .from('inventory_items')
      .select('item_code, item_name_ar, main_stock, production_stock, current_stock, units_per_carton');

    if (fetchError) {
      return NextResponse.json(
        { error: `تعذر قراءة أرصدة النظام الحالية قبل الجرد: ${fetchError.message}` },
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

    for (const row of liveDbItems || []) {
      const codeUpper = String(row.item_code || '').trim().toUpperCase();
      if (!codeUpper) continue;
      dbMap.set(codeUpper, {
        item_code: row.item_code,
        item_name_ar: String(row.item_name_ar || codeUpper),
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
            : (CARTON_SIZES[codeUpper] || 1),
      });
    }

    // 2. Calculate variance = actual_counted_units - system_stock_before
    const reconciledItems: InventoryCountItemPayload[] = [];
    const balanceUpdates: Array<{
      dbItemCode: string;
      codeUpper: string;
      newMainStock: number;
      newCurrentStock: number;
    }> = [];

    for (const rawItem of body.items_data) {
      const rec = (rawItem || {}) as Record<string, unknown>;
      const code = String(rec.item_code || rec.code || '').trim().toUpperCase();
      if (!code) continue;

      const dbItem = dbMap.get(code);
      const unitsPerCarton = dbItem?.units_per_carton
        ? dbItem.units_per_carton
        : Math.max(1, Number(rec.units_per_carton) || CARTON_SIZES[code] || 1);
      const cartonCount = Math.max(0, Number(rec.carton_count ?? rec.cartons) || 0);
      const actualUnits = Math.round(cartonCount * unitsPerCarton);
      const systemStockBefore = dbItem
        ? dbItem.main_stock
        : Number(rec.system_stock_before ?? rec.system_stock ?? 0);
      const variance = actualUnits - systemStockBefore;
      const itemNameAr = dbItem?.item_name_ar || String(rec.item_name_ar || rec.name || code);

      reconciledItems.push({
        code,
        item_code: code,
        name: itemNameAr,
        item_name_ar: itemNameAr,
        cartons: cartonCount,
        carton_count: cartonCount,
        units_per_carton: unitsPerCarton,
        actual_units: actualUnits,
        total_units: actualUnits,
        system_stock_before: systemStockBefore,
        system_stock: systemStockBefore,
        variance,
      });

      if (dbItem) {
        balanceUpdates.push({
          dbItemCode: dbItem.item_code,
          codeUpper: code,
          newMainStock: actualUnits,
          newCurrentStock: actualUnits + dbItem.production_stock,
        });
      }
    }

    if (reconciledItems.length === 0) {
      return NextResponse.json(
        { error: 'لم يتم العثور على أصناف صالحة في بيانات الجرد.' },
        { status: 400 }
      );
    }

    // 3. Save historical audit record into public.inventory_counts
    const { data: insertedCount, error: insertError } = await supabaseAdmin
      .from('inventory_counts')
      .insert({
        count_date: countDate,
        keeper_name: keeperName,
        warehouse_section: warehouseSection,
        items_data: reconciledItems,
        notes: notes || null,
      })
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: `فشل حفظ سجل الجرد في قاعدة البيانات: ${insertError.message}` },
        { status: 500 }
      );
    }

    // 4. Update main_stock (and total current_stock = new_main_stock + existing_production_stock)
    const updatedItems: Array<{
      item_code: string;
      main_stock: number;
      current_stock: number;
    }> = [];

    for (const upd of balanceUpdates) {
      const { error: updateErr } = await supabaseAdmin
        .from('inventory_items')
        .update({
          main_stock: upd.newMainStock,
          current_stock: upd.newCurrentStock,
        })
        .eq('item_code', upd.dbItemCode);

      if (updateErr) {
        return NextResponse.json(
          {
            error: `تم حفظ سجل الجرد، لكن تعذر تحديث الرصيد الافتتاحي للصنف (${upd.codeUpper}): ${updateErr.message}`,
          },
          { status: 500 }
        );
      }

      updatedItems.push({
        item_code: upd.codeUpper,
        main_stock: upd.newMainStock,
        current_stock: upd.newCurrentStock,
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: insertedCount,
        updatedItems,
        message: 'تم اعتماد الجرد وتحديث الرصيد الافتتاحي للمخزون الرئيسي بنجاح ✅',
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء حفظ الجرد.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
