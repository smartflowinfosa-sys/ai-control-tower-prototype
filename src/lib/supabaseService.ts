import { supabase } from './supabase';
import { getSessionPurchaseOrders, updateSessionPurchaseOrder } from './mockInventoryData';

export interface SupabaseInventoryItem {
  item_code: string;
  item_name_ar: string;
  item_name_en?: string;
  category_ar?: string;
  category_en?: string;
  current_stock: number;
  reorder_level: number;
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

export interface MenuItem {
  id?: string;
  meal_name_ar: string;
  meal_name_en?: string;
  category_ar?: string;
  category_en?: string;
  price?: number;
  is_active?: boolean;
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

  const items = (data as SupabaseInventoryItem[]) || [];
  return items.sort((a, b) => a.item_code.localeCompare(b.item_code, undefined, { numeric: true, sensitivity: 'base' }));
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
 */
export async function uploadInvoice(file: File, poNumber: string): Promise<string> {
  const filePath = `po-${poNumber}-${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from('invoices')
    .upload(filePath, file);

  if (error) {
    console.warn('Notice from Supabase Storage upload (invoices):', error.message);
  }

  const targetPath = data?.path || filePath;
  const { data: publicUrlData } = supabase.storage
    .from('invoices')
    .getPublicUrl(targetPath);

  return publicUrlData.publicUrl;
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

  // 1. Resolve corresponding item code
  const sessionPO = getSessionPurchaseOrders().find(p => p.id === poNumber);
  if (!targetItemCode && sessionPO?.itemId) {
    targetItemCode = sessionPO.itemId;
  }

  // Try checking purchase_orders table if it exists in Supabase
  try {
    const { data: poRow } = await supabase
      .from('purchase_orders')
      .select('item_id, item_code')
      .eq('id', poNumber)
      .maybeSingle();
    if (!targetItemCode && (poRow?.item_code || poRow?.item_id)) {
      targetItemCode = poRow.item_code || poRow.item_id;
    }
  } catch {
    // purchase_orders table query optional
  }

  // 2. Update purchase_orders table: set status to "تم الاستلام", and store invoiceUrl and signature (if columns exist)
  try {
    const { error: poErr } = await supabase
      .from('purchase_orders')
      .update({
        status: 'تم الاستلام',
        invoice_url: invoiceUrl,
        invoiceUrl: invoiceUrl,
        signature: actualSignature || null,
        receiver_signature: actualSignature || null,
        received_quantity: Number(receivedQty),
        receivedQty: Number(receivedQty),
        received_at: new Date().toISOString(),
      })
      .eq('id', poNumber);

    if (poErr) {
      // Fallback with standard columns if camelCase or extra fields are rejected
      await supabase
        .from('purchase_orders')
        .update({
          status: 'تم الاستلام',
          invoice_url: invoiceUrl,
        })
        .eq('id', poNumber);
    }
  } catch (err) {
    console.warn('purchase_orders table update skipped or not implemented:', err);
  }

  // Synchronize in-memory session purchase orders
  updateSessionPurchaseOrder(poNumber, {
    status: 'تم الاستلام',
    receivedQuantity: Number(receivedQty),
    invoiceUrl,
    receiverSignature: actualSignature,
    receivedAt: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
  });

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

      const { error: updateErr } = await supabase
        .from('inventory_items')
        .update({ current_stock: finalStock })
        .eq('item_code', currentItem.item_code);

      if (updateErr) {
        console.error('Failed to update current_stock in inventory_items:', updateErr.message);
        throw new Error(`تعذر تحديث كمية المخزون في Supabase: ${updateErr.message}`);
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

