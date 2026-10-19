import { fetchSuppliers, SupabaseSupplier } from '@/lib/supabaseService';
import SuppliersClient from './SuppliersClient';

export const instant = false;

export default async function SuppliersPage() {
  let initialSuppliers: SupabaseSupplier[] = [];
  let fetchError: string | null = null;

  try {
    initialSuppliers = await fetchSuppliers();
  } catch (err: unknown) {
    console.error('Failed to load suppliers from Supabase:', err);
    fetchError = err instanceof Error ? err.message : 'تعذر الاتصال بقاعدة بيانات Supabase لجلب الموردين';
  }

  return (
    <SuppliersClient
      initialSuppliers={initialSuppliers}
      fetchError={fetchError}
    />
  );
}
