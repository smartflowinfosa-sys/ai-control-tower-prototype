"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  Truck,
  ChefHat,
  ArrowUpRight,
  Sparkles,
  Layers,
  ChevronRight
} from 'lucide-react';
import { useLanguage } from '@/components/common/LanguageContext';

const ControlTowerCharts = dynamic(
  () => import('@/components/dashboard/ControlTowerCharts'),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-pulse">
        <div className="h-72 rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/10 p-5" />
        <div className="h-72 rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/10 p-5" />
      </div>
    ),
  }
);

const AIAutonomyControl = dynamic(
  () => import('@/components/dashboard/AIAutonomyControl'),
  {
    ssr: false,
    loading: () => (
      <div className="h-44 rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/10 p-5 animate-pulse" />
    ),
  }
);
import { initialInventoryItems, getSessionPurchaseOrders } from '@/lib/mockInventoryData';
import { fetchInventoryItems, fetchPurchaseOrders } from '@/lib/supabaseService';
import {
  TOTAL_PRODUCTION_TARGET,
  initialKdsBatches,
  getKdsBatches,
  calculateKdsCompletion,
} from '@/lib/kdsProductionStore';

const toEnglishDigits = (val: string | number): string => {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

export default function DashboardClientView() {
  const { lang, t } = useLanguage();

  // Dynamic counts state
  const [criticalCount, setCriticalCount] = useState<number>(() => {
    return initialInventoryItems.filter(item => {
      const min = item.minThreshold ?? item.min_stock_level ?? 1000;
      return item.currentStock <= min;
    }).length || 2;
  });

  const [activePOCount, setActivePOCount] = useState<number>(() => {
    return getSessionPurchaseOrders().filter(po => {
      const st = (po.status || '').toLowerCase();
      return st !== 'received' && st !== 'تم الاستلام' && st !== 'delivered';
    }).length || 3;
  });

  // Dynamically reactive to KDS Kanban board state (initialized deterministically with initialKdsBatches for SSR/CSR hydration parity)
  const [kdsStats, setKdsStats] = useState(() => {
    return calculateKdsCompletion(initialKdsBatches, TOTAL_PRODUCTION_TARGET);
  });

  useEffect(() => {
    const handleKdsUpdate = (e: any) => {
      if (e?.detail) {
        setKdsStats({
          readyUnits: e.detail.readyUnits,
          totalTarget: e.detail.totalTarget,
          completionRate: e.detail.completionRate,
        });
      } else {
        setKdsStats(calculateKdsCompletion(getKdsBatches(), TOTAL_PRODUCTION_TARGET));
      }
    };

    setKdsStats(calculateKdsCompletion(getKdsBatches(), TOTAL_PRODUCTION_TARGET));

    window.addEventListener('kds_batches_updated', handleKdsUpdate);
    window.addEventListener('storage', handleKdsUpdate);
    return () => {
      window.removeEventListener('kds_batches_updated', handleKdsUpdate);
      window.removeEventListener('storage', handleKdsUpdate);
    };
  }, []);

  // Fetch real-time count updates from Supabase if connected
  useEffect(() => {
    fetchInventoryItems()
      .then(items => {
        if (items && items.length > 0) {
          const crit = items.filter(i => (Number(i.current_stock) || 0) <= (Number(i.min_stock_level) || 0)).length;
          setCriticalCount(crit);
        }
      })
      .catch(console.warn);

    fetchPurchaseOrders()
      .then(pos => {
        if (pos && pos.length > 0) {
          const act = pos.filter(po => {
            const st = (po.status || '').toLowerCase();
            return st !== 'received' && st !== 'تم الاستلام' && st !== 'delivered';
          }).length;
          setActivePOCount(act);
        }
      })
      .catch(console.warn);
  }, []);

  return (
    <div className="page-shell w-full mx-auto space-y-8 font-sans">
      {/* 1. Executive Control Tower Header */}
      <header className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/15 border border-emerald-400/30 rounded-xl text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
                <span>{lang === 'en' ? 'Dashboard' : 'لوحة التحكم'}</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Quick KDS Link */}
        <div className="flex items-center gap-3">
          <Link
            href="/production"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white text-xs font-bold transition-all shadow-sm cursor-pointer group"
          >
            <ChefHat className="w-4 h-4 text-teal-300 group-hover:rotate-12 transition-transform" />
            <span>{lang === 'en' ? 'Open Kitchen KDS' : 'شاشة الإنتاج المجمع'}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-white/70" />
          </Link>
        </div>
      </header>

      {/* 2. Three Operational Metric Glassmorphism Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: نواقص حرجة (Critical Inventory) */}
        <Link
          href="/inventory"
          className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] hover:bg-white/[0.09] hover:border-rose-400/50 rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-white/75">
                {lang === 'en' ? 'Critical Inventory' : 'نواقص حرجة'}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono" dir="ltr" lang="en">
                  {toEnglishDigits(criticalCount)}
                </span>
                <span className="text-xs font-medium text-white/60">
                  {lang === 'en' ? 'items' : 'أصناف'}
                </span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.25)] group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between text-xs">
            <span className="text-rose-300 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              {lang === 'en' ? 'Below reorder point' : 'وصلت لحد إعادة الطلب'}
            </span>
            <span className="text-white/50 group-hover:text-white font-mono font-bold flex items-center">
              {lang === 'en' ? 'Review' : 'معاينة'} <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>

        {/* Card 2: طلبات الموردين النشطة (Active POs) */}
        <Link
          href="/suppliers"
          className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] hover:bg-white/[0.09] hover:border-emerald-400/50 rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-white/75">
                {lang === 'en' ? 'Active Purchase Orders' : 'طلبات الموردين النشطة'}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono" dir="ltr" lang="en">
                  {toEnglishDigits(activePOCount)}
                </span>
                <span className="text-xs font-medium text-white/60">
                  {lang === 'en' ? 'orders' : 'أوامر جارية'}
                </span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)] group-hover:scale-105 transition-transform">
              <Truck className="w-6 h-6" />
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between text-xs">
            <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              {lang === 'en' ? 'Dispatched / In-Transit' : 'شحنات قيد التوريد والتوصيل'}
            </span>
            <span className="text-white/50 group-hover:text-white font-mono font-bold flex items-center">
              {lang === 'en' ? 'Track' : 'تتبع'} <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>

        {/* Card 3: ملخص الإنتاج اليومي (Daily Production Summary - Consolidated) */}
        <Link
          href="/production"
          className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] hover:bg-white/[0.09] hover:border-teal-400/50 rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <ChefHat className="w-3.5 h-3.5 text-teal-300" />
                <span className="text-xs font-bold text-white/75">
                  {lang === 'en' ? 'Daily Production Summary' : 'ملخص الإنتاج اليومي'}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono" dir="ltr" lang="en">
                  {toEnglishDigits(kdsStats.totalTarget || TOTAL_PRODUCTION_TARGET)}
                </span>
                <span className="text-xs font-medium text-white/60">
                  {lang === 'en' ? 'target meals' : 'وجبة مستهدفة'}
                </span>
              </div>
            </div>

            {/* Sleek Circular Progress Ring */}
            <div className="relative flex items-center justify-center w-14 h-14 shrink-0 group-hover:scale-105 transition-transform">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 52 52">
                <circle
                  cx="26"
                  cy="26"
                  r="21"
                  className="stroke-white/10"
                  strokeWidth="4"
                  fill="transparent"
                />
                <circle
                  cx="26"
                  cy="26"
                  r="21"
                  className="stroke-emerald-400 transition-all duration-700 ease-out"
                  strokeWidth="4"
                  strokeDasharray={131.95}
                  strokeDashoffset={131.95 - (131.95 * Math.min(100, Math.max(0, kdsStats.completionRate))) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                  style={{
                    filter: 'drop-shadow(0 0 6px rgba(52, 211, 153, 0.6))',
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-extrabold font-mono text-emerald-300 drop-shadow-sm" dir="ltr" lang="en">
                  {toEnglishDigits(kdsStats.completionRate)}%
                </span>
              </div>
            </div>
          </div>

          {/* Minimalist Progress Bar & Live Status */}
          <div className="pt-3 mt-3 border-t border-white/10 space-y-2">
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden p-0.5 border border-white/15">
              <div
                className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-300 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_#10b981]"
                style={{ width: `${Math.min(100, Math.max(0, kdsStats.completionRate))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-white/70 font-medium">
              <span className="text-white/80">
                {lang === 'en'
                  ? `${toEnglishDigits(kdsStats.readyUnits)} of ${toEnglishDigits(kdsStats.totalTarget || TOTAL_PRODUCTION_TARGET)} ready`
                  : `تم إنجاز ${toEnglishDigits(kdsStats.readyUnits)} من ${toEnglishDigits(kdsStats.totalTarget || TOTAL_PRODUCTION_TARGET)} وجبة`}
              </span>
              <span className="text-white/50 group-hover:text-emerald-300 font-mono font-bold flex items-center gap-1 transition-colors">
                {lang === 'en' ? 'KDS Board' : 'شاشة الإنتاج'} <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </Link>
      </section>

      {/* 3. Recharts Visual Analytics Section */}
      <section className="space-y-3">
        <ControlTowerCharts />
      </section>

      {/* 4. AI Autonomy Control Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-300" />
            <h2 className="text-lg font-bold text-white">
              {lang === 'en' ? 'AI Operations Dispatcher & Autonomy Controls' : 'وكيل التحكم الذاتي وإدارة العمليات'}
            </h2>
          </div>
        </div>
        <AIAutonomyControl />
      </section>
    </div>
  );
}
