"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Truck,
  ChefHat,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  Layers,
  Activity,
  Flame,
  Package,
  Mic,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import AIAutonomyControl from '@/components/dashboard/AIAutonomyControl';
import ControlTowerCharts from '@/components/dashboard/ControlTowerCharts';
import { useLanguage } from '@/components/common/LanguageContext';
import { initialInventoryItems, getSessionPurchaseOrders } from '@/lib/mockInventoryData';
import { fetchInventoryItems, fetchPurchaseOrders } from '@/lib/supabaseService';
import {
  TOTAL_PRODUCTION_TARGET,
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

  // Dynamically reactive to KDS Kanban board state
  const [kdsStats, setKdsStats] = useState(() => {
    return calculateKdsCompletion(getKdsBatches(), TOTAL_PRODUCTION_TARGET);
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
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm flex items-center gap-3">
                <span>{lang === 'en' ? 'Central Operations Control Tower' : 'برج مراقبة العمليات وسلاسل الإمداد'}</span>
                <span className="text-xs font-mono font-bold bg-white/10 text-emerald-300 border border-white/20 px-2.5 py-0.5 rounded-full hidden sm:inline-block">
                  v2.0 PRO
                </span>
              </h1>
              <p className="text-slate-100 font-medium text-xs sm:text-sm mt-1 drop-shadow-sm">
                {lang === 'en'
                  ? 'Unified command center: live inventory shortages, active purchase orders, and batch kitchen production'
                  : 'منظومة القيادة الموحدة: رصد النواقص الحرجة، أوامر الشراء النشطة، وخطوط الإنتاج المجمع لحظياً'}
              </p>
            </div>
          </div>
        </div>

        {/* Live Status & Quick KDS Link */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{lang === 'en' ? 'Control Tower Active' : 'برج المراقبة نشط'}</span>
          </div>

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

      {/* 2. Four Operational Metric Glassmorphism Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

        {/* Card 3: المستهدف الإجمالي للإنتاج (Total Production Target - Consolidated) */}
        <Link
          href="/production"
          className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] hover:bg-white/[0.09] hover:border-teal-400/50 rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-white/75">
                {lang === 'en' ? 'Total Production Target' : 'المستهدف الإجمالي للإنتاج'}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono" dir="ltr" lang="en">
                  {toEnglishDigits(TOTAL_PRODUCTION_TARGET)}
                </span>
                <span className="text-xs font-medium text-white/60">
                  {lang === 'en' ? 'meals' : 'وجبة'}
                </span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-teal-500/15 border border-teal-400/30 text-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.25)] group-hover:scale-105 transition-transform">
              <ChefHat className="w-6 h-6" />
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between text-xs">
            <span className="text-teal-300 font-semibold flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-300" />
              {lang === 'en' ? 'Master Daily Production Plan' : 'إجمالي خطة الإنتاج اليومية'}
            </span>
            <span className="text-white/50 group-hover:text-white font-mono font-bold flex items-center">
              {lang === 'en' ? 'KDS Board' : 'شاشة الإنتاج'} <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>

        {/* Card 4: نسبة الإنجاز (Completion Rate - dynamically reactive to KDS board) */}
        <div className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] hover:bg-white/[0.09] rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-white/75">
                {lang === 'en' ? 'Completion Rate' : 'نسبة الإنجاز'}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-emerald-300 font-mono" dir="ltr" lang="en">
                  {toEnglishDigits(kdsStats.completionRate)}%
                </span>
                <span className="text-xs font-medium text-white/60">
                  {lang === 'en' ? 'progress' : 'إنجاز مهام اليوم'}
                </span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="pt-3 mt-3 space-y-2">
            {/* Glowing Progress Bar */}
            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/15">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-300 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_#10b981]"
                style={{ width: `${Math.min(100, Math.max(0, kdsStats.completionRate))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-white/60 font-medium">
              <span>
                {lang === 'en'
                  ? `${toEnglishDigits(kdsStats.readyUnits)} of ${toEnglishDigits(kdsStats.totalTarget)} units ready`
                  : `تم إنجاز ${toEnglishDigits(kdsStats.readyUnits)} من ${toEnglishDigits(kdsStats.totalTarget)} وجبة`}
              </span>
              <span className="text-emerald-300 font-bold font-mono" dir="ltr" lang="en">
                {lang === 'en' ? 'Live KDS' : 'محدث لحظياً'}
              </span>
            </div>
          </div>
        </div>
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
