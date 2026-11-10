import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface HistoryRow {
  id: number;
  item_code: string;
  target_date: string;
  balance_before: number;
  quantity_consumed: number;
  balance_after: number;
  created_at?: string;
}

const MASTER_CODES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11'];

/**
 * Hard Go-Live / Cutoff Date:
 * Warehouse stocktake was performed on Nov 6, 2026, establishing physical baseline stock.
 * The system MUST NOT track, calculate, or display any consumption prior to 2026-11-07.
 */
const CUTOFF_DATE = '2026-11-07';

function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return [startDate];
  }
  const s = start <= end ? start : end;
  const e = start <= end ? end : start;

  const curr = new Date(s);
  while (curr <= e) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const itemCode = searchParams.get('item_code')?.trim().toUpperCase();
    const rawStartDate = searchParams.get('start_date')?.trim();
    const rawEndDate = searchParams.get('end_date')?.trim();

    // If a specific endDate is requested and it is strictly before the physical stocktake cutoff date,
    // return an empty dataset immediately because no consumption is tracked or valid before 2026-11-07.
    if (rawEndDate && rawEndDate < CUTOFF_DATE) {
      const zeroConsumption: Record<string, number> = {};
      for (const code of MASTER_CODES) {
        zeroConsumption[code] = 0;
      }
      return NextResponse.json({
        success: true,
        data: [],
        consumptionByItem: zeroConsumption,
      });
    }

    // Enforce Cutoff Date: The effective start date can NEVER be earlier than 2026-11-07
    const effectiveStartDate = (!rawStartDate || rawStartDate < CUTOFF_DATE)
      ? CUTOFF_DATE
      : rawStartDate;

    const supabase = getSupabaseAdmin();

    // 1. Fetch current stock for items from inventory_items
    const { data: invItems } = await supabase
      .from('inventory_items')
      .select('item_code, current_stock');

    const stockByItem = new Map<string, number>(
      (invItems || []).map((i) => [String(i.item_code).toUpperCase(), Number(i.current_stock ?? 0)])
    );

    const allInventoryCodes = Array.from(
      new Set([
        ...MASTER_CODES,
        ...(invItems || []).map((i) => String(i.item_code).toUpperCase()),
      ])
    );

    const targetItems = itemCode ? [itemCode] : allInventoryCodes;

    // 2. Fetch existing records from inventory_consumption_history (Strictly >= CUTOFF_DATE)
    let query = supabase
      .from('inventory_consumption_history')
      .select('id, item_code, target_date, balance_before, quantity_consumed, balance_after, created_at')
      .gte('target_date', CUTOFF_DATE)
      .order('target_date', { ascending: false })
      .order('id', { ascending: false });

    if (itemCode) {
      query = query.eq('item_code', itemCode);
    }
    if (rawEndDate) {
      query = query.lte('target_date', rawEndDate);
    }

    const { data: existingData, error: histError } = await query;
    if (histError) {
      console.error('[GET /api/inventory/consumption-history] Supabase error:', histError.message);
      return NextResponse.json({ success: false, error: histError.message }, { status: 500 });
    }

    const existingRows: HistoryRow[] = (existingData || []).map((row) => ({
      id: Number(row.id),
      item_code: String(row.item_code || '').toUpperCase(),
      target_date: String(row.target_date || ''),
      balance_before: Number(row.balance_before ?? 0),
      quantity_consumed: Number(row.quantity_consumed ?? 0),
      balance_after: Number(row.balance_after ?? 0),
      created_at: row.created_at,
    }));

    const existingMap = new Map<string, HistoryRow>();
    for (const r of existingRows) {
      const key = `${r.item_code}__${r.target_date}`;
      if (!existingMap.has(key)) {
        existingMap.set(key, r);
      }
    }

    // 3. Determine the date horizon for backward chaining
    // Find the latest date among requested endDate, today, existing rows, and activity tables
    const todayStr = new Date().toISOString().split('T')[0];
    let maxDate = rawEndDate || todayStr;
    for (const r of existingRows) {
      if (r.target_date && r.target_date > maxDate) {
        maxDate = r.target_date;
      }
    }

    // Build chaining dates from CUTOFF_DATE to maxDate
    let chainDates = getDatesBetween(CUTOFF_DATE, maxDate).filter((d) => d >= CUTOFF_DATE);
    if (rawEndDate) {
      chainDates = chainDates.filter((d) => d <= rawEndDate);
    }

    // 4. Identify which dates are missing for packaging items (P7, P8) and BOM items (P1..P6, P9..P11)
    const missingPackagingDates = new Set<string>();
    const missingBoqDates = new Set<string>();

    for (const code of targetItems) {
      for (const date of chainDates) {
        const key = `${code}__${date}`;
        const existing = existingMap.get(key);
        if (!existing) {
          if (code === 'P8' || code === 'P7') {
            missingPackagingDates.add(date);
          } else {
            missingBoqDates.add(date);
          }
        }
      }
    }

    // 5. Fetch required packaging and BOQ/BOM data for missing dates (all >= CUTOFF_DATE)
    const bagsCountByDate = new Map<string, number>();
    const cutleryCountByDate = new Map<string, number>();

    if (missingPackagingDates.size > 0) {
      const { data: pkgRows } = await supabase
        .from('techrar_packaging_report')
        .select('report_date, package_name')
        .in('report_date', Array.from(missingPackagingDates))
        .gte('report_date', CUTOFF_DATE)
        .limit(10000);

      for (const row of pkgRows || []) {
        const d = String(row.report_date || '');
        if (!d || d < CUTOFF_DATE) continue;
        bagsCountByDate.set(d, (bagsCountByDate.get(d) || 0) + 1);

        const pkgName = String(row.package_name || '').trim();
        const cutleryAdd = pkgName.includes('غداء') ? 1 : 2;
        cutleryCountByDate.set(d, (cutleryCountByDate.get(d) || 0) + cutleryAdd);
      }
    }

    const boqSumsByItemAndDate = new Map<string, number>();

    if (missingBoqDates.size > 0) {
      const [{ data: boqRows }, { data: bomRows }] = await Promise.all([
        supabase
          .from('techrar_boq')
          .select('report_date, product_id, quantity')
          .in('report_date', Array.from(missingBoqDates))
          .gte('report_date', CUTOFF_DATE),
        supabase
          .from('bom_packaging')
          .select('inventory_item_code, meal_code, quantity_used'),
      ]);

      const bomLookup = new Map<string, number>();
      for (const bom of bomRows || []) {
        const k = `${String(bom.inventory_item_code).toUpperCase()}__${String(bom.meal_code)}`;
        bomLookup.set(k, Number(bom.quantity_used || 0));
      }

      for (const boq of boqRows || []) {
        const d = String(boq.report_date || '');
        const pid = String(boq.product_id || '');
        const boqQty = Number(boq.quantity || 0);
        if (!d || d < CUTOFF_DATE || !pid || boqQty <= 0) continue;

        for (const code of targetItems) {
          if (code === 'P7' || code === 'P8') continue;
          const used = bomLookup.get(`${code}__${pid}`);
          if (used && used > 0) {
            const sumKey = `${code}__${d}`;
            boqSumsByItemAndDate.set(
              sumKey,
              (boqSumsByItemAndDate.get(sumKey) || 0) + boqQty * used
            );
          }
        }
      }
    }

    // 6. Build unified rows per item with backward balance chaining
    // HALTS STRICTLY at CUTOFF_DATE ('2026-11-07')
    const allFinalRows: HistoryRow[] = [];

    for (const code of targetItems) {
      // Sort dates descending (newest first, down to CUTOFF_DATE)
      const descDates = [...chainDates].filter((d) => d >= CUTOFF_DATE).sort().reverse();
      let anchor = stockByItem.get(code) ?? 0;

      for (const date of descDates) {
        // Enforce hard cutoff guard: NEVER calculate or process any date before 2026-11-07
        if (date < CUTOFF_DATE) {
          break;
        }

        const key = `${code}__${date}`;
        const existing = existingMap.get(key);

        if (existing) {
          allFinalRows.push(existing);
          anchor = Number(existing.balance_before ?? anchor);
        } else {
          // Calculate dynamically on-the-fly
          let dynamicConsumed = 0;
          if (code === 'P8') {
            dynamicConsumed = bagsCountByDate.get(date) || 0;
          } else if (code === 'P7') {
            dynamicConsumed = cutleryCountByDate.get(date) || 0;
          } else {
            dynamicConsumed = boqSumsByItemAndDate.get(key) || 0;
          }

          const balanceAfter = anchor;
          const balanceBefore = anchor + dynamicConsumed;
          anchor = balanceBefore;

          allFinalRows.push({
            id: -Math.floor(Math.random() * 1000000), // Virtual calculated row ID
            item_code: code,
            target_date: date,
            balance_before: balanceBefore,
            quantity_consumed: dynamicConsumed,
            balance_after: balanceAfter,
          });
        }
      }
    }

    // 7. Filter by requested date range, guaranteeing no date < CUTOFF_DATE is returned
    const filteredRows = allFinalRows.filter((r) => {
      if (r.target_date < CUTOFF_DATE) return false;
      if (r.target_date < effectiveStartDate) return false;
      if (rawEndDate && r.target_date > rawEndDate) return false;
      return true;
    });

    // Sort final rows: target_date DESCENDING, then compareItemCodes
    filteredRows.sort((a, b) => {
      const cmpDate = (b.target_date || '').localeCompare(a.target_date || '');
      if (cmpDate !== 0) return cmpDate;
      const numA = parseInt(a.item_code.replace(/\D/g, ''), 10);
      const numB = parseInt(b.item_code.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
      return a.item_code.localeCompare(b.item_code);
    });

    // 8. Aggregate total quantity_consumed per item_code for the filtered range
    const consumptionByItem: Record<string, number> = {};
    for (const code of MASTER_CODES) {
      consumptionByItem[code] = 0;
    }
    for (const row of filteredRows) {
      const c = row.item_code;
      consumptionByItem[c] = (consumptionByItem[c] || 0) + Number(row.quantity_consumed || 0);
    }

    return NextResponse.json({
      success: true,
      data: filteredRows,
      consumptionByItem,
    });
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

    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[GET /api/inventory/consumption-history] Unexpected error:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
