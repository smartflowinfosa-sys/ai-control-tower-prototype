"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  MapPin,
  Building2,
  CheckCircle2,
  Truck,
  Clock,
  Filter,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Sparkles,
  Database,
  ArrowRightLeft,
  Check,
  Package,
  Boxes,
  Layers,
  Search,
  PackageX,
  TrendingUp,
  Hash,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import GlassSelect from '@/components/common/GlassSelect';
import {
  PACKAGING_PRODUCTS,
  PACKAGING_MAPPING,
  INITIAL_QUANTITY_MEALS,
  getMealsForDateRange,
  QuantityMealRow
} from '@/constants/packagingMap';

export default function QuantityClient() {
  // Main Filter States (Default test window: Oct 20 - 24, 2026)
  const [dateFrom, setDateFrom] = useState('2026-10-20');
  const [dateTo, setDateTo] = useState('2026-10-24');
  const [city, setCity] = useState('ALL');
  const [branch, setBranch] = useState('الكل');
  const [status, setStatus] = useState('مؤكد');
  const [serviceType, setServiceType] = useState('الكل');
  const [deliveryWindow, setDeliveryWindow] = useState('الكل');

  // Packaging Product BOM Filter State
  const [selectedPackaging, setSelectedPackaging] = useState<string>('none');

  // Search Query State
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic mock meals generation aggregated across the selected date range
  const items = useMemo(() => {
    return getMealsForDateRange(dateFrom, dateTo);
  }, [dateFrom, dateTo]);

  // Toggle Switches State
  const [groupByPackage, setGroupByPackage] = useState(false);
  const [groupBySku, setGroupBySku] = useState(false);
  const [showCategory, setShowCategory] = useState(true);
  const [groupByReference, setGroupByReference] = useState(false);
  const [groupBySize, setGroupBySize] = useState(false);

  // Filter feedback & Export State
  const [isFiltering, setIsFiltering] = useState(false);
  const [isFiltered, setIsFiltered] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Client-safe default date initialization to Oct 20 - 24, 2026
    setDateFrom('2026-10-20');
    setDateTo('2026-10-24');
  }, []);

  // Selected Packaging Product details
  const selectedProduct = useMemo(() => {
    return PACKAGING_PRODUCTS.find((p) => p.id === selectedPackaging) || PACKAGING_PRODUCTS[0];
  }, [selectedPackaging]);

  // Filtering Logic:
  // When selectedPackaging is a specific packaging item, filter out any items where Meal Code (as number)
  // is NOT included in PACKAGING_MAPPING[selectedPackaging]. If mapping array is empty, show no rows.
  // When 'none' or 'all', all kitchen meals are displayed.
  const filteredRows = useMemo(() => {
    let rows = items;

    if (selectedPackaging !== 'none' && selectedPackaging !== 'all') {
      const allowedCodes = PACKAGING_MAPPING[selectedPackaging] || [];
      if (allowedCodes.length === 0) {
        return [];
      }
      rows = rows.filter((item) => {
        const codeNum = Number(item.mealCode);
        return allowedCodes.includes(codeNum);
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter((item) =>
        String(item.mealCode).includes(q) ||
        item.nameAr.toLowerCase().includes(q) ||
        item.nameEn.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    }

    return rows;
  }, [items, selectedPackaging, searchQuery]);

  // Smart Summary Calculations:
  // 1. عدد الأصناف المرتبطة: Count of unique meal items displayed after filtering
  const uniqueLinkedItemsCount = useMemo(() => {
    const codes = new Set(filteredRows.map((r) => Number(r.mealCode)));
    return codes.size;
  }, [filteredRows]);

  // 2. إجمالي الاستهلاك للفترة: SUM of quantity for all currently filtered rows
  const totalConsumption = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  }, [filteredRows]);

  const handleFilter = () => {
    setIsFiltering(true);
    setTimeout(() => {
      setIsFiltering(false);
      setIsFiltered(true);
      showToast('تم تطبيق معايير التصفية وتحديث بيانات الاستهلاك بنجاح');
    }, 450);
  };

  const handleReset = () => {
    setDateFrom('2026-10-20');
    setDateTo('2026-10-24');
    setCity('ALL');
    setBranch('الكل');
    setStatus('مؤكد');
    setServiceType('الكل');
    setDeliveryWindow('الكل');
    setSelectedPackaging('none');
    setSearchQuery('');
    setGroupByPackage(false);
    setGroupBySku(false);
    setShowCategory(true);
    setGroupByReference(false);
    setGroupBySize(false);
    setIsFiltered(false);
    showToast('تمت إعادة ضبط معايير التصفية وفلتر التغليف');
  };

  const handleExport = (type: 'excel' | 'pdf') => {
    if (type === 'excel') {
      try {
        const headers = ['#', 'كود الوجبة', 'الاسم الإنجليزي', 'الاسم العربي', 'التصنيف', 'الكمية المستهلكة'];
        const csvRows = [
          headers.join(','),
          ...filteredRows.map((r, idx) =>
            [
              idx + 1,
              r.mealCode,
              `"${r.nameEn.replace(/"/g, '""')}"`,
              `"${r.nameAr.replace(/"/g, '""')}"`,
              `"${(r.category || 'عام').replace(/"/g, '""')}"`,
              r.quantity
            ].join(',')
          )
        ];
        const csvContent = '\uFEFF' + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fileName = `فاتورة_الكميات_${selectedPackaging !== 'none' ? selectedPackaging : 'المطبخ'}_${dateFrom || 'report'}.csv`;
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('تم تصدير ملف Excel بنجاح');
      } catch (err) {
        showToast('جاري تحضير ملف Excel للتصدير...');
      }
    } else {
      showToast('جاري تحضير ملف PDF للتصدير...');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="page-shell w-full mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-black/85 backdrop-blur-xl border border-white/30 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Title & Header */}
      <header className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl text-white p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
            فاتورة الكمية وتتبع استهلاك المخزون
          </h1>
        </div>
      </header>

      {/* Main Filter Panel */}
      <div className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl text-white p-6 sm:p-8 space-y-6">
        {/* Filters Grid (8 Fields, including Packaging Product) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Date From */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-white/80" />
              <span>من تاريخ:</span>
            </label>
            <input
              type="date"
              suppressHydrationWarning
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-white/10 backdrop-blur-md border border-white/20 text-white font-medium text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40 [color-scheme:dark] transition-colors cursor-pointer"
            />
          </div>

          {/* 2. Date To */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-white/80" />
              <span>إلى تاريخ:</span>
            </label>
            <input
              type="date"
              suppressHydrationWarning
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-white/10 backdrop-blur-md border border-white/20 text-white font-medium text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40 [color-scheme:dark] transition-colors cursor-pointer"
            />
          </div>

          {/* 3. City */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-white/80" />
              <span>المدينة:</span>
            </label>
            <GlassSelect
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none cursor-pointer hover:bg-white/15 transition-colors"
            >
              <option value="ALL">الكل (جميع المدن)</option>
              <option value="الرياض">الرياض</option>
              <option value="مكة المكرمة">مكة المكرمة</option>
              <option value="جدة">جدة</option>
            </GlassSelect>
          </div>

          {/* 4. Branch (الفرع - الفروع الفعلية فقط بدون أي خيارات وهمية) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-white/80" />
              <span>الفرع:</span>
            </label>
            <GlassSelect
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none cursor-pointer hover:bg-white/15 transition-colors"
            >
              <option value="الكل">الكل</option>
              <option value="الرياض (فرع التوصيل)">الرياض (فرع التوصيل)</option>
              <option value="مكة المكرمة (فرع التوصيل)">مكة المكرمة (فرع التوصيل)</option>
              <option value="جدة (فرع التوصيل)">جدة (فرع التوصيل)</option>
            </GlassSelect>
          </div>

          {/* 5. Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-white/80" />
              <span>الحالة:</span>
            </label>
            <GlassSelect
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none cursor-pointer hover:bg-white/15 transition-colors"
            >
              <option value="مؤكد">مؤكد</option>
              <option value="تم التوصيل">تم التوصيل</option>
              <option value="لم يتم استلامه من قبل العميل">لم يتم استلامه من قبل العميل</option>
              <option value="لم يتم استلامه من المطعم">لم يتم استلامه من المطعم</option>
              <option value="الكل">الكل</option>
            </GlassSelect>
          </div>

          {/* 6. Service Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-white/80" />
              <span>نوع الخدمة:</span>
            </label>
            <GlassSelect
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none cursor-pointer hover:bg-white/15 transition-colors"
            >
              <option value="الكل">الكل</option>
              <option value="التوصيل">التوصيل</option>
              <option value="استلام العميل">استلام العميل</option>
            </GlassSelect>
          </div>

          {/* 7. Delivery Window */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-white/80" />
              <span>نافذة التوصيل:</span>
            </label>
            <GlassSelect
              value={deliveryWindow}
              onChange={(e) => setDeliveryWindow(e.target.value)}
              className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none cursor-pointer hover:bg-white/15 transition-colors"
            >
              <option value="الكل">الكل</option>
              <option value="03:00 م - 08:00 م">03:00 م - 08:00 م</option>
              <option value="05:00 ص - 02:00 م">05:00 ص - 02:00 م</option>
              <option value="12:00 م - 08:00 م">12:00 م - 08:00 م</option>
            </GlassSelect>
          </div>

          {/* 8. Packaging Product Filter (فلتر منتجات التغليف - BOM) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-white/90" />
              <span className="text-white font-extrabold">منتج التغليف (BOM):</span>
            </label>
            <GlassSelect
              value={selectedPackaging}
              onChange={(e) => setSelectedPackaging(e.target.value)}
              className="w-full bg-white/10 border border-white/30 rounded-xl px-3.5 py-2.5 text-sm text-white font-extrabold focus:outline-none cursor-pointer hover:bg-white/15 transition-all shadow-sm"
            >
              {PACKAGING_PRODUCTS.map((prod) => (
                <option key={prod.id} value={prod.id}>
                  {prod.name}
                </option>
              ))}
            </GlassSelect>
          </div>
        </div>

        {/* Toggles (Switches) Row */}
        <div className="pt-4 border-t border-white/15">
          <div className="text-xs font-extrabold text-white/80 mb-3 flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-white/70" />
            <span>خيارات التجميع والعرض (Grouping & View Options):</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Toggle 1: Group by Package */}
            <button
              type="button"
              role="switch"
              aria-checked={groupByPackage}
              onClick={() => setGroupByPackage(!groupByPackage)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                groupByPackage
                  ? 'bg-white/20 border-white/40 text-white shadow-sm'
                  : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div
                dir="ltr"
                className={`w-8 h-4 rounded-full transition-all border relative flex items-center px-0.5 ${
                  groupByPackage
                    ? 'bg-white/40 border-white/60 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
                    : 'bg-white/10 border-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    groupByPackage ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </div>
              <span>تجميع حسب الباقة</span>
            </button>

            {/* Toggle 2: Group by SKU */}
            <button
              type="button"
              role="switch"
              aria-checked={groupBySku}
              onClick={() => setGroupBySku(!groupBySku)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                groupBySku
                  ? 'bg-white/20 border-white/40 text-white shadow-sm'
                  : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div
                dir="ltr"
                className={`w-8 h-4 rounded-full transition-all border relative flex items-center px-0.5 ${
                  groupBySku
                    ? 'bg-white/40 border-white/60 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
                    : 'bg-white/10 border-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    groupBySku ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </div>
              <span>تجميع حسب رمز المنتج</span>
            </button>

            {/* Toggle 3: Show Category */}
            <button
              type="button"
              role="switch"
              aria-checked={showCategory}
              onClick={() => setShowCategory(!showCategory)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                showCategory
                  ? 'bg-white/20 border-white/40 text-white shadow-sm'
                  : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div
                dir="ltr"
                className={`w-8 h-4 rounded-full transition-all border relative flex items-center px-0.5 ${
                  showCategory
                    ? 'bg-white/40 border-white/60 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
                    : 'bg-white/10 border-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    showCategory ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </div>
              <span>عرض التصنيف</span>
            </button>

            {/* Toggle 4: Group by Reference */}
            <button
              type="button"
              role="switch"
              aria-checked={groupByReference}
              onClick={() => setGroupByReference(!groupByReference)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                groupByReference
                  ? 'bg-white/20 border-white/40 text-white shadow-sm'
                  : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div
                dir="ltr"
                className={`w-8 h-4 rounded-full transition-all border relative flex items-center px-0.5 ${
                  groupByReference
                    ? 'bg-white/40 border-white/60 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
                    : 'bg-white/10 border-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    groupByReference ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </div>
              <span>التجميع حسب المرجع</span>
            </button>

            {/* Toggle 5: Group by Size */}
            <button
              type="button"
              role="switch"
              aria-checked={groupBySize}
              onClick={() => setGroupBySize(!groupBySize)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                groupBySize
                  ? 'bg-white/20 border-white/40 text-white shadow-sm'
                  : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div
                dir="ltr"
                className={`w-8 h-4 rounded-full transition-all border relative flex items-center px-0.5 ${
                  groupBySize
                    ? 'bg-white/40 border-white/60 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
                    : 'bg-white/10 border-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white shadow-md transition-transform duration-200 ${
                    groupBySize ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </div>
              <span>تجميع حسب الحجم</span>
            </button>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="pt-4 border-t border-white/15 flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleFilter}
            disabled={isFiltering}
            className="bg-white/20 hover:bg-white/30 active:scale-[0.98] text-white font-extrabold px-6 py-2.5 rounded-xl border border-white/30 shadow-lg shadow-black/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm backdrop-blur-md"
          >
            <Filter className={`w-4 h-4 text-white ${isFiltering ? 'animate-spin' : ''}`} />
            <span>{isFiltering ? 'جاري التصفية...' : 'تصفية'}</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="bg-white/8 hover:bg-white/15 active:scale-[0.98] text-white/80 hover:text-white font-bold px-3.5 py-2.5 rounded-xl border border-white/15 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
            title="إعادة ضبط المعايير"
          >
            <RotateCcw className="w-3.5 h-3.5 text-white/80" />
            <span>إعادة ضبط</span>
          </button>
        </div>
      </div>


      {/* Smart Summary Card (Dynamic) - Displayed prominently right above the table when selectedPackaging !== 'none' */}
      {selectedPackaging !== 'none' && (
        <section
          aria-label="ملخص استهلاك منتج التغليف"
          className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl text-white p-6 sm:p-7 space-y-4 animate-in fade-in slide-in-from-top-3 duration-200"
        >
          {/* Header of Summary Card */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3.5 border-b border-white/15">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-inner">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                  <span>تتبع استهلاك المخزون (BOM Consumption Tracker)</span>
                </h2>
                <p className="text-xs text-white/70 font-medium">
                  حساب دقيق لاستهلاك علب وصحون التغليف وفق جدول المواد (Bill of Materials)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/10 text-white border border-white/25 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>BOM النشط</span>
              </span>
            </div>
          </div>

          {/* 3 Metric Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Metric 1: منتج التغليف (Selected Product Name) */}
            <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 rounded-xl transition-all p-4 transition-all">
              <div className="text-xs font-bold text-white/70 mb-1 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-white/80" />
                <span>منتج التغليف:</span>
              </div>
              <div className="text-base sm:text-lg font-black text-white truncate" title={selectedProduct.name}>
                {selectedProduct.name}
              </div>
              <div className="text-[11px] text-white/50 font-mono mt-1">
                {selectedPackaging === 'all' ? 'حاسبة استهلاك شاملة' : `معرف التغليف: ${selectedPackaging}`}
              </div>
            </div>

            {/* Metric 2: عدد الأصناف المطلوبة (Dynamic distinct meal items currently visible) */}
            <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 rounded-xl transition-all p-4 transition-all">
              <div className="text-xs font-bold text-white/70 mb-1 flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-white/80" />
                <span>عدد الأصناف المطلوبة:</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono flex items-baseline gap-1.5">
                <span>{filteredRows.length.toLocaleString('en-US')}</span>
                <span className="text-xs font-medium text-white/70 font-sans">صنف</span>
              </div>
              <div className="text-[11px] text-white/50 font-medium mt-1">
                صنف منيو تم تحضيره في هذه الفترة
              </div>
            </div>

            {/* Metric 3: إجمالي الاستهلاك للفترة (SUM of quantity field for all currently filtered rows) */}
            <div className="bg-white/10 hover:bg-white/15 border border-white/30 rounded-xl p-4 transition-all shadow-sm">
              <div className="text-xs font-bold text-white mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-white" />
                <span>إجمالي الاستهلاك للفترة:</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono flex items-baseline gap-1.5">
                <span>{totalConsumption.toLocaleString('en-US')}</span>
                <span className="text-xs font-medium text-white/70 font-sans">وحدة تغليف</span>
              </div>
              <div className="text-[11px] text-white/60 font-medium mt-1">
                مجموع استهلاك كافة الوجبات المرتبطة
              </div>
            </div>
          </div>

          {/* Empty BOM Alert Notice when mapping array is empty */}
          {selectedPackaging !== 'none' && selectedPackaging !== 'all' && PACKAGING_MAPPING[selectedPackaging]?.length === 0 && (
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-white/80">
              <Info className="w-4 h-4 text-white shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">ملاحظة جدول المواد (BOM):</span> لم يتم تعيين أكواد وجبات لمنتج التغليف هذا في ملف جدول المواد حتى الآن. لذلك لا تظهر أي وجبات مستهلكة له في الوقت الحالي.
              </div>
            </div>
          )}
        </section>
      )}

      {/* Table Card (Bottom Section) */}
      <div className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl text-white p-6 sm:p-8 space-y-5">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/15">
          {/* Top Right (RTL): Status Text */}
          <div className="min-h-[28px] flex items-center">
            {isFiltered ? (
              <div className="text-white font-bold text-sm sm:text-base flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)] shrink-0" />
                <span suppressHydrationWarning>
                  {`التصدير جاهز للفترة من ${dateFrom || '---'} إلى ${dateTo || '---'}`}
                </span>
              </div>
            ) : (
              <span className="text-xs text-white/50 font-medium">
                يرجى الضغط على زر &quot;تصفية&quot; لتحديث وتجهيز بيانات التصدير
              </span>
            )}
          </div>

          {/* Top Left (RTL): Search & Export Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Quick Filter Search */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-white/50 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="بحث في الوجبات أو الكود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-white/40 text-xs rounded-xl pr-9 pl-3 py-2 outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40 transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={() => handleExport('excel')}
              className="bg-white/15 hover:bg-white/25 active:scale-[0.98] text-white font-bold px-4 py-2 rounded-xl border border-white/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs shadow-sm backdrop-blur-md"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>تصدير اكسل</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport('pdf')}
              className="bg-white/15 hover:bg-white/25 active:scale-[0.98] text-white font-bold px-4 py-2 rounded-xl border border-white/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs shadow-sm backdrop-blur-md"
            >
              <FileText className="w-4 h-4 text-white" />
              <span>تصدير PDF</span>
            </button>
          </div>
        </div>

        {/* Below Header: Dynamic Total Counters */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 px-4">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <span className="text-white/80">إجمالي الوجبات:</span>
            <span className="font-mono text-white font-extrabold text-xl">
              {totalConsumption.toLocaleString('en-US')}
            </span>
            <span className="text-xs text-white/60">وجبة محضرة</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-white/80">
            <span>
              عدد السجلات: <strong className="font-mono text-white">{filteredRows.length.toLocaleString('en-US')}</strong>
            </span>
            {selectedPackaging !== 'none' && (
              <span className="border-r border-white/20 pr-4">
                فلتر التغليف: <strong className="text-white">{selectedProduct.name}</strong>
              </span>
            )}
          </div>
        </div>

        {/* The Table Structure */}
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-white font-extrabold text-sm">
                <th scope="col" className="py-3.5 px-3 w-16 text-center font-bold">
                  #
                </th>
                <th scope="col" className="py-3.5 px-3 w-28 text-center font-bold">
                  كود الوجبة
                </th>
                <th scope="col" className="py-3.5 px-4 text-right font-bold">
                  الاسم الإنجليزي (English Name)
                </th>
                <th scope="col" className="py-3.5 px-4 text-right font-bold">
                  الاسم العربي
                </th>
                {showCategory && (
                  <th scope="col" className="py-3.5 px-3 w-32 text-center font-bold">
                    التصنيف
                  </th>
                )}
                <th scope="col" className="py-3.5 px-4 w-32 text-center font-bold">
                  الكمية
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRows.length > 0 ? (
                filteredRows.map((row, idx) => (
                  <tr
                    key={row.id || `${row.mealCode}-${idx}`}
                    className="hover:bg-white/5 transition-colors border-b border-white/5"
                  >
                    <td className="py-3 px-3 text-xs font-mono text-white/60 text-center">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3 text-xs font-mono font-bold text-white text-center">
                      <span className="bg-white/10 border border-white/20 px-2 py-0.5 rounded-lg inline-block">
                        {row.mealCode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-white/90 text-right" dir="ltr">
                      {row.nameEn}
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-white text-right">
                      {row.nameAr}
                    </td>
                    {showCategory && (
                      <td className="py-3 px-3 text-xs text-white/80 text-center">
                        <span className="bg-white/5 border border-white/15 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                          {row.category || 'عام'}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-4 text-sm font-mono font-black text-white text-center">
                      {row.quantity.toLocaleString('en-US')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={showCategory ? 6 : 5} className="py-16 px-4 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white mb-4 shadow-inner">
                        <PackageX size={28} className="text-white" />
                      </div>

                      <h3 className="text-lg font-extrabold text-white mb-1.5 drop-shadow-sm">
                        لا توجد أصناف مسندة لهذا الفلتر
                      </h3>
                      <p className="text-white/70 text-xs sm:text-sm max-w-md mx-auto leading-relaxed mb-4 font-medium">
                        {selectedPackaging !== 'none' && selectedPackaging !== 'all'
                          ? `لم يتم العثور على أي وجبات مرتبطة بمنتج "${selectedProduct.name}" في جدول المواد (BOM) للفترة المحددة.`
                          : 'لم يتم العثور على أي سجلات مطابقة لمعايير البحث الحالية.'}
                      </p>

                      <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-white/60 bg-white/5 border border-white/15 px-3.5 py-1.5 rounded-xl">
                        <Database size={13} className="text-white" />
                        <span>خريطة الـ BOM: packagingMap.ts</span>
                        <ArrowRightLeft size={11} className="text-white/40" />
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
