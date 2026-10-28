"use client";

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ChefHat,
  Database,
  Flame,
  Layers,
  Truck,
  CheckCircle2,
  Clock,
  Target,
  ShieldCheck,
  Gauge,
  CalendarClock,
  Activity,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '@/components/common/LanguageContext';
import {
  supabase,
  type OperationSchedule,
} from '@/lib/supabase';

/**
 * Single source of truth for mock production metrics.
 * Designed for 1-step replacement with live Supabase logs.
 */
export const MOCK_PRODUCTION_DATA = {
  dailyTarget: 450,
  overallCompletedEquivalent: 380,
  overallCompletionPct: 85,
  maxKitchenCapacity: 1000,
  capacityUtilizationPct: 45,
  slaStatus: 'on_track' as const, // 'on_track' | 'delayed' | 'critical'
  lines: {
    portioning: {
      completed: 400,
      target: 450,
    },
    packaging: {
      completed: 150,
      target: 450,
    },
    bagging: {
      completed: 110,
      target: 450,
    },
  },
};

interface ShiftStep {
  id: number;
  titleAr: string;
  titleEn: string;
  status: 'completed' | 'in_progress' | 'pending';
  icon: React.ElementType;
}

interface AssemblyLineProgress {
  id: 'portioning' | 'packaging' | 'bagging';
  nameAr: string;
  nameEn: string;
  shortAr: string;
  shortEn: string;
  completed: number;
  target: number;
  pct: number;
  color: string;
  innerRadius: number;
  outerRadius: number;
}

const SHIFT_STEPS: ShiftStep[] = [
  {
    id: 1,
    titleAr: 'سحب البيانات',
    titleEn: 'Data Pull',
    status: 'completed',
    icon: Database,
  },
  {
    id: 2,
    titleAr: 'بدء الطبخ',
    titleEn: 'Bulk Cooking',
    status: 'completed',
    icon: Flame,
  },
  {
    id: 3,
    titleAr: 'خطوط التجميع',
    titleEn: 'Assembly Lines',
    status: 'in_progress',
    icon: Layers,
  },
  {
    id: 4,
    titleAr: 'تسليم المناديب',
    titleEn: 'Courier Dispatch',
    status: 'pending',
    icon: Truck,
  },
];

const ASSEMBLY_LINES: AssemblyLineProgress[] = [
  {
    id: 'portioning',
    nameAr: 'الغرف (Portioning)',
    nameEn: 'Portioning',
    shortAr: 'الغرف',
    shortEn: 'Portioning',
    completed: MOCK_PRODUCTION_DATA.lines.portioning.completed,
    target: MOCK_PRODUCTION_DATA.lines.portioning.target,
    pct: Math.round(
      (MOCK_PRODUCTION_DATA.lines.portioning.completed / MOCK_PRODUCTION_DATA.lines.portioning.target) * 100
    ),
    color: '#34d399', // emerald-400
    innerRadius: 78,
    outerRadius: 92,
  },
  {
    id: 'packaging',
    nameAr: 'التغليف (Packaging)',
    nameEn: 'Packaging',
    shortAr: 'التغليف',
    shortEn: 'Packaging',
    completed: MOCK_PRODUCTION_DATA.lines.packaging.completed,
    target: MOCK_PRODUCTION_DATA.lines.packaging.target,
    pct: Math.round(
      (MOCK_PRODUCTION_DATA.lines.packaging.completed / MOCK_PRODUCTION_DATA.lines.packaging.target) * 100
    ),
    color: '#14b8a6', // teal-500
    innerRadius: 58,
    outerRadius: 72,
  },
  {
    id: 'bagging',
    nameAr: 'التكييس (Bagging)',
    nameEn: 'Bagging',
    shortAr: 'التكييس',
    shortEn: 'Bagging',
    completed: MOCK_PRODUCTION_DATA.lines.bagging.completed,
    target: MOCK_PRODUCTION_DATA.lines.bagging.target,
    pct: Math.round(
      (MOCK_PRODUCTION_DATA.lines.bagging.completed / MOCK_PRODUCTION_DATA.lines.bagging.target) * 100
    ),
    color: '#38bdf8', // sky-400
    innerRadius: 38,
    outerRadius: 52,
  },
];

const emptySubscribe = () => () => {};

export default function ProductionKDSClient() {
  const { lang, isRtl } = useLanguage();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [hoveredLineId, setHoveredLineId] = useState<AssemblyLineProgress['id'] | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<OperationSchedule | null>(null);
  const [isScheduleLoading, setIsScheduleLoading] = useState<boolean>(true);

  useEffect(() => {
    let isActive = true;

    async function fetchScheduleForToday() {
      try {
        const currentDay = new Date().getDay(); // 0 = Sunday, 3 = Wednesday, ..., 6 = Saturday
        const { data, error } = await supabase
          .from('operation_schedule')
          .select('day_of_week, day_name_ar, cooking_day_ar, delivery_day_ar, is_off')
          .eq('day_of_week', currentDay)
          .maybeSingle();

        if (!isActive) return;

        if (error) {
          console.error('[ProductionKDSClient] Error fetching operation_schedule:', error.message);
        } else {
          setTodaySchedule((data as OperationSchedule | null) ?? null);
        }
      } catch (err) {
        console.error('[ProductionKDSClient] Unexpected error fetching schedule:', err);
      } finally {
        if (isActive) {
          setIsScheduleLoading(false);
        }
      }
    }

    fetchScheduleForToday();

    return () => {
      isActive = false;
    };
  }, []);

  const activeLine = hoveredLineId
    ? ASSEMBLY_LINES.find((l) => l.id === hoveredLineId) || null
    : null;

  const renderScheduleBadgeContent = () => {
    if (isScheduleLoading) {
      return (
        <>
          <Loader2 className="w-4 h-4 shrink-0 text-emerald-300 animate-spin" />
          <span className="text-xs sm:text-sm font-bold text-white/80 whitespace-nowrap">
            جاري التحقق من الجدول...
          </span>
        </>
      );
    }

    if (!todaySchedule) {
      return (
        <>
          <CalendarClock className="w-4 h-4 shrink-0 text-white/50" />
          <span className="text-xs sm:text-sm font-bold text-white/70 whitespace-nowrap">
            تعذر جلب الجدول
          </span>
        </>
      );
    }

    if (todaySchedule.is_off) {
      return (
        <>
          <CalendarClock className="w-4 h-4 shrink-0 text-amber-300" />
          <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">
            إجازة (Off)
          </span>
        </>
      );
    }

    return (
      <>
        <CalendarClock className="w-4 h-4 shrink-0 text-emerald-300" />
        <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">
          {`إنتاج يوم: ${todaySchedule.cooking_day_ar} | تسليم: ${todaySchedule.delivery_day_ar}`}
        </span>
      </>
    );
  };

  return (
    <div className="page-shell w-full mx-auto space-y-5 font-sans">
      {/* 1. Pure Glassmorphism Header */}
      <header className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-white/[0.02] backdrop-blur-md border border-white/10 flex items-center justify-center text-emerald-300">
            <ChefHat className="w-5 h-5" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {lang === 'en' ? 'Production Control Panel' : 'لوحة التحكم للإنتاج'}
          </h1>
        </div>

        {/* Live Supabase Operational Day Schedule Badge (Top Left in RTL) */}
        <div
          aria-live="polite"
          className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl px-4 py-2.5 min-h-[42px] min-w-[180px] flex items-center justify-center sm:justify-start gap-2.5 self-start sm:self-center transition-all"
        >
          {renderScheduleBadgeContent()}
        </div>
      </header>

      {/* 2. Unified Pure Glassmorphism Main Module */}
      <section
        aria-label={lang === 'en' ? 'Production Cycle & Assembly Telemetry' : 'مسار التشغيل ومؤشرات التجميع'}
        className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 space-y-6"
      >
        {/* Part A: 4-Step T-2 Shift Cycle Tracker (Phase Name + Status Badge Only) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-300" />
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                {lang === 'en' ? 'T-2 Shift Cycle Tracker' : 'مسار دورة التشغيل (T-2)'}
              </h2>
            </div>
          </div>

          <div className="relative">
            {/* Subtle Translucent Connecting Rail on Desktop */}
            <div
              aria-hidden="true"
              className="hidden lg:block absolute top-1/2 -translate-y-1/2 inset-x-10 h-px bg-white/10 z-0 overflow-hidden"
            >
              <div
                className={`h-full w-2/3 opacity-75 ${
                  isRtl
                    ? 'bg-gradient-to-l from-emerald-400 via-teal-400 to-amber-400'
                    : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 relative z-10">
              {SHIFT_STEPS.map((step) => {
                const Icon = step.icon;
                const isCompleted = step.status === 'completed';
                const isInProgress = step.status === 'in_progress';

                return (
                  <div
                    key={step.id}
                    className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`relative w-9 h-9 shrink-0 rounded-xl bg-white/[0.02] backdrop-blur-md border border-white/10 flex items-center justify-center ${
                          isCompleted
                            ? 'text-emerald-300'
                            : isInProgress
                            ? 'text-amber-300'
                            : 'text-white/50'
                        }`}
                      >
                        {isInProgress && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-xl bg-amber-400/20" />
                        )}
                        <Icon className="w-4 h-4 relative z-10" />
                      </div>

                      <h3 className="text-sm font-extrabold text-white">
                        {lang === 'en' ? step.titleEn : step.titleAr}
                      </h3>
                    </div>

                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/[0.02] backdrop-blur-md text-emerald-300 border border-white/10 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{lang === 'en' ? 'Done' : 'مكتمل'}</span>
                      </span>
                    )}
                    {isInProgress && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/[0.02] backdrop-blur-md text-amber-300 border border-white/10 animate-pulse shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>{lang === 'en' ? 'Live' : 'جاري الآن'}</span>
                      </span>
                    )}
                    {!isCompleted && !isInProgress && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/[0.02] backdrop-blur-md text-white/60 border border-white/10 shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>{lang === 'en' ? 'Pending' : 'بالانتظار'}</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Part B: Circular 3-Lines Donut Chart + Consolidated Executive Indicators */}
        <div className="pt-5 border-t border-white/10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Interactive Recharts Circular Donut Chart for the 3 Assembly Lines (7 Cols) */}
          <div className="lg:col-span-7 bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-5">
            {/* Circular Concentric Donut Chart */}
            <div className="relative w-[200px] h-[200px] shrink-0 flex items-center justify-center">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    {ASSEMBLY_LINES.map((line) => {
                      const isDimmed = hoveredLineId !== null && hoveredLineId !== line.id;
                      const ringData = [
                        {
                          lineId: line.id,
                          nameAr: line.nameAr,
                          nameEn: line.nameEn,
                          completed: line.completed,
                          target: line.target,
                          pct: line.pct,
                          value: line.completed,
                          color: line.color,
                          isTrack: false,
                        },
                        {
                          lineId: line.id,
                          nameAr: line.nameAr,
                          nameEn: line.nameEn,
                          completed: line.completed,
                          target: line.target,
                          pct: line.pct,
                          value: Math.max(0, line.target - line.completed),
                          color: 'rgba(255, 255, 255, 0.06)',
                          isTrack: true,
                        },
                      ];

                      return (
                        <Pie
                          key={line.id}
                          data={ringData}
                          dataKey="value"
                          cx="50%"
                          cy="50%"
                          startAngle={90}
                          endAngle={-270}
                          innerRadius={line.innerRadius}
                          outerRadius={line.outerRadius}
                          cornerRadius={8}
                          stroke="none"
                          onMouseEnter={() => setHoveredLineId(line.id)}
                          onMouseLeave={() => setHoveredLineId(null)}
                        >
                          {ringData.map((slice, idx) => (
                            <Cell
                              key={`${line.id}-${idx}`}
                              fill={slice.color}
                              fillOpacity={slice.isTrack ? 1 : isDimmed ? 0.35 : 0.95}
                              style={{ cursor: 'pointer', transition: 'fill-opacity 200ms ease' }}
                            />
                          ))}
                        </Pie>
                      );
                    })}

                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div
                              dir={lang === 'en' ? 'ltr' : 'rtl'}
                              className="bg-white/[0.02] backdrop-blur-md border border-white/10 px-3.5 py-2.5 rounded-xl text-xs space-y-1"
                            >
                              <div className="font-extrabold text-white">
                                {lang === 'en' ? d.nameEn : d.nameAr}
                              </div>
                              <div className="font-mono font-bold text-emerald-300" dir="ltr">
                                {d.completed} / {d.target} ({d.pct}%)
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-36 h-36 rounded-full border-4 border-white/10 animate-pulse" />
              )}

              {/* Center Telemetry Readout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                <span className="text-xl font-extrabold font-mono text-white leading-none" dir="ltr">
                  {activeLine ? `${activeLine.pct}%` : `${MOCK_PRODUCTION_DATA.overallCompletionPct}%`}
                </span>
                <span className="text-[10px] font-bold text-white/70 mt-1 truncate max-w-[72px]">
                  {activeLine
                    ? lang === 'en'
                      ? activeLine.shortEn
                      : activeLine.shortAr
                    : lang === 'en'
                    ? 'Daily Plan'
                    : 'نسبة الهدف'}
                </span>
              </div>
            </div>

            {/* 3 Assembly Lines Progression Breakdown */}
            <div className="flex-1 w-full space-y-3">
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  {lang === 'en'
                    ? '3-Lines Assembly Progression'
                    : 'تقدم خطوط التجميع الثلاثة من الهدف'}
                </h3>
                <p className="text-[11px] text-white/65 mt-0.5">
                  {lang === 'en'
                    ? `Percentage completed out of ${MOCK_PRODUCTION_DATA.dailyTarget} daily target meals`
                    : `نسبة الإنجاز الفعلي لكل خط من إجمالي الهدف اليومي (${MOCK_PRODUCTION_DATA.dailyTarget} وجبة)`}
                </p>
              </div>

              <div className="space-y-2.5">
                {ASSEMBLY_LINES.map((line) => {
                  const isActive = hoveredLineId === line.id;
                  return (
                    <div
                      key={line.id}
                      onMouseEnter={() => setHoveredLineId(line.id)}
                      onMouseLeave={() => setHoveredLineId(null)}
                      className={`bg-white/[0.02] backdrop-blur-md border rounded-xl px-3.5 py-2.5 transition-all cursor-default ${
                        isActive ? 'border-white/25' : 'border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: line.color,
                              boxShadow: `0 0 8px ${line.color}`,
                            }}
                          />
                          <span className="font-bold text-white">
                            {lang === 'en' ? line.nameEn : line.nameAr}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono" dir="ltr">
                          <span className="text-white/65 text-[11px]">
                            {line.completed}/{line.target}
                          </span>
                          <span
                            className="font-extrabold text-xs px-1.5 py-0.5 rounded bg-white/[0.02] border border-white/10"
                            style={{ color: line.color }}
                          >
                            {line.pct}%
                          </span>
                        </div>
                      </div>
                      <div className="mt-1.5 w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${line.pct}%`, backgroundColor: line.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Consolidated Vital Executive Indicators (5 Cols) */}
          <div className="lg:col-span-5 bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-3.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="text-sm font-extrabold text-white">
                {lang === 'en' ? 'Executive Pulse Indicators' : 'المؤشرات التشغيلية المدمجة'}
              </span>
              <span className="text-[11px] font-mono text-white/60" dir="ltr">
                {MOCK_PRODUCTION_DATA.dailyTarget} {lang === 'en' ? 'Meals Plan' : 'وجبة'}
              </span>
            </div>

            {/* Indicator 1: إنجاز الهدف اليومي */}
            <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white/90">
                  <Target className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>{lang === 'en' ? 'Daily Target Completion' : 'إنجاز الهدف اليومي'}</span>
                </div>
                <div className="flex items-baseline gap-2 font-mono" dir="ltr">
                  <span className="text-base font-extrabold text-emerald-300">
                    {MOCK_PRODUCTION_DATA.overallCompletionPct}%
                  </span>
                  <span className="text-[11px] text-white/65">
                    ({MOCK_PRODUCTION_DATA.overallCompletedEquivalent}/{MOCK_PRODUCTION_DATA.dailyTarget})
                  </span>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400"
                  style={{ width: `${MOCK_PRODUCTION_DATA.overallCompletionPct}%` }}
                />
              </div>
            </div>

            {/* Indicator 2: مؤشر كفاءة الوقت (SLA - 06:00 AM Dispatch) */}
            <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white/90">
                  <ShieldCheck className="w-4 h-4 text-teal-300 shrink-0" />
                  <span>{lang === 'en' ? 'Time Efficiency (SLA)' : 'مؤشر كفاءة الوقت (SLA)'}</span>
                </div>
                <span className="text-xs font-extrabold text-emerald-300 bg-white/[0.02] backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-md">
                  {lang === 'en' ? 'On Track' : 'ضمن المسار الآمن'}
                </span>
              </div>
              <p className="text-[11px] text-white/65 font-medium">
                {lang === 'en'
                  ? 'On schedule to complete ahead of 06:00 AM courier dispatch'
                  : 'معدل التقدم ضمن النطاق الآمن قبل موعد تسليم المناديب (06:00 ص)'}
              </p>
            </div>

            {/* Indicator 3: معدل استغلال المطبخ (Capacity) */}
            <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white/90">
                  <Gauge className="w-4 h-4 text-sky-300 shrink-0" />
                  <span>{lang === 'en' ? 'Kitchen Capacity' : 'معدل استغلال المطبخ'}</span>
                </div>
                <div className="flex items-baseline gap-2 font-mono" dir="ltr">
                  <span className="text-base font-extrabold text-sky-300">
                    {MOCK_PRODUCTION_DATA.capacityUtilizationPct}%
                  </span>
                  <span className="text-[11px] text-white/65">
                    ({MOCK_PRODUCTION_DATA.dailyTarget}/{MOCK_PRODUCTION_DATA.maxKitchenCapacity.toLocaleString('en-US')})
                  </span>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-400 to-sky-400"
                  style={{ width: `${MOCK_PRODUCTION_DATA.capacityUtilizationPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
