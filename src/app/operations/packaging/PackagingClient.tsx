"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Calendar,
  MapPin,
  Building2,
  CheckCircle2,
  Truck,
  Clock,
  User,
  GitBranch,
  Filter,
  RotateCcw,
  FileSpreadsheet,
  FileText,
  Users,
  StickyNote,
  Tag,
  PackageCheck,
  Package,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Search,
} from 'lucide-react';
import GlassSelect from '@/components/common/GlassSelect';

interface ApiPackagingItem {
  id?: string;
  techrar_id?: number;
  subscription_number?: string;
  customer_name?: string;
  package_name?: string;
  district?: string;
  dispatch_branch?: string;
  service_type?: string;
  delivery_window?: string;
  items_count?: number;
  notes?: string;
  report_date?: string;
  status?: string;
  // Supplemental Techrar display fields
  plan_name?: string;
  subscription_days?: number | null;
  district_group?: string;
  item_1?: string;
  item_2?: string;
  all_items?: string[];
  captain_name?: string;
  city_id?: number | null;
  city_name?: string;
  restaurant_branch?: string;
}

interface PackagingTableRow {
  key: string;
  techrarId: number;
  subscriptionNumber: string;
  customerName: string;
  packageName: string;
  planName: string;
  notes: string;
  itemsCount: number;
  subscriptionDays: number | null;
  deliveryWindow: string;
  serviceType: string;
  district: string;
  dispatchBranch: string;
  districtGroup: string;
  item1: string;
  item2: string;
  allItems: string[];
  captainName: string;
  cityId: number | null;
  cityName: string;
  restaurantBranch: string;
  status: string;
}

const STATUS_OPTIONS = [
  'الكل',
  'مؤكد',
  'تم التوصيل',
  'لم يتم استلامه من قبل العميل',
];

const DEFAULT_CITIES = ['الكل', 'الرياض', 'جدة', 'مكة المكرمة'];
const DEFAULT_SERVICE_TYPES = ['الكل', 'التوصيل', 'استلام العميل'];
const DEFAULT_WINDOWS = [
  'الكل',
  '05:00 AM - 02:00 PM',
  '05:00 AM - 01:00 PM',
  '12:00 PM - 08:00 PM',
  '03:00 PM - 08:00 PM',
];
const DEFAULT_BRANCHES = [
  'الكل',
  'بدون',
  'الرياض (فرع التوصيل)',
  'جده (فرع التوصيل)',
  'مكة المكرمة (فرع التوصيل)',
];

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

const todayIso = () => new Date().toISOString().split('T')[0];

function normalizeAr(text: string): string {
  return text.trim().replace(/ة/g, 'ه').replace(/[أإآ]/g, 'ا').toLowerCase();
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  return `"${str.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

function escapeHtml(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function triggerCsvDownload(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function mapApiRow(item: ApiPackagingItem, index: number): PackagingTableRow {
  const techrarId = Number(item.techrar_id ?? index + 1);
  const pkgName = item.package_name || item.plan_name || '-';
  return {
    key: `${item.id || techrarId}-${index}`,
    techrarId,
    subscriptionNumber: item.subscription_number || '-',
    customerName: item.customer_name || '-',
    packageName: pkgName,
    planName: pkgName,
    notes: item.notes || '-',
    itemsCount: Number.isFinite(Number(item.items_count)) ? Number(item.items_count) : 0,
    subscriptionDays:
      item.subscription_days !== undefined && item.subscription_days !== null
        ? Number(item.subscription_days)
        : null,
    deliveryWindow: item.delivery_window || '-',
    serviceType: item.service_type || 'التوصيل',
    district: item.district || '-',
    dispatchBranch: item.dispatch_branch || '-',
    districtGroup: item.district_group || '-',
    item1: item.item_1 || '-',
    item2: item.item_2 || '-',
    allItems: Array.isArray(item.all_items) ? item.all_items : [],
    captainName: item.captain_name || '-',
    cityId: item.city_id ?? null,
    cityName: item.city_name || '-',
    restaurantBranch: item.restaurant_branch || 'بدون',
    status: item.status || 'confirmed',
  };
}

export default function PackagingClient() {
  // Row 1 Filters (Right to Left: التاريخ | المدينة | فروع الإرسال | الحالة)
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [city, setCity] = useState<string>('الكل');
  const [dispatchBranch, setDispatchBranch] = useState<string>('الكل');
  const [status, setStatus] = useState<string>('الكل');

  // Row 2 Filters (Right to Left: اسم الباقة | نوع الخدمة | نافذة التوصيل | اسم المندوب | فرع)
  const [packageNameFilter, setPackageNameFilter] = useState<string>('الكل');
  const [serviceType, setServiceType] = useState<string>('الكل');
  const [deliveryWindow, setDeliveryWindow] = useState<string>('الكل');
  const [driverName, setDriverName] = useState<string>('الكل');
  const [branch, setBranch] = useState<string>('الكل');

  // Quick search & pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Data state
  const [rows, setRows] = useState<PackagingTableRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<boolean>(false);

  const showToast = useCallback((msg: string, durationMs = 4200) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, durationMs);
  }, []);

  const loadPackagingReport = useCallback(
    async (params: {
      date: string;
      status: string;
      forceRefresh?: boolean;
      showSuccessToast?: boolean;
    }) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setLoading(true);
      setError(null);
      setWarning(null);

      try {
        const res = await fetch('/api/operations/packaging', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: params.date,
            status: params.status,
            force_refresh: Boolean(params.forceRefresh),
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
          const errMsg =
            data?.error ||
            (res.status === 401
              ? 'خطأ في المصادقة مع نظام تكرار (401)'
              : res.status === 400
              ? 'معاملات الطلب غير صالحة (400 Bad Request)'
              : `تعذر جلب تقرير التغليف (${res.status})`);
          setError(errMsg);
          setRows([]);
          return;
        }

        const rawItems: ApiPackagingItem[] = Array.isArray(data.items) ? data.items : [];
        setRows(rawItems.map(mapApiRow));
        setCurrentPage(1);

        if (data.warning) {
          setWarning(String(data.warning));
        }

        if (params.showSuccessToast) {
          showToast('✅ تم جلب البيانات بنجاح');
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'تعذر الاتصال بالخادم';
        setError(errMsg);
        setRows([]);
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [showToast]
  );

  // Initial load on mount with AbortController so React StrictMode never fires duplicate requests
  useEffect(() => {
    const controller = new AbortController();

    const runInitialFetch = async () => {
      inFlightRef.current = true;
      try {
        const res = await fetch('/api/operations/packaging', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: selectedDate,
            status,
            force_refresh: false,
          }),
          signal: controller.signal,
        });

        const data = await res.json().catch(() => null);
        if (controller.signal.aborted) return;

        if (!res.ok || !data?.success) {
          setError(data?.error || `تعذر جلب تقرير التغليف (${res.status})`);
          setRows([]);
          return;
        }

        const rawItems: ApiPackagingItem[] = Array.isArray(data.items) ? data.items : [];
        setRows(rawItems.map(mapApiRow));
        if (data.warning) setWarning(String(data.warning));
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'تعذر الاتصال بالخادم');
        setRows([]);
      } finally {
        if (!controller.signal.aborted) {
          inFlightRef.current = false;
          setLoading(false);
        }
      }
    };

    runInitialFetch();

    return () => {
      controller.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dynamic dropdown options enriched from loaded dataset
  const cityOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_CITIES);
    for (const r of rows) {
      if (r.cityName && r.cityName !== '-') {
        const norm = normalizeAr(r.cityName);
        const exists = Array.from(set).some((c) => normalizeAr(c) === norm);
        if (!exists) set.add(r.cityName);
      }
    }
    return Array.from(set).map((v) => ({ value: v, label: v }));
  }, [rows]);

  const dispatchBranchOptions = useMemo(() => {
    const set = new Set<string>(['الكل', 'جميع فروع الإرسال']);
    for (const r of rows) {
      if (r.dispatchBranch && r.dispatchBranch !== '-') {
        set.add(r.dispatchBranch);
      }
    }
    return Array.from(set).map((v) => ({ value: v, label: v }));
  }, [rows]);

  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((v) => ({ value: v, label: v })),
    []
  );

  const serviceTypeOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_SERVICE_TYPES);
    for (const r of rows) {
      if (r.serviceType && r.serviceType !== '-') {
        set.add(r.serviceType);
      }
    }
    return Array.from(set).map((v) => ({ value: v, label: v }));
  }, [rows]);

  const deliveryWindowOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_WINDOWS);
    for (const r of rows) {
      if (r.deliveryWindow && r.deliveryWindow !== '-') {
        set.add(r.deliveryWindow);
      }
    }
    return Array.from(set).map((v) => ({ value: v, label: v }));
  }, [rows]);

  const driverOptions = useMemo(() => {
    const set = new Set<string>(['الكل']);
    for (const r of rows) {
      if (r.captainName && r.captainName !== '-') {
        set.add(r.captainName);
      }
    }
    return Array.from(set).map((v) => ({ value: v, label: v }));
  }, [rows]);

  const branchOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_BRANCHES);
    for (const r of rows) {
      if (r.restaurantBranch && r.restaurantBranch !== '-') {
        set.add(r.restaurantBranch);
      }
    }
    return Array.from(set).map((v) => ({ value: v, label: v }));
  }, [rows]);

  const packageNameOptions = useMemo(() => {
    const set = new Set<string>(['الكل']);
    for (const r of rows) {
      const name = (r.packageName || r.planName || '').trim();
      if (name && name !== '-') {
        set.add(name);
      }
    }
    const [all, ...rest] = Array.from(set);
    rest.sort((a, b) => a.localeCompare(b, 'ar'));
    return [all, ...rest].map((v) => ({ value: v, label: v }));
  }, [rows]);

  // Instant in-memory filtering (prevents redundant external API calls)
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return rows.filter((r) => {
      // City filter (handles جدة <-> جده and city_id mapping)
      if (city !== 'الكل') {
        const normCity = normalizeAr(city);
        const matchById =
          (normCity === normalizeAr('الرياض') && r.cityId === 4) ||
          (normCity === normalizeAr('جدة') && r.cityId === 1) ||
          (normCity === normalizeAr('مكة المكرمة') && r.cityId === 12);
        const matchByName =
          r.cityName !== '-' && normalizeAr(r.cityName).includes(normCity);
        if (!matchById && !matchByName) return false;
      }

      // Dispatch Branch filter
      if (dispatchBranch !== 'الكل' && dispatchBranch !== 'جميع فروع الإرسال') {
        if (r.dispatchBranch !== dispatchBranch) return false;
      }

      // Package Name filter
      if (packageNameFilter !== 'الكل') {
        const itemPkg = (r.packageName || r.planName || '').trim();
        if (normalizeAr(itemPkg) !== normalizeAr(packageNameFilter)) return false;
      }

      // Service Type filter
      if (serviceType !== 'الكل') {
        if (normalizeAr(r.serviceType) !== normalizeAr(serviceType)) return false;
      }

      // Delivery Window filter
      if (deliveryWindow !== 'الكل') {
        if (r.deliveryWindow !== deliveryWindow) return false;
      }

      // Driver Name filter
      if (driverName !== 'الكل') {
        if (r.captainName !== driverName) return false;
      }

      // Branch filter
      if (branch !== 'الكل') {
        if (normalizeAr(r.restaurantBranch) !== normalizeAr(branch)) return false;
      }

      // Search query filter
      if (q) {
        const haystack = [
          r.subscriptionNumber,
          r.customerName,
          r.packageName,
          r.planName,
          r.notes,
          r.district,
          r.dispatchBranch,
          r.districtGroup,
          r.item1,
          r.item2,
          r.captainName,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    rows,
    city,
    dispatchBranch,
    packageNameFilter,
    serviceType,
    deliveryWindow,
    driverName,
    branch,
    searchQuery,
  ]);

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginatedRows = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, totalPages, pageSize]);

  const handleDateChange = (nextDate: string) => {
    setSelectedDate(nextDate);
  };

  const handleStatusChange = (nextStatus: string) => {
    setStatus(nextStatus);
    setCurrentPage(1);
  };

  const handleFilterClick = () => {
    if (loading || inFlightRef.current) return;
    void loadPackagingReport({
      date: selectedDate,
      status,
      forceRefresh: true,
      showSuccessToast: true,
    });
  };

  const handleResetClick = () => {
    const today = todayIso();
    setSelectedDate(today);
    setCity('الكل');
    setDispatchBranch('الكل');
    setStatus('الكل');
    setPackageNameFilter('الكل');
    setServiceType('الكل');
    setDeliveryWindow('الكل');
    setDriverName('الكل');
    setBranch('الكل');
    setSearchQuery('');
    setCurrentPage(1);
    loadPackagingReport({ date: today, status: 'الكل', forceRefresh: false });
    showToast('تمت إعادة ضبط معايير التصفية');
  };

  // 1. Export Excel (.csv with UTF-8 BOM for full RTL Arabic compatibility in Excel)
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      showToast('لا توجد بيانات حالية للتصدير');
      return;
    }

    const headers = [
      'الرقم',
      'رقم الاشتراك',
      'اسم العميل',
      'اسم الباقة',
      'ملاحظات',
      'عدد الأصناف',
      'عدد أيام الاشتراك',
      'نافذة التوصيل',
      'نوع الخدمة',
      'الحي',
      'فرع الإرسال',
      'مجموعة الحي',
      'الصنف 1',
      'الصنف 2',
    ];

    const dataRows = filteredRows.map((r, idx) => [
      idx + 1,
      r.subscriptionNumber,
      r.customerName,
      r.planName,
      r.notes,
      r.itemsCount,
      r.subscriptionDays !== null ? r.subscriptionDays : '-',
      r.deliveryWindow,
      r.serviceType,
      r.district,
      r.dispatchBranch,
      r.districtGroup,
      r.item1,
      r.item2,
    ]);

    triggerCsvDownload(`تقرير_التغليف_${selectedDate}.csv`, headers, dataRows);
    showToast(`تم تصدير ملف اكسل (${filteredRows.length} سجل) بنجاح`);
  };

  // 2. Export PDF (RTL Arabic print/PDF document with landscape layout)
  const handleExportPdf = () => {
    if (filteredRows.length === 0) {
      showToast('لا توجد بيانات حالية لتصدير PDF');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1280,height=900');
    if (!printWindow) {
      showToast('يرجى السماح بالنوافذ المنبثقة لتصدير ملف PDF');
      return;
    }

    const rowsHtml = filteredRows
      .map(
        (r, idx) => `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td style="font-family:monospace;font-weight:700;">${escapeHtml(r.subscriptionNumber)}</td>
          <td style="font-weight:700;">${escapeHtml(r.customerName)}</td>
          <td>${escapeHtml(r.planName)}</td>
          <td>${escapeHtml(r.notes)}</td>
          <td style="text-align:center;font-weight:700;">${r.itemsCount}</td>
          <td style="text-align:center;">${r.subscriptionDays !== null ? r.subscriptionDays : '-'}</td>
          <td dir="ltr" style="text-align:center;font-family:monospace;">${escapeHtml(r.deliveryWindow)}</td>
          <td>${escapeHtml(r.serviceType)}</td>
          <td>${escapeHtml(r.district)}</td>
          <td>${escapeHtml(r.dispatchBranch)}</td>
          <td>${escapeHtml(r.districtGroup)}</td>
          <td>${escapeHtml(r.item1)}</td>
          <td>${escapeHtml(r.item2)}</td>
        </tr>`
      )
      .join('');

    const htmlDoc = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تقرير التغليف - ${escapeHtml(selectedDate)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      color: #111827;
      margin: 0;
      padding: 12px;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #10b981;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
    }
    .meta {
      font-size: 13px;
      font-weight: 700;
      color: #374151;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      text-align: right;
      vertical-align: top;
      word-break: break-word;
    }
    th {
      background-color: #f3f4f6;
      font-weight: 800;
      white-space: nowrap;
    }
    tr:nth-child(even) td {
      background-color: #f9fafb;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>تقرير التغليف - المجموع ${filteredRows.length}</h1>
    <div class="meta">التاريخ: ${escapeHtml(selectedDate)} | الحالة: ${escapeHtml(status)}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>الرقم</th>
        <th>رقم الاشتراك</th>
        <th>اسم العميل</th>
        <th>اسم الباقة</th>
        <th>ملاحظات</th>
        <th>عدد الأصناف</th>
        <th>عدد أيام الاشتراك</th>
        <th>نافذة التوصيل</th>
        <th>نوع الخدمة</th>
        <th>الحي</th>
        <th>فرع الإرسال</th>
        <th>مجموعة الحي</th>
        <th>الصنف 1</th>
        <th>الصنف 2</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(htmlDoc);
    printWindow.document.close();
    showToast('تم تجهيز ملف PDF للطباعة والحفظ');
  };

  // 3. Export Notes (تصدير الملاحظات)
  const handleExportNotes = () => {
    if (filteredRows.length === 0) {
      showToast('لا توجد بيانات حالية لتصدير الملاحظات');
      return;
    }

    const notesSubset = filteredRows.filter(
      (r) => r.notes && r.notes.trim() !== '' && r.notes.trim() !== '-'
    );
    const targetRows = notesSubset.length > 0 ? notesSubset : filteredRows;

    const headers = [
      'الرقم',
      'رقم الاشتراك',
      'اسم العميل',
      'اسم الباقة',
      'ملاحظات',
      'الحي',
      'نافذة التوصيل',
    ];
    const dataRows = targetRows.map((r, idx) => [
      idx + 1,
      r.subscriptionNumber,
      r.customerName,
      r.planName,
      r.notes,
      r.district,
      r.deliveryWindow,
    ]);

    triggerCsvDownload(`ملاحظات_التغليف_${selectedDate}.csv`, headers, dataRows);
    showToast(`تم تصدير ملف الملاحظات (${targetRows.length} سجل) بنجاح`);
  };

  // 4. Export Customer Names (تصدير أسماء العملاء)
  const handleExportCustomerNames = () => {
    if (filteredRows.length === 0) {
      showToast('لا توجد بيانات حالية لتصدير أسماء العملاء');
      return;
    }

    const headers = [
      'الرقم',
      'رقم الاشتراك',
      'اسم العميل',
      'الحي',
      'مجموعة الحي',
      'نافذة التوصيل',
      'نوع الخدمة',
      'عدد الأصناف',
    ];
    const dataRows = filteredRows.map((r, idx) => [
      idx + 1,
      r.subscriptionNumber,
      r.customerName,
      r.district,
      r.districtGroup,
      r.deliveryWindow,
      r.serviceType,
      r.itemsCount,
    ]);

    triggerCsvDownload(`أسماء_العملاء_${selectedDate}.csv`, headers, dataRows);
    showToast(`تم تصدير قائمة أسماء العملاء (${filteredRows.length} عميل) بنجاح`);
  };

  // 5. Export Nutrition / Meal Labels (تصدير ملصقات القيم الغذائية)
  const handleExportNutritionLabels = () => {
    if (filteredRows.length === 0) {
      showToast('لا توجد بيانات حالية لتصدير الملصقات');
      return;
    }

    const headers = [
      'الرقم',
      'رقم الاشتراك',
      'اسم العميل',
      'اسم الباقة',
      'عدد الأصناف',
      'الصنف 1',
      'الصنف 2',
      'جميع الأصناف',
      'ملاحظات',
      'التاريخ',
    ];
    const dataRows = filteredRows.map((r, idx) => [
      idx + 1,
      r.subscriptionNumber,
      r.customerName,
      r.planName,
      r.itemsCount,
      r.item1,
      r.item2,
      r.allItems.length > 0 ? r.allItems.join(' | ') : `${r.item1} | ${r.item2}`,
      r.notes,
      selectedDate,
    ]);

    triggerCsvDownload(`ملصقات_القيم_الغذائية_${selectedDate}.csv`, headers, dataRows);
    showToast(`تم تصدير ملصقات القيم الغذائية (${filteredRows.length} سجل) بنجاح`);
  };

  return (
    <div dir="rtl" className="page-shell w-full mx-auto space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-black/85 backdrop-blur-xl border border-white/30 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Clean Header: Title & Icon Only */}
      <header className="bg-white/10 backdrop-blur-md border border-white/20 shadow-[0_6px_20px_rgba(0,0,0,0.14)] rounded-2xl p-5 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <PackageCheck className="w-7 h-7 text-emerald-400" />
          <span>تقرير التغليف</span>
        </h1>
      </header>

      {/* Top Filter Toolbar — Strictly Mirroring Techrar Layout (Right to Left) */}
      <section className="bg-white/10 backdrop-blur-md border border-white/20 shadow-[0_6px_20px_rgba(0,0,0,0.14)] rounded-2xl p-5 sm:p-6 space-y-5">
        {/* Row 1 (Right to Left): التاريخ | المدينة | فروع الإرسال | الحالة */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. التاريخ (Date Picker - Single Date) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-white/75" />
              <span>التاريخ</span>
            </label>
            <input
              type="date"
              suppressHydrationWarning
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full h-[42px] bg-white/10 backdrop-blur-md border border-white/20 text-white font-mono font-bold text-sm rounded-xl px-3.5 outline-none focus:border-emerald-400/60 [color-scheme:dark] transition-colors cursor-pointer"
            />
          </div>

          {/* 2. المدينة (City - Dropdown) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-white/75" />
              <span>المدينة</span>
            </label>
            <GlassSelect
              value={city}
              onChange={(e) => {
                setCity(e?.target ? e.target.value : String(e));
                setCurrentPage(1);
              }}
              options={cityOptions}
              placeholder="الكل"
            />
          </div>

          {/* 3. فروع الإرسال (Dispatch Branch - Dropdown) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-white/75" />
              <span>فروع الإرسال</span>
            </label>
            <GlassSelect
              value={dispatchBranch}
              onChange={(e) => {
                setDispatchBranch(e?.target ? e.target.value : String(e));
                setCurrentPage(1);
              }}
              options={dispatchBranchOptions}
              placeholder="الكل"
            />
          </div>

          {/* 4. الحالة (Status - Dropdown) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-white/75" />
              <span>الحالة</span>
            </label>
            <GlassSelect
              value={status}
              onChange={(e) =>
                handleStatusChange(e?.target ? e.target.value : String(e))
              }
              options={statusOptions}
              placeholder="الكل"
            />
          </div>
        </div>

        {/* Row 2 (Right to Left): اسم الباقة | نوع الخدمة | نافذة التوصيل | اسم المندوب | فرع */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* 5. اسم الباقة (Package Name - Dropdown) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-white/75" />
              <span>اسم الباقة</span>
            </label>
            <GlassSelect
              value={packageNameFilter}
              onChange={(e) => {
                setPackageNameFilter(e?.target ? e.target.value : String(e));
                setCurrentPage(1);
              }}
              options={packageNameOptions}
              placeholder="الكل"
            />
          </div>

          {/* 6. نوع الخدمة (Service Type - Dropdown) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-white/75" />
              <span>نوع الخدمة</span>
            </label>
            <GlassSelect
              value={serviceType}
              onChange={(e) => {
                setServiceType(e?.target ? e.target.value : String(e));
                setCurrentPage(1);
              }}
              options={serviceTypeOptions}
              placeholder="الكل"
            />
          </div>

          {/* 6. نافذة التوصيل (Delivery Window - Dropdown) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-white/75" />
              <span>نافذة التوصيل</span>
            </label>
            <GlassSelect
              value={deliveryWindow}
              onChange={(e) => {
                setDeliveryWindow(e?.target ? e.target.value : String(e));
                setCurrentPage(1);
              }}
              options={deliveryWindowOptions}
              placeholder="الكل"
            />
          </div>

          {/* 7. اسم المندوب (Driver Name - Dropdown) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-white/75" />
              <span>اسم المندوب</span>
            </label>
            <GlassSelect
              value={driverName}
              onChange={(e) => {
                setDriverName(e?.target ? e.target.value : String(e));
                setCurrentPage(1);
              }}
              options={driverOptions}
              placeholder="الكل"
            />
          </div>

          {/* 8. فرع (Branch - Dropdown) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-white/75" />
              <span>فرع</span>
            </label>
            <GlassSelect
              value={branch}
              onChange={(e) => {
                setBranch(e?.target ? e.target.value : String(e));
                setCurrentPage(1);
              }}
              options={branchOptions}
              placeholder="الكل"
            />
          </div>
        </div>

        {/* Action/Export Buttons + Filter & Reset Buttons Row (Right to Left) */}
        <div className="pt-4 border-t border-white/15 flex flex-wrap items-center gap-2.5">
          {/* 1. تصدير ملصقات القيم الغذائية */}
          <button
            type="button"
            onClick={handleExportNutritionLabels}
            className="bg-white/10 backdrop-blur-md hover:bg-white/20 active:scale-[0.98] text-white font-bold px-4 py-2.5 rounded-xl border border-white/20 transition-all flex items-center gap-2 cursor-pointer text-xs sm:text-sm shadow-sm"
          >
            <Tag className="w-4 h-4 text-emerald-300" />
            <span>تصدير ملصقات القيم الغذائية</span>
          </button>

          {/* 2. تصدير أسماء العملاء */}
          <button
            type="button"
            onClick={handleExportCustomerNames}
            className="bg-white/10 backdrop-blur-md hover:bg-white/20 active:scale-[0.98] text-white font-bold px-4 py-2.5 rounded-xl border border-white/20 transition-all flex items-center gap-2 cursor-pointer text-xs sm:text-sm shadow-sm"
          >
            <Users className="w-4 h-4 text-sky-300" />
            <span>تصدير أسماء العملاء</span>
          </button>

          {/* 3. تصدير الملاحظات */}
          <button
            type="button"
            onClick={handleExportNotes}
            className="bg-white/10 backdrop-blur-md hover:bg-white/20 active:scale-[0.98] text-white font-bold px-4 py-2.5 rounded-xl border border-white/20 transition-all flex items-center gap-2 cursor-pointer text-xs sm:text-sm shadow-sm"
          >
            <StickyNote className="w-4 h-4 text-amber-300" />
            <span>تصدير الملاحظات</span>
          </button>

          {/* 4. تصدير PDF */}
          <button
            type="button"
            onClick={handleExportPdf}
            className="bg-white/10 backdrop-blur-md hover:bg-white/20 active:scale-[0.98] text-white font-bold px-4 py-2.5 rounded-xl border border-white/20 transition-all flex items-center gap-2 cursor-pointer text-xs sm:text-sm shadow-sm"
          >
            <FileText className="w-4 h-4 text-rose-300" />
            <span>تصدير PDF</span>
          </button>

          {/* 5. تصدير اكسل */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="bg-white/10 backdrop-blur-md hover:bg-white/20 active:scale-[0.98] text-white font-bold px-4 py-2.5 rounded-xl border border-white/20 transition-all flex items-center gap-2 cursor-pointer text-xs sm:text-sm shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>تصدير اكسل</span>
          </button>

          {/* 6. تصفية (Immediately next to تصدير اكسل) */}
          <button
            type="button"
            onClick={handleFilterClick}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-[0.98] text-emerald-200 border border-emerald-400/40 font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 backdrop-blur-md shadow-sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Filter className="w-4 h-4" />
            )}
            <span>تصفية</span>
          </button>

          {/* 7. إعادة ضبط */}
          <button
            type="button"
            onClick={handleResetClick}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white/85 hover:text-white border border-white/20 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 backdrop-blur-md"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط</span>
          </button>
        </div>

        {/* Bold Export Ready Indicator */}
        <div className="pt-1 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          <p className="text-sm sm:text-base font-extrabold text-white tracking-tight">
            التصدير جاهز لـ <span className="font-mono text-emerald-300">{selectedDate}</span>
          </p>
        </div>
      </section>

      {/* Error & Warning Notices */}
      {error && (
        <div className="bg-rose-500/15 backdrop-blur-md border border-rose-500/35 rounded-2xl p-4 text-rose-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-extrabold">تعذر تحميل بيانات التغليف</p>
              <p className="text-white/80 text-xs mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFilterClick}
            className="px-3.5 py-1.5 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/40 text-xs font-bold text-white cursor-pointer shrink-0"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {warning && (
        <div className="bg-amber-500/15 backdrop-blur-md border border-amber-500/35 rounded-2xl p-3.5 text-amber-100 flex items-center gap-3 text-xs sm:text-sm font-semibold">
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      {/* Summary Bar & Main 14-Column Packaging Table */}
      <section className="bg-white/10 backdrop-blur-md border border-white/20 shadow-[0_6px_20px_rgba(0,0,0,0.14)] rounded-2xl overflow-hidden">
        {/* Summary Header: "تقرير التغليف - المجموع [Count]" */}
        <div className="p-5 sm:p-6 border-b border-white/15 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>
              تقرير التغليف - المجموع{' '}
              <span className="font-mono text-emerald-300">{totalCount}</span>
            </span>
          </h2>

          {/* Quick Search + Page Size */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-white/45 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="بحث برقم الاشتراك، العميل، الحي، الصنف..."
                className="w-full h-9 pr-9 pl-3 rounded-xl bg-black/25 border border-white/20 text-white placeholder-white/45 text-xs focus:outline-none focus:border-white/40 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-white/75 shrink-0">
              <span>عرض:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 bg-black/30 border border-white/20 text-white font-mono rounded-xl px-2.5 text-xs focus:outline-none cursor-pointer"
              >
                {PAGE_SIZE_OPTIONS.map((sz) => (
                  <option key={sz} value={sz} className="bg-neutral-900 text-white">
                    {sz}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 14-Column Table Container with Horizontal Scroll */}
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[1450px] text-right text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-white/10 border-b border-white/20 text-white font-extrabold text-xs whitespace-nowrap">
                <th scope="col" className="py-3.5 px-3 text-center w-14">الرقم</th>
                <th scope="col" className="py-3.5 px-3">رقم الاشتراك</th>
                <th scope="col" className="py-3.5 px-3 min-w-[200px] max-w-[220px]">اسم العميل</th>
                <th scope="col" className="py-3.5 px-3 min-w-[200px] max-w-[240px]">اسم الباقة</th>
                <th scope="col" className="py-3.5 px-2 w-[100px] max-w-[120px]">ملاحظات</th>
                <th scope="col" className="py-3.5 px-3 text-center">عدد الأصناف</th>
                <th scope="col" className="py-3.5 px-3 text-center">عدد أيام الاشتراك</th>
                <th scope="col" className="py-3.5 px-3 min-w-[140px]">نافذة التوصيل</th>
                <th scope="col" className="py-3.5 px-3">نوع الخدمة</th>
                <th scope="col" className="py-3.5 px-3 min-w-[130px]">الحي</th>
                <th scope="col" className="py-3.5 px-3">فرع الإرسال</th>
                <th scope="col" className="py-3.5 px-3">مجموعة الحي</th>
                <th scope="col" className="py-3.5 px-3 min-w-[170px]">الصنف 1</th>
                <th scope="col" className="py-3.5 px-3 min-w-[170px]">الصنف 2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white/95">
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-white/80">
                      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                      <p className="text-sm font-bold">
                        جاري جلب وحفظ بيانات التغليف لتاريخ {selectedDate}...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-2.5 text-white/70">
                      <PackageCheck className="w-11 h-11 text-white/25" />
                      <p className="text-base font-extrabold text-white">
                        لا توجد سجلات تغليف مطابقة
                      </p>
                      <p className="text-xs text-white/55 max-w-md">
                        لا توجد بيانات لتاريخ {selectedDate} بالمعايير المحددة حالياً. جرّب اختيار تاريخ آخر أو الضغط على &ldquo;إعادة ضبط&rdquo;.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;
                  const extraMealsTooltip =
                    row.allItems.length > 2
                      ? `جميع الأصناف: ${row.allItems.join(' | ')}`
                      : undefined;

                  return (
                    <tr
                      key={row.key}
                      className="hover:bg-white/10 transition-colors"
                    >
                      {/* 1. الرقم */}
                      <td className="py-3 px-3 text-center font-mono text-xs text-white/70 whitespace-nowrap">
                        {rowNum}
                      </td>

                      {/* 2. رقم الاشتراك */}
                      <td className="py-3 px-3 font-mono font-bold text-emerald-300 whitespace-nowrap">
                        {row.subscriptionNumber}
                      </td>

                      {/* 3. اسم العميل (Wrapping enabled) */}
                      <td className="py-3 px-3 font-bold text-white min-w-[200px] max-w-[220px] whitespace-normal break-words leading-snug">
                        {row.customerName}
                      </td>

                      {/* 4. اسم الباقة (Wrapping enabled) */}
                      <td className="py-3 px-3 text-xs text-white/90 min-w-[200px] max-w-[240px] whitespace-normal break-words leading-snug">
                        {row.packageName || row.planName}
                      </td>

                      {/* 5. ملاحظات (Narrow width with truncation) */}
                      <td
                        className="py-3 px-2 text-xs text-white/80 w-[100px] max-w-[120px] truncate"
                        title={row.notes}
                      >
                        {row.notes}
                      </td>

                      {/* 6. عدد الأصناف */}
                      <td
                        className="py-3 px-3 text-center font-mono font-extrabold text-white whitespace-nowrap"
                        title={extraMealsTooltip}
                      >
                        <span className="inline-block px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/20">
                          {row.itemsCount}
                        </span>
                      </td>

                      {/* 7. عدد أيام الاشتراك */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-white/90 whitespace-nowrap">
                        {row.subscriptionDays !== null ? row.subscriptionDays : '-'}
                      </td>

                      {/* 8. نافذة التوصيل */}
                      <td className="py-3 px-3 font-mono text-xs text-white/90 whitespace-nowrap" dir="ltr">
                        {row.deliveryWindow}
                      </td>

                      {/* 9. نوع الخدمة */}
                      <td className="py-3 px-3 text-xs font-semibold text-white/90 whitespace-nowrap">
                        {row.serviceType}
                      </td>

                      {/* 10. الحي */}
                      <td className="py-3 px-3 text-xs text-white/90 whitespace-nowrap">
                        {row.district}
                      </td>

                      {/* 11. فرع الإرسال */}
                      <td className="py-3 px-3 text-xs text-white/80 whitespace-nowrap">
                        {row.dispatchBranch}
                      </td>

                      {/* 12. مجموعة الحي */}
                      <td className="py-3 px-3 text-xs font-mono text-white/85 whitespace-nowrap">
                        {row.districtGroup}
                      </td>

                      {/* 13. الصنف 1 */}
                      <td className="py-3 px-3 text-xs font-semibold text-white/95 min-w-[170px] max-w-[210px] whitespace-normal break-words leading-snug">
                        {row.item1}
                      </td>

                      {/* 14. الصنف 2 */}
                      <td className="py-3 px-3 text-xs font-semibold text-white/95 min-w-[170px] max-w-[210px] whitespace-normal break-words leading-snug">
                        {row.item2}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/80">
            <div>
              عرض{' '}
              <strong className="font-mono text-white">
                {(currentPage - 1) * pageSize + 1}
              </strong>{' '}
              إلى{' '}
              <strong className="font-mono text-white">
                {Math.min(currentPage * pageSize, totalCount)}
              </strong>{' '}
              من إجمالي <strong className="font-mono text-white">{totalCount}</strong> سجل
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
                title="الصفحة السابقة"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/20 font-mono font-bold text-white">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
                title="الصفحة التالية"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
