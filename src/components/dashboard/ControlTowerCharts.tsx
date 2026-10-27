"use client";

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Sparkles, TrendingUp, PieChart as PieIcon, Layers } from 'lucide-react';
import { useLanguage } from '@/components/common/LanguageContext';
import { getKdsBatches, TOTAL_PRODUCTION_TARGET } from '@/lib/kdsProductionStore';

const hourlyTrendData = [
  { time: '08:00', production: 12, packagingConsumption: 14 },
  { time: '10:00', production: 28, packagingConsumption: 32 },
  { time: '12:00', production: 64, packagingConsumption: 70 },
  { time: '14:00', production: 88, packagingConsumption: 92 },
  { time: '16:00', production: 105, packagingConsumption: 110 },
  { time: '18:00', production: 120, packagingConsumption: 125 },
];

const toEnglishDigits = (val?: string | number | null): string => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

export default function ControlTowerCharts() {
  const { lang } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [timeframe, setTimeframe] = useState<'today' | 'week'>('today');
  const [batches, setBatches] = useState(() => getKdsBatches());

  useEffect(() => {
    setMounted(true);
    const sync = () => setBatches(getKdsBatches());
    window.addEventListener('kds_batches_updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('kds_batches_updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const inProgressUnits = batches.filter(b => b.column === 'IN_PROGRESS').reduce((acc, b) => acc + (Number(b.target_quantity) || 0), 0);
  const packagingUnits = batches.filter(b => b.column === 'PACKAGING').reduce((acc, b) => acc + (Number(b.target_quantity) || 0), 0);
  const doneUnits = batches.filter(b => b.column === 'DONE').reduce((acc, b) => acc + (Number(b.target_quantity) || 0), 0);
  const deliveredUnits = batches.filter(b => b.column === 'DELIVERED').reduce((acc, b) => acc + (Number(b.target_quantity) || 0), 0);

  const doughnutData = [
    { nameAr: 'قيد التحضير', nameEn: 'In Progress', value: inProgressUnits, color: '#f59e0b' },
    { nameAr: 'التغليف', nameEn: 'Packaging', value: packagingUnits, color: '#a855f7' },
    { nameAr: 'جاهز', nameEn: 'Done', value: doneUnits, color: '#10b981' },
    { nameAr: 'تم التسليم', nameEn: 'Delivered', value: deliveredUnits, color: '#06b6d4' },
  ];

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[380px]">
        <div className="lg:col-span-8 bg-white/[0.06] backdrop-blur-[2px] border border-white/[0.24] rounded-2xl p-6 animate-pulse" />
        <div className="lg:col-span-4 bg-white/[0.06] backdrop-blur-[2px] border border-white/[0.24] rounded-2xl p-6 animate-pulse" />
      </div>
    );
  }

  const totalMeals = doughnutData.reduce((acc, d) => acc + d.value, 0) || TOTAL_PRODUCTION_TARGET;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* 1. Dark Emerald Glowing Area Chart (Consumption / Production Trend) */}
      <div className="lg:col-span-8 bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] hover:border-white/[0.32] rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between">
        {/* Chart Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  {lang === 'en' ? 'Packaging Consumption vs. Production Velocity' : 'مسار وتيرة الإنتاج واستهلاك التغليف'}
                </h3>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {lang === 'en' ? 'Live Track' : 'تتبع آني'}
                </span>
              </div>
              <p className="text-xs text-white/65 mt-0.5 font-medium">
                {lang === 'en'
                  ? 'Real-time correlation between meals prepped and packing units depleted'
                  : 'مؤشر لحظي يربط بين عدد الوجبات المحضرة والعبوات المستهلكة من المستودع'}
              </p>
            </div>
          </div>

          {/* Timeframe Toggle Buttons */}
          <div className="flex items-center bg-white/5 border border-white/20 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTimeframe('today')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                timeframe === 'today'
                  ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 shadow-sm'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {lang === 'en' ? 'Today' : 'اليوم'}
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('week')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                timeframe === 'week'
                  ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 shadow-sm'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {lang === 'en' ? 'Last 7 Days' : 'آخر 7 أيام'}
            </button>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="w-full h-[280px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="emeraldGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="cyanGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                stroke="rgba(255,255,255,0.4)"
                tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                tickLine={false}
              />
              <YAxis
                stroke="rgba(255,255,255,0.4)"
                tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                tickLine={false}
                tickFormatter={(val) => toEnglishDigits(val)}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-black/85 backdrop-blur-xl border border-white/20 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 font-sans">
                        <div className="font-mono font-bold text-white/80 border-b border-white/15 pb-1">
                          {lang === 'en' ? `Time: ${toEnglishDigits(label)}` : `الساعة: ${toEnglishDigits(label)}`}
                        </div>
                        <div className="flex items-center justify-between gap-4 text-emerald-300 font-bold">
                          <span>{lang === 'en' ? 'Production:' : 'إنتاج الوجبات:'}</span>
                          <span className="font-mono" dir="ltr" lang="en">{toEnglishDigits(payload[0]?.value as any)} {lang === 'en' ? 'meals' : 'وجبة'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-cyan-300 font-bold">
                          <span>{lang === 'en' ? 'Packaging Dispatched:' : 'عبوات مسحوبة:'}</span>
                          <span className="font-mono" dir="ltr" lang="en">{toEnglishDigits(payload[1]?.value as any)} {lang === 'en' ? 'units' : 'وحدة'}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="production"
                stroke="#10b981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#emeraldGlow)"
                dot={{ r: 4, fill: '#10b981', stroke: '#ffffff', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="packagingConsumption"
                stroke="#06b6d4"
                strokeWidth={2}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill="url(#cyanGlow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chart Legend */}
        <div className="flex items-center justify-center gap-6 pt-4 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2 text-white/90 font-medium">
            <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
            <span>{lang === 'en' ? 'Actual Production (Meals)' : 'وجبات الإنتاج المنجزة'}</span>
          </div>
          <div className="flex items-center gap-2 text-white/70 font-medium">
            <span className="w-3 h-0.5 bg-cyan-400 border-dashed" />
            <span>{lang === 'en' ? 'Packaging Consumption (Units)' : 'استهلاك عبوات التغليف'}</span>
          </div>
        </div>
      </div>

      {/* 2. Glowing Doughnut Chart (Production Stage Breakdown) */}
      <div className="lg:col-span-4 bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] hover:border-white/[0.32] rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.25)]">
              <PieIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                {lang === 'en' ? 'Production Pipeline' : 'توزيع مراحل خطة الإنتاج'}
              </h3>
              <p className="text-xs text-white/65 mt-0.5 font-medium">
                {lang === 'en' ? 'Batch stages across kitchen' : 'مراحل الدفعات بمطبخ التجهيز'}
              </p>
            </div>
          </div>

          {/* Doughnut Chart with Center Number */}
          <div className="relative w-full h-[200px] flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={doughnutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {doughnutData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const percent = Math.round((data.value / totalMeals) * 100);
                      return (
                        <div className="bg-black/90 backdrop-blur-xl border border-white/20 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                          <div className="font-bold text-white">
                            {lang === 'en' ? data.nameEn : data.nameAr}
                          </div>
                          <div className="font-mono text-emerald-300 font-bold" dir="ltr" lang="en">
                            {toEnglishDigits(data.value)} {lang === 'en' ? 'meals' : 'وجبة'} ({toEnglishDigits(percent)}%)
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Label inside Doughnut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-white font-mono tracking-tight drop-shadow-md" dir="ltr" lang="en">
                {toEnglishDigits(totalMeals)}
              </span>
              <span className="text-[10px] text-white/65 font-bold uppercase tracking-wider">
                {lang === 'en' ? 'Total Meals' : 'إجمالي الوجبات'}
              </span>
            </div>
          </div>
        </div>

        {/* Legend Breakdown List */}
        <div className="space-y-2 pt-3 border-t border-white/10 text-xs">
          {doughnutData.map((item) => {
            const pct = Math.round((item.value / totalMeals) * 100);
            return (
              <div key={item.nameEn} className="flex items-center justify-between text-white/85">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium">{lang === 'en' ? item.nameEn : item.nameAr}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-white/60 text-[11px]" dir="ltr" lang="en">({toEnglishDigits(pct)}%)</span>
                  <span className="font-bold text-white" dir="ltr" lang="en">{toEnglishDigits(item.value)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
