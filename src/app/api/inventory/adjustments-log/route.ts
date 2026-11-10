import { NextRequest, NextResponse } from 'next/server';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { supabase } from '@/lib/supabase';
import { getStandardCodeInfo } from '@/constants/inventoryCodes';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('en');

const SAUDI_TZ = 'Asia/Riyadh';

export interface ManualAdjustmentLogRecord {
  id: string;
  item_code: string;
  item_name_ar: string;
  item_name_en: string;
  adjustment_type: 'add' | 'deduct' | 'redirect' | string;
  quantity: number;
  reason: string;
  notes: string | null;
  reference_id: string | null;
  employee_name: string;
  created_at: string;
  ksa_datetime: string;
  ksa_date: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = (searchParams.get('start_date') || '').trim();
    const endDate = (searchParams.get('end_date') || '').trim();

    let db = supabase;
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        db = getSupabaseAdmin();
      }
    } catch {
      db = supabase;
    }

    const [{ data: logsData, error: logsError }, { data: invItems }] = await Promise.all([
      db
        .from('manual_adjustments_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000),
      db
        .from('inventory_items')
        .select('item_code, item_name_ar, item_name_en'),
    ]);

    if (logsError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database Error',
          message: logsError.message,
        },
        { status: 500 }
      );
    }

    const itemMap = new Map<string, { nameAr: string; nameEn: string }>();
    for (const item of invItems || []) {
      const code = String(item.item_code || '').trim().toUpperCase();
      if (code) {
        itemMap.set(code, {
          nameAr: String(item.item_name_ar || code),
          nameEn: String(item.item_name_en || code),
        });
      }
    }

    const enriched: ManualAdjustmentLogRecord[] = (logsData || []).map((row: Record<string, unknown>) => {
      const code = String(row.item_code || '').trim().toUpperCase();
      const dbItem = itemMap.get(code);
      const stdItem = getStandardCodeInfo(code);
      const createdAtRaw = String(row.created_at || new Date().toISOString());
      const ksaMoment = dayjs(createdAtRaw).tz(SAUDI_TZ).locale('en');

      return {
        id: String(row.id || ''),
        item_code: code,
        item_name_ar: dbItem?.nameAr || stdItem?.nameAr || code,
        item_name_en: dbItem?.nameEn || stdItem?.nameEn || code,
        adjustment_type: String(row.adjustment_type || 'add').toLowerCase(),
        quantity: Number(row.quantity ?? 0),
        reason: String(row.reason || '—'),
        notes: row.notes ? String(row.notes) : null,
        reference_id: row.reference_id ? String(row.reference_id) : null,
        employee_name: String(row.employee_name || 'موظف العمليات'),
        created_at: createdAtRaw,
        ksa_datetime: ksaMoment.isValid()
          ? ksaMoment.format('YYYY-MM-DD hh:mm A')
          : createdAtRaw,
        ksa_date: ksaMoment.isValid()
          ? ksaMoment.format('YYYY-MM-DD')
          : createdAtRaw.split('T')[0],
      };
    });

    const filtered = enriched.filter((rec) => {
      if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        if (rec.ksa_date < startDate) return false;
      }
      if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        if (rec.ksa_date > endDate) return false;
      }
      return true;
    });

    return NextResponse.json(
      {
        success: true,
        count: filtered.length,
        records: filtered,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message,
      },
      { status: 500 }
    );
  }
}

