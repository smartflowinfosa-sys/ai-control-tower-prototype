import dynamic from 'next/dynamic';
import { unstable_cache } from 'next/cache';
import { SupabasePurchaseOrder, SupabaseInventoryItem, fetchInventoryItems } from '@/lib/supabaseService';
import { fetchPurchaseOrdersServer } from '@/lib/purchaseOrdersServer';

const InventoryClient = dynamic(() => import('./InventoryClient'), {
  loading: () => (
    <div className="page-shell w-full mx-auto space-y-6 font-sans animate-pulse">
      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6 h-24" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5 h-28" />
        <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5 h-28" />
        <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5 h-28" />
        <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5 h-28" />
      </div>
      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6 h-96" />
    </div>
  ),
});

const getCachedPurchaseOrders = unstable_cache(
  async () => fetchPurchaseOrdersServer(),
  ['purchase-orders-list'],
  { revalidate: 60, tags: ['purchase-orders'] }
);

const getCachedInventoryItems = unstable_cache(
  async () => fetchInventoryItems(),
  ['inventory-items-list'],
  { revalidate: 60, tags: ['inventory-items'] }
);

export default async function InventoryPage() {
  let initialPurchaseOrders: SupabasePurchaseOrder[] = [];
  let initialItems: SupabaseInventoryItem[] = [];

  try {
    const [pos, items] = await Promise.all([
      getCachedPurchaseOrders().catch(err => {
        console.warn('Failed to fetch purchase orders from Supabase:', err);
        return [];
      }),
      getCachedInventoryItems().catch(err => {
        console.warn('Failed to fetch inventory items from Supabase:', err);
        return [];
      }),
    ]);
    initialPurchaseOrders = pos;
    initialItems = items;
  } catch (err: unknown) {
    console.warn('Failed to load initial purchase orders:', err);
  }

  return <InventoryClient initialItems={initialItems} initialPurchaseOrders={initialPurchaseOrders} />;
}
