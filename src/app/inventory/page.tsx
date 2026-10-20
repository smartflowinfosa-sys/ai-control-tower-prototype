import { fetchInventoryItems, fetchPurchaseOrders, SupabaseInventoryItem, SupabasePurchaseOrder } from '@/lib/supabaseService';
import InventoryClient from './InventoryClient';

export const instant = false;

export default async function InventoryPage() {
  let initialItems: SupabaseInventoryItem[] = [];
  let initialPurchaseOrders: SupabasePurchaseOrder[] = [];
  let fetchError: string | null = null;

  try {
    const [items, pos] = await Promise.all([
      fetchInventoryItems(),
      fetchPurchaseOrders().catch(err => {
        console.warn('Failed to fetch purchase orders from Supabase:', err);
        return [];
      }),
    ]);
    initialItems = items;
    initialPurchaseOrders = pos;
  } catch (err: unknown) {
    console.error('Failed to load inventory items from Supabase:', err);
    fetchError = err instanceof Error ? err.message : 'تعذر الاتصال بقاعدة بيانات Supabase لجلب المخزون';
  }

  return (
    <InventoryClient
      initialItems={initialItems}
      initialPurchaseOrders={initialPurchaseOrders}
      fetchError={fetchError}
    />
  );
}
