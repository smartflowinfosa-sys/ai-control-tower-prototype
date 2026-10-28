"use client";

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/components/common/LanguageContext';

export default function ProductionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { lang } = useLanguage();

  useEffect(() => {
    console.error('[ProductionError]', error);
  }, [error]);

  return (
    <div className="page-shell w-full min-h-[60vh] flex items-center justify-center p-4 font-sans">
      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-8 max-w-lg w-full text-center space-y-5 shadow-2xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-400/25 flex items-center justify-center text-amber-300">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-white">
            {lang === 'en' ? 'Unable to Connect to Database' : 'تعذر الاتصال بقاعدة البيانات'}
          </h2>
          <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
            {lang === 'en'
              ? 'An unexpected error occurred while loading production telemetry. Please verify your connection and try again.'
              : 'حدث خطأ غير متوقع أثناء تحميل بيانات تشغيل الإنتاج. يرجى التحقق من الاتصال وإعادة المحاولة.'}
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs sm:text-sm font-bold border border-white/20 backdrop-blur-md transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-4 h-4 text-emerald-300" />
            <span>{lang === 'en' ? 'Retry' : 'إعادة المحاولة'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

