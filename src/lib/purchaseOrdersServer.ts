import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { SupabasePurchaseOrder } from '@/lib/supabaseService';
import { isUuidString, sanitizeCreatorName } from '@/lib/poAuth';

const LEGACY_TOKENS = new Set([
  '',
  'human',
  'ai_agent',
  'ai agent',
  'system user',
  'مستخدم النظام',
  'موظف المشتريات',
  'مدير العمليات',
]);

/**
 * Resolves an array of Supabase user IDs (`created_by`) to their clean display names
 * by checking `profiles.full_name`, `app_users`, and `auth.users` (`user_metadata.full_name`).
 */
export async function resolveCreatorNamesByIds(userIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(userIds.filter(id => isUuidString(id))));
  const result = new Map<string, string>();
  if (uniqueIds.length === 0) return result;

  const supabaseAdmin = getSupabaseAdmin();

  // 1. Check `profiles.full_name` if `profiles` table exists in Supabase
  try {
    const { data: profilesData, error: profilesErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', uniqueIds);

    if (!profilesErr && Array.isArray(profilesData)) {
      for (const row of profilesData as Array<{ id: string; full_name?: string | null }>) {
        const clean = sanitizeCreatorName(row.full_name);
        if (row.id && clean) {
          result.set(row.id, clean);
        }
      }
    }
  } catch {
    // `profiles` table is optional if users reside in `app_users` or `auth.users`
  }

  // 2. Check `app_users` for any IDs not yet resolved
  const remainingForAppUsers = uniqueIds.filter(id => !result.has(id));
  if (remainingForAppUsers.length > 0) {
    try {
      const { data: appUsersData, error: appUsersErr } = await supabaseAdmin
        .from('app_users')
        .select('id, name_en, name_ar, username')
        .in('id', remainingForAppUsers);

      if (!appUsersErr && Array.isArray(appUsersData)) {
        for (const u of appUsersData as Array<{
          id: string;
          name_en?: string | null;
          name_ar?: string | null;
          username?: string | null;
        }>) {
          const clean = sanitizeCreatorName(u.name_en || u.name_ar || u.username);
          if (u.id && clean) {
            result.set(u.id, clean);
          }
        }
      }
    } catch {
      // Ignore if unavailable
    }
  }

  // 3. Check Supabase Auth `user.user_metadata.full_name` for any remaining unresolved IDs
  const remainingForAuth = uniqueIds.filter(id => !result.has(id));
  for (const uid of remainingForAuth) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(uid);
      if (!error && data?.user) {
        const metaName =
          (data.user.user_metadata?.full_name as string | undefined) ||
          (data.user.user_metadata?.name as string | undefined) ||
          data.user.email ||
          '';
        const clean = sanitizeCreatorName(metaName);
        if (clean) {
          result.set(uid, clean);
        }
      }
    } catch {
      // Ignore individual lookup errors
    }
  }

  return result;
}

interface RawPurchaseOrderRow {
  po_number: string;
  supplier_id?: string;
  inventory_item_code?: string;
  quantity?: number;
  total_cost?: number;
  status: string;
  created_at?: string;
  created_by?: string | null;
  invoice_url?: string | null;
  receiver_signature?: string | null;
  suppliers?: { id?: string; name_ar?: string; name_en?: string } | Array<{ id?: string; name_ar?: string; name_en?: string }> | null;
  inventory_items?: { item_code?: string; item_name_ar?: string; category_ar?: string } | Array<{ item_code?: string; item_name_ar?: string; category_ar?: string }> | null;
}

/**
 * Fetches all Purchase Orders from Supabase on the server and resolves `created_by` (`user.id`)
 * to clean user display names.
 */
export async function fetchPurchaseOrdersServer(): Promise<SupabasePurchaseOrder[]> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('purchase_orders')
    .select(`
      po_number,
      supplier_id,
      inventory_item_code,
      quantity,
      total_cost,
      status,
      created_at,
      created_by,
      invoice_url,
      receiver_signature,
      suppliers (
        id,
        name_ar,
        name_en
      ),
      inventory_items (
        item_code,
        item_name_ar,
        category_ar
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[fetchPurchaseOrdersServer] Supabase query error:', error.message);
    throw new Error(`خطأ في جلب أوامر الشراء من Supabase: ${error.message}`);
  }

  const rows = (data || []) as RawPurchaseOrderRow[];
  const creatorIds = rows
    .map(r => String(r.created_by || '').trim())
    .filter(val => isUuidString(val));

  const creatorNameMap = await resolveCreatorNamesByIds(creatorIds);
  const groupedMap = new Map<string, SupabasePurchaseOrder>();

  for (const row of rows) {
    const sup = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const inv = Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items;
    const supName = sup?.name_ar || sup?.name_en || 'المورد المعتمد';
    const code = String(row.inventory_item_code || '').trim().toUpperCase();
    const itemName = inv?.item_name_ar || code || 'صنف توريد';
    const qty = Number(row.quantity) || 0;
    const cost = Number(row.total_cost) || 0;
    const poNum = String(row.po_number || '').trim();
    if (!poNum) continue;

    const rawCreatedBy = String(row.created_by || '').trim();
    let resolvedCreatorName = '';
    let resolvedCreatorId: string | undefined = undefined;

    if (isUuidString(rawCreatedBy)) {
      resolvedCreatorId = rawCreatedBy;
      resolvedCreatorName = creatorNameMap.get(rawCreatedBy) || '';
    } else {
      const cleaned = sanitizeCreatorName(rawCreatedBy);
      if (cleaned && !LEGACY_TOKENS.has(cleaned.toLowerCase()) && !LEGACY_TOKENS.has(rawCreatedBy.toLowerCase())) {
        resolvedCreatorName = cleaned;
      }
    }

    const existing = groupedMap.get(poNum);
    if (!existing) {
      groupedMap.set(poNum, {
        id: poNum,
        po_number: poNum,
        itemId: code,
        itemName,
        items: code ? [{ itemId: code, itemName, quantity: qty }] : [],
        supplierName: supName,
        supplier_id: row.supplier_id || '',
        supplierId: row.supplier_id || '',
        quantity: qty,
        totalCost: cost,
        status: row.status || 'PENDING_APPROVAL',
        createdAt: row.created_at ? new Date(row.created_at).toLocaleDateString('en-US') : '',
        createdBy: resolvedCreatorName,
        createdById: resolvedCreatorId,
        invoiceUrl: row.invoice_url || undefined,
        invoice_url: row.invoice_url || undefined,
        receiverSignature: row.receiver_signature || undefined,
        receiver_signature: row.receiver_signature || undefined,
      });
    } else {
      existing.quantity += qty;
      existing.totalCost = Number((existing.totalCost + cost).toFixed(2));
      if (code) {
        const currentItems = existing.items || [];
        const matchIdx = currentItems.findIndex(it => it.itemId === code);
        if (matchIdx >= 0) {
          currentItems[matchIdx].quantity += qty;
        } else {
          currentItems.push({ itemId: code, itemName, quantity: qty });
        }
        existing.items = currentItems;
        if (currentItems.length > 1) {
          existing.itemName = `${currentItems[0].itemName} (+${currentItems.length - 1})`;
        }
      }
      if (!existing.createdBy && resolvedCreatorName) {
        existing.createdBy = resolvedCreatorName;
      }
      if (!existing.createdById && resolvedCreatorId) {
        existing.createdById = resolvedCreatorId;
      }
    }
  }

  return Array.from(groupedMap.values());
}

/**
 * Inserts a new Purchase Order into Supabase linking `created_by` strictly to `user.id`,
 * and returns the normalized PO with the user's clean display name.
 */
export async function createPurchaseOrderServer(
  poData: {
    po_number?: string;
    supplier_id?: string;
    inventory_item_code: string;
    quantity: number;
    total_cost: number;
    status?: string;
  },
  authenticatedUserId: string,
  fallbackDisplayName?: string
): Promise<SupabasePurchaseOrder> {
  const userId = String(authenticatedUserId || '').trim();
  if (!userId) {
    throw new Error('لا يمكن إنشاء أمر شراء بدون معرف مستخدم موثق (Missing user.id)');
  }

  const supabaseAdmin = getSupabaseAdmin();
  const poNumber = poData.po_number || `PO-${Math.floor(1000 + Math.random() * 9000)}`;

  const selectColumns = `
      po_number,
      supplier_id,
      inventory_item_code,
      quantity,
      total_cost,
      status,
      created_at,
      created_by,
      invoice_url,
      receiver_signature,
      suppliers (
        id,
        name_ar,
        name_en
      ),
      inventory_items (
        item_code,
        item_name_ar,
        category_ar
      )
    `;

  const payload = {
    po_number: poNumber,
    supplier_id: poData.supplier_id || null,
    inventory_item_code: poData.inventory_item_code,
    quantity: poData.quantity,
    total_cost: poData.total_cost,
    status: poData.status || 'PENDING_APPROVAL',
    created_by: userId,
  };

  const { data, error } = await supabaseAdmin
    .from('purchase_orders')
    .insert([payload])
    .select(selectColumns)
    .single();

  if (error || !data) {
    console.error('[createPurchaseOrderServer] Supabase insert error:', error);
    throw new Error(`تعذر حفظ أمر الشراء في Supabase: ${error?.message || 'Unknown error'}`);
  }

  const nameMap = await resolveCreatorNamesByIds([userId]);
  const cleanCreatorName =
    nameMap.get(userId) || sanitizeCreatorName(fallbackDisplayName) || '';

  const rowData = data as RawPurchaseOrderRow;
  const sup = Array.isArray(rowData.suppliers) ? rowData.suppliers[0] : rowData.suppliers;
  const inv = Array.isArray(rowData.inventory_items) ? rowData.inventory_items[0] : rowData.inventory_items;
  const code = String(rowData.inventory_item_code || '').trim().toUpperCase();
  const itemName = inv?.item_name_ar || code || 'صنف توريد';
  const qty = Number(rowData.quantity) || 0;

  return {
    id: rowData.po_number,
    po_number: rowData.po_number,
    itemId: code,
    itemName,
    items: code ? [{ itemId: code, itemName, quantity: qty }] : [],
    supplierName: sup?.name_ar || sup?.name_en || 'المورد المعتمد',
    supplier_id: rowData.supplier_id || '',
    supplierId: rowData.supplier_id || '',
    quantity: qty,
    totalCost: Number(rowData.total_cost) || 0,
    status: rowData.status,
    createdAt: rowData.created_at ? new Date(rowData.created_at).toLocaleDateString('en-US') : '',
    createdBy: cleanCreatorName,
    createdById: userId,
  };
}

