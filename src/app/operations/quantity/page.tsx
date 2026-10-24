"use client";

import { useState, useEffect } from 'react';
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
  Check
} from 'lucide-react';
import GlassSelect from '@/components/common/GlassSelect';

export default function QuantityInvoicePage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [city, setCity] = useState('ALL');
  const [dispatchBranch, setDispatchBranch] = useState('جميع فروع الإرسال');
  const [status, setStatus] = useState('مؤكد');
  const [serviceType, setServiceType] = useState('الكل');
  const [deliveryWindow, setDeliveryWindow] = useState('الكل');

  // Toggle Switches State
  const [groupByPackage, setGroupByPackage] = useState(false);
  const [groupBySku, setGroupBySku] = useState(false);
  const [showCategory, setShowCategory] = useState(true);
  const [groupByReference, setGroupByReference] = useState(false);
  const [groupBySize, setGroupBySize] = useState(false);

  // Filter feedback
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterApplied, setFilterApplied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Client-safe default date initialization to avoid hydration mismatch
    const today = new Date().toISOString().split('T')[0];
    setDateFrom(today);
    setDateTo(today);
  }, []);

  const handleFilter = () => {
    setIsFiltering(true);
    setTimeout(() => {
      setIsFiltering(false);
      setFilterApplied(true);
      showToast('تم تطبيق معايير التصفية بنجاح');
    }, 450);
  };

  const handleReset = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateFrom(today);
    setDateTo(today);
    setCity('ALL');
    setDispatchBranch('جميع فروع الإرسال');
    setStatus('مؤكد');
    setServiceType('الكل');
    setDeliveryWindow('الكل');
    setGroupByPackage(false);
    setGroupBySku(false);
    setShowCategory(true);
    setGroupByReference(false);
    setGroupBySize(false);
    setFilterApplied(false);
    showToast('تمت إعادة ضبط معايير التصفية');
  };

  const handleExport = (type: 'excel' | 'pdf') => {
    const formatName = type === 'excel' ? 'Excel' : 'PDF';
    showToast(`جاري تحضير ملف ${formatName} للتصدير...`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="page-shell w-full mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur-xl border border-teal-400/40 text-teal-100 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-teal-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Title & Header */}
      <header className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-500/15 text-teal-200 border border-teal-400/30">
                تقارير العمليات (Operations Reports)
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/10 text-white/80 border border-white/20">
                نظام تكرار (Tikrar)
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
              فاتورة الكمية
            </h1>
            <p className="text-slate-100 font-semibold text-sm mt-1.5 drop-shadow-sm">
              استخراج وتحليل كميات الوجبات والإنتاج المجمعة لمطابخ وفروع زاهي
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/8 border border-white/20 px-3.5 py-1.5 rounded-xl text-xs font-bold text-teal-300">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>جاهز للربط (API Ready)</span>
          </div>
        </div>
      </header>

      {/* Main Filter Panel */}
      <div className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date From */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-300" />
              <span>من تاريخ:</span>
            </label>
            <input
              type="date"
              suppressHydrationWarning
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-white/8 border border-white/20 text-white font-medium text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 [color-scheme:dark] transition-colors cursor-pointer"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-300" />
              <span>إلى تاريخ:</span>
            </label>
            <input
              type="date"
              suppressHydrationWarning
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-white/8 border border-white/20 text-white font-medium text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 [color-scheme:dark] transition-colors cursor-pointer"
            />
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-teal-300" />
              <span>المدينة:</span>
            </label>
            <GlassSelect
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-white/8 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none cursor-pointer hover:bg-white/12 transition-colors"
            >
              <option value="ALL">الكل (جميع المدن)</option>
              <option value="الرياض">الرياض</option>
              <option value="مكة المكرمة">مكة المكرمة</option>
              <option value="جدة">جدة</option>
            </GlassSelect>
          </div>

          {/* Dispatch Branches */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-teal-300" />
              <span>فروع الإرسال:</span>
            </label>
            <GlassSelect
              value={dispatchBranch}
              onChange={(e) => setDispatchBranch(e.target.value)}
              className="w-full bg-white/8 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none cursor-pointer hover:bg-white/12 transition-colors"
            >
              <option value="جميع فروع الإرسال">جميع فروع الإرسال</option>
              <option value="جميع الفروع باستثناء فروع الإرسال">جميع الفروع باستثناء فروع الإرسال</option>
              <option value="إزالة التصفية حسب فرع الإرسال">إزالة التصفية حسب فرع الإرسال</option>
            </GlassSelect>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-300" />
              <span>الحالة:</span>
            </label>
            <GlassSelect
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-white/8 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none cursor-pointer hover:bg-white/12 transition-colors"
            >
              <option value="مؤكد">مؤكد</option>
              <option value="تم التوصيل">تم التوصيل</option>
              <option value="لم يتم استلامه من قبل العميل">لم يتم استلامه من قبل العميل</option>
              <option value="لم يتم استلامه من المطعم">لم يتم استلامه من المطعم</option>
              <option value="الكل">الكل</option>
            </GlassSelect>
          </div>

          {/* Service Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-teal-300" />
              <span>نوع الخدمة:</span>
            </label>
            <GlassSelect
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full bg-white/8 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none cursor-pointer hover:bg-white/12 transition-colors"
            >
              <option value="الكل">الكل</option>
              <option value="التوصيل">التوصيل</option>
              <option value="استلام العميل">استلام العميل</option>
            </GlassSelect>
          </div>

          {/* Delivery Window */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-300" />
              <span>نافذة التوصيل:</span>
            </label>
            <GlassSelect
              value={deliveryWindow}
              onChange={(e) => setDeliveryWindow(e.target.value)}
              className="w-full bg-white/8 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none cursor-pointer hover:bg-white/12 transition-colors"
            >
              <option value="الكل">الكل</option>
              <option value="03:00 م - 08:00 م">03:00 م - 08:00 م</option>
              <option value="05:00 ص - 02:00 م">05:00 ص - 02:00 م</option>
              <option value="12:00 م - 08:00 م">12:00 م - 08:00 م</option>
            </GlassSelect>
          </div>
        </div>

        {/* Toggles (Switches) Row */}
        <div className="pt-4 border-t border-white/15">
          <div className="text-xs font-extrabold text-white/80 mb-3 flex items-center gap-2">
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
                  ? 'bg-teal-500/25 border-teal-400/50 text-teal-100 shadow-sm shadow-teal-500/20'
                  : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div
                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                  groupByPackage ? 'bg-teal-400' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
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
                  ? 'bg-teal-500/25 border-teal-400/50 text-teal-100 shadow-sm shadow-teal-500/20'
                  : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div
                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                  groupBySku ? 'bg-teal-400' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
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
                  ? 'bg-teal-500/25 border-teal-400/50 text-teal-100 shadow-sm shadow-teal-500/20'
                  : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div
                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                  showCategory ? 'bg-teal-400' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
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
                  ? 'bg-teal-500/25 border-teal-400/50 text-teal-100 shadow-sm shadow-teal-500/20'
                  : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div
                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                  groupByReference ? 'bg-teal-400' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
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
                  ? 'bg-teal-500/25 border-teal-400/50 text-teal-100 shadow-sm shadow-teal-500/20'
                  : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div
                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                  groupBySize ? 'bg-teal-400' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    groupBySize ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </div>
              <span>تجميع حسب الحجم</span>
            </button>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="pt-4 border-t border-white/15 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Filter & Reset Buttons (Left in visual / Action Start) */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleFilter}
              disabled={isFiltering}
              className="bg-teal-500 hover:bg-teal-600 active:scale-[0.98] text-white font-extrabold px-6 py-2.5 rounded-xl shadow-lg shadow-teal-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <Filter className={`w-4 h-4 ${isFiltering ? 'animate-spin' : ''}`} />
              <span>{isFiltering ? 'جاري التصفية...' : 'تصفية'}</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="bg-white/8 hover:bg-white/15 active:scale-[0.98] text-white/80 hover:text-white font-bold px-3.5 py-2.5 rounded-xl border border-white/15 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
              title="إعادة ضبط المعايير"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط</span>
            </button>
          </div>

          {/* Export Buttons (Bottom Right) */}
          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={() => handleExport('excel')}
              className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-100 border border-emerald-400/30 font-bold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs shadow-sm hover:border-emerald-300"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>تصدير اكسل</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport('pdf')}
              className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-100 border border-rose-400/30 font-bold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs shadow-sm hover:border-rose-300"
            >
              <FileText className="w-4 h-4 text-rose-300" />
              <span>تصدير PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Applied Filters Summary Bar */}
      {filterApplied && (
        <div className="bg-white/5 border border-white/15 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-white/80">المعايير النشطة:</span>
            <span className="bg-white/10 text-white font-semibold px-2.5 py-1 rounded-lg border border-white/15">
              من: {dateFrom || 'اليوم'} إلى: {dateTo || 'اليوم'}
            </span>
            <span className="bg-teal-500/20 text-teal-200 font-semibold px-2.5 py-1 rounded-lg border border-teal-400/30">
              الحالة: {status}
            </span>
            <span className="bg-white/10 text-white font-semibold px-2.5 py-1 rounded-lg border border-white/15">
              المدينة: {city === 'ALL' ? 'كافة المدن' : city}
            </span>
            <span className="bg-white/10 text-white font-semibold px-2.5 py-1 rounded-lg border border-white/15">
              فروع الإرسال: {dispatchBranch}
            </span>
            <span className="bg-white/10 text-white font-semibold px-2.5 py-1 rounded-lg border border-white/15">
              الخدمة: {serviceType}
            </span>
            <span className="bg-white/10 text-white font-semibold px-2.5 py-1 rounded-lg border border-white/15">
              النافذة: {deliveryWindow}
            </span>
          </div>
          <span className="text-teal-300 font-mono font-bold flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>تم التحديث</span>
          </span>
        </div>
      )}

      {/* Empty State / Integration Placeholder Area */}
      <div className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-12 sm:p-16 text-center flex flex-col items-center justify-center min-h-[340px]">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-300/30 flex items-center justify-center text-teal-200 mb-6 shadow-inner">
          <FileText size={32} />
        </div>

        <h2 className="text-xl font-extrabold text-white mb-2 drop-shadow-sm">
          في انتظار ربط البيانات...
        </h2>
        <p className="text-white/70 text-sm max-w-md mx-auto leading-relaxed mb-6 font-medium">
          تم تصميم وبناء شاشة فاتورة الكمية بنجاح وفق معايير نظام تكرار. ستظهر جداول الكميات المفصلة للطلبات تلقائياً فور اكتمال الربط البرمجي مع النظام الرئيسي.
        </p>

        <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-white/60 bg-white/5 border border-white/15 px-4 py-2 rounded-xl">
          <Database size={14} className="text-teal-300" />
          <span>Endpoint: /api/operations/quantity</span>
          <ArrowRightLeft size={12} className="text-white/40" />
        </div>
      </div>
    </div>
  );
}
