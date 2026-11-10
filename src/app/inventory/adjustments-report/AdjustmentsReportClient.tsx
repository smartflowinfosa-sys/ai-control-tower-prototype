"use client";

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
  ArrowRight,
  Calendar,
  RefreshCw,
  Search,
  PlusCircle,
  MinusCircle,
  ShieldAlert,
  FileSpreadsheet,
  Filter,
  RotateCcw,
  User,
  Package,
  Clock,
  Hash,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getStandardCodeInfo } from '@/constants/inventoryCodes';
import { useLanguage } from '@/components/common/LanguageContext';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('en');

const SAUDI_TZ = 'Asia/Riyadh';

const englishNumericStyle: CSSProperties = {
  fontFamily: 'var(--font-inter), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  fontFeatureSettings: '"locl" 0, "lnum" 1, "tnum" 1',
  fontVariantNumeric: 'lining-nums tabular-nums',
  direction: 'ltr',
};

const toEnglishDigitsStr = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .trim();
};

export interface AdjustmentLogRow {
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

export default function AdjustmentsReportClient() {
  const { lang } = useLanguage();
  const [records, setRecords] = useState<AdjustmentLogRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchAdjustmentsLog = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/inventory/adjustments-log', {
        method: 'GET',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => null);

      if (res.ok && json?.success && Array.isArray(json.records)) {
        setRecords(json.records);
        return;
      }

      // Direct fallback to Supabase client if needed
      const { data: rawLogs, error: sbError } = await supabase
        .from('manual_adjustments_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (sbError) {
        throw new Error(sbError.message);
      }

      const mapped: AdjustmentLogRow[] = (rawLogs || []).map((row: Record<string, unknown>) => {
        const code = String(row.item_code || '').trim().toUpperCase();
        const std = getStandardCodeInfo(code);
        const createdAtRaw = String(row.created_at || new Date().toISOString());
        const ksaMoment = dayjs(createdAtRaw).tz(SAUDI_TZ).locale('en');

        return {
          id: String(row.id || ''),
          item_code: code,
          item_name_ar: std?.nameAr || code,
          item_name_en: std?.nameEn || code,
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

      setRecords(mapped);
    } catch (err: unknown) {
      console.error('Error loading manual_adjustments_log:', err);
      setErrorMsg(err instanceof Error ? err.message : 'تعذر تحميل سجل التعديلات اليدوية');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAdjustmentsLog();
  }, [fetchAdjustmentsLog]);

  const filteredRecords = useMemo(() => {
    const cleanStart = toEnglishDigitsStr(startDate);
    const cleanEnd = toEnglishDigitsStr(endDate);
    const q = toEnglishDigitsStr(searchQuery).toLowerCase();

    return records.filter((row) => {
      if (cleanStart && /^\d{4}-\d{2}-\d{2}$/.test(cleanStart)) {
        if (row.ksa_date < cleanStart) return false;
      }
      if (cleanEnd && /^\d{4}-\d{2}-\d{2}$/.test(cleanEnd)) {
        if (row.ksa_date > cleanEnd) return false;
      }
      if (typeFilter !== 'ALL' && row.adjustment_type !== typeFilter) {
        return false;
      }
      if (q) {
        const refMatch = (row.reference_id || '').toLowerCase().includes(q);
        const codeMatch = row.item_code.toLowerCase().includes(q);
        const nameMatch = row.item_name_ar.toLowerCase().includes(q);
        const reasonMatch = row.reason.toLowerCase().includes(q);
        const empMatch = row.employee_name.toLowerCase().includes(q);
        const notesMatch = (row.notes || '').toLowerCase().includes(q);
        if (!refMatch && !codeMatch && !nameMatch && !reasonMatch && !empMatch && !notesMatch) {
          return false;
        }
      }
      return true;
    });
  }, [records, startDate, endDate, typeFilter, searchQuery]);

  const summary = useMemo(() => {
    let addedUnits = 0;
    let deductedUnits = 0;
    let redirectedUnits = 0;

    for (const r of filteredRecords) {
      if (r.adjustment_type === 'add') addedUnits += r.quantity;
      else if (r.adjustment_type === 'deduct') deductedUnits += r.quantity;
      else if (r.adjustment_type === 'redirect') redirectedUnits += r.quantity;
    }

    return {
      totalCount: filteredRecords.length,
      addedUnits,
      deductedUnits,
      redirectedUnits,
    };
  }, [filteredRecords]);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setTypeFilter('ALL');
    setSearchQuery('');
  };

  return (
    <div
      className="page-shell w-full mx-auto space-y-6 font-sans text-white tabular-nums"
      style={{
        fontFeatureSettings: '"locl" 0, "lnum" 1, "tnum" 1',
        fontVariantNumeric: 'lining-nums tabular-nums',
      }}
    >
      {/* Top Header */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-white/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="p-2.5 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 shadow-inner">
              <FileSpreadsheet className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
                <span>📑 تقرير التعديلات اليدوية للمخزون</span>
              </h1>
              <p className="text-xs sm:text-sm text-white/70 font-medium mt-0.5">
                {lang === 'en'
                  ? 'Audit log of all single-item manual stock adjustments and subscriber meal deconstructions (manual_adjustments_log)'
                  : 'سجل الرقابة والتدقيق لجميع عمليات تعديل أرصدة الأصناف وإدارة طلبات المشتركين (manual_adjustments_log)'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => void fetchAdjustmentsLog()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 border border-white/20 text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-300 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث السجل</span>
          </button>

          <Link
            href="/inventory"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-indigo-600/35 hover:bg-indigo-600/50 border border-indigo-400/50 text-indigo-100 hover:text-white transition-all shadow-sm"
          >
            <ArrowRight className="w-3.5 h-3.5 text-indigo-300" />
            <span>العودة إلى لوحة المخزون</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 border border-white/15 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-white/70">إجمالي الحركات المسجلة</p>
            <p className="text-2xl font-mono font-black text-white mt-1" style={englishNumericStyle} dir="ltr">
              {summary.totalCount.toLocaleString('en-US')}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
            <Hash className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-emerald-400/25 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-200/80">إجمالي الوحدات المضافة (+)</p>
            <p className="text-2xl font-mono font-black text-emerald-300 mt-1" style={englishNumericStyle} dir="ltr">
              +{summary.addedUnits.toLocaleString('en-US')}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
            <PlusCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-rose-400/25 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-rose-200/80">إجمالي الوحدات المخصومة (-)</p>
            <p className="text-2xl font-mono font-black text-rose-300 mt-1" style={englishNumericStyle} dir="ltr">
              -{summary.deductedUnits.toLocaleString('en-US')}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-300">
            <MinusCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-amber-400/25 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-200/80">وحدات موجهة للتوالف (Redirect)</p>
            <p className="text-2xl font-mono font-black text-amber-300 mt-1" style={englishNumericStyle} dir="ltr">
              {summary.redirectedUnits.toLocaleString('en-US')}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters Toolbar (Date Range + Type + Search) */}
      <div className="glass-panel rounded-2xl p-4 border border-white/15 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-extrabold text-white/90">
            <Filter className="w-4 h-4 text-indigo-300" />
            <span>تصفية سجل التعديلات اليدوية (حسب نطاق التاريخ ونوع العملية):</span>
          </div>

          {(startDate || endDate || typeFilter !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط الفلاتر</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* From Date */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-white/75 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-300" />
              <span>من تاريخ (From Date):</span>
            </label>
            <input
              type="date"
              dir="ltr"
              lang="en"
              value={startDate}
              onChange={(e) => setStartDate(toEnglishDigitsStr(e.target.value))}
              className="w-full bg-black/40 hover:bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] cursor-pointer tabular-nums"
              style={englishNumericStyle}
            />
          </div>

          {/* To Date */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-white/75 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-300" />
              <span>إلى تاريخ (To Date):</span>
            </label>
            <input
              type="date"
              dir="ltr"
              lang="en"
              value={endDate}
              onChange={(e) => setEndDate(toEnglishDigitsStr(e.target.value))}
              className="w-full bg-black/40 hover:bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] cursor-pointer tabular-nums"
              style={englishNumericStyle}
            />
          </div>

          {/* Operation Type Filter */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-white/75">
              نوع العملية:
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-black/40 hover:bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] cursor-pointer"
            >
              <option value="ALL" className="bg-zinc-900 text-white">الكل (جميع العمليات)</option>
              <option value="add" className="bg-zinc-900 text-white">إضافة رصيد (+ Add)</option>
              <option value="deduct" className="bg-zinc-900 text-white">خصم رصيد (- Deduct)</option>
              <option value="redirect" className="bg-zinc-900 text-white">توجيه للتوالف (Redirect)</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-white/75 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-indigo-300" />
              <span>بحث (رقم الاشتراك، الصنف، الموظف):</span>
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="مثال: 2703326 أو P8 أو تسويق..."
              className="w-full bg-black/40 hover:bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
            />
          </div>
        </div>
      </div>

      {/* Error State */}
      {errorMsg && (
        <div className="bg-rose-500/20 border border-rose-400/40 rounded-2xl p-4 text-xs font-bold text-rose-200 flex items-center justify-between">
          <span>⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => void fetchAdjustmentsLog()}
            className="px-3 py-1 rounded-lg bg-rose-500/30 hover:bg-rose-500/40 text-white cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Data Table */}
      <div className="glass-panel rounded-3xl border border-white/20 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead>
              <tr className="bg-white/[0.07] border-b border-white/15 text-white/85 font-extrabold">
                <th className="py-3.5 px-4 whitespace-nowrap">التاريخ والوقت (KSA)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">رقم الاشتراك (Reference ID)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">الصنف</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">نوع العملية</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">الكمية</th>
                <th className="py-3.5 px-4 whitespace-nowrap">السبب</th>
                <th className="py-3.5 px-4 whitespace-nowrap">اسم الموظف</th>
                <th className="py-3.5 px-4">الملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-white/70">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-300" />
                      <span className="font-bold">جاري تحميل سجل التعديلات اليدوية...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-white/60">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="w-8 h-8 text-white/30" />
                      <p className="font-extrabold text-sm text-white/80">
                        لا توجد سجلات تعديلات يدوية مطابقة للفلاتر المحددة
                      </p>
                      <p className="text-xs text-white/50">
                        ستظهر هنا جميع العمليات المسجلة في جدول manual_adjustments_log فور تنفيذها.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((row) => {
                  const typeLower = row.adjustment_type.toLowerCase();
                  const isAdd = typeLower === 'add';
                  const isDeduct = typeLower === 'deduct';
                  const isRedirect = typeLower === 'redirect';

                  return (
                    <tr key={row.id} className="hover:bg-white/[0.04] transition-colors">
                      {/* 1. Date/Time (KSA) */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-white/90" style={englishNumericStyle} dir="ltr">
                        <div className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                          <span>{row.ksa_datetime} KSA</span>
                        </div>
                      </td>

                      {/* 2. Reference ID (رقم الاشتراك) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {row.reference_id ? (
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-lg font-mono font-black text-xs bg-emerald-500/20 border border-emerald-400/40 text-emerald-200"
                            style={englishNumericStyle}
                            dir="ltr"
                          >
                            #{toEnglishDigitsStr(row.reference_id)}
                          </span>
                        ) : (
                          <span className="text-white/40 text-xs font-medium">تعديل مباشر —</span>
                        )}
                      </td>

                      {/* 3. Item */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded-md bg-white/15 border border-white/25 font-mono font-black text-xs text-white"
                            style={englishNumericStyle}
                            dir="ltr"
                          >
                            {row.item_code}
                          </span>
                          <span className="font-bold text-white text-xs sm:text-sm">
                            {row.item_name_ar}
                          </span>
                        </div>
                      </td>

                      {/* 4. Type (Add / Deduct / Redirect with colored badges) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isAdd && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">
                            <PlusCircle className="w-3.5 h-3.5 text-emerald-300" />
                            <span>إضافة رصيد (Add)</span>
                          </span>
                        )}
                        {isDeduct && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-rose-500/20 border border-rose-400/40 text-rose-200">
                            <MinusCircle className="w-3.5 h-3.5 text-rose-300" />
                            <span>خصم رصيد (Deduct)</span>
                          </span>
                        )}
                        {isRedirect && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-amber-500/20 border border-amber-400/40 text-amber-200">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                            <span>توجيه للتوالف (Redirect)</span>
                          </span>
                        )}
                        {!isAdd && !isDeduct && !isRedirect && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-white/10 border border-white/20 text-white">
                            {row.adjustment_type}
                          </span>
                        )}
                      </td>

                      {/* 5. Quantity */}
                      <td className="py-3 px-4 text-center whitespace-nowrap font-mono font-black text-sm" style={englishNumericStyle} dir="ltr">
                        <span
                          className={
                            isAdd
                              ? 'text-emerald-300'
                              : isDeduct
                              ? 'text-rose-300'
                              : 'text-amber-300'
                          }
                        >
                          {isAdd ? '+' : isDeduct ? '-' : '~'}
                          {Number(row.quantity).toLocaleString('en-US')}
                        </span>
                      </td>

                      {/* 6. Reason */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/15 text-xs font-bold text-white/90">
                          {row.reason}
                        </span>
                      </td>

                      {/* 7. Employee Name */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-200">
                          <User className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                          <span>{row.employee_name}</span>
                        </div>
                      </td>

                      {/* 8. Notes */}
                      <td className="py-3 px-4 text-xs text-white/75 max-w-xs break-words">
                        {row.notes ? toEnglishDigitsStr(row.notes) : <span className="text-white/35">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

