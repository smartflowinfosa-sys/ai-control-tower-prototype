import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { supabase as anonSupabase } from '@/lib/supabase';

const TECHRAR_PACKAGING_URL =
  'https://api.techrar.com/api/v1/dashboard/subscription-packaging/';

/** UI status label (Arabic / English) -> Techrar status code */
const STATUS_MAPPING: Record<string, string> = {
  'مؤكد': 'confirmed',
  confirmed: 'confirmed',
  'تم التوصيل': 'delivered',
  delivered: 'delivered',
  'لم يتم استلامه من قبل العميل': 'not_received_by_customer',
  not_received_by_customer: 'not_received_by_customer',
  'لم يتم استلامه من قبل المطعم': 'not_received_by_restaurant',
  not_received_by_restaurant: 'not_received_by_restaurant',
};

/**
 * Valid packaging status codes supported by Techrar's `subscription-packaging` endpoint
 * when fetching "الكل" (All).
 */
const ALL_STATUS_CODES = [
  'confirmed',
  'delivered',
  'not_received_by_customer',
];

type RawItem = Record<string, unknown>;

/** Exact schema of `techrar_packaging_report` in Supabase */
export interface PackagingDbRow {
  id?: string;
  techrar_id: number;
  subscription_number: string;
  customer_name: string;
  package_name?: string;
  district: string;
  dispatch_branch: string;
  service_type: string;
  delivery_window: string;
  items_count: number;
  notes: string;
  report_date: string;
  status: string;
  created_at?: string;
}

/** Supplemental Techrar display fields merged onto returned Supabase records */
export interface ExtraPackagingMeta {
  plan_name: string;
  subscription_days: number | null;
  district_group: string;
  item_1: string;
  item_2: string;
  all_items: string[];
  captain_name: string;
  city_id: number | null;
  city_name: string;
  restaurant_branch: string;
  only_has_notes: boolean;
  techrar_seq: number;
}

export type PackagingApiRecord = PackagingDbRow & Partial<ExtraPackagingMeta>;

interface FetchOutcome {
  statusCode: string;
  items: RawItem[];
  failedStatus?: number;
  error?: string;
}

/**
 * Short-lived server cache to prevent redundant 2MB+ Techrar API calls
 * while preserving supplementary UI columns across page reloads.
 */
const SYNC_TTL_MS = 60_000;
const lastSyncTimestamps = new Map<string, number>();
const extraMetaStore = new Map<number, ExtraPackagingMeta>();

function getDbClient() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? getSupabaseAdmin() : anonSupabase;
}

function resolveToken(): string {
  const raw =
    process.env.TECHRAR_API_TOKEN ||
    process.env.TECHRAR_TOKEN ||
    process.env.TECHRAR_BEARER_TOKEN ||
    '';
  return raw.replace(/^Bearer\s+/i, '').trim();
}

function extractItems(data: unknown): RawItem[] {
  if (Array.isArray(data)) return data as RawItem[];
  if (!data || typeof data !== 'object') return [];

  const obj = data as Record<string, unknown>;
  for (const key of ['data', 'items', 'results', 'report', 'subscriptions']) {
    const value = obj[key];
    if (Array.isArray(value)) return value as RawItem[];
    if (value && typeof value === 'object') {
      const nested = extractItems(value);
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

function formatServiceType(raw: RawItem): string {
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

function hasRealNotes(notes: string): boolean {
  const trimmed = notes.trim();
  return Boolean(trimmed && trimmed !== '-' && trimmed !== '—' && trimmed !== 'لا توجد ملاحظات');
}

/**
 * Transforms a raw Techrar subscription-packaging item into:
 * 1) `dbRow`: strict `techrar_packaging_report` Supabase schema
 * 2) `meta`: extra Techrar fields required by the 14-column UI & 8 filter dropdowns
 */
function transformTechrarItem(
  raw: RawItem,
  selectedDate: string,
  statusCode: string,
  seqIndex: number
): { dbRow: PackagingDbRow; meta: ExtraPackagingMeta } | null {
  const rawUniqueId = raw.sub_order_id ?? raw.techrar_id ?? raw.id;
  const techrarId = Number(rawUniqueId);
  if (!Number.isFinite(techrarId) || techrarId <= 0) {
    return null;
  }

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

  const rawMealsList = Array.isArray(raw.items) ? (raw.items as RawItem[]) : [];
  const itemsCountRaw = Number(raw.number_of_items ?? raw.items_count ?? rawMealsList.length ?? 0);
  const itemsCount = Number.isFinite(itemsCountRaw) ? itemsCountRaw : rawMealsList.length;

  const notes = toCleanString(raw.notes) || '-';
  const reportDate = toCleanString(raw.date) || selectedDate;

  const mealNames = rawMealsList
    .map((m) => toCleanString(m.name_ar) || toCleanString(m.name_en) || toCleanString(m.name))
    .filter(Boolean);

  const numDaysRaw = Number(raw.num_of_days ?? raw.subscription_days);
  const subscriptionDays = Number.isFinite(numDaysRaw) && numDaysRaw > 0 ? numDaysRaw : null;

  const cityObj =
    raw.city && typeof raw.city === 'object' ? (raw.city as Record<string, unknown>) : null;
  const cityIdRaw = cityObj ? Number(cityObj.id) : NaN;
  const cityId = Number.isFinite(cityIdRaw) ? cityIdRaw : null;
  const cityName = cityObj
    ? toCleanString(cityObj.name_ar) || toCleanString(cityObj.name_en)
    : toCleanString(raw.city);

  const packageName = (
    toCleanString(raw.package_name) ||
    toCleanString(raw.name_ar) ||
    toCleanString(raw.name) ||
    toCleanString(raw.subscription_name) ||
    toCleanString(raw.plan_name) ||
    toCleanString(raw.name_en) ||
    '-'
  ).slice(0, 255);

  const dbRow: PackagingDbRow = {
    techrar_id: techrarId,
    subscription_number: subscriptionNumber,
    customer_name: customerName,
    package_name: packageName,
    district,
    dispatch_branch: dispatchBranch,
    service_type: serviceType,
    delivery_window: deliveryWindow,
    items_count: itemsCount,
    notes,
    report_date: reportDate,
    status: statusCode.slice(0, 50),
  };

  const meta: ExtraPackagingMeta = {
    plan_name: packageName,
    subscription_days: subscriptionDays,
    district_group: toCleanString(raw.district_group) || '-',
    item_1: mealNames[0] || '-',
    item_2: mealNames[1] || '-',
    all_items: mealNames,
    captain_name: toCleanString(raw.captain_name) || '-',
    city_id: cityId,
    city_name: cityName || '-',
    restaurant_branch: toCleanString(raw.restaurant_branch) || 'بدون',
    only_has_notes: hasRealNotes(notes),
    techrar_seq: seqIndex,
  };

  return { dbRow, meta };
}

/**
 * Executes a single status POST request to Techrar's subscription-packaging endpoint
 * using `date` (single date) as required by the endpoint serializer.
 */
async function fetchPackagingForStatus(
  token: string,
  selectedDate: string,
  statusCode: string,
  citiesIds: number[] = [4, 1, 12],
  dispatchBranchIds: number[] = []
): Promise<FetchOutcome> {
  const payload = {
    restaurant_id: 715,
    date: selectedDate,
    cities_ids: citiesIds,
    dispatch_branch_ids: dispatchBranchIds,
    status: statusCode,
    type: 'subscription',
  };

  try {
    const res = await fetch(TECHRAR_PACKAGING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        app_id: '715',
        org_id: '685',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      // If a status code is unsupported by subscription-packaging (e.g. not_received_by_restaurant),
      // treat cleanly as 0 items rather than failing the request.
      if (res.status === 400 && errorText.includes('enter valid status')) {
        console.warn(`⚠️ [Techrar Packaging] Status "${statusCode}" not supported on packaging endpoint; returning empty list.`);
        return { statusCode, items: [] };
      }

      console.error(
        `❌ [Techrar Packaging API] Status: "${statusCode}" - HTTP ${res.status}:`,
        errorText.slice(0, 400)
      );
      return {
        statusCode,
        items: [],
        failedStatus: res.status,
        error: `Techrar returned HTTP ${res.status}: ${errorText.slice(0, 150)}`,
      };
    }

    const data: unknown = await res.json();
    const items = extractItems(data);
    console.log(
      `✅ [Techrar Packaging] Date: ${selectedDate} | Status: "${statusCode}" -> ${items.length} items`
    );
    return { statusCode, items };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ [Techrar Packaging] Status: "${statusCode}" fetch error:`, message);
    return { statusCode, items: [], failedStatus: 502, error: message };
  }
}

/**
 * Reads saved records from Supabase `techrar_packaging_report` and enriches them
 * with any cached Techrar metadata (plan name, subscription days, items 1 & 2, etc.).
 */
async function fetchFromSupabase(
  selectedDate: string,
  statusCodesFilter: string[] | null,
  liveIdSet?: Set<number>
): Promise<{ records: PackagingApiRecord[]; dbError?: string }> {
  const supabase = getDbClient();

  let query = supabase
    .from('techrar_packaging_report')
    .select('*')
    .eq('report_date', selectedDate)
    .order('techrar_id', { ascending: true })
    .limit(5000);

  if (statusCodesFilter && statusCodesFilter.length === 1) {
    query = query.eq('status', statusCodesFilter[0]);
  } else if (statusCodesFilter && statusCodesFilter.length > 1) {
    query = query.in('status', statusCodesFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ [Supabase Packaging Select] Error:', error.message);
    return { records: [], dbError: error.message };
  }

  const rows = (data || []) as PackagingDbRow[];
  const filteredRows = liveIdSet
    ? rows.filter((r) => liveIdSet.has(Number(r.techrar_id)))
    : rows;

  const enriched: PackagingApiRecord[] = filteredRows.map((row) => {
    const meta = extraMetaStore.get(Number(row.techrar_id));
    return meta ? { ...row, ...meta } : { ...row };
  });

  // Sort by Techrar's natural report sequence when available
  enriched.sort((a, b) => {
    const seqA = a.techrar_seq ?? Number.MAX_SAFE_INTEGER;
    const seqB = b.techrar_seq ?? Number.MAX_SAFE_INTEGER;
    if (seqA !== seqB) return seqA - seqB;
    return Number(a.techrar_id) - Number(b.techrar_id);
  });

  return { records: enriched };
}

/**
 * POST /api/operations/packaging
 *
 * Workflow:
 * 1. Fetch raw packaging data from Techrar using single `date`
 *    (skips redundant Techrar call if already synced within TTL unless `force_refresh` is true).
 * 2. Transform raw items to match `techrar_packaging_report` schema.
 * 3. Upsert records into Supabase `techrar_packaging_report` on `techrar_id` conflict.
 * 4. Return saved/fetched records from Supabase to the client.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const today = new Date().toISOString().split('T')[0];
    const selectedDate = String(
      body.date || body.selectedDate || body.from_date || body.fromDate || today
    ).trim();

    const status =
      body.status !== undefined && body.status !== null && String(body.status).trim() !== ''
        ? String(body.status).trim()
        : 'الكل';

    const forceRefresh = Boolean(body.force_refresh);

    const citiesIds: number[] =
      Array.isArray(body.cities_ids) && body.cities_ids.length > 0
        ? body.cities_ids.map(Number).filter(Number.isFinite)
        : [4, 1, 12];

    const dispatchBranchIds: number[] = Array.isArray(body.dispatch_branch_ids)
      ? body.dispatch_branch_ids.map(Number).filter(Number.isFinite)
      : [];

    const isFetchAll = status === 'الكل' || status.toLowerCase() === 'all';
    const statusCodes = isFetchAll
      ? ALL_STATUS_CODES
      : [STATUS_MAPPING[status] || status];

    const cacheKey = `${selectedDate}|${isFetchAll ? 'ALL' : statusCodes.join(',')}|${citiesIds.join(',')}`;
    const allCacheKey = `${selectedDate}|ALL|${citiesIds.join(',')}`;
    const now = Date.now();
    const lastSync = Math.max(
      lastSyncTimestamps.get(cacheKey) ?? 0,
      lastSyncTimestamps.get(allCacheKey) ?? 0
    );

    // Prevent redundant external API calls if recently synced to Supabase
    if (!forceRefresh && lastSync > 0 && now - lastSync < SYNC_TTL_MS) {
      const { records, dbError } = await fetchFromSupabase(
        selectedDate,
        isFetchAll ? null : statusCodes
      );
      if (!dbError && records.length > 0) {
        return NextResponse.json({
          success: true,
          items: records,
          count: records.length,
          date: selectedDate,
          status,
          source: 'supabase_cached',
        });
      }
    }

    const token = resolveToken();
    if (!token) {
      console.error('❌ [Techrar Packaging] Missing TECHRAR_API_TOKEN in environment');
      const fallback = await fetchFromSupabase(selectedDate, isFetchAll ? null : statusCodes);
      if (fallback.records.length > 0) {
        return NextResponse.json({
          success: true,
          items: fallback.records,
          count: fallback.records.length,
          date: selectedDate,
          status,
          source: 'supabase_fallback',
          warning: 'تم عرض البيانات المحفوظة من قاعدة البيانات لعدم توفر رمز تفويض تكرار',
        });
      }
      return NextResponse.json(
        {
          success: false,
          items: [],
          count: 0,
          source: 'techrar_live',
          error: 'رمز تفويض تكرار (TECHRAR_API_TOKEN) غير مُعرّف في إعدادات الخادم (.env)',
        },
        { status: 401 }
      );
    }

    // Step a: Fetch raw data from Techrar subscription-packaging
    const outcomes = await Promise.all(
      statusCodes.map((code) =>
        fetchPackagingForStatus(token, selectedDate, code, citiesIds, dispatchBranchIds)
      )
    );

    // If all upstream calls failed, fall back to Supabase if records exist for this date
    if (outcomes.every((o) => o.failedStatus !== undefined)) {
      const fallback = await fetchFromSupabase(selectedDate, isFetchAll ? null : statusCodes);
      if (fallback.records.length > 0) {
        return NextResponse.json({
          success: true,
          items: fallback.records,
          count: fallback.records.length,
          date: selectedDate,
          status,
          source: 'supabase_fallback',
          warning: 'تعذر الاتصال اللحظي بتكرار — تم استرجاع البيانات المحفوظة من Supabase',
        });
      }

      const primaryFail = outcomes[0];
      const code = primaryFail.failedStatus ?? 502;
      const httpStatus = code === 401 || code === 403 ? 401 : code === 400 ? 400 : 502;
      return NextResponse.json(
        {
          success: false,
          items: [],
          count: 0,
          source: 'techrar_live',
          upstream_status: code,
          error:
            httpStatus === 401
              ? 'رفضت Techrar بيانات الاعتماد (401/403) — يرجى التحقق من صلاحية الرمز'
              : primaryFail.error || 'تعذر الاتصال بخادم تكرار',
        },
        { status: httpStatus }
      );
    }

    // Step b: Transform raw Techrar items to match `techrar_packaging_report` schema
    const uniqueDbRowsMap = new Map<number, PackagingDbRow>();
    const liveIdSet = new Set<number>();
    let seqCounter = 0;

    for (const outcome of outcomes) {
      for (const rawItem of outcome.items) {
        seqCounter += 1;
        const transformed = transformTechrarItem(
          rawItem,
          selectedDate,
          outcome.statusCode,
          seqCounter
        );
        if (!transformed) continue;

        uniqueDbRowsMap.set(transformed.dbRow.techrar_id, transformed.dbRow);
        extraMetaStore.set(transformed.dbRow.techrar_id, transformed.meta);
        liveIdSet.add(transformed.dbRow.techrar_id);
      }
    }

    const dbRowsToUpsert = Array.from(uniqueDbRowsMap.values());

    // Step c: Upsert into `techrar_packaging_report` on `techrar_id` conflict (chunked for safety)
    const supabase = getDbClient();
    let upsertWarning: string | undefined;

    if (dbRowsToUpsert.length > 0) {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < dbRowsToUpsert.length; i += CHUNK_SIZE) {
        const chunk = dbRowsToUpsert.slice(i, i + CHUNK_SIZE);
        const { error: upsertError } = await supabase
          .from('techrar_packaging_report')
          .upsert(chunk, { onConflict: 'techrar_id' });

        if (upsertError) {
          console.error('❌ [Supabase Packaging Upsert] Error:', upsertError.message);
          upsertWarning = `تم جلب البيانات ولكن تعذر حفظ جزء منها في Supabase: ${upsertError.message}`;
          break;
        }
      }

      if (!upsertWarning) {
        console.log(
          `💾 [Supabase Packaging] Upserted ${dbRowsToUpsert.length} rows into techrar_packaging_report for ${selectedDate}`
        );
        lastSyncTimestamps.set(cacheKey, Date.now());

        // Step c.1: Auto-cleanup records older than 30 days (Non-blocking retention policy)
        try {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const formattedDate = thirtyDaysAgo.toISOString().split('T')[0];

          const { error: cleanupError } = await supabase
            .from('techrar_packaging_report')
            .delete()
            .lt('report_date', formattedDate);

          if (cleanupError) {
            console.error('⚠️ [Auto-Cleanup] Error deleting packaging records older than 30 days:', cleanupError.message);
          } else {
            console.log(`🧹 [Auto-Cleanup] Purged packaging records older than ${formattedDate} (30-day retention).`);
          }
        } catch (cleanupErr: unknown) {
          const msg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
          console.error('⚠️ [Auto-Cleanup] Exception during 30-day packaging retention cleanup:', msg);
        }
      }
    } else {
      lastSyncTimestamps.set(cacheKey, Date.now());
    }

    // Step d: Return the saved/fetched records from Supabase to the client
    if (dbRowsToUpsert.length === 0) {
      return NextResponse.json({
        success: true,
        items: [],
        count: 0,
        date: selectedDate,
        status,
        source: 'supabase_synced',
      });
    }

    const { records, dbError } = await fetchFromSupabase(
      selectedDate,
      isFetchAll ? null : statusCodes,
      liveIdSet
    );

    // Resilient fallback if Supabase read encountered an issue after fetch
    const finalItems: PackagingApiRecord[] =
      !dbError && records.length > 0
        ? records
        : dbRowsToUpsert.map((row) => ({
            ...row,
            ...(extraMetaStore.get(row.techrar_id) || {}),
          }));

    const partialFailures = outcomes.filter((o) => o.failedStatus !== undefined).length;
    const combinedWarning =
      upsertWarning ||
      (partialFailures > 0
        ? `تعذر جلب ${partialFailures} من أصل ${outcomes.length} حالات من نظام تكرار`
        : undefined);

    return NextResponse.json({
      success: true,
      items: finalItems,
      count: finalItems.length,
      date: selectedDate,
      status,
      source: 'supabase_synced',
      ...(combinedWarning ? { warning: combinedWarning } : {}),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('❌ [POST /api/operations/packaging] Uncaught Exception:', err);
    return NextResponse.json(
      {
        success: false,
        items: [],
        count: 0,
        source: 'techrar_live',
        error: message,
      },
      { status: 500 }
    );
  }
}
