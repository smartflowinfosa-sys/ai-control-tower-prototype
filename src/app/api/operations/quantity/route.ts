import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { supabase as anonSupabase } from '@/lib/supabase';

interface TechrarRawItem {
  id?: number | string;
  product_id?: number | string;
  productId?: number | string;
  meal_code?: number | string;
  mealCode?: number | string;
  code?: number | string;
  product_name?: string | null;
  productName?: string | null;
  name_ar?: string | null;
  nameAr?: string | null;
  meal_name_ar?: string | null;
  name_en?: string | null;
  nameEn?: string | null;
  product_name_en?: string | null;
  meal_name_en?: string | null;
  name?: string | null;
  quantity?: number | string | null;
  total_quantity?: number | string | null;
  count?: number | string | null;
  qty?: number | string | null;
  meals_count?: number | string | null;
  status?: string | null;
  order_status?: string | null;
  report_date?: string | null;
  date?: string | null;
  category?: string | null;
  category_ar?: string | null;
}

export interface AggregatedMealItem {
  id: string;
  product_id: number;
  product_name: string;
  mealCode: number;
  nameAr: string;
  nameEn: string;
  quantity: number;
  report_date: string;
  category: string;
}

const STATUS_MAPPING: Record<string, string> = {
  'مؤكد': 'confirmed',
  'تم التوصيل': 'delivered',
  'لم يتم استلامه من قبل العميل': 'not_received_by_customer',
  'لم يتم استلامه من قبل المطعم': 'not_received_by_restaurant',
};

function getDbClient() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ? getSupabaseAdmin() : anonSupabase;
}

/**
 * Enriches aggregated items with categories and English names from Supabase `menu_items`
 */
async function enrichWithMenuMeta(items: AggregatedMealItem[]): Promise<void> {
  if (items.length === 0) return;

  try {
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? getSupabaseAdmin()
      : anonSupabase;

    const ids = items.map((i) => String(i.product_id));
    const { data } = await supabase
      .from('menu_items')
      .select('meal_code, category_ar, meal_name_en, meal_name_ar')
      .in('meal_code', ids);

    if (data && data.length > 0) {
      const metaMap = new Map<number, { categoryAr?: string; nameEn?: string; nameAr?: string }>();
      for (const row of data) {
        const num = Number(row.meal_code);
        if (Number.isFinite(num)) {
          metaMap.set(num, {
            categoryAr: row.category_ar,
            nameEn: row.meal_name_en,
            nameAr: row.meal_name_ar,
          });
        }
      }

      for (const item of items) {
        const meta = metaMap.get(item.product_id);
        if (meta) {
          if ((!item.category || item.category === 'عام') && meta.categoryAr) {
            item.category = meta.categoryAr;
          }
          if (!item.nameEn && meta.nameEn) {
            item.nameEn = meta.nameEn;
          }
          if ((!item.product_name || item.product_name.startsWith('وجبة #')) && meta.nameAr) {
            item.product_name = meta.nameAr;
            item.nameAr = meta.nameAr;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[enrichWithMenuMeta] Non-fatal menu metadata error:', err);
  }
}

const boqSyncLocks = new Map<string, Promise<boolean>>();

/**
 * Safely syncs `techrar_boq` for `targetDate` WITHOUT triggering any legacy PostgreSQL
 * `AFTER INSERT` inventory trigger:
 * - Updates existing `product_id` rows in place when `quantity` or `product_name` changed.
 * - Inserts any brand-new `product_id` rows with `quantity: 0` first, then updates `quantity`
 *   to the real value (so `AFTER INSERT` triggers see `0` and never double-deduct stock).
 * - Removes stale/duplicate rows when syncing the full day (`isFullStatusSync`).
 */
async function syncSupabaseCache(
  targetDate: string,
  aggregatedItems: AggregatedMealItem[],
  isFullStatusSync: boolean
): Promise<boolean> {
  const prevSync = boqSyncLocks.get(targetDate) ?? Promise.resolve(true);

  const task = prevSync
    .catch(() => true)
    .then(async (): Promise<boolean> => {
      try {
        const supabase = getDbClient();

        const { data: existingRows, error: fetchError } = await supabase
          .from('techrar_boq')
          .select('id, product_id, product_name, quantity')
          .eq('report_date', targetDate);

        if (fetchError) {
          console.error('[Supabase Cache] Error reading existing techrar_boq rows:', fetchError.message);
          return false;
        }

        // Do not overwrite full-day BOQ cache with a partial single-status filter
        if (!isFullStatusSync && existingRows && existingRows.length > 0) {
          return true;
        }

        const existingByProductId = new Map<
          number,
          { id: number; product_name: string; quantity: number }
        >();
        const duplicateOrStaleIds: number[] = [];

        for (const row of existingRows || []) {
          const pid = Number(row.product_id);
          const rowId = Number(row.id);
          if (!existingByProductId.has(pid)) {
            existingByProductId.set(pid, {
              id: rowId,
              product_name: String(row.product_name || ''),
              quantity: Number(row.quantity || 0),
            });
          } else if (Number.isFinite(rowId)) {
            duplicateOrStaleIds.push(rowId);
          }
        }

        const seenProductIds = new Set<number>();
        const toUpdate: Array<{ id: number; product_name: string; quantity: number }> = [];
        const toInsert: AggregatedMealItem[] = [];

        for (const item of aggregatedItems) {
          seenProductIds.add(item.product_id);
          const existing = existingByProductId.get(item.product_id);
          if (existing) {
            if (
              existing.quantity !== item.quantity ||
              existing.product_name !== item.product_name
            ) {
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

        if (isFullStatusSync) {
          for (const [pid, existing] of existingByProductId.entries()) {
            if (!seenProductIds.has(pid) && Number.isFinite(existing.id)) {
              duplicateOrStaleIds.push(existing.id);
            }
          }
        }

        // 1. Update changed existing rows in place (does NOT fire AFTER INSERT triggers)
        if (toUpdate.length > 0) {
          const updateResults = await Promise.all(
            toUpdate.map((u) =>
              supabase
                .from('techrar_boq')
                .update({ product_name: u.product_name, quantity: u.quantity })
                .eq('id', u.id)
            )
          );
          const failedUpdate = updateResults.find((r) => r.error);
          if (failedUpdate?.error) {
            console.error('[Supabase Cache] Error updating techrar_boq row:', failedUpdate.error.message);
            return false;
          }
        }

        // 2. Insert brand-new rows with quantity = 0 first, then update to real quantity
        //    so any legacy DB AFTER INSERT trigger computes 0 and NEVER double-deducts stock.
        if (toInsert.length > 0) {
          const zeroRows = toInsert.map((item) => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: 0,
            report_date: targetDate,
          }));

          const { data: insertedRows, error: insertError } = await supabase
            .from('techrar_boq')
            .insert(zeroRows)
            .select('id, product_id');

          if (insertError) {
            console.error('[Supabase Cache] Error inserting zero-qty techrar_boq rows:', insertError.message);
            return false;
          }

          const qtyByProdId = new Map<number, number>(
            toInsert.map((i) => [i.product_id, i.quantity])
          );

          const patchResults = await Promise.all(
            (insertedRows || []).map((ins) =>
              supabase
                .from('techrar_boq')
                .update({ quantity: qtyByProdId.get(Number(ins.product_id)) ?? 0 })
                .eq('id', ins.id)
            )
          );
          const failedPatch = patchResults.find((r) => r.error);
          if (failedPatch?.error) {
            console.error('[Supabase Cache] Error setting quantities on new techrar_boq rows:', failedPatch.error.message);
            return false;
          }
        }

        // 3. Clean up stale or duplicate rows
        if (duplicateOrStaleIds.length > 0) {
          const { error: deleteError } = await supabase
            .from('techrar_boq')
            .delete()
            .in('id', duplicateOrStaleIds);

          if (deleteError) {
            console.warn('[Supabase Cache] Warning cleaning stale techrar_boq rows:', deleteError.message);
          }
        }

        console.log(
          `[Supabase Cache] Synced techrar_boq for ${targetDate} (inserted: ${toInsert.length}, updated: ${toUpdate.length}, removed: ${duplicateOrStaleIds.length})`
        );
        return true;
      } catch (err) {
        console.error('[Supabase Cache] Exception while syncing cache:', err);
        return false;
      }
    });

  boqSyncLocks.set(targetDate, task);
  try {
    return await task;
  } finally {
    if (boqSyncLocks.get(targetDate) === task) {
      boqSyncLocks.delete(targetDate);
    }
  }
}

/**
 * Core handler executing concurrent multi-status fetch and aggregation
 */
async function handleBoqRequest(
  fromDate: string,
  toDate: string,
  status: string
) {
  // 1. Request Headers
  const token =
    process.env.TECHRAR_API_TOKEN ||
    process.env.TECHRAR_TOKEN ||
    process.env.TECHRAR_BEARER_TOKEN ||
    '';
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'app_id': '715',
    'org_id': '685',
    'Authorization': `Bearer ${cleanToken}`,
  };

  // 2. Determine Which Statuses to Fetch
  let statusesToFetch: string[] = [];
  if (!status || status === 'الكل') {
    statusesToFetch = [
      'confirmed',
      'delivered',
      'not_received_by_customer',
      'not_received_by_restaurant',
    ];
  } else {
    statusesToFetch = [STATUS_MAPPING[status] || status];
  }

  const url =
    process.env.TECHRAR_API_URL ||
    'https://api.techrar.com/api/v1/dashboard/bill-of-quantity/';

  console.log(`[Techrar BOQ] Fetching statuses: ${statusesToFetch.join(', ')} from: ${url}`);

  // 3. Fetch Concurrently (Promise.all)
  const fetchPromises = statusesToFetch.map(async (st) => {
    const payload = {
      restaurant_id: 715,
      type: 'subscription',
      from_date: fromDate,
      to_date: toDate,
      status: st,
      cities_ids: [4, 1, 12],
      dispatch_branch_ids: [],
      group_by_reference: false,
      grouped: 0,
      grouped_by_description: false,
      grouped_by_size: false,
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        cache: 'no-store',
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error(
          `❌ [Techrar BOQ] (${st}) failed with HTTP ${res.status}:`,
          errorText.slice(0, 300)
        );
        return [];
      }

      const data = await res.json();
      const items: TechrarRawItem[] = Array.isArray(data)
        ? data
        : (data?.data || data?.items || data?.report || data?.boq || data?.results || []);

      console.log(`✅ [Techrar BOQ] (${st}) received ${items.length} items`);
      return items;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ [Techrar BOQ] (${st}) fetch error:`, errMsg);
      return [];
    }
  });

  const resultsArray = await Promise.all(fetchPromises);
  const allRawItems: TechrarRawItem[] = resultsArray.flat();

  console.log(`📊 [Techrar BOQ] Total merged raw items across all statuses: ${allRawItems.length}`);

  // 4. Aggregate & Clean
  // - Group allRawItems by product_id
  // - Sum quantity: Number(item.quantity ?? item.total_quantity ?? item.count ?? 0)
  // - Filter out items with quantity <= 0
  const map = new Map<number, AggregatedMealItem>();

  for (const item of allRawItems) {
    const rawId =
      item.product_id ??
      item.productId ??
      item.meal_code ??
      item.mealCode ??
      item.code ??
      item.id;
    const prodId = Number(rawId);
    if (!Number.isFinite(prodId) || prodId <= 0) {
      continue;
    }

    const qty = Number(
      item.quantity ??
      item.total_quantity ??
      item.count ??
      item.qty ??
      item.meals_count ??
      0
    );
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }

    const name = String(
      item.product_name ??
      item.productName ??
      item.name_ar ??
      item.nameAr ??
      item.meal_name_ar ??
      item.name_en ??
      item.nameEn ??
      item.name ??
      `وجبة #${prodId}`
    ).trim();

    const nameEn = String(
      item.name_en ??
      item.product_name_en ??
      item.meal_name_en ??
      ''
    ).trim();

    const category = String(
      item.category ??
      item.category_ar ??
      'عام'
    ).trim();

    const existing = map.get(prodId);
    if (existing) {
      existing.quantity += qty;
      if ((!existing.product_name || existing.product_name.startsWith('وجبة #')) && name) {
        existing.product_name = name;
        existing.nameAr = name;
      }
      if (!existing.nameEn && nameEn) {
        existing.nameEn = nameEn;
      }
      if ((!existing.category || existing.category === 'عام') && category) {
        existing.category = category;
      }
    } else {
      map.set(prodId, {
        id: `boq-${prodId}`,
        product_id: prodId,
        product_name: name,
        mealCode: prodId,
        nameAr: name,
        nameEn: nameEn,
        quantity: qty,
        report_date: fromDate,
        category: category || 'عام',
      });
    }
  }

  const aggregatedItems = Array.from(map.values());
  aggregatedItems.sort((a, b) => a.product_id - b.product_id);

  // Optional metadata enrichment from menu_items
  await enrichWithMenuMeta(aggregatedItems);

  // 5. Read-only Supabase Cache Sync (no inventory deductions triggered from UI/API)
  const isSingleDate = fromDate === toDate;
  const isFullStatusSync = !status || status === 'الكل';

  if (isSingleDate && aggregatedItems.length > 0) {
    await syncSupabaseCache(fromDate, aggregatedItems, isFullStatusSync);
  }

  const totalMeals = aggregatedItems.reduce((acc, cur) => acc + cur.quantity, 0);

  // 6. Response: Return merged live response
  return NextResponse.json({
    success: true,
    items: aggregatedItems,
    totalMeals,
    uniqueCount: aggregatedItems.length,
    source: 'techrar_live_merged',
  });
}

/**
 * POST handler accepting { from_date, to_date, status }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const today = new Date().toISOString().split('T')[0];
    const from_date = String(body.from_date || body.fromDate || today).trim();
    const to_date = String(body.to_date || body.toDate || from_date).trim();
    const status =
      body.status !== undefined && body.status !== null && String(body.status).trim() !== ''
        ? String(body.status).trim()
        : 'الكل';

    return await handleBoqRequest(from_date, to_date, status);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[POST /api/operations/quantity] Error:', err);
    return NextResponse.json(
      {
        success: false,
        items: [],
        totalMeals: 0,
        uniqueCount: 0,
        source: 'techrar_live_merged',
        error: message,
      },
      { status: 500 }
    );
  }
}
