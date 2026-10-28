"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Upload,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  Check,
  Eye,
  Trash2,
  Layers,
  ArrowRight,
  ClipboardPaste,
  ScanLine
} from 'lucide-react';
import { useLanguage } from '@/components/common/LanguageContext';
import {
  MasterPlanItem,
  BatchProductionItem,
  importAIVisionProductionPlan,
  normalizeCategory
} from '@/lib/kdsProductionStore';

interface TikrarSmartReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (totalItems: number, totalQuantity: number) => void;
}

export default function TikrarSmartReaderModal({
  isOpen,
  onClose,
  onSuccess
}: TikrarSmartReaderModalProps) {
  const { lang, isRtl } = useLanguage();

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [extractedData, setExtractedData] = useState<{
    invoiceNumber: string;
    invoiceDate: string;
    modelUsed: string;
    totalQuantity: number;
    items: Array<{
      meal_code: string;
      name: string;
      name_en: string;
      category: string;
      target_quantity: number;
      calories: number;
      dietNotes: string;
      station: string;
      chef: string;
      prep_time: string;
      priority: 'HIGH' | 'MEDIUM' | 'NORMAL';
    }>;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setImagePreview(null);
      setImageFile(null);
      setIsAnalyzing(false);
      setExtractedData(null);
      setErrorMsg(null);
      setAppliedSuccess(false);
    }
  }, [isOpen]);

  // Handle Clipboard Paste (Ctrl + V)
  const handlePasteEvent = useCallback((e: ClipboardEvent) => {
    if (!isOpen) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          e.preventDefault();
          break;
        }
      }
    }
  }, [isOpen]);

  useEffect(() => {
    window.addEventListener('paste', handlePasteEvent);
    return () => {
      window.removeEventListener('paste', handlePasteEvent);
    };
  }, [handlePasteEvent]);

  // Convert File to Base64 and set preview
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg(lang === 'en' ? 'Please upload an image file (PNG, JPG, WebP).' : 'يرجى تحميل ملف صورة صالح (PNG, JPG, WebP).');
      return;
    }
    setErrorMsg(null);
    setImageFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  // Sample Tikrar Demo Invoice Loader
  const handleLoadSampleInvoice = () => {
    setErrorMsg(null);
    // Create an SVG demo invoice representation as data URL
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
        <rect width="600" height="400" fill="#08201a"/>
        <rect x="20" y="20" width="560" height="360" rx="16" fill="#0e2d25" stroke="#2dd4bf" stroke-width="2"/>
        <text x="300" y="70" fill="#ffffff" font-size="22" font-family="sans-serif" font-weight="bold" text-anchor="middle">نظام تكرار (Tikrar) - أمر إنتاج ومطابقة كميات</text>
        <text x="300" y="105" fill="#5eead4" font-size="14" font-family="sans-serif" text-anchor="middle">فاتورة كمية معتمدة: TIKRAR-2026-8841</text>
        <line x1="40" y1="125" x2="560" y2="125" stroke="#2dd4bf" stroke-width="1" stroke-opacity="0.3"/>
        <text x="540" y="155" fill="#ffffff" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="end">كود الوجبة</text>
        <text x="380" y="155" fill="#ffffff" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="end">اسم الوجبة</text>
        <text x="180" y="155" fill="#ffffff" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="end">التصنيف</text>
        <text x="60" y="155" fill="#ffffff" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="start">الكمية</text>
        
        <text x="540" y="195" fill="#2dd4bf" font-size="13" font-family="sans-serif" text-anchor="end">#43022</text>
        <text x="380" y="195" fill="#ffffff" font-size="13" font-family="sans-serif" text-anchor="end">كباب لحم مع ارز الزعفران</text>
        <text x="180" y="195" fill="#99f6e4" font-size="13" font-family="sans-serif" text-anchor="end">وجبات رئيسية</text>
        <text x="60" y="195" fill="#34d399" font-size="14" font-weight="bold" font-family="sans-serif" text-anchor="start">45</text>
        
        <text x="540" y="235" fill="#2dd4bf" font-size="13" font-family="sans-serif" text-anchor="end">#43039</text>
        <text x="380" y="235" fill="#ffffff" font-size="13" font-family="sans-serif" text-anchor="end">سليق دجاج</text>
        <text x="180" y="235" fill="#99f6e4" font-size="13" font-family="sans-serif" text-anchor="end">وجبات رئيسية</text>
        <text x="60" y="235" fill="#34d399" font-size="14" font-weight="bold" font-family="sans-serif" text-anchor="start">40</text>

        <text x="540" y="275" fill="#2dd4bf" font-size="13" font-family="sans-serif" text-anchor="end">#42857</text>
        <text x="380" y="275" fill="#ffffff" font-size="13" font-family="sans-serif" text-anchor="end">سلطة الكينوا بالأفوكادو</text>
        <text x="180" y="275" fill="#99f6e4" font-size="13" font-family="sans-serif" text-anchor="end">سلطات</text>
        <text x="60" y="275" fill="#34d399" font-size="14" font-weight="bold" font-family="sans-serif" text-anchor="start">30</text>

        <text x="540" y="315" fill="#2dd4bf" font-size="13" font-family="sans-serif" text-anchor="end">#43015</text>
        <text x="380" y="315" fill="#ffffff" font-size="13" font-family="sans-serif" text-anchor="end">بان كيك جبنه قريش</text>
        <text x="180" y="315" fill="#99f6e4" font-size="13" font-family="sans-serif" text-anchor="end">فطور</text>
        <text x="60" y="315" fill="#34d399" font-size="14" font-weight="bold" font-family="sans-serif" text-anchor="start">30</text>

        <text x="300" y="360" fill="#94a3b8" font-size="12" font-family="sans-serif" text-anchor="middle">تم إنشاؤه عبر بوابة تكرار الإلكترونية • جاهز للمعالجة الآلية</text>
      </svg>
    `;
    const base64Sample = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
    setImagePreview(base64Sample);
  };

  // Run AI Vision Analysis with Gemini 3.8 Flash
  const handleStartAnalysis = async () => {
    if (!imagePreview) return;

    setIsAnalyzing(true);
    setErrorMsg(null);
    setLoadingStep(lang === 'en' ? 'Analyzing receipt image with Gemini 3.8 Flash Vision...' : 'جاري تحليل الفاتورة لاستخراج الكميات عبر Gemini 3.8 Flash...');

    try {
      const response = await fetch('/api/vision/parse-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64Image: imagePreview,
          mimeType: imageFile?.type || 'image/jpeg',
        }),
      });

      if (!response.ok) {
        throw new Error('Vision processing returned status ' + response.status);
      }

      const data = await response.json();
      if (!data.success || !data.items) {
        throw new Error(data.error || 'Failed to extract items from invoice');
      }

      setLoadingStep(lang === 'en' ? 'Structuring daily production batches...' : 'تجهيز دفعات الإنتاج ومطابقة جدول الكميات...');
      await new Promise((r) => setTimeout(r, 600));

      setExtractedData({
        invoiceNumber: data.invoiceNumber || 'TIKRAR-2026-INV',
        invoiceDate: data.invoiceDate || new Date().toISOString().split('T')[0],
        modelUsed: data.modelUsed || 'Gemini 3.8 Flash Vision',
        totalQuantity: data.totalQuantity || 245,
        items: data.items,
      });
    } catch (err: any) {
      console.warn('Vision analysis error:', err);
      setErrorMsg(
        lang === 'en'
          ? 'Failed to parse image. Please try another screenshot or use the sample.'
          : 'تعذر تحليل الصورة، يرجى إعادة المحاولة أو تجربة النموذج الاختباري.'
      );
    } finally {
      setIsAnalyzing(false);
      setLoadingStep('');
    }
  };

  // Commit extracted items to Master Daily Plan & KDS Batches
  const handleApplyToProduction = () => {
    if (!extractedData || !extractedData.items) return;

    // 1. Build Master Plan Items
    const newMasterPlan: MasterPlanItem[] = extractedData.items.map((item) => ({
      id: item.meal_code,
      meal_code: item.meal_code,
      short: item.name,
      category: normalizeCategory(item.category),
      required: Number(item.target_quantity) || 30,
    }));

    // 2. Build Batch Production Items
    const newBatches: BatchProductionItem[] = extractedData.items.map((item, idx) => {
      const cat = normalizeCategory(item.category);
      const targetQty = Number(item.target_quantity) || 30;

      // Assign packaging BOM items
      const isSalad = cat === 'سلطات';
      const isBreakfast = cat === 'فطور';
      const packagingItems = [
        {
          item_code: isSalad ? 'P4' : 'P1',
          item_name_ar: isSalad ? 'صحن السلطة' : 'صحن مقسم 32',
          quantity_used: 1,
        },
        { item_code: 'P6', item_name_ar: 'سليف مطبوع', quantity_used: 1 },
        { item_code: 'P7', item_name_ar: 'أدوات المائدة مطبوع', quantity_used: 1 },
        { item_code: 'P8', item_name_ar: 'كيس زاهي مطبوع', quantity_used: 1 },
      ];

      if (isSalad) {
        packagingItems.push({ item_code: 'P3', item_name_ar: 'علب الصوص', quantity_used: 1 });
      }

      return {
        id: `BATCH-${100 + idx + 1}`,
        meal_code: item.meal_code,
        menuId: item.meal_code,
        name: item.name,
        name_en: item.name_en || item.name,
        category: cat,
        target_quantity: targetQty,
        completed_quantity: idx === 0 ? Math.round(targetQty * 0.4) : idx === 1 ? Math.round(targetQty * 0.6) : 0,
        station: item.station || 'محطة الشوايات والأفران',
        chef: item.chef || 'الشيف طارق',
        prep_time: item.prep_time || '25 دقيقة',
        priority: item.priority || 'NORMAL',
        column: idx === 0 ? 'PACKAGING' : 'IN_PROGRESS',
        dietNotes: item.dietNotes || 'وجبة صحية متوازنة',
        calories: item.calories || 420,
        packaging: packagingItems,
      };
    });

    // Save to store and dispatch reactive events
    importAIVisionProductionPlan(newMasterPlan, newBatches);

    setAppliedSuccess(true);
    if (onSuccess) {
      onSuccess(extractedData.items.length, extractedData.totalQuantity);
    }

    setTimeout(() => {
      onClose();
    }, 1400);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl bg-[#071914]/90 backdrop-blur-2xl border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.7)] rounded-3xl p-5 sm:p-7 text-white z-10 max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/15">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-md">
                <ScanLine className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                    {lang === 'en' ? 'Tikrar Smart Reader' : 'قراءة فاتورة تكرار'}
                  </h3>
                  <span className="text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-400/30 px-2 py-0.5 rounded-full">
                    Gemini 3.8 Flash Vision
                  </span>
                </div>
                <p className="text-white/60 text-xs mt-0.5">
                  {lang === 'en'
                    ? 'Upload or paste a screenshot of Tikrar invoice to extract quantities automatically'
                    : 'ارفع أو الصق لقطة شاشة من فاتورة نظام تكرار لاستخراج أصناف وكميات الإنتاج آلياً'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {appliedSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs sm:text-sm font-bold flex items-center gap-2.5"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                <span>
                  {lang === 'en'
                    ? 'Successfully added items to Master Daily Plan & Batch Board!'
                    : 'تمت إضافة وجبات الفاتورة بنجاح إلى خطة الإنتاج اليومية وقائمة دفعات KDS!'}
                </span>
              </motion.div>
            )}

            {/* Stage 1: Upload / Paste Area (when no extracted data yet) */}
            {!extractedData && (
              <>
                {!imagePreview ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                      isDragging
                        ? 'border-teal-400 bg-teal-500/15 scale-[1.01]'
                        : 'border-white/25 hover:border-teal-400/60 bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          processImageFile(e.target.files[0]);
                        }
                      }}
                    />

                    <div className="w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-400/30 flex items-center justify-center text-teal-300 shadow-inner">
                      <ClipboardPaste className="w-7 h-7" />
                    </div>

                    <div>
                      <p className="text-sm sm:text-base font-extrabold text-white">
                        {lang === 'en'
                          ? 'Paste image (Ctrl + V) or drag screenshot here'
                          : 'الصق لقطة الشاشة هنا (Ctrl + V) أو اسحب وأفلت الصورة'}
                      </p>
                      <p className="text-white/60 text-xs mt-1">
                        {lang === 'en'
                          ? 'Supports clipboard screenshots, PNG, JPG, WebP'
                          : 'يدعم لقطات الشاشة المنسوخة، وصور الفواتير بصيغ PNG, JPG, WebP'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <span className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all">
                        <Upload className="w-3.5 h-3.5 inline me-1.5" />
                        {lang === 'en' ? 'Browse File' : 'استعراض من جهازك'}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadSampleInvoice();
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 font-bold text-xs border border-teal-400/30 transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 inline me-1.5" />
                        {lang === 'en' ? 'Try Sample Invoice' : 'تجربة عينة فاتورة تكرار'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Image Preview Card */
                  <div className="bg-white/5 border border-white/15 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white/80 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-teal-300" />
                        <span>{lang === 'en' ? 'Loaded Screenshot' : 'لقطة الشاشة الجاهزة للتحليل'}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setImageFile(null);
                        }}
                        disabled={isAnalyzing}
                        className="text-xs text-rose-300 hover:text-rose-200 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{lang === 'en' ? 'Remove' : 'إزالة الصورة'}</span>
                      </button>
                    </div>

                    <div className="relative rounded-xl overflow-hidden border border-white/20 max-h-56 flex items-center justify-center bg-black/40">
                      <img
                        src={imagePreview}
                        alt="Tikrar Receipt"
                        className="w-full h-auto max-h-56 object-contain"
                      />

                      {/* Animated scanning bar while analyzing */}
                      {isAnalyzing && (
                        <div className="absolute inset-0 bg-teal-500/10 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2">
                          <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-teal-300 to-transparent animate-pulse shadow-[0_0_15px_#2dd4bf]" />
                          <RefreshCw className="w-8 h-8 text-teal-300 animate-spin" />
                          <span className="text-xs font-bold text-white bg-black/70 px-3 py-1 rounded-full border border-teal-400/30 shadow-lg">
                            {loadingStep || (lang === 'en' ? 'Analyzing invoice to extract quantities...' : 'جاري تحليل الفاتورة لاستخراج الكميات...')}
                          </span>
                        </div>
                      )}
                    </div>

                    {!isAnalyzing && (
                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleStartAnalysis}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-xs sm:text-sm shadow-[0_0_20px_rgba(45,212,191,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-teal-100" />
                          <span>{lang === 'en' ? 'Start AI Vision Analysis (Gemini 3.8)' : 'بدء تحليل الفاتورة واستخراج الكميات'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Stage 2: Extracted Items Review Table */}
            {extractedData && (
              <div className="space-y-4">
                {/* Meta summary card */}
                <div className="bg-white/5 border border-teal-400/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-white/60 block">{lang === 'en' ? 'Invoice Number' : 'رقم الفاتورة المستخرجة'}</span>
                    <span className="font-mono font-bold text-white text-sm">{extractedData.invoiceNumber}</span>
                  </div>
                  <div>
                    <span className="text-white/60 block">{lang === 'en' ? 'Total Extracted' : 'إجمالي الوجبات'}</span>
                    <span className="font-mono font-extrabold text-teal-300 text-sm">
                      {extractedData.totalQuantity} {lang === 'en' ? 'meals' : 'وجبة'}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/60 block">{lang === 'en' ? 'Vision Engine' : 'محرك الذكاء الاصطناعي'}</span>
                    <span className="font-mono text-emerald-300 text-xs font-bold">{extractedData.modelUsed}</span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border border-white/15 rounded-2xl overflow-hidden bg-black/20">
                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-white/10 text-white/70 sticky top-0 backdrop-blur-md font-bold">
                        <tr>
                          <th className="p-2.5">{lang === 'en' ? 'Code' : 'كود'}</th>
                          <th className="p-2.5">{lang === 'en' ? 'Meal Name' : 'اسم الوجبة'}</th>
                          <th className="p-2.5">{lang === 'en' ? 'Category' : 'التصنيف'}</th>
                          <th className="p-2.5 text-center">{lang === 'en' ? 'Qty' : 'الكمية'}</th>
                          <th className="p-2.5">{lang === 'en' ? 'Station' : 'المحطة'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {extractedData.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="p-2.5 font-mono font-bold text-teal-300" dir="ltr">
                              #{item.meal_code}
                            </td>
                            <td className="p-2.5 font-bold text-white">
                              <div>{item.name}</div>
                              {item.name_en && (
                                <div className="text-[10px] text-white/50 font-normal font-sans">{item.name_en}</div>
                              )}
                            </td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/80 text-[10px]">
                                {item.category}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono font-bold text-center text-emerald-300 text-sm">
                              {item.target_quantity}
                            </td>
                            <td className="p-2.5 text-white/70 text-[11px]">{item.station}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="pt-4 border-t border-white/15 flex items-center justify-between gap-3">
            {extractedData ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setExtractedData(null);
                    setImagePreview(null);
                    setImageFile(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  {lang === 'en' ? 'Re-scan / Back' : 'مسح وإعادة القراءة'}
                </button>

                <button
                  type="button"
                  disabled={appliedSuccess}
                  onClick={handleApplyToProduction}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs sm:text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {lang === 'en'
                      ? 'Confirm & Populate Daily Plan / Batch List'
                      : 'تأكيد واعتماد الوجبات في خطة الإنتاج اليومية (KDS)'}
                  </span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
              >
                {lang === 'en' ? 'Close' : 'إغلاق'}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

