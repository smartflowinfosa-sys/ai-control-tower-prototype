import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { supabase as anonSupabase } from '@/lib/supabase';

const TECHRAR_BOQ_URL =
  process.env.TECHRAR_API_URL ||
  'https://api.techrar.com/api/v1/dashboard/bill-of-quantity/';

const TECHRAR_PACKAGING_URL =
  'https://api.techrar.com/api/v1/dashboard/subscription-packaging/';

const BOQ_STATUS_CODES = [
  'confirmed',
  'delivered',
  'not_received_by_customer',
  'not_received_by_restaurant',
] as const;

const PACKAGING_STATUS_CODES = [
  'confirmed',
  'delivered',
  'not_received_by_customer',
] as const;

type RawRecord = Record<string, unknown>;

interface AggregatedBoqRow {
  product_id: number;
  product_name: string;
  quantity: number;
  report_date: string;
}

interface PackagingDbRow {
  techrar_id: number;
  subscription_number: string;
  customer_name: string;
  district: string;
  dispatch_branch: string;
  service_type: string;
  delivery_window: string;
  items_count: number;
  notes: string;
  report_date: string;
  status: string;
}

/**
 * Per-date mutex on `globalThis` to serialize concurrent cron invocations
 * targeting the exact same `targetDate`.
 */
const globalForCron = globalThis as unknown as {
  __zahiCronDeductionLocks?: Map<string, Promise<unknown>>;
};
const cronLocks =
  globalForCron.__zahiCronDeductionLocks ??
  (globalForCron.__zahiCronDeductionLocks = new Map<string, Promise<unknown>>());

function getDbClient() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? getSupabaseAdmin() : anonSupabase;
}

function resolveTechrarToken(): string {
  const raw =
    process.env.TECHRAR_API_TOKEN ||
    process.env.TECHRAR_TOKEN ||
    process.env.TECHRAR_BEARER_TOKEN ||
    '';
  return raw.replace(/^Bearer\s+/i, '').trim();
}

/**
 * Constant-time verification of `Authorization: Bearer <CRON_SECRET>`.
 */
function verifyCronAuthorization(request: Request): {
  authorized: boolean;
  status: number;
  error?: string;
} {
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (!cronSecret) {
    return {
      authorized: false,
      status: 500,
      error: 'CRON_SECRET is not configured in server environment (.env)',
    };
  }

  const authHeader = (request.headers.get('authorization') || '').trim();
  if (!authHeader) {
    return {
      authorized: false,
      status: 401,
      error: 'Missing Authorization header',
    };
  }

  const expected = `Bearer ${cronSecret}`;
  const actualBuf = Buffer.from(authHeader, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  if (
    actualBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(actualBuf, expectedBuf)
  ) {
    return {
      authorized: false,
      status: 401,
      error: 'Unauthorized: invalid CRON_SECRET token',
    };
  }

  return { authorized: true, status: 200 };
}

/**
 * Computes current calendar date, weekday, and T+2 `targetDate` strictly in `Asia/Riyadh`
 * (immune to UTC / server host timezone differences at 00:05 AM).
 */
function getRiyadhScheduleContext(now: Date = new Date()): {
  riyadhDate: string;
  weekday: string;
  isWednesday: boolean;
  targetDate: string;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const riyadhDate = `${year}-${pad(month)}-${pad(day)}`;

  // Pure UTC calendar day addition (T+2 days)
  const targetUtc = new Date(Date.UTC(year, month - 1, day + 2));
  const targetDate = targetUtc.toISOString().split('T')[0];

  return {
    riyadhDate,
    weekday,
    isWednesday: weekday === 'Wednesday',
    targetDate,
  };
}

function extractArrayItems(data: unknown): RawRecord[] {
  if (Array.isArray(data)) return data as RawRecord[];
  if (!data || typeof data !== 'object') return [];

  const obj = data as Record<string, unknown>;
  for (const key of ['data', 'items', 'results', 'report', 'boq', 'subscriptions']) {
    const val = obj[key];
    if (Array.isArray(val)) return val as RawRecord[];
    if (val && typeof val === 'object') {
      const nested = extractArrayItems(val);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

function toCleanString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>;
    for (const k of ['name_ar', 'name', 'title_ar', 'title', 'name_en']) {
      if (typeof o[k] === 'string' && String(o[k]).trim()) {
        return String(o[k]).trim();
      }
    }
  }
  return '';
}

function formatServiceType(raw: RawRecord): string {
  if (raw.is_pickup === true) return 'استلام العميل';
  const st = toCleanString(raw.service_type).toLowerCase();
  if (!st || st === 'other_delivery' || st === 'delivery' || st === 'driver_delivery') {
    return 'التوصيل';
  }
  if (st === 'pickup' || st === 'branch_pickup' || st === 'customer_pickup') {
    return 'استلام العميل';
  }
  return toCleanString(raw.service_type) || 'التوصيل';
}

function parsePackagingItemsCount(raw: RawRecord): number {
  const direct = Number(raw.items_count ?? raw.meals_count ?? raw.total_items);
  if (Number.isFinite(direct) && direct >= 0) {
    return direct;
  }

  for (const key of ['items', 'meals', 'order_items', 'products']) {
    const arr = raw[key];
    if (Array.isArray(arr)) {
      return arr.length;
    }
  }

  let count = 0;
  for (let i = 1; i <= 10; i++) {
    if (toCleanString(raw[`item_${i}`] ?? raw[`meal_${i}`])) {
      count += 1;
    }
  }
  return count;
}

/**
 * Step 3a: Fetch BOQ from Techrar for `targetDate` and safely sync into `techrar_boq`.
 * Uses update-in-place + zero-quantity insert -> update so any legacy `AFTER INSERT` trigger
 * on `techrar_boq` never causes duplicate stock deductions before the official RPC runs.
 */
async function fetchAndSyncBoq(
  supabase: ReturnType<typeof getDbClient>,
  token: string,
  targetDate: string
): Promise<{ uniqueMeals: number; totalMeals: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    app_id: '715',
    org_id: '685',
    Authorization: `Bearer ${token}`,
  };

  const outcomes = await Promise.all(
    BOQ_STATUS_CODES.map(async (st) => {
      const payload = {
        restaurant_id: 715,
        type: 'subscription',
        from_date: targetDate,
        to_date: targetDate,
        status: st,
        cities_ids: [4, 1, 12],
        dispatch_branch_ids: [],
        group_by_reference: false,
        grouped: 0,
        grouped_by_description: false,
        grouped_by_size: false,
      };

      const res = await fetch(TECHRAR_BOQ_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        cache: 'no-store',
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        return { ok: false, status: res.status, error: errBody.slice(0, 200), items: [] as RawRecord[] };
      }

      const json = await res.json();
      return { ok: true, status: 200, items: extractArrayItems(json) };
    })
  );

  if (outcomes.every((o) => !o.ok)) {
    throw new Error(
      `Techrar BOQ API failed for all statuses on ${targetDate} (HTTP ${outcomes[0]?.status ?? 502})`
    );
  }

  const aggregatedMap = new Map<number, AggregatedBoqRow>();
  for (const outcome of outcomes) {
    for (const item of outcome.items) {
      const rawId =
        item.product_id ??
        item.productId ??
        item.meal_code ??
        item.mealCode ??
        item.code ??
        item.id;
      const prodId = Number(rawId);
      if (!Number.isFinite(prodId) || prodId <= 0) continue;

      const qty = Number(
        item.quantity ??
          item.total_quantity ??
          item.count ??
          item.qty ??
          item.meals_count ??
          0
      );
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const name =
        toCleanString(
          item.product_name ??
            item.productName ??
            item.name_ar ??
            item.nameAr ??
            item.meal_name_ar ??
            item.name_en ??
            item.name
        ) || `وجبة #${prodId}`;

      const existing = aggregatedMap.get(prodId);
      if (existing) {
        existing.quantity += qty;
        if (existing.product_name.startsWith('وجبة #') && !name.startsWith('وجبة #')) {
          existing.product_name = name;
        }
      } else {
        aggregatedMap.set(prodId, {
          product_id: prodId,
          product_name: name,
          quantity: qty,
          report_date: targetDate,
        });
      }
    }
  }

  const aggregatedItems = Array.from(aggregatedMap.values());
  const totalMeals = aggregatedItems.reduce((sum, r) => sum + r.quantity, 0);

  // Sync into `techrar_boq` safely without firing legacy AFTER INSERT triggers with non-zero qty
  const { data: existingRows, error: fetchErr } = await supabase
    .from('techrar_boq')
    .select('id, product_id, product_name, quantity')
    .eq('report_date', targetDate);

  if (fetchErr) {
    throw new Error(`Failed reading techrar_boq for ${targetDate}: ${fetchErr.message}`);
  }

  const existingByPid = new Map<
    number,
    { id: number; product_name: string; quantity: number }
  >();
  const staleIds: number[] = [];

  for (const row of existingRows || []) {
    const pid = Number(row.product_id);
    const id = Number(row.id);
    if (!existingByPid.has(pid)) {
      existingByPid.set(pid, {
        id,
        product_name: String(row.product_name || ''),
        quantity: Number(row.quantity || 0),
      });
    } else if (Number.isFinite(id)) {
      staleIds.push(id);
    }
  }

  const seenPids = new Set<number>();
  const toUpdate: Array<{ id: number; product_name: string; quantity: number }> = [];
  const toInsert: AggregatedBoqRow[] = [];

  for (const item of aggregatedItems) {
    seenPids.add(item.product_id);
    const existing = existingByPid.get(item.product_id);
    if (existing) {
      if (existing.quantity !== item.quantity || existing.product_name !== item.product_name) {
        toUpdate.push({
          id: existing.id,
          product_name: item.product_name,
          quantity: item.quantity,
        });
      }
    } else {
      toInsert.push(item);
    }
  }

  for (const [pid, existing] of existingByPid.entries()) {
    if (!seenPids.has(pid) && Number.isFinite(existing.id)) {
      staleIds.push(existing.id);
    }
  }

  if (toUpdate.length > 0) {
    const updResults = await Promise.all(
      toUpdate.map((u) =>
        supabase
          .from('techrar_boq')
          .update({ product_name: u.product_name, quantity: u.quantity })
          .eq('id', u.id)
      )
    );
    const failed = updResults.find((r) => r.error);
    if (failed?.error) {
      throw new Error(`Failed updating techrar_boq for ${targetDate}: ${failed.error.message}`);
    }
  }

  if (toInsert.length > 0) {
    const zeroRows = toInsert.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: 0,
      report_date: targetDate,
    }));

    const { data: insertedRows, error: insErr } = await supabase
      .from('techrar_boq')
      .insert(zeroRows)
      .select('id, product_id');

    if (insErr) {
      throw new Error(`Failed inserting into techrar_boq for ${targetDate}: ${insErr.message}`);
    }

    const qtyByPid = new Map<number, number>(toInsert.map((i) => [i.product_id, i.quantity]));
    const patchResults = await Promise.all(
      (insertedRows || []).map((ins) =>
        supabase
          .from('techrar_boq')
          .update({ quantity: qtyByPid.get(Number(ins.product_id)) ?? 0 })
          .eq('id', ins.id)
      )
    );
    const failedPatch = patchResults.find((r) => r.error);
    if (failedPatch?.error) {
      throw new Error(
        `Failed setting quantities in techrar_boq for ${targetDate}: ${failedPatch.error.message}`
      );
    }
  }

  if (staleIds.length > 0) {
    await supabase.from('techrar_boq').delete().in('id', staleIds);
  }

  return {
    uniqueMeals: aggregatedItems.length,
    totalMeals,
  };
}

/**
 * Step 3b: Fetch Packaging Report from Techrar for `targetDate` and upsert into `techrar_packaging_report`.
 */
async function fetchAndSyncPackaging(
  supabase: ReturnType<typeof getDbClient>,
  token: string,
  targetDate: string
): Promise<{ packagingOrdersSynced: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    app_id: '715',
    org_id: '685',
    Authorization: `Bearer ${token}`,
  };

  const outcomes = await Promise.all(
    PACKAGING_STATUS_CODES.map(async (st) => {
      const payload = {
        restaurant_id: 715,
        date: targetDate,
        status: st,
        cities_ids: [4, 1, 12],
        dispatch_branch_ids: [],
        group_by_reference: false,
        grouped: 0,
        grouped_by_description: false,
        grouped_by_size: false,
        type: 'subscription',
      };

      const res = await fetch(TECHRAR_PACKAGING_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        cache: 'no-store',
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        return {
          ok: false,
          statusCode: st,
          httpStatus: res.status,
          error: errBody.slice(0, 200),
          items: [] as RawRecord[],
        };
      }

      const json = await res.json();
      return {
        ok: true,
        statusCode: st,
        httpStatus: 200,
        items: extractArrayItems(json),
      };
    })
  );

  if (outcomes.every((o) => !o.ok)) {
    throw new Error(
      `Techrar Packaging API failed for all statuses on ${targetDate} (HTTP ${outcomes[0]?.httpStatus ?? 502})`
    );
  }

  const uniqueRows = new Map<number, PackagingDbRow>();
  for (const outcome of outcomes) {
    for (const raw of outcome.items) {
      const rawUniqueId = raw.sub_order_id ?? raw.techrar_id ?? raw.id;
      const techrarId = Number(rawUniqueId);
      if (!Number.isFinite(techrarId) || techrarId <= 0) continue;

      const subscriptionNumber = toCleanString(
        raw.subscription_id ?? raw.subscription_number ?? raw.reference ?? ''
      ).slice(0, 50);

      const customerName = (
        toCleanString(raw.customer_name ?? raw.client_name ?? raw.customer) || 'عميل غير مسجل'
      ).slice(0, 255);

      const district = (
        toCleanString(raw.district_ar) ||
        toCleanString(raw.district) ||
        '-'
      ).slice(0, 255);

      const dispatchBranch = (
        toCleanString(raw.dispatch_branch_name ?? raw.dispatch_branch) || '-'
      ).slice(0, 255);

      const serviceType = formatServiceType(raw).slice(0, 100);
      const deliveryWindow = (toCleanString(raw.delivery_window) || '-').slice(0, 100);
      const itemsCount = parsePackagingItemsCount(raw);
      const notes =
        toCleanString(raw.notes ?? raw.customer_notes ?? raw.delivery_notes ?? raw.comment) || '-';
      const rowStatus = (toCleanString(raw.status) || outcome.statusCode).slice(0, 50);

      uniqueRows.set(techrarId, {
        techrar_id: techrarId,
        subscription_number: subscriptionNumber,
        customer_name: customerName,
        district,
        dispatch_branch: dispatchBranch,
        service_type: serviceType,
        delivery_window: deliveryWindow,
        items_count: itemsCount,
        notes,
        report_date: targetDate,
        status: rowStatus,
      });
    }
  }

  const rowsToUpsert = Array.from(uniqueRows.values());
  if (rowsToUpsert.length > 0) {
    const CHUNK_SIZE = 500;
    for (let i = 0; i < rowsToUpsert.length; i += CHUNK_SIZE) {
      const chunk = rowsToUpsert.slice(i, i + CHUNK_SIZE);
      const { error: upsertError } = await supabase
        .from('techrar_packaging_report')
        .upsert(chunk, { onConflict: 'techrar_id' });

      if (upsertError) {
        throw new Error(
          `Failed upserting techrar_packaging_report for ${targetDate}: ${upsertError.message}`
        );
      }
    }

    // Non-blocking 30-day retention cleanup
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
      await supabase
        .from('techrar_packaging_report')
        .delete()
        .lt('report_date', cutoffDate);
    } catch {
      // Non-fatal retention cleanup
    }
  }

  return {
    packagingOrdersSynced: rowsToUpsert.length,
  };
}

async function executeScheduledDeduction(request: Request) {
  // 1. Verify CRON_SECRET Authorization header
  const auth = verifyCronAuthorization(request);
  if (!auth.authorized) {
    return NextResponse.json(
      {
        status: 'unauthorized',
        error: auth.error,
      },
      { status: auth.status }
    );
  }

  // 2. Compute Asia/Riyadh current date, Wednesday skip rule, and T+2 `targetDate`
  const { riyadhDate, weekday, isWednesday, targetDate } = getRiyadhScheduleContext();

  if (isWednesday) {
    console.log(
      `[Cron Daily Deduction] Skipping Wednesday (${riyadhDate}) -> Friday (${targetDate}) has no deliveries.`
    );
    return NextResponse.json({
      status: 'skipped',
      message: 'Wednesday run skipped (No Friday deliveries)',
      run_date_riyadh: riyadhDate,
      weekday_riyadh: weekday,
      target_date: targetDate,
    });
  }

  const token = resolveTechrarToken();
  if (!token) {
    return NextResponse.json(
      {
        target_date: targetDate,
        status: 'error',
        error: 'Missing TECHRAR_API_TOKEN in server environment (.env)',
      },
      { status: 500 }
    );
  }

  // Serialize concurrent executions for the same `targetDate`
  const prevLock = cronLocks.get(targetDate) ?? Promise.resolve();

  const currentRun = prevLock
    .catch(() => undefined)
    .then(async () => {
      const supabase = getDbClient();

      // 3. Fetch & Cache Source of Truth (BOQ + Packaging) for `targetDate`
      const [boqSummary, packagingSummary] = await Promise.all([
        fetchAndSyncBoq(supabase, token, targetDate),
        fetchAndSyncPackaging(supabase, token, targetDate),
      ]);

      // 4. Strict Idempotency Check & Automated Inventory Deduction
      const { data: existingLog, error: logCheckError } = await supabase
        .from('inventory_deduction_logs')
        .select('*')
        .eq('target_date', targetDate)
        .single();

      // PGRST116 = 0 rows returned by .single() (not deducted yet)
      if (logCheckError && logCheckError.code !== 'PGRST116') {
        throw new Error(
          `Failed querying inventory_deduction_logs for ${targetDate}: ${logCheckError.message}`
        );
      }

      if (existingLog) {
        console.log(
          `[Cron Daily Deduction] Deduction already executed for ${targetDate}, skipping RPC.`
        );
        return {
          target_date: targetDate,
          status: 'already_deducted' as const,
          message: `Inventory deduction already executed for ${targetDate}`,
          deducted_at: (existingLog as Record<string, unknown>).deducted_at ?? null,
          bags_deducted: 0,
          boq_unique_meals: boqSummary.uniqueMeals,
          boq_total_meals: boqSummary.totalMeals,
          packaging_orders_synced: packagingSummary.packagingOrdersSynced,
          run_date_riyadh: riyadhDate,
          weekday_riyadh: weekday,
        };
      }

      // Execute daily inventory deduction RPC for `targetDate`
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'process_daily_inventory_deduction',
        { target_date: targetDate }
      );

      if (rpcError) {
        throw new Error(
          `RPC process_daily_inventory_deduction failed for ${targetDate}: ${rpcError.message}`
        );
      }

      // Immediately lock `targetDate` in `inventory_deduction_logs`
      const { error: insertLogError } = await supabase
        .from('inventory_deduction_logs')
        .insert({ target_date: targetDate });

      if (insertLogError && insertLogError.code !== '23505') {
        throw new Error(
          `Deduction ran for ${targetDate} but failed to lock inventory_deduction_logs: ${insertLogError.message}`
        );
      }

      const rpcObj =
        rpcData && typeof rpcData === 'object' && !Array.isArray(rpcData)
          ? (rpcData as Record<string, unknown>)
          : {};
      const bagsDeducted =
        typeof rpcObj.bags_deducted === 'number'
          ? rpcObj.bags_deducted
          : packagingSummary.packagingOrdersSynced;

      console.log(
        `✅ [Cron Daily Deduction] Successfully deducted & locked ${targetDate} (bags_deducted: ${bagsDeducted}, boq_total_meals: ${boqSummary.totalMeals})`
      );

      return {
        target_date: targetDate,
        status: 'success' as const,
        bags_deducted: bagsDeducted,
        boq_unique_meals: boqSummary.uniqueMeals,
        boq_total_meals: boqSummary.totalMeals,
        packaging_orders_synced: packagingSummary.packagingOrdersSynced,
        run_date_riyadh: riyadhDate,
        weekday_riyadh: weekday,
        rpc_result: rpcData ?? null,
      };
    });

  cronLocks.set(targetDate, currentRun);

  try {
    const result = await currentRun;
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error(`❌ [Cron Daily Deduction] Error for ${targetDate}:`, err);
    return NextResponse.json(
      {
        target_date: targetDate,
        run_date_riyadh: riyadhDate,
        weekday_riyadh: weekday,
        status: 'error',
        error: message,
      },
      { status: 500 }
    );
  } finally {
    if (cronLocks.get(targetDate) === currentRun) {
      cronLocks.delete(targetDate);
    }
  }
}

export async function GET(request: Request) {
  return executeScheduledDeduction(request);
}

export async function POST(request: Request) {
  return executeScheduledDeduction(request);
}

