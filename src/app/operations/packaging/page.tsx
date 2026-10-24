"use client";

import { useState, useEffect } from 'react';
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
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Sparkles,
  Database,
  ArrowRightLeft,
  PackageCheck,
  Check,
  Lock
} from 'lucide-react';
import GlassSelect from '@/components/common/GlassSelect';

export default function PackagingPage() {
  const [date, setDate] = useState('');
  const [city, setCity] = useState('ALL');
  const [dispatchBranch, setDispatchBranch] = useState('جميع فروع الإرسال');
  const [status, setStatus] = useState('مؤكد');
  const [serviceType, setServiceType] = useState('الكل');
  const [deliveryWindow, setDeliveryWindow] = useState('الكل');
  const [driverName, setDriverName] = useState('ALL');
  const [branch, setBranch] = useState('ALL');

  // Checkbox State
  const [onlyNotes, setOnlyNotes] = useState(false);

  // Filter feedback
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterApplied, setFilterApplied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Client-safe default date initialization to prevent hydration mismatch
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
  }, []);

  const handleFilter = () => {
    setIsFiltering(true);
    setTimeout(() => {
      setIsFiltering(false);
      setFilterApplied(true);
      showToast('تم تطبيق معايير التصفية بنجاح *');
    }, 450);
  };

  const handleReset = () => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    setCity('ALL');
    setDispatchBranch('جميع فروع الإرسال');
    setStatus('مؤكد');
    setServiceType('الكل');
    setDeliveryWindow('الكل');
    setDriverName('ALL');
    setBranch('ALL');
    setOnlyNotes(false);
    setFilterApplied(false);
    showToast('تمت إعادة ضبط معايير التصفية');
  };

  const handleExport = (name: string, disabled: boolean) => {
    if (disabled) return;
    showToast(`جاري تحضير ملف "${name}" للتصدير...`);
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
              تقرير التغليف
            </h1>
            <p className="text-slate-100 font-semibold text-sm mt-1.5 drop-shadow-sm">
              متابعة وتدقيق معايير التغليف، وتجهيز وجبات الاشتراكات والطلبات حسب خطوط التوزيع
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
        {/* Filters Grid (8 Fields) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-300" />
              <span>التاريخ:</span>
            </label>
            <input
              type="date"
              suppressHydrationWarning
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/8 border border-white/20 text-white font-medium text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 [color-scheme:dark] transition-colors cursor-pointer"
            />
          </div>

          {/* 2. City */}
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

          {/* 3. Dispatch Branches */}
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

          {/* 4. Status (Default: مؤكد) */}
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

          {/* 5. Service Type */}
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

          {/* 6. Delivery Window */}
          <div className="space-y-1.5">
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

          {/* 7. Driver Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-teal-300" />
              <span>اسم المندوب:</span>
            </label>
            <GlassSelect
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="w-full bg-white/8 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none cursor-pointer hover:bg-white/12 transition-colors"
            >
              <option value="ALL">الكل (جميع المناديب)</option>
              <option value="أحمد السالم">أحمد السالم</option>
              <option value="محمد العمري">محمد العمري</option>
              <option value="خالد الغامدي">خالد الغامدي</option>
              <option value="فهد الشمري">فهد الشمري</option>
            </GlassSelect>
          </div>

          {/* 8. Branch */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-teal-300" />
              <span>الفرع:</span>
            </label>
            <GlassSelect
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full bg-white/8 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none cursor-pointer hover:bg-white/12 transition-colors"
            >
              <option value="ALL">الكل (كافة الفروع)</option>
              <option value="فرع التخصصي">فرع التخصصي</option>
              <option value="فرع العليا">فرع العليا</option>
              <option value="فرع حطين">فرع حطين</option>
              <option value="فرع الروضة">فرع الروضة</option>
            </GlassSelect>
          </div>
        </div>

        {/* Checkbox Section */}
        <div className="pt-2">
          <label className="inline-flex items-center gap-3 cursor-pointer select-none bg-white/5 hover:bg-white/10 border border-white/15 px-4 py-3 rounded-xl transition-all">
            <input
              type="checkbox"
              checked={onlyNotes}
              onChange={(e) => setOnlyNotes(e.target.checked)}
              className="w-4 h-4 rounded border-white/30 bg-white/10 text-teal-500 focus:ring-teal-400 focus:ring-offset-0 cursor-pointer accent-teal-500"
            />
            <span className="text-xs sm:text-sm font-bold text-white/95">
              فقط قم بإظهار الإشتراكات التي تحتوي على ملاحظات
            </span>
          </label>
        </div>

        {/* Action Buttons Row */}
        <div className="pt-4 border-t border-white/15 flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4">
          {/* Primary Filter Button (Left in visual / Start) */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleFilter}
              disabled={isFiltering}
              className="bg-teal-500 hover:bg-teal-600 active:scale-[0.98] text-white font-extrabold px-6 py-2.5 rounded-xl shadow-lg shadow-teal-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <Filter className={`w-4 h-4 ${isFiltering ? 'animate-spin' : ''}`} />
              <span>{isFiltering ? 'جاري التصفية...' : 'تصفية *'}</span>
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

          {/* Row of 5 Export Buttons */}
          <div className="flex flex-wrap items-center gap-2 justify-start xl:justify-end">
            {/* 1. Export Excel (Active) */}
            <button
              type="button"
              onClick={() => handleExport('تصدير اكسل', false)}
              className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-100 border border-emerald-400/30 font-bold px-3.5 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs shadow-sm hover:border-emerald-300"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>تصدير اكسل</span>
            </button>

            {/* 2. Export PDF (Active) */}
            <button
              type="button"
              onClick={() => handleExport('تصدير PDF', false)}
              className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-100 border border-rose-400/30 font-bold px-3.5 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs shadow-sm hover:border-rose-300"
            >
              <FileText className="w-4 h-4 text-rose-300" />
              <span>تصدير PDF</span>
            </button>

            {/* 3. Export Notes (Disabled / Greyed out) */}
            <button
              type="button"
              disabled
              className="opacity-40 cursor-not-allowed bg-white/5 border border-white/10 text-white/50 font-bold px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs select-none"
              title="يتطلب ربط بيانات الملاحظات"
            >
              <Lock className="w-3.5 h-3.5 text-white/40" />
              <span>تصدير الملاحظات</span>
            </button>

            {/* 4. Export Customer Names (Disabled / Greyed out) */}
            <button
              type="button"
              disabled
              className="opacity-40 cursor-not-allowed bg-white/5 border border-white/10 text-white/50 font-bold px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs select-none"
              title="يتطلب ربط بيانات العملاء"
            >
              <Lock className="w-3.5 h-3.5 text-white/40" />
              <span>تصدير أسماء العملاء</span>
            </button>

            {/* 5. Export Nutrition Labels (Disabled / Greyed out) */}
            <button
              type="button"
              disabled
              className="opacity-40 cursor-not-allowed bg-white/5 border border-white/10 text-white/50 font-bold px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs select-none"
              title="يتطلب ربط ملصقات القيم الغذائية"
            >
              <Lock className="w-3.5 h-3.5 text-white/40" />
              <span>تصدير ملصقات القيم الغذائية</span>
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
              التاريخ: {date || 'اليوم'}
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
              الفرع: {branch === 'ALL' ? 'كافة الفروع' : branch}
            </span>
            <span className="bg-white/10 text-white font-semibold px-2.5 py-1 rounded-lg border border-white/15">
              الخدمة: {serviceType}
            </span>
            <span className="bg-white/10 text-white font-semibold px-2.5 py-1 rounded-lg border border-white/15">
              النافذة: {deliveryWindow}
            </span>
            {onlyNotes && (
              <span className="bg-amber-500/20 text-amber-200 font-semibold px-2.5 py-1 rounded-lg border border-amber-400/30">
                فقط الاشتراكات ذات الملاحظات
              </span>
            )}
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
          <PackageCheck size={32} />
        </div>

        <h2 className="text-xl font-extrabold text-white mb-2 drop-shadow-sm">
          في انتظار ربط البيانات...
        </h2>
        <p className="text-white/70 text-sm max-w-md mx-auto leading-relaxed mb-6 font-medium">
          تم تصميم وبناء شاشة تقرير التغليف بنجاح وفق معايير نظام تكرار. ستظهر تفاصيل وقوائم التغليف والملصقات تلقائياً فور اكتمال الربط البرمجي مع النظام الرئيسي.
        </p>

        <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-white/60 bg-white/5 border border-white/15 px-4 py-2 rounded-xl">
          <Database size={14} className="text-teal-300" />
          <span>Endpoint: /api/operations/packaging</span>
          <ArrowRightLeft size={12} className="text-white/40" />
        </div>
      </div>
    </div>
  );
}
