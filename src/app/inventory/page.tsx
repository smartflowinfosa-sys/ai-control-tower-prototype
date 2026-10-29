import dynamic from 'next/dynamic';
import { unstable_cache } from 'next/cache';
import { fetchInventoryItems, SupabaseInventoryItem, SupabasePurchaseOrder } from '@/lib/supabaseService';
import { fetchPurchaseOrdersServer } from '@/lib/purchaseOrdersServer';

const InventoryClient = dynamic(() => import('./InventoryClient'), {
  loading: () => (
    <div className="page-shell w-full mx-auto space-y-6 font-sans animate-pulse">
      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6 h-24" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5 h-28" />
        <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5 h-28" />
        <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5 h-28" />
      </div>
      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6 h-96" />
    </div>
  ),
});

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

export default async function InventoryPage() {
  let initialItems: SupabaseInventoryItem[] = [];
  let initialPurchaseOrders: SupabasePurchaseOrder[] = [];
  const initialSupplierMappings: Record<string, Array<{ id: string; name: string }>> = {};
  let fetchError: string | null = null;

  try {
    const [items, pos] = await Promise.all([
      getCachedInventoryItems(),
      getCachedPurchaseOrders().catch(err => {
        console.warn('Failed to fetch purchase orders from Supabase:', err);
        return [];
      }),
    ]);
    initialItems = items;
    initialPurchaseOrders = pos;

    // Extract supplier names directly from the joined `supplier_items -> suppliers` on each inventory item (zero N+1 queries)
    for (const item of items) {
      const code = String(item.item_code || '').trim().toUpperCase();
      if (!code || !Array.isArray(item.supplier_items)) continue;
      for (const rel of item.supplier_items) {
        const sup = Array.isArray(rel.suppliers) ? rel.suppliers[0] : rel.suppliers;
        if (!sup) continue;
        const name = (sup.name_ar || sup.name_en || '').trim();
        if (!name) continue;
        if (!initialSupplierMappings[code]) initialSupplierMappings[code] = [];
        if (!initialSupplierMappings[code].some(x => x.name === name)) {
          initialSupplierMappings[code].push({ id: sup.id, name });
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
