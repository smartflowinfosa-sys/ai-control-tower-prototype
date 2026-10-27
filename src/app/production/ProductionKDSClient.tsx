"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChefHat,
  Flame,
  PackageCheck,
  CheckCircle2,
  ListOrdered,
  Plus,
  Search,
  Filter,
  Clock,
  User,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  X,
  RotateCcw,
  UtensilsCrossed,
  Timer,
  ChevronRight,
  Layers,
  Check,
  Truck,
  CheckCircle,
  Database,
  RefreshCw,
  Box,
  Layers3
} from 'lucide-react';
import { useLanguage } from '@/components/common/LanguageContext';
import {
  KDSColumnId,
  BatchProductionItem,
  MasterPlanItem,
  initialMasterPlan,
  TOTAL_PRODUCTION_TARGET,
  getKdsBatches,
  saveKdsBatches,
  moveKdsBatch as storeMoveBatch,
  addKdsBatch as storeAddBatch,
  calculateKdsCompletion,
  getMasterPlan,
  saveMasterPlan,
  normalizeCategory,
} from '@/lib/kdsProductionStore';
import {
  fetchMealsWithPackaging,
  MealWithPackaging,
  calculatePackagingDemand,
} from '@/lib/supabaseService';

const toEnglishDigits = (val?: string | number | null): string => {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

const columnOrder: KDSColumnId[] = ['IN_PROGRESS', 'PACKAGING', 'DONE', 'DELIVERED'];

export default function ProductionKDSClient() {
  const { lang, isRtl } = useLanguage();

  const [batches, setBatches] = useState<BatchProductionItem[]>(() => getKdsBatches());
  const [currentMasterPlan, setCurrentMasterPlan] = useState<MasterPlanItem[]>(() => getMasterPlan());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [draggedBatchId, setDraggedBatchId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KDSColumnId | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Real Supabase Data State
  const [realMeals, setRealMeals] = useState<MealWithPackaging[]>([]);
  const [isLoadingMeals, setIsLoadingMeals] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ count: number; bomCount: number }>({ count: 176, bomCount: 586 });

  const loadRealSupabaseMeals = async () => {
    setIsLoadingMeals(true);
    try {
      const data = await fetchMealsWithPackaging();
      if (data && data.length > 0) {
        setRealMeals(data);
        const totalBom = data.reduce((acc, m) => acc + (m.packaging?.length || 0), 0);
        setDbStatus({ count: data.length, bomCount: totalBom });
      }
    } catch (err) {
      console.error('Failed to load real meals from Supabase:', err);
    } finally {
      setIsLoadingMeals(false);
    }
  };

  useEffect(() => {
    loadRealSupabaseMeals();
  }, []);

  // Sync with store events
  useEffect(() => {
    const handleSync = () => {
      setBatches(getKdsBatches());
    };
    const handlePlanSync = () => {
      setCurrentMasterPlan(getMasterPlan());
    };
    window.addEventListener('kds_batches_updated', handleSync);
    window.addEventListener('kds_master_plan_updated', handlePlanSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('kds_batches_updated', handleSync);
      window.removeEventListener('kds_master_plan_updated', handlePlanSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // New Batch Form State
  const [newBatch, setNewBatch] = useState<{
    meal_code: string;
    name: string;
    name_en: string;
    category: string;
    target_quantity: number;
    station: string;
    chef: string;
    prep_time: string;
    priority: 'HIGH' | 'MEDIUM' | 'NORMAL';
    dietNotes: string;
    calories: number;
    packaging?: Array<{
      item_code: string;
      item_name_ar: string;
      quantity_used: number;
    }>;
  }>({
    meal_code: '',
    name: '',
    name_en: '',
    category: 'وجبات رئيسية',
    target_quantity: 30,
    station: 'محطة الشوايات والأفران',
    chef: 'الشيف طارق',
    prep_time: '25 دقيقة',
    priority: 'HIGH',
    dietNotes: 'وجبة صحية متوازنة',
    calories: 450,
    packaging: [],
  });

  const columnsMeta: Record<
    KDSColumnId,
    {
      titleAr: string;
      titleEn: string;
      icon: any;
      headerBg: string;
      accentColor: string;
      borderColor: string;
      badgeBg: string;
    }
  > = {
    IN_PROGRESS: {
      titleAr: 'قيد التحضير',
      titleEn: 'In Progress / Cooking',
      icon: Flame,
      headerBg: 'bg-amber-500/10',
      accentColor: 'text-amber-300',
      borderColor: 'border-amber-400/40',
      badgeBg: 'bg-amber-500/20 text-amber-100 border-amber-400/30',
    },
    PACKAGING: {
      titleAr: 'التغليف',
      titleEn: 'Packaging',
      icon: PackageCheck,
      headerBg: 'bg-purple-500/10',
      accentColor: 'text-purple-300',
      borderColor: 'border-purple-400/40',
      badgeBg: 'bg-purple-500/20 text-purple-100 border-purple-400/30',
    },
    DONE: {
      titleAr: 'جاهز',
      titleEn: 'Done',
      icon: CheckCircle2,
      headerBg: 'bg-emerald-500/10',
      accentColor: 'text-emerald-300',
      borderColor: 'border-emerald-400/40',
      badgeBg: 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30',
    },
    DELIVERED: {
      titleAr: 'تم التسليم',
      titleEn: 'Dispatched / Delivered',
      icon: Truck,
      headerBg: 'bg-cyan-500/10',
      accentColor: 'text-cyan-300',
      borderColor: 'border-cyan-400/40',
      badgeBg: 'bg-cyan-500/20 text-cyan-100 border-cyan-400/30',
    },
  };

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.name_en.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q) ||
        b.chef.toLowerCase().includes(q);

      const matchesCategory =
        selectedCategory === 'ALL' || b.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [batches, searchQuery, selectedCategory]);

  // Overall Stats & Dynamic Completion Formula
  const totalTargetQuantity = useMemo(() => {
    return currentMasterPlan.reduce((acc, m) => acc + (Number(m.required) || 0), 0) || TOTAL_PRODUCTION_TARGET;
  }, [currentMasterPlan]);

  const completionStats = useMemo(() => {
    return calculateKdsCompletion(batches, totalTargetQuantity);
  }, [batches, totalTargetQuantity]);

  const completionPct = completionStats.completionRate;

  // Master Daily Menu summary (aggregated across all batches and dynamic master plan)
  const masterSummary = useMemo(() => {
    type Row = MasterPlanItem & { scheduled: number; ready: number; cooking: number };
    const rows: Row[] = currentMasterPlan.map((m) => ({ ...m, scheduled: 0, ready: 0, cooking: 0 }));
    const extra = new Map<string, Row>();
    batches.forEach((b) => {
      let row = b.menuId ? rows.find((r) => r.id === b.menuId) : undefined;
      if (!row) {
        row = extra.get(b.name);
        if (!row) {
          row = { id: b.name, short: b.name, category: b.category, required: b.target_quantity, scheduled: 0, ready: 0, cooking: 0 };
          extra.set(b.name, row);
        }
      }
      row.scheduled += b.target_quantity;
      if (b.column === 'DONE' || b.column === 'DELIVERED') row.ready += b.target_quantity;
      else if (b.column === 'IN_PROGRESS' || b.column === 'PACKAGING') row.cooking += b.target_quantity;
    });
    return [...rows, ...extra.values()].filter(
      (r) => selectedCategory === 'ALL' || r.category === selectedCategory
    );
  }, [batches, currentMasterPlan, selectedCategory]);

  // Move Batch Forward or Backward (saved to shared store and session)
  const moveBatch = (batchId: string, targetCol: KDSColumnId) => {
    const updated = storeMoveBatch(batchId, targetCol);
    setBatches(updated);
  };

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, batchId: string) => {
    e.dataTransfer.setData('text/plain', batchId);
    setDraggedBatchId(batchId);
  };

  const handleDragOver = (e: React.DragEvent, colId: KDSColumnId) => {
    e.preventDefault();
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, colId: KDSColumnId) => {
    e.preventDefault();
    const batchId = e.dataTransfer.getData('text/plain') || draggedBatchId;
    if (batchId) {
      moveBatch(batchId, colId);
    }
    setDraggedBatchId(null);
    setDragOverColumn(null);
  };

  const handleCreateNewBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatch.name.trim()) return;

    const id = `BATCH-${Math.floor(100 + Math.random() * 900)}`;
    const created: BatchProductionItem = {
      id,
      meal_code: newBatch.meal_code || undefined,
      menuId: newBatch.meal_code || undefined,
      name: newBatch.name,
      name_en: newBatch.name_en || newBatch.name,
      category: newBatch.category,
      target_quantity: Number(newBatch.target_quantity) || 20,
      completed_quantity: 0,
      station: newBatch.station,
      chef: newBatch.chef,
      prep_time: newBatch.prep_time,
      priority: newBatch.priority,
      column: 'IN_PROGRESS',
      dietNotes: newBatch.dietNotes,
      calories: Number(newBatch.calories) || 350,
      packaging: newBatch.packaging,
    };

    const updated = storeAddBatch(created);
    setBatches(updated);
    setIsAddModalOpen(false);
    setNewBatch({
      meal_code: '',
      name: '',
      name_en: '',
      category: 'وجبات رئيسية',
      target_quantity: 30,
      station: 'محطة الشوايات والأفران',
      chef: 'الشيف طارق',
      prep_time: '25 دقيقة',
      priority: 'HIGH',
      dietNotes: 'وجبة صحية متوازنة',
      calories: 450,
      packaging: [],
    });
  };

  const categories = ['ALL', 'فطور', 'وجبات رئيسية', 'سلطات', 'حلى'];

  return (
    <div className="page-shell w-full mx-auto space-y-6 font-sans">
      {/* 1. Header & Live Production Metrics */}
      <header className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-400/30 flex items-center justify-center text-teal-300 shadow-[0_0_20px_rgba(45,212,191,0.25)]">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm flex items-center gap-3">
                <span>{lang === 'en' ? 'Aggregated Production KDS' : 'شاشة الإنتاج المجمع (Batch KDS)'}</span>
                <span className="text-xs font-mono font-bold bg-white/10 text-teal-300 border border-white/20 px-2.5 py-0.5 rounded-full">
                  Batch Board
                </span>
              </h1>
              <p className="text-slate-100 font-medium text-xs sm:text-sm mt-1 drop-shadow-sm">
                {lang === 'en'
                  ? 'Batch preparation display for healthy diet meals — track swimlanes from In Progress to Delivered'
                  : 'لوحة التحكم بإنتاج وجبات الحمية المجمعة — تتبع المراحل من قيد التحضير حتى التسليم النهائي'}
              </p>
            </div>
          </div>
        </div>

        {/* Live Batch Metric Indicators & Add Batch Button */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="bg-white/[0.05] border border-white/20 rounded-xl px-4 py-2 flex items-center gap-3 text-xs">
            <div>
              <span className="text-white/60 block">{lang === 'en' ? 'Total Target' : 'المستهدف الإجمالي'}</span>
              <span className="text-base font-extrabold text-white font-mono" dir="ltr" lang="en">
                {toEnglishDigits(totalTargetQuantity)} <span className="text-xs font-normal text-white/70">{lang === 'en' ? 'units' : 'وجبة'}</span>
              </span>
            </div>
            <div className="h-7 w-px bg-white/20" />
            <div>
              <span className="text-white/60 block">{lang === 'en' ? 'Overall Progress' : 'نسبة الإنجاز'}</span>
              <span className="text-base font-extrabold text-emerald-300 font-mono" dir="ltr" lang="en">
                {toEnglishDigits(completionPct)}%
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs sm:text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'en' ? 'Add Production Batch' : 'إضافة دفعة إنتاج'}</span>
          </button>
        </div>
      </header>

      {/* 2. Search & Category Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/[0.04] border border-white/15 p-3 rounded-2xl">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-white/50 absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'en' ? 'Search by meal, chef, or batch code...' : 'ابحث بالصنف، الشيف، أو رمز الدفعة...'}
            className="w-full bg-white/10 border border-white/20 rounded-xl ps-9 pe-3 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none font-medium"
          />
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-teal-500/25 text-teal-200 border border-teal-400/40 shadow-sm'
                  : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/15'
              }`}
            >
              {cat === 'ALL' ? (lang === 'en' ? 'All Batches' : 'جميع الوجبات') : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Master Daily Menu Tracker (خطة الإنتاج اليومية) */}
      <section className="bg-white/[0.05] backdrop-blur-[2px] border border-white/[0.22] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-emerald-300" />
            <h2 className="text-sm font-bold text-white">
              {lang === 'en' ? 'Daily Production Plan' : 'خطة الإنتاج اليومية'}
            </h2>
            <span className="text-[10px] font-mono font-bold bg-white/10 text-white/80 border border-white/20 px-2 py-0.5 rounded-full" dir="ltr" lang="en">
              {toEnglishDigits(masterSummary.length)}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Live Supabase Database Connection Badge */}
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-400/25 px-3 py-1.5 rounded-xl text-xs backdrop-blur-md shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Database className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-emerald-200 font-bold hidden sm:inline">
                {lang === 'en' ? 'Live Supabase Menu & BOM' : 'قاعدة البيانات الحية'}
              </span>
              <span className="text-white/60 font-mono text-[11px]" dir="ltr">
                ({toEnglishDigits(dbStatus.count)} {lang === 'en' ? 'meals' : 'وجبة'} • {toEnglishDigits(dbStatus.bomCount)} BOM)
              </span>
              <button
                type="button"
                onClick={loadRealSupabaseMeals}
                disabled={isLoadingMeals}
                title={lang === 'en' ? 'Sync from Supabase' : 'تحديث من قاعدة البيانات'}
                className="p-1 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMeals ? 'animate-spin text-teal-300' : ''}`} />
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-[10px] text-white/60 font-medium">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />{lang === 'en' ? 'Ready' : 'جاهز'}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{lang === 'en' ? 'In kitchen' : 'قيد التنفيذ'}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {masterSummary.map((m) => {
            const readyPct = m.required > 0 ? Math.min(100, (m.ready / m.required) * 100) : 0;
            const cookPct = m.required > 0 ? Math.min(100 - readyPct, (m.cooking / m.required) * 100) : 0;
            const remaining = Math.max(0, m.required - m.ready);
            return (
              <div
                key={m.id}
                className="shrink-0 min-w-[185px] bg-white/[0.07] hover:bg-white/[0.12] border border-white/20 rounded-xl px-3.5 py-2.5 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-white whitespace-nowrap">
                    {m.short}: {toEnglishDigits(m.required)} {lang === 'en' ? 'meals' : 'وجبة'}
                  </span>
                </div>
                <div className="mt-2 w-full h-1.5 bg-white/10 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-400 h-full transition-all duration-300" style={{ width: `${readyPct}%` }} />
                  <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${cookPct}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-white/70" dir="ltr" lang="en">
                  <span className="text-emerald-300 font-bold">
                    {lang === 'en' ? 'Done:' : 'المنجز:'} {toEnglishDigits(m.ready)}
                  </span>
                  <span className="text-white/60">
                    {lang === 'en' ? 'Remaining:' : 'المتبقي:'} {toEnglishDigits(remaining)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Four Kanban Swimlanes (In Progress, Packaging, Done, Delivered) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
        {columnOrder.map((colId, colIndex) => {
          const meta = columnsMeta[colId];
          const colBatches = filteredBatches.filter((b) => b.column === colId);
          const colUnits = colBatches.reduce((acc, b) => acc + b.target_quantity, 0);
          const Icon = meta.icon;
          const isOver = dragOverColumn === colId;

          return (
            <div
              key={colId}
              onDragOver={(e) => handleDragOver(e, colId)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, colId)}
              className={`bg-white/[0.05] backdrop-blur-[2px] backdrop-saturate-[1.1] border rounded-2xl p-4 transition-all duration-200 min-h-[580px] flex flex-col ${
                isOver
                  ? 'border-emerald-400/80 shadow-[0_0_25px_rgba(16,185,129,0.3)] bg-white/[0.09]'
                  : 'border-white/[0.22] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)]'
              }`}
            >
              {/* Column Header */}
              <div className={`p-3 rounded-xl border ${meta.borderColor} ${meta.headerBg} flex items-center justify-between mb-4 shadow-sm`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${meta.accentColor}`} />
                  <h3 className="font-bold text-sm text-white">
                    {lang === 'en' ? meta.titleEn : meta.titleAr}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${meta.badgeBg}`} dir="ltr" lang="en">
                    {toEnglishDigits(colBatches.length)}
                  </span>
                  <span className="text-[10px] text-white/60 font-mono" dir="ltr" lang="en">
                    ({toEnglishDigits(colUnits)} {lang === 'en' ? 'u' : 'وحدة'})
                  </span>
                </div>
              </div>

              {/* Batches Container */}
              <div className="space-y-3.5 flex-1 overflow-y-auto">
                {colBatches.length === 0 ? (
                  <div className="h-44 border-2 border-dashed border-white/15 rounded-xl flex flex-col items-center justify-center text-center p-4 text-white/40">
                    <Layers className="w-6 h-6 mb-2 opacity-50" />
                    <span className="text-xs font-semibold">
                      {lang === 'en' ? 'Drop batch card here' : 'اسحب بطاقة الدفعة إلى هنا'}
                    </span>
                  </div>
                ) : (
                  colBatches.map((batch) => {
                    const isDone = batch.column === 'DONE';
                    const progress = Math.min(100, Math.round((batch.completed_quantity / batch.target_quantity) * 100));

                    return (
                      <motion.div
                        key={batch.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        draggable={true}
                        onDragStart={(e: any) => handleDragStart(e, batch.id)}
                        className={`bg-white/[0.07] hover:bg-white/[0.12] border border-white/20 hover:border-white/35 rounded-xl p-4 shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all cursor-grab active:cursor-grabbing relative group ${
                          isDone ? 'border-emerald-400/40' : ''
                        }`}
                      >
                        {/* Top ID & Meal Code & Priority Badges */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-[11px] font-extrabold text-white/90 bg-white/10 px-2 py-0.5 rounded-md border border-white/20" dir="ltr" lang="en">
                              {toEnglishDigits(batch.id)}
                            </span>
                            {batch.meal_code && (
                              <span className="text-[10px] font-bold text-teal-300 bg-teal-500/15 px-1.5 py-0.5 rounded-md border border-teal-400/30" dir="ltr" lang="en">
                                #{toEnglishDigits(batch.meal_code)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {batch.priority === 'HIGH' && (
                              <span className="text-[10px] font-bold text-rose-200 bg-rose-500/20 border border-rose-400/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                                {lang === 'en' ? 'High' : 'أولوية قصوى'}
                              </span>
                            )}
                            <span className="text-[10px] text-white/70 bg-white/5 border border-white/15 px-2 py-0.5 rounded-md">
                              {batch.category}
                            </span>
                          </div>
                        </div>

                        {/* Meal Title (Real Supabase Arabic & English) */}
                        <h4 className="font-bold text-white text-sm leading-snug line-clamp-2">
                          {batch.name}
                        </h4>
                        {batch.name_en && (
                          <p className="text-[11px] text-white/50 font-medium mt-0.5 line-clamp-1">
                            {batch.name_en}
                          </p>
                        )}

                        {/* BOM Packaging Materials Joined from Supabase */}
                        {batch.packaging && batch.packaging.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-white/10">
                            <div className="text-[10px] text-teal-300/80 mb-1 flex items-center gap-1 font-bold">
                              <Box className="w-3 h-3 text-teal-300" />
                              <span>{lang === 'en' ? 'BOM Packaging:' : 'تغليف الوجبة (BOM):'}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {batch.packaging.map((pkg, pIdx) => (
                                <span
                                  key={pIdx}
                                  className="text-[10px] bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 px-2 py-0.5 rounded-md text-white/90 flex items-center gap-1 font-mono transition-colors"
                                  title={`${pkg.item_name_ar} (رمز: ${pkg.item_code})`}
                                >
                                  <span className="text-teal-300 font-bold">{pkg.item_code}</span>
                                  <span className="font-sans text-[9px] text-white/70 truncate max-w-[85px]">{pkg.item_name_ar}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Diet / Allergen Tag */}
                        <div className="mt-2.5 text-[11px] text-teal-200/90 bg-teal-500/10 border border-teal-400/20 px-2 py-1 rounded-lg flex items-center justify-between font-medium">
                          <span>{batch.dietNotes}</span>
                          <span className="font-mono font-bold" dir="ltr" lang="en">
                            {toEnglishDigits(batch.calories)} {lang === 'en' ? 'kcal' : 'سعرة'}
                          </span>
                        </div>

                        {/* Target Quantity & Progress */}
                        <div className="mt-3 pt-2.5 border-t border-white/10 space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-white/70">{lang === 'en' ? 'Batch Quantity:' : 'كمية الدفعة:'}</span>
                            <span className="font-mono text-emerald-300 font-extrabold" dir="ltr" lang="en">
                              {toEnglishDigits(batch.completed_quantity)} / {toEnglishDigits(batch.target_quantity)} {lang === 'en' ? 'units' : 'وجبة'}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-emerald-500 to-teal-300 h-full rounded-full transition-all duration-300"
                              style={{ width: `${isDone ? 100 : progress}%` }}
                            />
                          </div>
                        </div>

                        {/* Station, Chef & Prep Time */}
                        <div className="mt-3 flex items-center justify-between text-[11px] text-white/60 pt-2 border-t border-white/10">
                          <div className="flex items-center gap-1 text-white/75">
                            <User className="w-3.5 h-3.5 text-white/50" />
                            <span>{batch.chef}</span>
                          </div>
                          <div className="flex items-center gap-1 font-mono">
                            <Timer className="w-3.5 h-3.5 text-amber-300/80" />
                            <span>{toEnglishDigits(batch.prep_time)}</span>
                          </div>
                        </div>

                        {/* Swimlane Shift Action Buttons */}
                        <div className="mt-3.5 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                          {colIndex > 0 ? (
                            <button
                              type="button"
                              onClick={() => moveBatch(batch.id, columnOrder[colIndex - 1])}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border border-white/15 transition-colors cursor-pointer text-[11px] flex items-center gap-1"
                              title={lang === 'en' ? 'Move back' : 'إرجاع للمرحلة السابقة'}
                            >
                              <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? '' : 'rotate-180'}`} />
                              <span>{lang === 'en' ? 'Back' : 'السابق'}</span>
                            </button>
                          ) : (
                            <div />
                          )}

                          {colIndex < columnOrder.length - 1 ? (
                            <button
                              type="button"
                              onClick={() => moveBatch(batch.id, columnOrder[colIndex + 1])}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-200 border border-emerald-400/40 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1.5 shadow-sm"
                            >
                              <span>{colId === 'DONE' ? (lang === 'en' ? 'Dispatch' : 'تسليم') : (lang === 'en' ? 'Advance' : 'المرحلة التالية')}</span>
                              <ArrowLeft className={`w-3.5 h-3.5 ${isRtl ? '' : 'rotate-180'}`} />
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-1 rounded-lg flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              {lang === 'en' ? 'Completed' : 'مكتمل وجاهز'}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Add New Production Batch Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-slate-950/85 backdrop-blur-2xl border border-white/25 rounded-3xl p-6 sm:p-8 shadow-2xl text-white space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/15">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-teal-500/20 border border-teal-400/30 rounded-xl text-teal-300">
                    <ChefHat className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {lang === 'en' ? 'Add New Healthy Diet Batch' : 'إضافة دفعة إنتاج وجبة جديدة'}
                    </h3>
                    <p className="text-xs text-white/60">
                      {lang === 'en' ? 'Schedule a new batch to the kitchen In-Progress swimlane' : 'جدولة دفعة جديدة وإدراجها ضمن مرحلة قيد التحضير'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/15 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateNewBatch} className="space-y-4 text-xs">
                {/* 1. Pick from Real Supabase Menu Dropdown */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-teal-500/10 border border-teal-400/25">
                  <label className="font-bold text-teal-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-teal-300" />
                      <span>{lang === 'en' ? 'Select Meal from Supabase Menu:' : 'اختر الوجبة من قاعدة بيانات زاهي الحية:'}</span>
                    </span>
                    <span className="text-[10px] text-teal-300/80 font-mono">BOM Auto-link</span>
                  </label>
                  <select
                    value={newBatch.meal_code}
                    onChange={(e) => {
                      const code = e.target.value;
                      const meal = realMeals.find((m) => m.meal_code === code);
                      if (meal) {
                        setNewBatch({
                          ...newBatch,
                          meal_code: meal.meal_code,
                          name: meal.meal_name_ar,
                          name_en: meal.meal_name_en || meal.meal_name_ar,
                          category: normalizeCategory(meal.category_ar),
                          packaging: (meal.packaging || []).map((p) => ({
                            item_code: p.inventory_item_code,
                            item_name_ar: p.inventory_item?.item_name_ar || p.inventory_item_code,
                            quantity_used: p.quantity_used,
                          })),
                        });
                      } else {
                        setNewBatch({ ...newBatch, meal_code: '' });
                      }
                    }}
                    className="w-full bg-slate-900 border border-teal-400/30 rounded-xl p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="">-- {lang === 'en' ? 'Choose from 176 seeded meals or enter manually' : 'اختر من 176 وجبة محقونة أو أدخل يدوياً'} --</option>
                    {realMeals.map((m) => (
                      <option key={m.meal_code} value={m.meal_code}>
                        [{m.meal_code}] {m.meal_name_ar} {m.category_ar ? `• ${m.category_ar}` : ''}
                      </option>
                    ))}
                  </select>
                  {newBatch.packaging && newBatch.packaging.length > 0 && (
                    <div className="pt-1.5 flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-teal-200/80 font-medium">{lang === 'en' ? 'Joined Packaging:' : 'مواد التغليف المرتبطة:'}</span>
                      {newBatch.packaging.map((pkg, idx) => (
                        <span key={idx} className="text-[10px] bg-teal-500/20 text-teal-200 border border-teal-400/30 px-1.5 py-0.5 rounded font-mono">
                          {pkg.item_code} {pkg.item_name_ar}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-white block">
                    {lang === 'en' ? 'Meal Name (Arabic):' : 'اسم الوجبة (عربي):'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: فاهيتا لحم بقري دايت مع الأرز البري"
                    value={newBatch.name}
                    onChange={(e) => setNewBatch({ ...newBatch, name: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-white block">
                      {lang === 'en' ? 'Meal Name (English):' : 'اسم الوجبة (إنجليزي):'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Diet Beef Fajita with Wild Rice"
                      value={newBatch.name_en}
                      onChange={(e) => setNewBatch({ ...newBatch, name_en: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-white block">
                      {lang === 'en' ? 'Category:' : 'التصنيف:'}
                    </label>
                    <select
                      value={newBatch.category}
                      onChange={(e) => setNewBatch({ ...newBatch, category: e.target.value })}
                      className="w-full bg-slate-900 border border-white/20 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none"
                    >
                      <option value="فطور">فطور</option>
                      <option value="وجبات رئيسية">وجبات رئيسية</option>
                      <option value="سلطات">سلطات</option>
                      <option value="حلى">حلى</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-white flex justify-between">
                      <span>{lang === 'en' ? 'Target Units:' : 'الكمية المستهدفة:'}</span>
                      <span className="text-[10px] text-white/50 font-mono">0-9</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      dir="ltr"
                      lang="en"
                      required
                      value={newBatch.target_quantity}
                      onChange={(e) => {
                        const clean = String(e.target.value).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^0-9]/g, '');
                        setNewBatch({ ...newBatch, target_quantity: clean === '' ? 0 : Number(clean) });
                      }}
                      className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none font-mono text-center font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-white flex justify-between">
                      <span>{lang === 'en' ? 'Calories (kcal):' : 'السعرات:'}</span>
                      <span className="text-[10px] text-white/50 font-mono">0-9</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      dir="ltr"
                      lang="en"
                      value={newBatch.calories}
                      onChange={(e) => {
                        const clean = String(e.target.value).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^0-9]/g, '');
                        setNewBatch({ ...newBatch, calories: clean === '' ? 0 : Number(clean) });
                      }}
                      className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none font-mono text-center font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-white block">
                      {lang === 'en' ? 'Priority:' : 'الأولوية:'}
                    </label>
                    <select
                      value={newBatch.priority}
                      onChange={(e) => setNewBatch({ ...newBatch, priority: e.target.value as any })}
                      className="w-full bg-slate-900 border border-white/20 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none"
                    >
                      <option value="HIGH">أولوية قصوى</option>
                      <option value="MEDIUM">متوسطة</option>
                      <option value="NORMAL">عادية</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="font-bold text-white block">
                      {lang === 'en' ? 'Kitchen Station:' : 'محطة التحضير بالمطبخ:'}
                    </label>
                    <input
                      type="text"
                      value={newBatch.station}
                      onChange={(e) => setNewBatch({ ...newBatch, station: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-white block">
                      {lang === 'en' ? 'Assigned Chef:' : 'الشيف المسؤول:'}
                    </label>
                    <input
                      type="text"
                      value={newBatch.chef}
                      onChange={(e) => setNewBatch({ ...newBatch, chef: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-white block">
                    {lang === 'en' ? 'Dietary Notes & Allergens:' : 'ملاحظات الحمية ومسببات الحساسية:'}
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: خالٍ من الغلوتين • بدون مكسرات"
                    value={newBatch.dietNotes}
                    onChange={(e) => setNewBatch({ ...newBatch, dietNotes: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none"
                  />
                </div>

                <div className="pt-3 border-t border-white/15 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{lang === 'en' ? 'Confirm & Add to Schedule' : 'تأكيد وإدراج الدفعة'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/20 transition-all cursor-pointer"
                  >
                    {lang === 'en' ? 'Cancel' : 'إلغاء'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

