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
  const [driverName, setDriverName] = useState('الكل');
  const [branch, setBranch] = useState('الرياض (فرع التوصيل)');

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
    setDriverName('الكل');
    setBranch('الرياض (فرع التوصيل)');
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
              تقرير التغليف
            </h1>
            <p className="text-slate-100 font-semibold text-sm mt-1.5 drop-shadow-sm">
              متابعة وتدقيق معايير التغليف، وتجهيز وجبات الاشتراكات والطلبات حسب خطوط التوزيع
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
        {/* Filters Grid (8 Fields) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-white/80" />
              <span>التاريخ:</span>
            </label>
            <input
              type="date"
              suppressHydrationWarning
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/8 border border-white/20 text-white font-medium text-sm rounded-xl px-3.5 py-2.5 outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40 [color-scheme:dark] transition-colors cursor-pointer"
            />
          </div>

          {/* 2. City */}
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

          {/* 3. Dispatch Branches */}
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

          {/* 4. Status (Default: مؤكد) */}
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
            </GlassSelect>
          </div>

          {/* 5. Service Type */}
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

          {/* 6. Delivery Window */}
          <div className="space-y-1.5">
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

          {/* 7. Driver Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-white/80" />
              <span>اسم المندوب:</span>
            </label>
            <GlassSelect
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="w-full bg-white/8 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none cursor-pointer hover:bg-white/12 transition-colors"
            >
              <option value="الكل">الكل</option>
            </GlassSelect>
          </div>

          {/* 8. Branch */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-white/80" />
              <span>الفرع:</span>
            </label>
            <GlassSelect
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full bg-white/8 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none cursor-pointer hover:bg-white/12 transition-colors"
            >
              <option value="الرياض (فرع التوصيل)">الرياض (فرع التوصيل)</option>
              <option value="مكة المكرمة (فرع التوصيل)">مكة المكرمة (فرع التوصيل)</option>
              <option value="جده (فرع التوصيل)">جده (فرع التوصيل)</option>
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
              className="w-4 h-4 rounded border-white/30 bg-white/10 text-white focus:ring-white/40 focus:ring-offset-0 cursor-pointer accent-white"
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
              className="bg-white/20 hover:bg-white/30 active:scale-[0.98] text-white font-extrabold px-6 py-2.5 rounded-xl border border-white/30 shadow-lg shadow-black/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm backdrop-blur-md"
            >
              <Filter className={`w-4 h-4 text-white ${isFiltering ? 'animate-spin' : ''}`} />
              <span>{isFiltering ? 'جاري التصفية...' : 'تصفية *'}</span>
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

          {/* Row of 5 Export Buttons */}
          <div className="flex flex-wrap items-center gap-2 justify-start xl:justify-end">
            {/* 1. Export Excel (Active) */}
            <button
              type="button"
              onClick={() => handleExport('تصدير اكسل', false)}
              className="bg-white/15 hover:bg-white/25 active:scale-[0.98] text-white font-bold px-3.5 py-2 rounded-xl border border-white/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs shadow-sm backdrop-blur-md"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>تصدير اكسل</span>
            </button>

            {/* 2. Export PDF (Active) */}
            <button
              type="button"
              onClick={() => handleExport('تصدير PDF', false)}
              className="bg-white/15 hover:bg-white/25 active:scale-[0.98] text-white font-bold px-3.5 py-2 rounded-xl border border-white/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs shadow-sm backdrop-blur-md"
            >
              <FileText className="w-4 h-4 text-white" />
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
          {/* Title Tab Styled with Bottom Border */}
          <div className="flex items-center gap-4">
            <div className="border-b-2 border-white pb-4 -mb-4 px-2 text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-white" />
              <span>تقرير التغليف</span>
            </div>
          </div>

          {/* Total Counter Placeholder */}
          <div className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <span>المجموع</span>
            <span className="font-mono text-2xl font-black">0</span>
          </div>
        </div>

        {/* The Table Structure */}
        <div className="overflow-x-auto rounded-xl border border-white/20">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-white/10 border-b border-white/20 text-white font-extrabold text-xs">
                <th scope="col" className="py-3 px-3 w-14 text-center font-bold whitespace-nowrap">
                  الرقم
                </th>
                <th scope="col" className="py-3 px-3 text-center font-bold whitespace-nowrap">
                  رقم الإشتراك
                </th>
                <th scope="col" className="py-3 px-3 text-center font-bold whitespace-nowrap">
                  اسم العميل
                </th>
                <th scope="col" className="py-3 px-3 text-center font-bold whitespace-nowrap">
                  الاسم
                </th>
                <th scope="col" className="py-3 px-3 text-center font-bold whitespace-nowrap">
                  ملاحظات
                </th>
                <th scope="col" className="py-3 px-3 text-center font-bold whitespace-nowrap">
                  عدد الأصناف
                </th>
                <th scope="col" className="py-3 px-3 text-center font-bold whitespace-nowrap">
                  عدد أيام الإشتراك
                </th>
                <th scope="col" className="py-3 px-3 text-center font-bold whitespace-nowrap">
                  نافذة التوصيل
                </th>
                <th scope="col" className="py-3 px-3 text-center font-bold whitespace-nowrap">
                  نوع الخدمة
                </th>
                <th scope="col" className="py-3 px-3 text-center font-bold whitespace-nowrap">
                  الحي
                </th>
                <th scope="col" className="py-3 px-3 text-center font-bold whitespace-nowrap">
                  فرع الارسال
                </th>
                <th scope="col" className="py-3 px-3 text-center font-bold whitespace-nowrap">
                  مجموعة الحي
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/10">
                <td colSpan={12} className="py-20 text-center text-white">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-inner">
                      <PackageCheck size={24} />
                    </div>
                    <div className="text-base font-extrabold text-white">
                      في انتظار ربط البيانات...
                    </div>
                    <p className="text-xs text-white/60 max-w-sm font-medium">
                      تم تجهيز هيكل جدول تقرير التغليف. ستظهر تفاصيل وقوائم التغليف تلقائياً فور اكتمال الربط البرمجي.
                    </p>
                    <div className="inline-flex items-center gap-2 text-[11px] font-mono font-bold text-white/50 bg-white/5 border border-white/15 px-3 py-1.5 rounded-xl mt-1">
                      <Database size={13} className="text-white/70" />
                      <span>Endpoint: /api/operations/packaging</span>
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
