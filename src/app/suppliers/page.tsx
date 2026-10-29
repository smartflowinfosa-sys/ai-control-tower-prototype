import dynamic from 'next/dynamic';
import { unstable_cache } from 'next/cache';
import {
  fetchSuppliers,
  fetchInventoryItems,
  fetchAllSupplierItems,
  SupabaseSupplier,
  SupabaseInventoryItem,
  SupabasePurchaseOrder,
  SupabaseSupplierItem,
} from '@/lib/supabaseService';
import { fetchPurchaseOrdersServer } from '@/lib/purchaseOrdersServer';

const SuppliersClient = dynamic(() => import('./SuppliersClient'), {
  loading: () => (
    <div className="page-shell w-full mx-auto space-y-6 font-sans animate-pulse">
      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6 h-24" />
      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6 h-80" />
      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6 h-96" />
    </div>
  ),
});

const getCachedSuppliers = unstable_cache(
  async () => fetchSuppliers(),
  ['suppliers-list'],
  { revalidate: 60, tags: ['suppliers'] }
);

const getCachedInventoryItems = unstable_cache(
  async () => fetchInventoryItems(),
  ['inventory-items-with-suppliers'],
  { revalidate: 60, tags: ['inventory-items', 'supplier-items'] }
);

const getCachedPurchaseOrders = unstable_cache(
  async () => fetchPurchaseOrdersServer(),
  ['purchase-orders-list'],
  { revalidate: 60, tags: ['purchase-orders'] }
);

const getCachedSupplierItems = unstable_cache(
  async () => fetchAllSupplierItems(),
  ['all-supplier-items'],
  { revalidate: 60, tags: ['supplier-items'] }
);

export default async function SuppliersPage() {
  let initialSuppliers: SupabaseSupplier[] = [];
  let initialInventoryItems: SupabaseInventoryItem[] = [];
  let initialPurchaseOrders: SupabasePurchaseOrder[] = [];
  let initialSupplierItems: SupabaseSupplierItem[] = [];
  let fetchError: string | null = null;

  try {
    const [sups, items, pos, supplierItems] = await Promise.all([
      getCachedSuppliers(),
      getCachedInventoryItems().catch(() => []),
      getCachedPurchaseOrders().catch(() => []),
      getCachedSupplierItems().catch(() => []),
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
