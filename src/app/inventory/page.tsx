import { fetchInventoryItems, SupabaseInventoryItem } from '@/lib/supabaseService';
import InventoryClient from './InventoryClient';

export const instant = false;

export default async function InventoryPage() {
  let initialItems: SupabaseInventoryItem[] = [];
  let fetchError: string | null = null;

  try {
    initialItems = await fetchInventoryItems();
  } catch (err: unknown) {
    console.error('Failed to load inventory items from Supabase:', err);
    fetchError = err instanceof Error ? err.message : 'تعذر الاتصال بقاعدة بيانات Supabase لجلب المخزون';
  }

  return (
    <InventoryClient
      initialItems={initialItems}
      fetchError={fetchError}
    />
  );
}
