import { supabase } from './supabase';

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
  // Normalized & UI compatibility fields:
  name?: string;
  category?: string;
  city?: string;
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
 * Fetch all inventory items from the Supabase database
 */
export async function fetchInventoryItems(): Promise<SupabaseInventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .order('item_code', { ascending: true });

  if (error) {
    console.error('Error in fetchInventoryItems from Supabase:', error.message);
    throw new Error(error.message);
  }

  return (data as SupabaseInventoryItem[]) || [];
}

/**
 * Fetch all real suppliers from the Supabase database
 */
export async function fetchSuppliers(): Promise<SupabaseSupplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error in fetchSuppliers from Supabase:', error.message);
    throw new Error(error.message);
  }

  return ((data as SupabaseSupplier[]) || []).map(row => ({
    ...row,
    name: row.name_ar || row.name_en || '',
    city: row.location_ar || row.location_en || 'جدة',
    leadTime: row.delivery_time_hours ? `${row.delivery_time_hours} ساعة` : '24 ساعة',
    category: row.category || 'تغليف ومستلزمات تشغيل',
    phone: row.phone || '+966 12 654 3210',
    email: row.email || 'orders@supplier.sa',
    reliability: row.reliability || '98%',
    pricingTier: row.pricingTier || 'أسعار جملة معتمدة',
    activeOrdersCount: row.activeOrdersCount ?? 1,
    tags: row.tags || ['تغليف وعلب', 'مورد معتمد'],
    metrics: row.metrics || {
      deliverySpeed: Math.round(Math.min(99, Math.max(80, 100 - ((row.delivery_time_hours || 24) - 20) * 0.5))),
      qualityScore: Math.round((row.rating || 4.5) * 20),
      priceStability: 95,
    },
  }));
}
