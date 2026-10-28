import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface OperationSchedule {
  day_of_week: number;
  day_name_ar?: string | null;
  cooking_day_ar: string;
  delivery_day_ar: string | null;
  is_off: boolean;
}

/**
 * Fetches today's operation schedule row from Supabase `operation_schedule`
 * where `day_of_week` matches JavaScript's `new Date().getDay()` (0 = Sunday .. 6 = Saturday).
 */
export async function getTodaySchedule(): Promise<OperationSchedule | null> {
  const currentDay = new Date().getDay();

  const { data, error } = await supabase
    .from('operation_schedule')
    .select('day_of_week, day_name_ar, cooking_day_ar, delivery_day_ar, is_off')
    .eq('day_of_week', currentDay)
    .maybeSingle();

  if (error) {
    console.error('[getTodaySchedule] Error fetching operation_schedule:', error.message);
    return null;
  }

  return (data as OperationSchedule | null) ?? null;
}
