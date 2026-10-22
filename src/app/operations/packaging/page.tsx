"use client";

import { PackageCheck, Database, ArrowRightLeft } from 'lucide-react';

export default function PackagingPage() {
  return (
    <div className="page-shell w-full mx-auto space-y-6">
      {/* Title Container */}
      <header className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-500/15 text-teal-200 border border-teal-400/30">
                تقارير العمليات
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
              التغليف
            </h1>
            <p className="text-slate-100 font-semibold text-sm mt-1.5 drop-shadow-sm">
              متابعة وتدقيق معايير التغليف ومطابقة المواد للطلبات
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/8 border border-white/20 px-3.5 py-1.5 rounded-xl text-xs font-bold text-teal-300">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>جاهز للربط (API Ready)</span>
          </div>
        </div>
      </header>

      {/* Empty State / Integration Placeholder */}
      <div className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-12 sm:p-16 text-center flex flex-col items-center justify-center min-h-[380px]">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-300/30 flex items-center justify-center text-teal-200 mb-6 shadow-inner">
          <PackageCheck size={32} />
        </div>

        <h2 className="text-xl font-extrabold text-white mb-2 drop-shadow-sm">
          في انتظار ربط البيانات...
        </h2>
        <p className="text-white/70 text-sm max-w-md mx-auto leading-relaxed mb-6 font-medium">
          تم تجهيز شاشة متابعة التغليف بنجاح. سيتم جلب وعرض بيانات التغليف ومعايير التحقق تلقائياً بمجرد تفعيل واجهة البرمجة (API).
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
