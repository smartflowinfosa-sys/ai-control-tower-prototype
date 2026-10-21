import { fetchSuppliers, fetchInventoryItems, fetchPurchaseOrders, fetchAllSupplierItems, SupabaseSupplier, SupabaseInventoryItem, SupabasePurchaseOrder, SupabaseSupplierItem } from '@/lib/supabaseService';
import SuppliersClient from './SuppliersClient';

export const instant = false;

export default async function SuppliersPage() {
  let initialSuppliers: SupabaseSupplier[] = [];
  let initialInventoryItems: SupabaseInventoryItem[] = [];
  let initialPurchaseOrders: SupabasePurchaseOrder[] = [];
  let initialSupplierItems: SupabaseSupplierItem[] = [];
  let fetchError: string | null = null;

  try {
    const [sups, items, pos, supplierItems] = await Promise.all([
      fetchSuppliers(),
      fetchInventoryItems().catch(() => []),
      fetchPurchaseOrders().catch(() => []),
      fetchAllSupplierItems().catch(() => []),
    ]);
    initialSuppliers = sups;
    initialInventoryItems = items;
    initialPurchaseOrders = pos;
    initialSupplierItems = supplierItems;
  } catch (err: unknown) {
    console.error('Failed to load suppliers from Supabase:', err);
    fetchError = err instanceof Error ? err.message : 'تعذر الاتصال بقاعدة بيانات Supabase لجلب الموردين';
  }

  return (
    <SuppliersClient
      initialSuppliers={initialSuppliers}
      initialInventoryItems={initialInventoryItems}
      initialPurchaseOrders={initialPurchaseOrders}
      initialSupplierItems={initialSupplierItems}
      fetchError={fetchError}
    />
  );
}
