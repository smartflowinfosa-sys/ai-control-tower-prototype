import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const itemCode = searchParams.get('item_code')?.trim().toUpperCase();
    const startDate = searchParams.get('start_date')?.trim();
    const endDate = searchParams.get('end_date')?.trim();

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('inventory_consumption_history')
      .select('id, item_code, target_date, balance_before, quantity_consumed, balance_after, created_at')
      .order('target_date', { ascending: false })
      .order('id', { ascending: false });

    if (itemCode) {
      query = query.eq('item_code', itemCode);
    }
    if (startDate) {
      query = query.gte('target_date', startDate);
    }
    if (endDate) {
      query = query.lte('target_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[GET /api/inventory/consumption-history] Supabase error:`, error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const rows = data || [];

    // Aggregate total quantity_consumed per item_code for the date range
    const consumptionByItem: Record<string, number> = {};
    for (const row of rows) {
      const code = String(row.item_code || '').trim().toUpperCase();
      if (code) {
        consumptionByItem[code] = (consumptionByItem[code] || 0) + (Number(row.quantity_consumed) || 0);
      }
    }

    return NextResponse.json({
      success: true,
      data: rows,
      consumptionByItem,
    });
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'digest' in err &&
      typeof (err as { digest?: string }).digest === 'string' &&
      (err as { digest: string }).digest.startsWith('NEXT_')
    ) {
      throw err;
    }

    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[GET /api/inventory/consumption-history] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
