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
