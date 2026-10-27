import { supabase } from './supabase';
import { getSessionPurchaseOrders, updateSessionPurchaseOrder } from './mockInventoryData';
import { compareItemCodes, getStockPolicy, CARTON_SIZES } from '@/constants/inventoryCodes';

export interface SupabaseInventoryItem {
  item_code: string;
  item_name_ar: string;
  item_name_en?: string;
  category_ar?: string;
  category_en?: string;
  current_stock: number;
  reorder_level: number;
  /** Minimum stock level / reorder point (INTEGER column `min_stock_level`) */
  min_stock_level?: number | null;
  /** Supplier lead time in days (INTEGER column `lead_time_days`) */
  lead_time_days?: number | null;
  /** Last restock date in ISO string format (e.g., '2026-10-21T10:00:00.000Z') */
  last_restock_date?: string | null;
  cost_per_unit?: number;
  supplier_id?: string | null;
  created_at?: string;
}

export interface InventoryItem {
  id?: string;
  item_code?: string;
  name?: string;
  item_name_ar?: string;
  item_name_en?: string;
  category?: string;
  category_ar?: string;
  category_en?: string;
  current_stock?: number;
  reorder_level?: number;
  currentStock?: number;
  minThreshold?: number;
  maxCapacity?: number;
  unit?: string;
  unitCost?: number;
  supplier_id?: string | null;
  created_at?: string;
}

export interface SupabaseMenuItem {
  meal_code: string;
  meal_name_ar: string;
  meal_name_en?: string | null;
  category?: string | null;
  category_ar?: string | null;
  category_en?: string | null;
  created_at?: string;
}

export interface MenuItem extends Partial<SupabaseMenuItem> {
  id?: string;
  meal_name_ar: string;
  meal_name_en?: string;
  category_ar?: string;
  category_en?: string;
  price?: number;
  is_active?: boolean;
}

export interface SupabaseBomPackaging {
  id: string;
  meal_code: string;
  inventory_item_code: string;
  quantity_used: number;
}

export interface BomPackagingDetail extends SupabaseBomPackaging {
  inventory_item?: SupabaseInventoryItem;
}

export interface MealWithPackaging extends SupabaseMenuItem {
  packaging: BomPackagingDetail[];
}

export interface SupabaseSupplier {
  id: string;
  name_ar: string;
  name_en?: string;
  delivery_time_hours: number;
  rating: number;
  location_ar?: string;
  location_en?: string;
  created_at?: string;
  cr_number?: string | null;
  tax_number?: string | null;
  // Normalized & UI compatibility fields:
  name?: string;
  category?: string;
  city?: string;
  phone_number?: string;
  phone?: string;
  email?: string;
  leadTime?: string;
  reliability?: string;
  pricingTier?: string;
  activeOrdersCount?: number;
  tags?: string[];
  metrics?: {
    deliverySpeed: number;
    qualityScore: number;
    priceStability: number;
  };
}

/**
 * Strict default ordering of suppliers:
 * 1. الصندوق المناسب
 * 2. أمجد كميت
 * 3. مزايا
 * 4. عالم الوسام
 */
export const DEFAULT_SUPPLIER_ORDER = [
  'الصندوق المناسب',
  'أمجد كميت',
  'مزايا',
  'عالم الوسام',
];

export function sortSuppliersByDefault(list: SupabaseSupplier[]): SupabaseSupplier[] {
  return [...list].sort((a, b) => {
    const nameA = a.name_ar || a.name || '';
    const nameB = b.name_ar || b.name || '';
    const indexA = DEFAULT_SUPPLIER_ORDER.indexOf(nameA);
    const indexB = DEFAULT_SUPPLIER_ORDER.indexOf(nameB);
    const weightA = indexA !== -1 ? indexA : 999;
    const weightB = indexB !== -1 ? indexB : 999;
    return weightA - weightB;
  });
}

/**
 * Fetch all inventory items from the Supabase database
 */
export async function fetchInventoryItems(): Promise<SupabaseInventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('item_code, item_name_ar, item_name_en, current_stock, reorder_level, cost_per_unit, category_ar, category_en')
    .order('item_code', { ascending: true });

  if (error) {
    console.error('Error in fetchInventoryItems from Supabase:', error.message);
    throw new Error(error.message);
  }

  // DB values win when present; otherwise fall back to the real-world policy constants.
  const items = ((data as SupabaseInventoryItem[]) || []).map(row => {
    const policy = getStockPolicy(row.item_code);
    return {
      ...row,
      min_stock_level: row.min_stock_level ?? policy.min_stock_level ?? null,
      lead_time_days: row.lead_time_days ?? policy.lead_time_days ?? null,
    };
  });
  // Frontend Data Transformation: PostgreSQL standard .order('item_code') sorts lexicographically
  // as P1, P10, P2, P3. Here we apply strict numerical/alphanumeric transformation so P1..P10
  // are sorted strictly ascending (P1, P2 ... P9, P10).
  return items.sort((a, b) => compareItemCodes(a.item_code, b.item_code));
}

function normalizeSupplier(row: any, overrides?: Partial<SupabaseSupplier>): SupabaseSupplier {
  const phoneVal = overrides?.phone_number || overrides?.phone || row?.phone_number || row?.phone || '+966 12 654 3210';
  return {
    ...row,
    ...overrides,
    cr_number: overrides?.cr_number !== undefined ? overrides.cr_number : (row?.cr_number || null),
    tax_number: overrides?.tax_number !== undefined ? overrides.tax_number : (row?.tax_number || null),
    name: row?.name_ar || row?.name_en || overrides?.name || '',
    city: row?.location_ar || row?.location_en || overrides?.city || 'جدة',
    leadTime: row?.delivery_time_hours ? `${row.delivery_time_hours} ساعة` : (overrides?.leadTime || '24 ساعة'),
    category: overrides?.category || row?.category || 'تغليف ومستلزمات تشغيل',
    phone: phoneVal,
    phone_number: phoneVal,
    email: overrides?.email || row?.email || 'orders@supplier.sa',
    reliability: overrides?.reliability || row?.reliability || '98%',
    pricingTier: overrides?.pricingTier || row?.pricingTier || 'أسعار جملة معتمدة',
    activeOrdersCount: overrides?.activeOrdersCount ?? row?.activeOrdersCount ?? 1,
    tags: overrides?.tags || row?.tags || ['تغليف وعلب', 'مورد معتمد'],
    metrics: overrides?.metrics || row?.metrics || {
      deliverySpeed: Math.round(Math.min(99, Math.max(80, 100 - ((row?.delivery_time_hours || 24) - 20) * 0.5))),
      qualityScore: Math.round((row?.rating || 4.5) * 20),
      priceStability: 95,
    },
  };
}

/**
 * Fetch all real suppliers from the Supabase database in strict default order
 */
export async function fetchSuppliers(): Promise<SupabaseSupplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name_ar, name_en, delivery_time_hours, rating, location_ar, location_en, cr_number, tax_number, phone_number, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error in fetchSuppliers from Supabase:', error.message);
    throw new Error(error.message);
  }

  const normalized = ((data as SupabaseSupplier[]) || []).map(row => normalizeSupplier(row));
  return sortSuppliersByDefault(normalized);
}

/**
 * Insert a new supplier into Supabase
 */
export async function addSupplier(supplierData: {
  name_ar: string;
  name_en?: string;
  delivery_time_hours: number;
  rating: number;
  location_ar?: string;
  location_en?: string;
  phone_number?: string;
  phone?: string;
  category?: string;
  pricingTier?: string;
  cr_number?: string | null;
  tax_number?: string | null;
}): Promise<SupabaseSupplier> {
  const phoneVal = supplierData.phone_number || supplierData.phone || null;
  const insertPayload = {
    name_ar: supplierData.name_ar,
    name_en: supplierData.name_en || supplierData.name_ar,
    delivery_time_hours: supplierData.delivery_time_hours,
    rating: supplierData.rating,
    location_ar: supplierData.location_ar || 'جدة',
    location_en: supplierData.location_en || 'Jeddah',
    phone_number: phoneVal,
    cr_number: supplierData.cr_number || null,
    tax_number: supplierData.tax_number || null,
  };

  const { data, error } = await supabase
    .from('suppliers')
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    console.error('Error in addSupplier to Supabase:', error.message);
    throw new Error(error.message);
  }

  return normalizeSupplier(data, supplierData);
}

/**
 * Update an existing supplier in Supabase
 */
export async function updateSupplier(
  id: string,
  supplierData: Partial<SupabaseSupplier>
): Promise<SupabaseSupplier> {
  const updatePayload: Record<string, any> = {};
  if (supplierData.name_ar !== undefined) updatePayload.name_ar = supplierData.name_ar;
  if (supplierData.name_en !== undefined) updatePayload.name_en = supplierData.name_en;
  if (supplierData.delivery_time_hours !== undefined) updatePayload.delivery_time_hours = supplierData.delivery_time_hours;
  if (supplierData.rating !== undefined) updatePayload.rating = supplierData.rating;
  if (supplierData.location_ar !== undefined) updatePayload.location_ar = supplierData.location_ar;
  if (supplierData.location_en !== undefined) updatePayload.location_en = supplierData.location_en;
  if (supplierData.phone_number !== undefined || supplierData.phone !== undefined) {
    updatePayload.phone_number = supplierData.phone_number || supplierData.phone;
  }
  if (supplierData.cr_number !== undefined) updatePayload.cr_number = supplierData.cr_number;
  if (supplierData.tax_number !== undefined) updatePayload.tax_number = supplierData.tax_number;

  const { data, error } = await supabase
    .from('suppliers')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`Error in updateSupplier ${id} in Supabase:`, error.message);
    throw new Error(error.message);
  }

  return normalizeSupplier(data, supplierData);
}

/**
 * Upload an invoice copy to the 'invoices' public storage bucket in Supabase.
 * Returns the public URL of the uploaded file.
 * Sanitizes all file names and paths to safe ASCII characters to prevent Supabase 400 'Invalid key' errors.
 */
export async function uploadInvoice(file: File, poNumber: string): Promise<string> {
  // Sanitize PO number and file extension to pure ASCII characters
  const cleanPo = String(poNumber || 'po').replace(/[^a-zA-Z0-9_-]/g, '');
  const rawExt = file.name && file.name.includes('.')
    ? file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'pdf'
    : 'pdf';
  const safeRandom = Math.random().toString(36).substring(7);
  const filePath = `invoice-${cleanPo ? cleanPo + '-' : ''}${Date.now()}-${safeRandom}.${rawExt}`;

  // Ensure file object itself has a safe ASCII filename
  const safeFile = file.name && /^[a-zA-Z0-9._-]+$/.test(file.name)
    ? file
    : new File([file], `invoice-${Date.now()}-${safeRandom}.${rawExt}`, {
        type: file.type || 'application/pdf',
      });

  try {
    const { data, error } = await supabase.storage
      .from('invoices')
      .upload(filePath, safeFile, {
        contentType: safeFile.type || 'application/pdf',
        upsert: false,
      });

    if (error) {
      console.error(
        `[Storage Bucket Notice] Supabase Storage upload error:`,
        error.message
      );

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('supabase_storage_bucket_error', {
            detail: {
              bucket: 'invoices',
              message: "Please ensure you click 'New Bucket' in Supabase Storage and name it 'invoices' (public)",
              error: error.message,
            },
          })
        );
      }
      throw new Error(`فشل رفع الفاتورة إلى التخزين: ${error.message}`);
    }

    const targetPath = data?.path || filePath;
    const { data: publicUrlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(targetPath);

    return publicUrlData.publicUrl;
  } catch (err: any) {
    console.error(`[Storage Bucket Exception]`, err);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('supabase_storage_bucket_error', {
          detail: {
            bucket: 'invoices',
            message: "Please ensure you click 'New Bucket' in Supabase Storage and name it 'invoices' (public)",
            error: err?.message || String(err),
          },
        })
      );
    }
    throw err;
  }
}

/**
 * Receive stock against a specific Purchase Order:
 * 1. Updates purchase_orders table: set status to "تم الاستلام" (Received), and store invoiceUrl and signature (if columns exist).
 * 2. IMPORTANT: Updates inventory_items table to add receivedQty to the current_stock.
 */
export async function receivePurchaseOrder(
  poNumber: string,
  receivedQty: number,
  invoiceUrl: string,
  signature?: string,
  itemCode?: string
): Promise<{ success: boolean; newStock: number; itemCode: string }> {
  // Support both (poNumber, receivedQty, invoiceUrl, signature, itemCode) and legacy (poNumber, receivedQty, invoiceUrl, itemCode, signature)
  let actualSignature = signature;
  let targetItemCode = itemCode;

  if (
    signature &&
    (signature.startsWith('ITEM-') || signature.startsWith('RAW-') || signature.startsWith('PKG-') || signature.startsWith('inv-') || signature.startsWith('P')) &&
    itemCode &&
    !itemCode.startsWith('ITEM-') &&
    !itemCode.startsWith('RAW-') &&
    !itemCode.startsWith('PKG-') &&
    !itemCode.startsWith('inv-') &&
    !itemCode.startsWith('P')
  ) {
    targetItemCode = signature;
    actualSignature = itemCode;
  }

  // Audit log for traceability
  console.info(`[RECEIVING AUDIT] PO: ${poNumber} | Qty: ${receivedQty} | Signed by: ${actualSignature || 'N/A'} | Invoice: ${invoiceUrl}`);

  // 1. Resolve corresponding item code and supplier_id
  const sessionPO = getSessionPurchaseOrders().find(p => p.id === poNumber);
  if (!targetItemCode && sessionPO?.itemId) {
    targetItemCode = sessionPO.itemId;
  }

  let supplierId = sessionPO?.supplier_id || sessionPO?.supplierId;

  // If supplier_id not set on sessionPO, look up supplier by name from suppliers table
  if (!supplierId && sessionPO?.supplierName) {
    try {
      const { data: matchedSup } = await supabase
        .from('suppliers')
        .select('id')
        .or(`name_ar.eq.${sessionPO.supplierName},name_en.eq.${sessionPO.supplierName}`)
        .maybeSingle();
      if (matchedSup?.id) {
        supplierId = matchedSup.id;
      }
    } catch {
      // ignore
    }

    if (!supplierId) {
      const sName = sessionPO.supplierName.trim();
      if (sName.includes('الصندوق')) supplierId = '11111111-1111-1111-1111-111111111111';
      else if (sName.includes('مزايا')) supplierId = '22222222-2222-2222-2222-222222222222';
      else if (sName.includes('كميت')) supplierId = '33333333-3333-3333-3333-333333333333';
      else if (sName.includes('الوسام')) supplierId = '44444444-4444-4444-4444-444444444444';
    }
  }

  // Try checking purchase_orders table if it exists in Supabase
  try {
    const { data: poRow } = await supabase
      .from('purchase_orders')
      .select('item_id, item_code, supplier_id')
      .eq('id', poNumber)
      .maybeSingle();
    if (!targetItemCode && (poRow?.item_code || poRow?.item_id)) {
      targetItemCode = poRow.item_code || poRow.item_id;
    }
    if (!supplierId && poRow?.supplier_id) {
      supplierId = poRow.supplier_id;
    }
  } catch {
    // purchase_orders table query optional
  }

  // 2. Update purchase_orders table: set status to "تم الاستلام", and store invoiceUrl, signature, and supplier_id
  try {
    const poPayload: Record<string, any> = {
      status: 'تم الاستلام',
      invoice_url: invoiceUrl,
      receiver_signature: actualSignature || null,
    };

    const { error: poErr } = await supabase
      .from('purchase_orders')
      .update(poPayload)
      .eq('po_number', poNumber);

    if (poErr) {
      console.warn('purchase_orders table update notice:', poErr.message);
    }
  } catch (err) {
    console.warn('purchase_orders table update exception:', err);
  }

  // Synchronize in-memory session purchase orders with explicit status and supplier_id
  updateSessionPurchaseOrder(poNumber, {
    status: 'تم الاستلام',
    receivedQuantity: Number(receivedQty),
    invoiceUrl,
    receiverSignature: actualSignature,
    receivedAt: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    ...(supplierId ? { supplier_id: supplierId, supplierId } : {}),
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('purchase_order_received', {
        detail: {
          id: poNumber,
          poNumber,
          supplier_id: supplierId,
          supplierId,
          invoiceUrl,
          receivedQuantity: Number(receivedQty),
        },
      })
    );
  }

  // 3. IMPORTANT: Update inventory_items table: add receivedQty to current_stock
  let finalStock = Number(receivedQty);
  if (targetItemCode) {
    // Try finding item by exact item_code
    let { data: currentItem } = await supabase
      .from('inventory_items')
      .select('item_code, current_stock')
      .eq('item_code', targetItemCode)
      .maybeSingle();

    // If not found by exact code, search by item name
    if (!currentItem && sessionPO?.itemName) {
      const { data: itemByName } = await supabase
        .from('inventory_items')
        .select('item_code, current_stock')
        .ilike('item_name_ar', `%${sessionPO.itemName}%`)
        .maybeSingle();
      if (itemByName) {
        currentItem = itemByName;
        targetItemCode = itemByName.item_code;
      }
    }

    if (currentItem) {
      const existingStock = Number(currentItem.current_stock) || 0;
      finalStock = existingStock + Number(receivedQty);

      const updatePayload: Record<string, any> = {
        current_stock: finalStock,
        last_restock_date: new Date().toISOString(),
      };

      const { error: updateErr } = await supabase
        .from('inventory_items')
        .update(updatePayload)
        .eq('item_code', currentItem.item_code);

      if (updateErr) {
        // If last_restock_date column does not exist yet in DB schema, fall back to current_stock only
        const { error: retryErr } = await supabase
          .from('inventory_items')
          .update({ current_stock: finalStock })
          .eq('item_code', currentItem.item_code);
        if (retryErr) {
          console.error('Failed to update current_stock in inventory_items:', retryErr.message);
          throw new Error(`تعذر تحديث كمية المخزون في Supabase: ${retryErr.message}`);
        }
      }
    } else {
      console.warn(`Could not locate item ${targetItemCode} in inventory_items`);
    }
  }

  return {
    success: true,
    newStock: finalStock,
    itemCode: targetItemCode || '',
  };
}

export interface BatchReceivedItemInput {
  itemCode: string;
  quantityCartons: number;
}

export async function batchReceiveInventory(
  receivedItems: BatchReceivedItemInput[],
  poNumber?: string,
  invoiceUrl?: string,
  signature?: string
): Promise<{ success: boolean; updatedItems: { itemCode: string; addedUnits: number; newStock: number }[] }> {
  const updatedItems: { itemCode: string; addedUnits: number; newStock: number }[] = [];
  const nowIso = new Date().toISOString();

  for (const item of receivedItems) {
    const code = item.itemCode.toUpperCase();
    const cartons = Number(item.quantityCartons) || 0;
    const cSize = CARTON_SIZES[code] || 1;
    const addedUnits = cartons * cSize;

    let finalStock = addedUnits;
    try {
      const { data: cur } = await supabase
        .from('inventory_items')
        .select('item_code, current_stock')
        .eq('item_code', code)
        .maybeSingle();

      if (cur) {
        finalStock = (Number(cur.current_stock) || 0) + addedUnits;
        const { error: err1 } = await supabase
          .from('inventory_items')
          .update({
            current_stock: finalStock,
            last_restock_date: nowIso,
          })
          .eq('item_code', code);
        if (err1) {
          await supabase
            .from('inventory_items')
            .update({ current_stock: finalStock })
            .eq('item_code', code);
        }
      }
    } catch (e) {
      console.warn(`Error updating stock for ${code}:`, e);
    }
    updatedItems.push({ itemCode: code, addedUnits, newStock: finalStock });
  }

  // Update PO if provided
  if (poNumber) {
    try {
      await supabase
        .from('purchase_orders')
        .update({
          status: 'تم الاستلام',
          received_quantity: receivedItems.reduce((acc, i) => acc + (Number(i.quantityCartons) || 0), 0),
          receiver_signature: signature,
          invoice_url: invoiceUrl,
        })
        .eq('id', poNumber);
    } catch (poErr) {
      console.warn('purchase_orders table update exception:', poErr);
    }

    updateSessionPurchaseOrder(poNumber, {
      status: 'تم الاستلام',
      invoiceUrl: invoiceUrl || undefined,
      receiverSignature: signature,
      receivedAt: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('purchase_order_received', {
          detail: {
            id: poNumber,
            poNumber,
            invoiceUrl,
          },
        })
      );
    }
  }

  return { success: true, updatedItems };
}

/**
 * Purchase Orders Model & Dynamic Fetching from Supabase
 */
export interface SupabasePurchaseOrder {
  id: string; // mapped from po_number
  po_number: string;
  itemId: string; // mapped from inventory_item_code
  itemName: string;
  supplierName: string;
  supplier_id: string;
  supplierId: string;
  quantity: number;
  totalCost: number;
  status: string;
  createdAt: string;
  createdBy: 'AI_AGENT' | 'HUMAN';
  invoiceUrl?: string;
  invoice_url?: string;
  receiverSignature?: string;
  receiver_signature?: string;
  receivedQuantity?: number;
  receivedAt?: string;
}

/**
 * Fetch all purchase orders directly from Supabase with joins to suppliers and inventory_items
 */
export async function fetchPurchaseOrders(): Promise<SupabasePurchaseOrder[]> {
  const { data, error } = await supabase
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
    console.error('Failed to fetch purchase orders from Supabase:', error);
    throw new Error(`خطأ في جلب أوامر الشراء من Supabase: ${error.message}`);
  }

  return (data || []).map((row: any) => {
    const sup = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const inv = Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items;
    const supName = sup?.name_ar || sup?.name_en || 'المورد المعتمد';
    const itemName = inv?.item_name_ar || row.inventory_item_code || 'صنف توريد';

    return {
      id: row.po_number,
      po_number: row.po_number,
      itemId: row.inventory_item_code || '',
      itemName,
      supplierName: supName,
      supplier_id: row.supplier_id,
      supplierId: row.supplier_id,
      quantity: Number(row.quantity) || 0,
      totalCost: Number(row.total_cost) || 0,
      status: row.status || 'pending',
      createdAt: row.created_at ? new Date(row.created_at).toLocaleDateString('ar-SA') : '',
      createdBy: (row.created_by as any) || 'HUMAN',
      invoiceUrl: row.invoice_url || undefined,
      invoice_url: row.invoice_url || undefined,
      receiverSignature: row.receiver_signature || undefined,
      receiver_signature: row.receiver_signature || undefined,
    };
  });
}

/**
 * Create and insert a new Purchase Order into Supabase `purchase_orders` table
 */
export async function createPurchaseOrder(poData: {
  po_number?: string;
  supplier_id?: string;
  inventory_item_code: string;
  quantity: number;
  total_cost: number;
  status?: string;
  created_by?: 'AI_AGENT' | 'HUMAN';
}): Promise<SupabasePurchaseOrder> {
  const poNumber = poData.po_number || `PO-${Math.floor(1000 + Math.random() * 9000)}`;

  const payload = {
    po_number: poNumber,
    supplier_id: poData.supplier_id || null,
    inventory_item_code: poData.inventory_item_code,
    quantity: poData.quantity,
    total_cost: poData.total_cost,
    status: poData.status || 'PENDING_APPROVAL',
    created_by: poData.created_by || 'HUMAN',
  };

  const { data, error } = await supabase
    .from('purchase_orders')
    .insert([payload])
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
    .single();

  if (error) {
    console.error('Failed to insert purchase order into Supabase:', error);
    throw new Error(`تعذر حفظ أمر الشراء في Supabase: ${error.message}`);
  }

  const sup = Array.isArray(data.suppliers) ? data.suppliers[0] : data.suppliers;
  const inv = Array.isArray(data.inventory_items) ? data.inventory_items[0] : data.inventory_items;

  return {
    id: data.po_number,
    po_number: data.po_number,
    itemId: data.inventory_item_code || '',
    itemName: inv?.item_name_ar || data.inventory_item_code || 'صنف توريد',
    supplierName: sup?.name_ar || sup?.name_en || 'المورد المعتمد',
    supplier_id: data.supplier_id,
    supplierId: data.supplier_id,
    quantity: Number(data.quantity) || 0,
    totalCost: Number(data.total_cost) || 0,
    status: data.status,
    createdAt: data.created_at ? new Date(data.created_at).toLocaleDateString('ar-SA') : '',
    createdBy: data.created_by,
  };
}

/**
 * Supplier Items Junction Model
 */
export interface SupabaseSupplierItem {
  id: string;
  supplier_id: string;
  inventory_item_code: string;
  price: number;
  is_available: boolean;
  suppliers?: {
    id: string;
    name_ar?: string;
    name_en?: string;
    delivery_time_hours?: number;
    rating?: number;
    location_ar?: string;
  };
  inventory_items?: {
    item_code: string;
    item_name_ar?: string;
    item_name_en?: string;
    cost_per_unit?: number;
  };
}

/**
 * Fetch all supplier-item relationships from `supplier_items` in Supabase
 */
export async function fetchAllSupplierItems(): Promise<SupabaseSupplierItem[]> {
  const { data, error } = await supabase
    .from('supplier_items')
    .select(`
      id,
      supplier_id,
      inventory_item_code,
      price,
      is_available,
      suppliers (
        id,
        name_ar,
        name_en,
        delivery_time_hours,
        rating,
        location_ar
      ),
      inventory_items (
        item_code,
        item_name_ar,
        item_name_en,
        cost_per_unit
      )
    `);

  if (error) {
    console.error('Failed to fetch supplier_items from Supabase:', error);
    return [];
  }

  return (data || []) as unknown as SupabaseSupplierItem[];
}

/**
 * Query supplier_items joined with suppliers table dynamically by inventory_item_code (e.g. P1)
 * Real Database Mapping without hardcoded arrays.
 */
export async function fetchSuppliersForItem(itemCode: string): Promise<Array<{ id: string; name: string }>> {
  const code = (itemCode || '').trim().toUpperCase();
  if (!code) return [];

  const { data, error } = await supabase
    .from('supplier_items')
    .select(`
      supplier_id,
      inventory_item_code,
      suppliers (
        id,
        name_ar,
        name_en
      )
    `)
    .eq('inventory_item_code', code);

  if (error) {
    console.error('Failed to fetch suppliers for item from Supabase:', error.message);
    return [];
  }

  const result: Array<{ id: string; name: string }> = [];
  const seen = new Set<string>();

  for (const row of (data || []) as any[]) {
    const sup = row.suppliers;
    if (sup) {
      const name = (sup.name_ar || sup.name_en || '').trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        result.push({ id: sup.id, name });
      }
    }
  }

  return result;
}

export interface SupplierItemRecord {
  id?: string;
  supplier_id: string;
  item_code: string;
  unit_price?: number;
  item_name_ar?: string;
  item_name_en?: string;
  category_ar?: string;
  current_stock?: number;
  created_at?: string;
}

/**
 * Fetch certified items strictly for a supplier from `supplier_items` junction table joined with `inventory_items`
 */
export async function fetchSupplierItems(supplierId: string): Promise<SupplierItemRecord[]> {
  const { data, error } = await supabase
    .from('supplier_items')
    .select(`
      id,
      supplier_id,
      inventory_item_code,
      price,
      is_available,
      inventory_items (
        item_code,
        item_name_ar,
        item_name_en,
        category_ar,
        category_en,
        current_stock,
        cost_per_unit
      )
    `)
    .eq('supplier_id', supplierId);

  if (error) {
    console.error('Failed to fetch supplier items from Supabase:', error);
    throw new Error(`خطأ في جلب أصناف المورد من Supabase: ${error.message}`);
  }

  return (data || []).map((row: any) => {
    const inv = Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items;
    return {
      id: row.id,
      supplier_id: row.supplier_id,
      item_code: row.inventory_item_code,
      unit_price: row.price ?? inv?.cost_per_unit ?? 0.5,
      item_name_ar: inv?.item_name_ar || row.inventory_item_code,
      item_name_en: inv?.item_name_en || '',
      category_ar: inv?.category_ar || '',
      current_stock: inv?.current_stock ?? 0,
    };
  }).sort((a: any, b: any) => compareItemCodes(a.item_code, b.item_code));
}

/**
 * Add a new certified supply item to `supplier_items` junction table in Supabase
 */
export async function addSupplierItem(
  supplierId: string,
  itemCode: string,
  unitPrice?: number
): Promise<SupplierItemRecord> {
  const { data, error } = await supabase
    .from('supplier_items')
    .insert([{
      supplier_id: supplierId,
      inventory_item_code: itemCode,
      price: unitPrice || 0.5,
      is_available: true,
    }])
    .select(`
      id,
      supplier_id,
      inventory_item_code,
      price,
      is_available,
      inventory_items (
        item_code,
        item_name_ar,
        item_name_en,
        category_ar,
        current_stock,
        cost_per_unit
      )
    `)
    .single();

  if (error) {
    console.error('Failed to insert supplier item into Supabase:', error);
    throw new Error(`تعذر حفظ الصنف للمورد في قاعدة البيانات: ${error.message}`);
  }

  const inv = (data as any)?.inventory_items;
  const newItem: SupplierItemRecord = {
    id: data.id,
    supplier_id: data.supplier_id,
    item_code: data.inventory_item_code,
    unit_price: data.price,
    item_name_ar: inv?.item_name_ar || data.inventory_item_code,
    item_name_en: inv?.item_name_en || '',
    category_ar: inv?.category_ar || '',
    current_stock: inv?.current_stock ?? 0,
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('supplier_items_updated', { detail: newItem }));
  }

  return newItem;
}

/**
 * Fetch all real menu items from Supabase (109+ items)
 */
export async function fetchMenuItems(): Promise<SupabaseMenuItem[]> {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('meal_code', { ascending: true });

    if (error) {
      console.error('Error fetching menu_items from Supabase:', error);
      return [];
    }

    return (data || []) as SupabaseMenuItem[];
  } catch (err) {
    console.error('Unexpected error in fetchMenuItems:', err);
    return [];
  }
}

/**
 * Fetch all BOM packaging relationships from Supabase (313+ relationships)
 */
export async function fetchBomPackaging(): Promise<SupabaseBomPackaging[]> {
  try {
    const { data, error } = await supabase
      .from('bom_packaging')
      .select('*');

    if (error) {
      console.error('Error fetching bom_packaging from Supabase:', error);
      return [];
    }

    return (data || []) as SupabaseBomPackaging[];
  } catch (err) {
    console.error('Unexpected error in fetchBomPackaging:', err);
    return [];
  }
}

/**
 * Fetch meals with joined BOM packaging items and current inventory stock
 */
export async function fetchMealsWithPackaging(): Promise<MealWithPackaging[]> {
  try {
    const [menuResult, bomResult, invResult] = await Promise.all([
      supabase.from('menu_items').select('*').order('meal_code', { ascending: true }),
      supabase.from('bom_packaging').select('*'),
      supabase.from('inventory_items').select('*'),
    ]);

    const menu = (menuResult.data || []) as SupabaseMenuItem[];
    const bom = (bomResult.data || []) as SupabaseBomPackaging[];
    const inv = (invResult.data || []) as SupabaseInventoryItem[];

    const invMap = new Map<string, SupabaseInventoryItem>();
    inv.forEach(i => invMap.set(i.item_code.toUpperCase(), i));

    const bomMap = new Map<string, BomPackagingDetail[]>();
    bom.forEach(b => {
      const code = b.meal_code;
      if (!bomMap.has(code)) bomMap.set(code, []);
      bomMap.get(code)!.push({
        ...b,
        inventory_item: invMap.get(b.inventory_item_code.toUpperCase()),
      });
    });

    return menu.map(m => ({
      ...m,
      packaging: bomMap.get(m.meal_code) || [],
    }));
  } catch (err) {
    console.error('Unexpected error in fetchMealsWithPackaging:', err);
    return [];
  }
}

/**
 * Calculate packaging demand for a scheduled production batch plan
 * Returns a map of inventory item code to total required units
 */
export async function calculatePackagingDemand(
  batches: Array<{ meal_code?: string; target_quantity: number }>
): Promise<Array<{
  item_code: string;
  item_name_ar: string;
  required_units: number;
  current_stock: number;
  is_shortage: boolean;
  shortage_units: number;
}>> {
  try {
    const [bom, inv] = await Promise.all([
      fetchBomPackaging(),
      fetchInventoryItems(),
    ]);

    const invMap = new Map<string, SupabaseInventoryItem>();
    inv.forEach(i => invMap.set(i.item_code.toUpperCase(), i));

    const bomByMeal = new Map<string, SupabaseBomPackaging[]>();
    bom.forEach(b => {
      if (!bomByMeal.has(b.meal_code)) bomByMeal.set(b.meal_code, []);
      bomByMeal.get(b.meal_code)!.push(b);
    });

    const demandMap = new Map<string, number>();
    batches.forEach(batch => {
      if (!batch.meal_code) return;
      const materials = bomByMeal.get(batch.meal_code) || [];
      materials.forEach(mat => {
        const code = mat.inventory_item_code.toUpperCase();
        const needed = (Number(mat.quantity_used) || 1) * (Number(batch.target_quantity) || 0);
        demandMap.set(code, (demandMap.get(code) || 0) + needed);
      });
    });

    const result: Array<{
      item_code: string;
      item_name_ar: string;
      required_units: number;
      current_stock: number;
      is_shortage: boolean;
      shortage_units: number;
    }> = [];

    demandMap.forEach((required_units, item_code) => {
      const invItem = invMap.get(item_code);
      const current_stock = Number(invItem?.current_stock) || 0;
      const is_shortage = current_stock < required_units;
      const shortage_units = is_shortage ? required_units - current_stock : 0;
      result.push({
        item_code,
        item_name_ar: invItem?.item_name_ar || item_code,
        required_units,
        current_stock,
        is_shortage,
        shortage_units,
      });
    });

    return result.sort((a, b) => compareItemCodes(a.item_code, b.item_code));
  } catch (err) {
    console.error('Error calculating packaging demand:', err);
    return [];
  }
}

