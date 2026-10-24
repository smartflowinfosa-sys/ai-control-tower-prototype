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

  // Filter feedback & Dynamic Export Text State
  const [isFiltering, setIsFiltering] = useState(false);
  const [isFiltered, setIsFiltered] = useState(false);
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
      setIsFiltered(true);
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
    setIsFiltered(false);
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
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-black/85 backdrop-blur-xl border border-white/30 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Title & Header */}
      <header className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/10 text-white border border-white/20">
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
          <div className="flex items-center gap-2 bg-white/8 border border-white/20 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white/90">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
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
              <Calendar className="w-3.5 h-3.5 text-white/80" />
              <span>من تاريخ:</span>
            </label>
            <input
              type="date"
              suppressHydrationWarning
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-white/8 border border-white/20 text-white font-medium text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40 [color-scheme:dark] transition-colors cursor-pointer"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-white/80" />
              <span>إلى تاريخ:</span>
            </label>
            <input
              type="date"
              suppressHydrationWarning
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-white/8 border border-white/20 text-white font-medium text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40 [color-scheme:dark] transition-colors cursor-pointer"
            />
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-white/80" />
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
              <Building2 className="w-3.5 h-3.5 text-white/80" />
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
              <CheckCircle2 className="w-3.5 h-3.5 text-white/80" />
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
              <Truck className="w-3.5 h-3.5 text-white/80" />
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
              <Clock className="w-3.5 h-3.5 text-white/80" />
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
                  ? 'bg-white/20 border-white/40 text-white shadow-sm'
                  : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div
                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                  groupByPackage ? 'bg-white' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full transition-transform duration-200 ${
                    groupByPackage ? 'translate-x-3.5 bg-zinc-900 shadow-sm' : 'translate-x-0 bg-white shadow-sm'
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
                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                  groupBySku ? 'bg-white' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full transition-transform duration-200 ${
                    groupBySku ? 'translate-x-3.5 bg-zinc-900 shadow-sm' : 'translate-x-0 bg-white shadow-sm'
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
                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                  showCategory ? 'bg-white' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full transition-transform duration-200 ${
                    showCategory ? 'translate-x-3.5 bg-zinc-900 shadow-sm' : 'translate-x-0 bg-white shadow-sm'
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
                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                  groupByReference ? 'bg-white' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full transition-transform duration-200 ${
                    groupByReference ? 'translate-x-3.5 bg-zinc-900 shadow-sm' : 'translate-x-0 bg-white shadow-sm'
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
                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                  groupBySize ? 'bg-white' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full transition-transform duration-200 ${
                    groupBySize ? 'translate-x-3.5 bg-zinc-900 shadow-sm' : 'translate-x-0 bg-white shadow-sm'
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

      {/* Applied Filters Summary Bar */}
      {isFiltered && (
        <div className="bg-white/5 border border-white/15 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-white/80">المعايير النشطة:</span>
            <span className="bg-white/10 text-white font-semibold px-2.5 py-1 rounded-lg border border-white/15">
              من: {dateFrom || '---'} إلى: {dateTo || '---'}
            </span>
            <span className="bg-white/15 text-white font-semibold px-2.5 py-1 rounded-lg border border-white/30">
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
          <span className="text-white font-mono font-bold flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-white" />
            <span>تم التحديث</span>
          </span>
        </div>
      )}

      {/* Table Card (Bottom Section) */}
      <div className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-6 sm:p-8 space-y-5">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/15">
          {/* Top Right (RTL): Dynamic Green-to-White Success Text (Shown ONLY when filtered) */}
          <div className="min-h-[28px] flex items-center">
            {isFiltered ? (
              <div className="text-white font-bold text-sm sm:text-base flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)] shrink-0" />
                <span suppressHydrationWarning>
                  {`التصدير جاهز للفترة من ${dateFrom || '---'} إلى ${dateTo || '---'}`}
                </span>
              </div>
            ) : (
              <span className="text-xs text-white/40 font-medium">
                يرجى الضغط على زر &quot;تصفية&quot; لتحديث وتجهيز بيانات التصدير
              </span>
            )}
          </div>

          {/* Top Left (RTL): Export Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleExport('excel')}
              className="bg-white/15 hover:bg-white/25 active:scale-[0.98] text-white font-bold px-4 py-2.5 rounded-xl border border-white/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs shadow-sm backdrop-blur-md"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>تصدير اكسل</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport('pdf')}
              className="bg-white/15 hover:bg-white/25 active:scale-[0.98] text-white font-bold px-4 py-2.5 rounded-xl border border-white/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs shadow-sm backdrop-blur-md"
            >
              <FileText className="w-4 h-4 text-white" />
              <span>تصدير PDF</span>
            </button>
          </div>
        </div>

        {/* Below Header: Total Counter Placeholder */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <span>المجموع:</span>
            <span className="font-mono text-white font-extrabold text-xl">0</span>
          </div>
          <span className="text-xs text-white/50 font-medium">عدد السجلات: 0</span>
        </div>

        {/* The Table Structure */}
        <div className="overflow-x-auto rounded-xl border border-white/20">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-white/10 border-b border-white/20 text-white font-extrabold text-sm">
                <th scope="col" className="py-3.5 px-4 w-20 text-center font-bold">
                  #
                </th>
                <th scope="col" className="py-3.5 px-4 text-center font-bold">
                  الاسم الإنجليزي
                </th>
                <th scope="col" className="py-3.5 px-4 text-center font-bold">
                  الاسم العربي
                </th>
                <th scope="col" className="py-3.5 px-4 w-32 text-center font-bold">
                  الكمية
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              <tr>
                <td colSpan={4} className="py-16 px-4 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white mb-4 shadow-inner">
                      <FileText size={28} className="text-white" />
                    </div>

                    <h3 className="text-lg font-extrabold text-white mb-1.5 drop-shadow-sm">
                      في انتظار ربط البيانات...
                    </h3>
                    <p className="text-white/70 text-xs sm:text-sm max-w-md mx-auto leading-relaxed mb-4 font-medium">
                      تم تصميم وبناء شاشة فاتورة الكمية بنجاح وفق معايير نظام تكرار. ستظهر جداول الكميات المفصلة للطلبات تلقائياً فور اكتمال الربط البرمجي مع النظام الرئيسي.
                    </p>

                    <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-white/60 bg-white/5 border border-white/15 px-3.5 py-1.5 rounded-xl">
                      <Database size={13} className="text-white" />
                      <span>Endpoint: /api/operations/quantity</span>
                      <ArrowRightLeft size={11} className="text-white/40" />
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
