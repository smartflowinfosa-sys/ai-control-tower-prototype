"use client";

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import GlassSelect from '@/components/common/GlassSelect';
import {
  UploadCloud,
  Image as ImageIcon,
  MapPin,
  Sparkles,
  FileSpreadsheet,
  FileText,
  Mail,
  Send,
  Building2,
  Phone,
  Clock,
  ShieldCheck,
  Package,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronRight,
  Filter,
  Layers,
  ArrowRight,
  Plus,
  Search,
  Eye,
  Check,
  PackageSearch
} from 'lucide-react';
import { initialSuppliers, Supplier } from '@/lib/mockInventoryData';

// Helper for English digits (0-9)
const toEnglishDigits = (str: string | number): string => {
  if (str === null || str === undefined) return '';
  if (typeof str === 'number') {
    return str.toLocaleString('en-US');
  }
  return String(str).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

// Interface for Discovered Suppliers
interface DiscoveredSupplier {
  id: string;
  name: string;
  matchScore: number;
  city: string;
  region: string;
  rating: number;
  phone: string;
  email: string;
  leadTime: string;
  minOrderQuantity: number;
  estimatedUnitCost: number;
  specialties: string[];
  matchedProducts: string[];
  aiAnalysis: string;
  tags: string[];
}

const mockDiscoveredSuppliers: DiscoveredSupplier[] = [
  {
    id: 'disc-1',
    name: 'مصنع الأفق للبلاستيك والتغليف المتطور',
    matchScore: 96,
    city: 'الرياض',
    region: 'المنطقة الوسطى',
    rating: 4.9,
    phone: '+966 11 234 5678',
    email: 'sales@alofokplastic.sa',
    leadTime: '24 ساعة',
    minOrderQuantity: 1000,
    estimatedUnitCost: 0.42,
    specialties: ['علب صوص محكمة الغلق', 'صحون حرارية مقاس 24 و 32', 'أدوات مائدة PP-5 فاخرة'],
    matchedProducts: ['علبة صوص 2 أونص', 'صحن مقاس 24'],
    aiAnalysis: 'تطابق فائق في نوع البلاستيك الغذائي (Food-Grade PP-5) والمواصفات الحرارية، مع مستودع جاهز للتسليم الفوري في الرياض.',
    tags: ['مطابق 100% لمواصفات زاهي', 'اعتماد فوري', 'ISO 22000']
  },
  {
    id: 'disc-2',
    name: 'شركة التغليف الذكي (Smart Packaging Co.)',
    matchScore: 92,
    city: 'جدة',
    region: 'المنطقة الغربية',
    rating: 4.8,
    phone: '+966 12 789 0123',
    email: 'orders@smartpack.sa',
    leadTime: '12 - 18 ساعة',
    minOrderQuantity: 500,
    estimatedUnitCost: 0.95,
    specialties: ['بوكسات كرتون مموج بطباعة أوفست 4 ألوان', 'أكياس كرافت مقاومة للدهون', 'سليف وجبات زاهي'],
    matchedProducts: ['بوكس وجبة زاهي', 'سليف الوجبة', 'كيس ورقي'],
    aiAnalysis: 'تطابق بصري 92% مع خامة الكرتون المموج المطبوع بدقة ألوان زاهي الأصلية، وخاصية عزل الدهون المعتمدة للمطاعم.',
    tags: ['توصيل فوري بالغرب', 'ورق كرافت بيئي', 'جودة معتمدة']
  },
  {
    id: 'disc-3',
    name: 'مؤسسة الجملة وسلاسل الإمداد المركزية',
    matchScore: 88,
    city: 'الدمام',
    region: 'المنطقة الشرقية',
    rating: 4.7,
    phone: '+966 13 456 7890',
    email: 'wholesale@aljomlah-supply.sa',
    leadTime: '48 ساعة',
    minOrderQuantity: 3000,
    estimatedUnitCost: 0.35,
    specialties: ['أكياس حاملة 4 مشروبات', 'مناديل معطرة مخصصة', 'أكواب ورقية مزدوجة الجدار'],
    matchedProducts: ['كيس حامل مشروبات', 'مناديل زاهي'],
    aiAnalysis: 'سعر اقتصادي منافس جداً للكميات الكبيرة مع نسبة استقرار أسعار 98% وعقود توريد ربع سنوية مرنة.',
    tags: ['سعر جملة منافس', 'خصم كميات', 'مستودعات الشرقية']
  }
];

export default function SupplierDiscoveryPage() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [discoveredList, setDiscoveredList] = useState<DiscoveredSupplier[]>(mockDiscoveredSuppliers);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedSampleModal, setSelectedSampleModal] = useState<DiscoveredSupplier | null>(null);
  const [rfqModalSupplier, setRfqModalSupplier] = useState<DiscoveredSupplier | null>(null);
  const [rfqQuantity, setRfqQuantity] = useState<number>(2500);
  const [addedSupplierIds, setAddedSupplierIds] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Handle Drag & Drop / File Input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
      showToast(`تم رفع صورة العينة (${file.name}) بنجاح! جاري استخراج البصمة اللونية للمنتج...`);
    };
    reader.readAsDataURL(file);
  };

  // Sample Preset Selection
  const handleSelectPredefinedSample = (name: string, url: string) => {
    setUploadedImage(url);
    setUploadedFileName(name);
    showToast(`تم تحميل عينة [${name}] الجاهزة للتحليل الذكي`);
  };

  // Trigger AI Matching Search
  const handlePerformSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      let results = [...mockDiscoveredSuppliers];

      if (selectedCity !== 'ALL') {
        results = results.filter(s => s.city === selectedCity || s.region.includes(selectedCity));
      }

      setDiscoveredList(results);
      showToast(`تم العثور على ${toEnglishDigits(results.length)} مصانع وموردين مطابقين تماماً لمواصفات العينة`);
    }, 1200);
  };

  // Export Tools
  const handleExportExcel = () => {
    showToast('تم تصدير ملف إكسل (XLSX) متضمناً قائمة الموردين والأسعار بنجاح 📊');
  };

  const handleExportPDF = () => {
    showToast('تم إنشاء وتنزيل تقرير المطابقة والمفاضلة بصيغة PDF 📄');
  };

  const handleSendEmailReport = () => {
    showToast('تم إرسال تقرير الموردين المكتشفين إلى البريد الإلكتروني المعتمد للإدارة 📧');
  };

  // Add Discovered Supplier to Approved Network
  const handleAddSupplierToNetwork = (sup: DiscoveredSupplier) => {
    if (addedSupplierIds.includes(sup.id)) {
      showToast(`المورد (${sup.name}) مضاف مسبقاً لشبكة الموردين`);
      return;
    }

    const newSupplierEntry: Supplier = {
      id: `sup-${Date.now()}`,
      name: sup.name,
      category: sup.specialties[0] || 'توريد وتغليف ذكي',
      city: sup.city,
      phone: sup.phone,
      email: sup.email,
      rating: sup.rating,
      leadTime: sup.leadTime,
      reliability: `${sup.matchScore}%`,
      pricingTier: 'أسعار جملة معتمدة',
      activeOrdersCount: 0,
      tags: ['مكتشف بـ AI', 'مطابق للمواصفات'],
      metrics: {
        deliverySpeed: Math.min(99, Math.round(sup.rating * 19.5)),
        qualityScore: Math.min(100, Math.round(sup.rating * 20)),
        priceStability: 96,
      }
    };

    initialSuppliers.unshift(newSupplierEntry);
    setAddedSupplierIds(prev => [...prev, sup.id]);
    showToast(`تم اعتماد المورد (${sup.name}) وإضافته لشبكة الموردين بنجاح! 🎉`);
  };

  return (
    <div className="page-shell w-full mx-auto space-y-8 font-sans pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass-popover border border-white/40 text-white px-6 py-3.5 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-5 h-5 text-white animate-spin" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="glass page-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-white/8 border border-white/40 text-white ">
              <PackageSearch className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                مساحة عمل اكتشاف الموردين (Supplier Discovery Workspace)
              </h1>
              <p className="text-white/80 font-semibold text-sm mt-1">
                البحث الذكي بالرؤية الحاسوبية والنطاق الجغرافي لمطابقة خامات التغليف واعتماد سلاسل الإمداد
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* AI Vision Status Badge */}
          <div className="bg-white/8 border border-white/40 px-4 py-2 rounded-2xl text-xs font-bold text-white flex items-center gap-2 ">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI Vision Engine v2.4 متصل</span>
          </div>

          <Link
            href="/suppliers"
            className="bg-white/8 hover:bg-white/15 text-white font-bold px-4 py-2.5 rounded-2xl border border-white/40 transition-all text-sm flex items-center gap-2 group "
          >
            <Building2 className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
            <span>دليل الموردين المعتمدين</span>
            <ChevronRight className="w-4 h-4 text-white/65 rotate-180" />
          </Link>
        </div>
      </header>

      {/* 1. INPUT ZONE: AI Vision & Geographic Filtering */}
      <section className="glass p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/25 pb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-white/8 border border-white/40 text-white">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold text-white">
              منطقة البحث الذكي بمطابقة الصورة والنطاق الجغرافي
            </h2>
          </div>
          <span className="text-xs text-white/65 font-medium">
            خطوة 1: ارفع صورة العينة أو التغليف وحدد المنطقة
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left/Main Column: Drag & Drop Area (7 Cols) */}
          <div className="lg:col-span-7 space-y-3">
            <label className="block text-xs font-bold text-white">
              صورة المنتج أو عينة التغليف (Product Sample Image):
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {uploadedImage ? (
              /* Uploaded Preview State */
              <div className="relative rounded-2xl border border-white/40 glass p-4 flex items-center gap-4 group">
                <div className="w-24 h-24 rounded-xl border border-white/40 overflow-hidden shrink-0 flex items-center justify-center relative bg-white/8">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadedImage}
                    alt="Uploaded Product Sample"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-teal-500/15 text-teal-100 border border-teal-300/30 font-bold px-2.5 py-0.5 rounded-md">
                      تم الفحص بالذكاء الاصطناعي
                    </span>
                    <span className="text-[11px] text-white/65 truncate font-mono">
                      {uploadedFileName}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 truncate">
                    عينة معتمدة لمطاعم زاهي
                  </h4>
                  <p className="text-xs text-white/80 mt-0.5 leading-relaxed">
                    تم استخراج البصمة اللونية والمواصفات: كرتون مقوى آمن للأغذية، عازل للحرارة والزيوت.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUploadedImage(null);
                    setUploadedFileName(null);
                  }}
                  className="p-2 rounded-xl bg-white/8 hover:bg-rose-500/15 text-white/65 hover:text-rose-200 transition-colors cursor-pointer border border-white/40"
                  title="حذف الصورة واختيار غيرها"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Drag & Drop Dropzone */
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/25 hover:border-white/25 bg-white/8 hover:bg-white/15 backdrop-blur-[10px] rounded-2xl p-7 transition-all cursor-pointer flex flex-col items-center justify-center text-center group"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/8 text-white flex items-center justify-center mb-3 transition-colors border border-white/50">
                  <UploadCloud className="w-6 h-6 group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-sm font-bold text-white">
                  اسحب وأفلت صورة عينة التغليف هنا، أو <span className="text-white underline underline-offset-4">انقر لاختيار ملف</span>
                </div>
                <div className="text-xs text-white/80 mt-1">
                  يدعم صيغ PNG, JPG, WEBP عالية الدقة لمطابقة تفاصيل الطباعة والخامة
                </div>
              </div>
            )}

            {/* Quick Demo Samples Selector */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-xs font-semibold text-white/80 flex items-center gap-1">
                <span>⚡ عينات جاهزة للتجربة:</span>
              </span>
              {[
                { name: 'بوكس وجبة زاهي كرتوني', img: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=300&auto=format&fit=crop&q=80' },
                { name: 'علبة صوص بلاستيك 2 أونص', img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80' },
                { name: 'طقم أدوات مائدة فاخر', img: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=300&auto=format&fit=crop&q=80' },
              ].map((sample) => (
                <button
                  key={sample.name}
                  type="button"
                  onClick={() => handleSelectPredefinedSample(sample.name, sample.img)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-white/8 hover:bg-white/15 text-white border border-white/40 transition-all cursor-pointer "
                >
                  + {sample.name}
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Geographic Scope & Filters (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* Geographic Scope Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-white" />
                  <span>النطاق الجغرافي المستهدف (Geographic Scope):</span>
                </label>
                <div className="relative">
                  <GlassSelect
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full glass border border-white/40 rounded-2xl p-3 text-sm text-white font-bold focus:outline-none cursor-pointer pr-10 "
                  >
                    <option value="ALL">جميع مناطق المملكة (تغطية شاملة)</option>
                    <option value="جدة">جدة (المنطقة الغربية - توريد فوري)</option>
                    <option value="الرياض">الرياض (المنطقة الوسطى - مصانع رئيسية)</option>
                    <option value="مكة">مكة المكرمة وضواحيها</option>
                    <option value="الدمام">الدمام والمنطقة الشرقية (مستودعات مركزية)</option>
                  </GlassSelect>
                  <MapPin className="w-4 h-4 text-white absolute top-3.5 right-3 pointer-events-none" />
                </div>
              </div>

              {/* Material Classification */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-white" />
                  <span>تصنيف خامة المنتج المرفق:</span>
                </label>
                <div className="relative">
                  <GlassSelect
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full glass border border-white/40 rounded-2xl p-3 text-sm text-white font-bold focus:outline-none cursor-pointer pr-10 "
                  >
                    <option value="ALL">التعرف التلقائي بالذكاء الاصطناعي (Auto Detect)</option>
                    <option value="كرتون وورقيات">كرتون مموج وورقيات معتمدة للمطاعم</option>
                    <option value="بلاستيك">بلاستيك حراري ومستلزمات صوص (PP-5)</option>
                    <option value="مستلزمات تقديم">أدوات مائدة صديقة للبيئة ومستهلكات</option>
                  </GlassSelect>
                  <Filter className="w-4 h-4 text-white absolute top-3.5 right-3 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Main AI Search Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handlePerformSearch}
                disabled={isSearching}
                className="w-full bg-white/20 hover:bg-white/25 active:scale-[0.98] text-white font-bold py-3.5 px-6 rounded-2xl transition-all flex items-center justify-center gap-2.5 text-base cursor-pointer "
              >
                {isSearching ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جاري فحص بصمة المنتج ومطابقة الموردين...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-white animate-pulse" />
                    <span>بحث ذكي بالذكاء الاصطناعي 🪄</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. RESULTS GRID & EXPORT TOOLS */}
      <section className="space-y-5">
        {/* Export Toolbar & Grid Header */}
        <div className="glass p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/8 border border-white/40 text-white rounded-2xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>نتائج الموردين المكتشفين</span>
                <span className="text-xs font-extrabold bg-teal-600/15 text-teal-100 border border-teal-300/30 px-2.5 py-0.5 rounded-full font-mono">
                  {toEnglishDigits(discoveredList.length)} موردين مطابقين
                </span>
              </h3>
              <p className="text-xs text-white/80 font-semibold">
                مرتبة حسب أعلى نسبة تطابق تقديرية مع صورة المنتج ومعايير التشغيل
              </p>
            </div>
          </div>

          {/* Export Tools Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-white/80 ml-1">تصدير النتائج:</span>

            {/* Export Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="bg-white/8 hover:bg-white/15 text-white font-bold px-3.5 py-2 rounded-xl border border-white/40 transition-all text-xs flex items-center gap-1.5 cursor-pointer "
              title="تصدير النتائج إلى جدول إكسل"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>تصدير Excel 📊</span>
            </button>

            {/* Export PDF */}
            <button
              type="button"
              onClick={handleExportPDF}
              className="bg-white/8 hover:bg-white/15 text-white font-bold px-3.5 py-2 rounded-xl border border-white/40 transition-all text-xs flex items-center gap-1.5 cursor-pointer "
              title="توليد تقرير PDF رسمي"
            >
              <FileText className="w-4 h-4 text-white" />
              <span>تصدير PDF 📄</span>
            </button>

            {/* Send Email Report */}
            <button
              type="button"
              onClick={handleSendEmailReport}
              className="bg-white/8 hover:bg-white/15 text-white font-bold px-3.5 py-2 rounded-xl border border-white/40 transition-all text-xs flex items-center gap-1.5 cursor-pointer "
              title="إرسال التقرير لإيميل الإدارة"
            >
              <Mail className="w-4 h-4 text-white" />
              <span>إرسال تقرير بالإيميل 📧</span>
            </button>
          </div>
        </div>

        {/* Results Cards (3 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {discoveredList.map((sup) => {
            const isAdded = addedSupplierIds.includes(sup.id);

            return (
              <div
                key={sup.id}
                className="glass p-6 transition-all duration-200 flex flex-col justify-between group relative"
              >
                {/* Top Badge: AI Match Score */}
                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-extrabold text-base text-white flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-white shrink-0" />
                        <span>{sup.name}</span>
                      </h4>
                      <p className="text-xs text-white/80 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-white/65" />
                        <span>{sup.city} ({sup.region})</span>
                      </p>
                    </div>

                    {/* Match Score Badge */}
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-extrabold bg-teal-600/15 text-teal-100 border border-teal-300/30 px-3 py-1 rounded-xl flex items-center gap-1 font-mono">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                        <span>تطابق {toEnglishDigits(sup.matchScore)}%</span>
                      </span>
                      <span className="text-[10px] text-white/65 font-semibold mt-0.5">
                        رؤية حاسوبية دقيقة
                      </span>
                    </div>
                  </div>

                  {/* Supplier Key Specs Box */}
                  <div className="glass p-4 rounded-xl border border-white/40 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-white" />
                        <span>تقييم المورد المعتمد:</span>
                      </span>
                      <strong className="text-white bg-white/8 px-2 py-0.5 rounded-md border border-white/50 font-mono">
                        {toEnglishDigits(sup.rating)} من 5
                      </strong>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-white/80 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-white" />
                        <span>سرعة التوريد المتوقعة:</span>
                      </span>
                      <strong className="text-white font-mono">{toEnglishDigits(sup.leadTime)}</strong>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-white/80 flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-white" />
                        <span>الحد الأدنى للطلب (MOQ):</span>
                      </span>
                      <strong className="text-white font-mono">
                        {toEnglishDigits(sup.minOrderQuantity.toLocaleString('en-US'))} وحدة
                      </strong>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-white/80">متوسط سعر الوحدة التقديري:</span>
                      <strong className="text-white font-extrabold text-sm font-mono">
                        {toEnglishDigits(sup.estimatedUnitCost)} ر.س
                      </strong>
                    </div>
                  </div>

                  {/* AI Reasoning Analysis */}
                  <div className="glass p-3.5 rounded-xl border border-white/40 text-xs text-white leading-relaxed">
                    <strong className="text-white flex items-center gap-1 text-[11px] mb-1 font-bold">
                      <Sparkles className="w-3 h-3 text-white" />
                      <span>تحليل مطابقة الذكاء الاصطناعي:</span>
                    </strong>
                    {sup.aiAnalysis}
                  </div>

                  {/* Matched Specialties Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {sup.specialties.map((spec) => (
                      <span
                        key={spec}
                        className="text-[10px] bg-white/8 text-white px-2.5 py-0.5 rounded-lg border border-white/50 font-medium"
                      >
                        ✓ {spec}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Actions & Contact Footer */}
                <div className="pt-4 mt-4 border-t border-white/25 space-y-3">
                  <div className="flex justify-between items-center text-xs text-white/80 font-mono">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-white" />
                      <span>{toEnglishDigits(sup.phone)}</span>
                    </span>
                    <span className="text-[11px] text-white font-semibold">{sup.email}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {/* Request Sample Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedSampleModal(sup)}
                      className="bg-white/8 hover:bg-white/15 text-white font-bold py-2 px-3 rounded-xl border border-white/40 text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer "
                    >
                      <Package className="w-3.5 h-3.5 text-white" />
                      <span>طلب عينة فحص 📦</span>
                    </button>

                    {/* RFQ Button */}
                    <button
                      type="button"
                      onClick={() => setRfqModalSupplier(sup)}
                      className="bg-white/8 hover:bg-white/15 text-white font-bold py-2 px-3 rounded-xl border border-white/40 text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer "
                    >
                      <Send className="w-3.5 h-3.5 text-white" />
                      <span>طلب تسعيرة (RFQ)</span>
                    </button>
                  </div>

                  {/* Add to Approved Network Action */}
                  <button
                    type="button"
                    onClick={() => handleAddSupplierToNetwork(sup)}
                    disabled={isAdded}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isAdded
                        ? 'bg-teal-600/15 text-teal-100 border border-teal-300/30 cursor-not-allowed'
                        : 'bg-white/20 hover:bg-white/25 active:scale-95 text-white'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>تمت الإضافة لشبكة الموردين بنجاح</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>اعتماد وإضافة للموردين المعتمدين</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Operational Assistant Banner */}
      <section className="glass p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white/8 border border-white/40 flex items-center justify-center text-white shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              تكامل وكيل الذكاء الاصطناعي المدرك للسياق (AI Operations Assistant)
            </h4>
            <p className="text-xs text-white/80 mt-0.5 font-medium">
              يمكنك في أي لحظة الضغط على أيقونة المساعد العائم بالأسفل أو إعطاء أمر صوتي مثل: &quot;احسب لي تكلفة توريد 5000 بوكس من مصنع الأفق&quot;.
            </p>
          </div>
        </div>
      </section>

      {/* Modal: Request Sample */}
      {selectedSampleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
          <div className="font-sans glass-popover border border-white/40 rounded-2xl w-full max-w-md p-6 space-y-4 text-white">
            <div className="flex justify-between items-center border-b border-white/25 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-white" />
                <h3 className="text-base font-bold text-white">طلب عينة فحص جودة</h3>
              </div>
              <button
                onClick={() => setSelectedSampleModal(null)}
                className="text-white/65 hover:text-white bg-white/8 hover:bg-white/15 border border-white/25 p-1.5 rounded-full w-7 h-7 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-white/80 leading-relaxed">
              سيتم إرسال طلب عينة فحص رسمية إلى <strong className="text-white">{selectedSampleModal.name}</strong> لإرسال عينات مجانية إلى المختبر التشغيلي لزاهي في <strong className="text-white">{selectedSampleModal.city}</strong>.
            </p>

            <div className="bg-white/8 p-4 rounded-xl border border-white/25 text-xs space-y-1.5 text-white/80">
              <div><strong className="text-white">العنوان المعتمد:</strong> مركز زاهي اللوجستي، الرياض - حي العقيق</div>
              <div><strong className="text-white">مهلة التوصيل المقدرة للعينة:</strong> 24 ساعة عمل</div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  showToast(`تم إرسال طلب عينة الفحص إلى (${selectedSampleModal.name}) بنجاح 📦`);
                  setSelectedSampleModal(null);
                }}
                className="flex-1 bg-white/20 hover:bg-white/25 text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer "
              >
                تأكيد إرسال طلب العينة
              </button>
              <button
                type="button"
                onClick={() => setSelectedSampleModal(null)}
                className="px-4 bg-white/8 hover:bg-white/15 text-white/80 border border-white/25 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: RFQ (Request for Quote) */}
      {rfqModalSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
          <div className="font-sans glass-popover border border-white/40 rounded-2xl w-full max-w-md p-6 space-y-4 text-white">
            <div className="flex justify-between items-center border-b border-white/25 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-white" />
                <h3 className="text-base font-bold text-white">طلب استفسار أسعار (RFQ)</h3>
              </div>
              <button
                onClick={() => setRfqModalSupplier(null)}
                className="text-white/65 hover:text-white bg-white/8 hover:bg-white/15 border border-white/25 p-1.5 rounded-full w-7 h-7 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-white mb-1">المورد المستهدف:</label>
                <input
                  type="text"
                  disabled
                  value={rfqModalSupplier.name}
                  className="w-full bg-white/8 border border-white/25 rounded-xl p-2.5 text-white font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-white mb-1">الكمية المطلوبة للتسعير (وحدة):</label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  value={rfqQuantity}
                  onChange={(e) => setRfqQuantity(Number(e.target.value))}
                  className="w-full bg-white/8 border border-white/25 rounded-xl p-2.5 text-sm font-mono text-white font-bold focus:outline-none focus:ring-2 focus:ring-white/25"
                />
              </div>

              <div className="bg-white/8 p-3.5 rounded-xl border border-white/25 flex justify-between items-center">
                <span className="text-white/80 font-medium">التكلفة التقديرية المبدئية:</span>
                <span className="font-extrabold text-white font-mono text-base">
                  {toEnglishDigits((rfqQuantity * rfqModalSupplier.estimatedUnitCost).toFixed(2))} ر.س
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  showToast(`تم إرسال استفسار التسعير (RFQ) لـ ${toEnglishDigits(rfqQuantity)} وحدة إلى (${rfqModalSupplier.name})`);
                  setRfqModalSupplier(null);
                }}
                className="flex-1 bg-white/20 hover:bg-white/25 text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer "
              >
                إرسال استفسار التسعير الآن ⚡
              </button>
              <button
                type="button"
                onClick={() => setRfqModalSupplier(null)}
                className="px-4 bg-white/8 hover:bg-white/15 text-white/80 border border-white/25 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
