import { fetchSuppliers, fetchInventoryItems, SupabaseSupplier, SupabaseInventoryItem } from '@/lib/supabaseService';
import SuppliersClient from './SuppliersClient';

export const instant = false;

export default async function SuppliersPage() {
  let initialSuppliers: SupabaseSupplier[] = [];
  let initialInventoryItems: SupabaseInventoryItem[] = [];
  let fetchError: string | null = null;

  try {
    const [sups, items] = await Promise.all([
      fetchSuppliers(),
      fetchInventoryItems().catch(() => []),
    ]);
    initialSuppliers = sups;
    initialInventoryItems = items;
  } catch (err: unknown) {
    console.error('Failed to load suppliers from Supabase:', err);
    fetchError = err instanceof Error ? err.message : 'تعذر الاتصال بقاعدة بيانات Supabase لجلب الموردين';
  }

  return (
    <SuppliersClient
      initialSuppliers={initialSuppliers}
      initialInventoryItems={initialInventoryItems}
      fetchError={fetchError}
    />
  );
}
