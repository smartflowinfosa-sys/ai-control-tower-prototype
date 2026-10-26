import { fetchInventoryItems, fetchPurchaseOrders, fetchAllSupplierItems, SupabaseInventoryItem, SupabasePurchaseOrder } from '@/lib/supabaseService';
import InventoryClient from './InventoryClient';

export const instant = false;

export default async function InventoryPage() {
  let initialItems: SupabaseInventoryItem[] = [];
  let initialPurchaseOrders: SupabasePurchaseOrder[] = [];
  let initialSupplierMappings: Record<string, Array<{ id: string; name: string }>> = {};
  let fetchError: string | null = null;

  try {
    const [items, pos, supplierItems] = await Promise.all([
      fetchInventoryItems(),
      fetchPurchaseOrders().catch(err => {
        console.warn('Failed to fetch purchase orders from Supabase:', err);
        return [];
      }),
      fetchAllSupplierItems().catch(err => {
        console.warn('Failed to fetch supplier_items from Supabase:', err);
        return [];
      }),
    ]);
    initialItems = items;
    initialPurchaseOrders = pos;

    if (supplierItems && supplierItems.length > 0) {
      for (const row of supplierItems as any[]) {
        const code = String(row.inventory_item_code || '').trim().toUpperCase();
        const sup = row.suppliers;
        if (code && sup) {
          const name = (sup.name_ar || sup.name_en || '').trim();
          if (!initialSupplierMappings[code]) initialSupplierMappings[code] = [];
          if (name && !initialSupplierMappings[code].some(x => x.name === name)) {
            initialSupplierMappings[code].push({ id: sup.id, name });
          }
        }
      }
    }
  } catch (err: unknown) {
    console.error('Failed to load inventory items from Supabase:', err);
    fetchError = err instanceof Error ? err.message : 'تعذر الاتصال بقاعدة بيانات Supabase لجلب المخزون';
  }

  return (
    <InventoryClient
      initialItems={initialItems}
      initialPurchaseOrders={initialPurchaseOrders}
      initialSupplierMappings={initialSupplierMappings}
      fetchError={fetchError}
    />
  );
}
