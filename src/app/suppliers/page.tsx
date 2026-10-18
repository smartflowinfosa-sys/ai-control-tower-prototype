"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import GlassSelect from '@/components/common/GlassSelect';
import { useLanguage } from '@/components/common/LanguageContext';
import {
  initialSuppliers,
  initialInventoryItems,
  supplierQuotesMatrix,
  Supplier,
  PurchaseOrder,
  getSessionPurchaseOrders,
  addPurchaseOrderToSession
} from '@/lib/mockInventoryData';
import {
  Clock,
  Mail,
  Loader2,
  CheckCircle2,
  Sparkles,
  Zap,
  ShieldCheck,
  Scale,
  Truck,
  Building2,
  MapPin,
  Phone,
  Layers,
  Tag,
  Package,
  Bot,
  User,
  X,
  FileText,
  BadgeCheck,
  Coins,
  Send,
  ExternalLink,
  ChevronRight,
  Plus,
  Edit2,
  Check
} from 'lucide-react';

// Helper to ensure all digits are English (0-9)
const toEnglishDigits = (str: string | number): string => {
  if (str === null || str === undefined) return '';
  if (typeof str === 'number') {
    return str.toLocaleString('en-US');
  }
  return String(str).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

export default function SuppliersPage() {
  const { lang, t } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [analyzingItemId, setAnalyzingItemId] = useState<string | null>('inv-5'); // Default analyze "أدوات المائدة"
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => getSessionPurchaseOrders());
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // PO Edit State
  const [isEditingPO, setIsEditingPO] = useState<boolean>(false);
  const [editPOQuantity, setEditPOQuantity] = useState<number>(0);
  const [editPOSupplier, setEditPOSupplier] = useState<string>('');

  // Supplier Add / Edit Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    city: 'الرياض',
    rating: 4.8,
    leadTime: '24 ساعة',
    category: 'بلاستيك ومستلزمات مائدة',
    phone: '+966 11 456 7890',
    pricingTier: 'أسعار معتمدة',
  });

  // Sync with global purchase orders event from AI assistant or inventory
  useEffect(() => {
    const handleNewAiPO = (event: CustomEvent<PurchaseOrder>) => {
      if (event.detail) {
        setPurchaseOrders(prev => {
          if (prev.some(p => p.id === event.detail.id)) return prev;
          return [event.detail, ...prev];
        });
      }
    };

    window.addEventListener('ai_purchase_order_created' as any, handleNewAiPO);
    return () => {
      window.removeEventListener('ai_purchase_order_created' as any, handleNewAiPO);
    };
  }, []);

  const lowStockItems = initialInventoryItems.filter(item => item.currentStock <= item.minThreshold);

  const handleAnalyzeQuotes = (itemId: string) => {
    setAnalyzingItemId(itemId);
  };

  const handleQuickOrder = (supplierName: string, itemName: string) => {
    const matchedItem = initialInventoryItems.find(i => i.name === itemName);
    const unitCost = matchedItem ? matchedItem.unitCost : 0.45;
    const quantity = 2500;
    const totalCost = Number((quantity * unitCost).toFixed(2));

    const newPO: PurchaseOrder = {
      id: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
      itemId: matchedItem ? matchedItem.id : 'inv-quick',
      itemName: itemName,
      supplierName: supplierName,
      quantity: quantity,
      totalCost: totalCost,
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      createdBy: 'AI_AGENT',
    };

    addPurchaseOrderToSession(newPO);
    setPurchaseOrders(prev => [newPO, ...prev]);
    showToast(`تم إصدار أمر شراء جديد (${newPO.id}) عبر الـ AI للمورد (${supplierName}) بنجاح!`);
  };

  const handleUpdatePOStatus = (poId: string, nextStatus: PurchaseOrder['status']) => {
    setPurchaseOrders(prev =>
      prev.map(p => (p.id === poId ? { ...p, status: nextStatus } : p))
    );
    const existing = getSessionPurchaseOrders().find(p => p.id === poId);
    if (existing) {
      existing.status = nextStatus;
    }
    if (selectedPO && selectedPO.id === poId) {
      setSelectedPO({ ...selectedPO, status: nextStatus });
    }
    showToast(`تم تحديث حالة أمر الشراء (${poId}) بنجاح`);
  };

  const handleOpenEditPO = () => {
    if (!selectedPO) return;
    setEditPOQuantity(selectedPO.quantity);
    setEditPOSupplier(selectedPO.supplierName);
    setIsEditingPO(true);
  };

  const handleSavePOEdit = () => {
    if (!selectedPO) return;

    const matchedItem = initialInventoryItems.find(i => i.name === selectedPO.itemName);
    const unitCost = matchedItem ? matchedItem.unitCost : 0.5;
    const newTotalCost = Number((editPOQuantity * unitCost).toFixed(2));

    const updatedPO: PurchaseOrder = {
      ...selectedPO,
      quantity: editPOQuantity,
      supplierName: editPOSupplier,
      totalCost: newTotalCost,
    };

    setPurchaseOrders(prev => prev.map(p => p.id === selectedPO.id ? updatedPO : p));
    setSelectedPO(updatedPO);
    setIsEditingPO(false);
    showToast(`تم حفظ تعديلات أمر الشراء (${updatedPO.id}) بنجاح`);
  };

  // Supplier Add & Edit Handlers
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: '',
      city: 'الرياض',
      rating: 4.8,
      leadTime: '24 ساعة',
      category: 'بلاستيك ومستلزمات مائدة',
      phone: '+966 11 456 7890',
      pricingTier: 'أسعار معتمدة',
    });
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupplierForm({
      name: sup.name,
      city: sup.city,
      rating: sup.rating,
      leadTime: sup.leadTime,
      category: sup.category,
      phone: sup.phone,
      pricingTier: sup.pricingTier,
    });
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return;

    if (editingSupplier) {
      // Edit existing supplier
      const updatedSup: Supplier = {
        ...editingSupplier,
        name: supplierForm.name,
        city: supplierForm.city,
        rating: Number(supplierForm.rating) || 4.8,
        leadTime: supplierForm.leadTime,
        category: supplierForm.category,
        phone: supplierForm.phone,
        pricingTier: supplierForm.pricingTier,
        metrics: {
          deliverySpeed: Math.min(99, Math.round((Number(supplierForm.rating) || 4.8) * 19.5)),
          qualityScore: Math.min(100, Math.round((Number(supplierForm.rating) || 4.8) * 20)),
          priceStability: editingSupplier.metrics?.priceStability || 95,
        },
      };
      setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? updatedSup : s));
      showToast(`تم تعديل بيانات المورد (${updatedSup.name}) بنجاح`);
    } else {
      // Add new supplier
      const newSup: Supplier = {
        id: `sup-${Date.now()}`,
        name: supplierForm.name,
        category: supplierForm.category || 'تغليف ومستلزمات',
        city: supplierForm.city || 'الرياض',
        phone: supplierForm.phone || '+966 11 000 0000',
        email: 'info@supplier.sa',
        rating: Number(supplierForm.rating) || 4.8,
        leadTime: supplierForm.leadTime || '24 ساعة',
        reliability: '98%',
        pricingTier: supplierForm.pricingTier || 'أسعار معتمدة',
        activeOrdersCount: 0,
        tags: ['مورد جديد', 'معتمد'],
        metrics: {
          deliverySpeed: Math.min(99, Math.round((Number(supplierForm.rating) || 4.8) * 19.5)),
          qualityScore: Math.min(100, Math.round((Number(supplierForm.rating) || 4.8) * 20)),
          priceStability: 95,
        },
      };
      setSuppliers(prev => [newSup, ...prev]);
      showToast(`تمت إضافة المورد الجديد (${newSup.name}) بنجاح`);
    }

    setIsSupplierModalOpen(false);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const currentQuotes = analyzingItemId ? supplierQuotesMatrix[analyzingItemId] || [] : [];
  const selectedItem = initialInventoryItems.find(i => i.id === analyzingItemId);
  const bestQuote = currentQuotes.length > 0
    ? [...currentQuotes].sort((a, b) => b.aiRecommendationScore - a.aiRecommendationScore)[0]
    : null;

  // Filter purchase orders
  const filteredPOs = purchaseOrders.filter(po => {
    if (activeStatusFilter === 'ALL') return true;
    return po.status === activeStatusFilter;
  });

  // Calculate stats
  const pendingCount = purchaseOrders.filter(p => p.status === 'PENDING_APPROVAL').length;
  const inTransitCount = purchaseOrders.filter(p => p.status === 'IN_TRANSIT').length;
  const sentCount = purchaseOrders.filter(p => p.status === 'SENT').length;
  const deliveredCount = purchaseOrders.filter(p => p.status === 'DELIVERED').length;

  return (
    <div className="page-shell w-full mx-auto space-y-8 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass text-white px-6 py-3.5 rounded-[18px] flex items-center gap-3 border animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-5 h-5 text-white" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="glass page-header rounded-[24px]  mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 rounded-[18px] glass glass-card text-white/65 border">
              <Truck className="w-6 h-6" />
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {t('suppliers.title')}
            </h1>
          </div>
          <p className="text-white/65 text-sm mt-1.5">
            {t('suppliers.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Add Supplier Button */}
          <button
            onClick={handleOpenAddSupplier}
            className="glass glass-card hover:bg-white/15 active:scale-95 text-white font-bold px-5 py-2.5 rounded-[18px] transition-all text-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مورد جديد +</span>
          </button>

          <Link
            href="/inventory"
            className="glass glass-card hover:bg-white/15 text-white font-bold px-4 py-2.5 rounded-[18px] border transition-all text-sm flex items-center gap-2 group cursor-pointer"
          >
            <Package className="w-4 h-4 text-white/65 group-hover:scale-110 transition-transform" />
            <span>العودة للمخزون</span>
            <ChevronRight className="w-4 h-4 text-white/65 rotate-180" />
          </Link>
        </div>
      </header>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass glass-hover rounded-[18px] p-6 flex items-center justify-between transition-all duration-200">
          <div>
            <div className="text-xs font-semibold text-white/65">إجمالي الأوامر (POs)</div>
            <div className="text-3xl font-bold text-white tracking-wider font-mono mt-1">{toEnglishDigits(purchaseOrders.length)}</div>
            <div className="text-[11px] text-white/65 mt-0.5">أمر شراء مسجل</div>
          </div>
          <div className="p-3.5 rounded-[18px] glass glass-card text-white/65 border">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="glass glass-hover rounded-[18px] p-6 flex items-center justify-between transition-all duration-200">
          <div>
            <div className="text-xs font-semibold text-white/65">جاري التوصيل</div>
            <div className="text-3xl font-bold text-white tracking-wider font-mono mt-1">{toEnglishDigits(inTransitCount)}</div>
            <div className="text-[11px] text-white font-medium mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full glass glass-card animate-ping" /> في طريقها للفروع
            </div>
          </div>
          <div className="p-3.5 rounded-[18px] glass glass-card text-white/65 border">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        <div className="glass glass-hover rounded-[18px] p-6 flex items-center justify-between transition-all duration-200">
          <div>
            <div className="text-xs font-semibold text-white/65">بانتظار الموافقة</div>
            <div className="text-3xl font-bold text-white tracking-wider font-mono mt-1">{toEnglishDigits(pendingCount)}</div>
            <div className="text-[11px] text-rose-700/80 mt-0.5">تتطلب اعتماد المشتريات</div>
          </div>
          <div className="p-3.5 rounded-[18px] glass glass-card text-rose-200 border">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
        </div>
      </div>

      {/* 1. Animated Purchase Orders Tracker */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 glass border border-white/40 text-white rounded-[18px]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                لوحة تتبع أوامر الشراء التفاعلية (Animated PO Tracker)
              </h2>
              <p className="text-xs text-white/80">
                متابعة آنية ودقيقة لحالة أوامر الشراء الصادرة من الـ AI والمشتريات
              </p>
            </div>
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="flex items-center gap-1.5 glass border border-white/40 p-1.5 rounded-[18px] overflow-x-auto">
            {[
              { id: 'ALL', label: 'الكل', count: purchaseOrders.length },
              { id: 'PENDING_APPROVAL', label: 'بانتظار الموافقة', count: pendingCount },
              { id: 'SENT', label: 'تم الإرسال', count: sentCount },
              { id: 'IN_TRANSIT', label: 'جاري التوصيل', count: inTransitCount },
              { id: 'DELIVERED', label: 'تم الاستلام', count: deliveredCount },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeStatusFilter === tab.id
                    ? 'glass-active text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/15'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  activeStatusFilter === tab.id ? 'bg-teal-600/15 text-teal-100' : 'bg-white/8 text-white/80 border border-white/50'
                }`}>
                  {toEnglishDigits(tab.count)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* PO Glass Table */}
        <div className="glass rounded-[24px]">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm text-white">
              <thead className="bg-white/8 text-white/80 text-xs font-bold border-b border-white/25">
                <tr>
                  <th className="px-5 py-4">رقم الأمر</th>
                  <th className="px-5 py-4">الصنف المطلوب</th>
                  <th className="px-5 py-4">المورد المعتمد</th>
                  <th className="px-5 py-4">الكمية</th>
                  <th className="px-5 py-4">التكلفة التقديرية</th>
                  <th className="px-5 py-4">المُنشئ</th>
                  <th className="px-5 py-4">توقيت الإنشاء</th>
                  <th className="px-5 py-4">الحالة الحركية</th>
                  <th className="px-5 py-4 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/15">
                {filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-white/65 text-sm">
                      لا توجد أوامر شراء مطابقة لهذا الفلتر حالياً
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => {
                    return (
                      <tr
                        key={po.id}
                        className="hover:bg-white/15 transition-colors group"
                      >
                        {/* ID */}
                        <td className="px-5 py-4 font-mono font-bold text-white">
                          <button
                            onClick={() => {
                              setSelectedPO(po);
                              setIsEditingPO(false);
                            }}
                            className="hover:underline decoration-white/50 flex items-center gap-1 group/btn cursor-pointer"
                            title="عرض تفاصيل أمر الشراء"
                          >
                            <span>{toEnglishDigits(po.id)}</span>
                            <ExternalLink className="w-3 h-3 text-white/65 opacity-70 group-hover/btn:opacity-100 transition-opacity" />
                          </button>
                        </td>

                        {/* Item Name */}
                        <td className="px-5 py-4 font-bold text-white">
                          {po.itemName}
                        </td>

                        {/* Supplier Name */}
                        <td className="px-5 py-4 text-white/80 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-white/65 shrink-0" />
                            <span>{po.supplierName}</span>
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="px-5 py-4 font-bold text-white font-mono">
                          {toEnglishDigits(po.quantity.toLocaleString('en-US'))}
                        </td>

                        {/* Total Cost */}
                        <td className="px-5 py-4 font-bold text-white font-mono">
                          {toEnglishDigits(po.totalCost.toLocaleString('en-US'))} ر.س
                        </td>

                        {/* Created By */}
                        <td className="px-5 py-4">
                          {po.createdBy === 'AI_AGENT' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[18px] text-xs font-bold bg-teal-600/15 border border-teal-300/30 text-teal-100">
                              <Bot className="w-3.5 h-3.5 text-white" />
                              <span>وكيل الذكاء الاصطناعي</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[18px] text-xs font-medium bg-white/8 border border-white/40 text-white/80">
                              <User className="w-3.5 h-3.5 text-white/65" />
                              <span>مسؤول المشتريات</span>
                            </span>
                          )}
                        </td>

                        {/* Created At */}
                        <td className="px-5 py-4 text-xs text-white/80 font-medium font-mono">
                          {toEnglishDigits(po.createdAt)}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          {po.status === 'PENDING_APPROVAL' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 border border-rose-400/30 text-rose-200">
                              <Clock className="w-3.5 h-3.5 text-rose-200 animate-pulse" />
                              <span>بانتظار الموافقة</span>
                            </span>
                          )}

                          {po.status === 'SENT' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-600/15 border border-teal-300/30 text-teal-100">
                              <motion.div
                                animate={{ y: [0, -3, 0] }}
                                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                              >
                                <Mail className="w-3.5 h-3.5 text-white" />
                              </motion.div>
                              <span>تم إرسال الإيميل</span>
                            </span>
                          )}

                          {po.status === 'IN_TRANSIT' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-200">
                              <Loader2 className="w-3.5 h-3.5 text-amber-200 animate-spin" />
                              <span>جاري التوصيل</span>
                            </span>
                          )}

                          {po.status === 'DELIVERED' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                              <span>تم الاستلام</span>
                            </span>
                          )}

                          {po.status === 'APPROVED' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-600/15 border border-teal-300/30 text-teal-100">
                              <BadgeCheck className="w-3.5 h-3.5 text-white" />
                              <span>معتمد</span>
                            </span>
                          )}
                        </td>

                        {/* Action Quick Button */}
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedPO(po);
                              setIsEditingPO(false);
                            }}
                            className="text-xs font-bold text-white bg-white/8 hover:bg-white/15 border border-white/40 px-3 py-1.5 rounded-[18px] transition-all cursor-pointer"
                          >
                            التفاصيل
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 2. Smart Bidding Comparison */}
      <section className="glass p-6 space-y-6">
        <div className="border-b border-white/25 pb-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-[18px] bg-white/8 border border-white/40 text-white">
                  <Bot className="w-5 h-5" />
                </span>
                <h2 className="text-xl font-bold text-white">
                  شاشة المفاضلة الذكية (Smart Bidding Comparison)
                </h2>
                <span className="bg-teal-600/15 border border-teal-300/30 text-teal-100 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  AI Procurement
                </span>
              </div>
              <p className="text-xs text-white/80 mt-1">
                مقارنة أسعار الموردين جنباً إلى جنب (مورد سريع vs مورد جملة) وتوصيات الوكيل الذكي
              </p>
            </div>

            <div className="text-xs font-semibold text-white bg-white/8 border border-white/40 px-3.5 py-1.5 rounded-[18px] self-start sm:self-auto flex items-center gap-2">
              <span>أصناف تتطلب إعادة توريد:</span>
              <span className="font-extrabold text-teal-100 bg-teal-600/15 border border-teal-300/30 px-2 py-0.5 rounded-md">
                {toEnglishDigits(lowStockItems.length)}
              </span>
            </div>
          </div>

          {/* Sub-navigation Pills */}
          <div className="flex flex-row items-center gap-2.5 overflow-x-auto pb-1 pt-1 bg-white/8 border border-white/40 p-2 rounded-[18px]">
            <span className="text-xs font-bold text-white/80 shrink-0 px-2 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-white" />
              <span>اختر صنفاً للمقارنة:</span>
            </span>
            {lowStockItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleAnalyzeQuotes(item.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  analyzingItemId === item.id
                    ? 'bg-teal-600/15 border border-teal-300/30 text-teal-100 scale-[1.02]'
                    : 'bg-white/8 border border-white/40 text-white/80 hover:text-white hover:bg-white/15'
                }`}
              >
                <span>{item.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors ${
                  analyzingItemId === item.id ? 'bg-teal-600/15 text-teal-100' : 'bg-white/8 text-white/80 border border-white/50'
                }`}>
                  مفاضلة الأسعار
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Item Bidding Matrix */}
        {selectedItem && (
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                <span className="text-white/80">عروض الأسعار المتاحة لصنف:</span>
                <span className="text-teal-100 font-extrabold text-base bg-teal-600/15 border border-teal-300/30 px-3 py-1 rounded-[18px]">
                  {selectedItem.name}
                </span>
                <span className="text-xs text-white/80 font-semibold bg-white/8 border border-white/40 px-2.5 py-1 rounded-[18px] font-mono">
                  المخزون الحالي: {toEnglishDigits(selectedItem.currentStock)} / الحد الأدنى: {toEnglishDigits(selectedItem.minThreshold)}
                </span>
              </div>

              {bestQuote && (
                <div className="bg-teal-600/15 border border-teal-300/30 text-teal-100 px-3.5 py-1.5 rounded-[18px] text-xs font-bold flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </motion.div>
                  <span>التوصية الذكية المعتمدة:</span>
                  <span className="font-extrabold text-white">{bestQuote.supplierName}</span>
                  <span className="text-[10px] bg-white/8 border border-white/50 px-1.5 py-0.5 rounded text-white/80 font-semibold">
                    مطابقة {toEnglishDigits(bestQuote.aiRecommendationScore)}%
                  </span>
                </div>
              )}
            </div>

            {currentQuotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-3">
                {currentQuotes.map((quote) => {
                  const isBest = quote.supplierId === bestQuote?.supplierId;

                  return (
                    <div
                      key={quote.supplierId}
                      className={`glass border border-white/40 rounded-2xl p-6 transition-all flex flex-col justify-between relative ${
                        isBest
                          ? 'ring-2 ring-white/25 '
                          : ''
                      }`}
                    >
                      {/* Floating Badge for Best AI Choice */}
                      {isBest && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-teal-600/15 border border-teal-300/30 text-teal-100 text-xs font-bold px-3.5 py-1 rounded-full flex items-center gap-1.5 z-10 whitespace-nowrap ">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                          >
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                          </motion.div>
                          <span>توصية الـ AI Agent</span>
                        </div>
                      )}

                      <div className="space-y-3 pt-1">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-white text-base flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-white shrink-0" />
                              <span>{quote.supplierName}</span>
                            </h4>
                            <span className="text-[11px] text-white/80">
                              {quote.leadTimeHours <= 18 ? 'مورد سريع (توريد فوري)' : quote.leadTimeHours <= 24 ? 'مورد معتمد (مباشر)' : 'مورد جملة (كميات كبيرة)'}
                            </span>
                          </div>
                        </div>

                        {/* Specs Card */}
                        <div className="bg-white/8 border border-white/40 p-4 rounded-[18px] space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-white/80">سعر الوحدة:</span>
                            <span className="font-extrabold text-white text-lg font-mono">
                              {toEnglishDigits(quote.unitPrice)} ر.س
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-white/80 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-white/65" />
                              <span>مدة التوصيل:</span>
                            </span>
                            <span className="font-bold text-white font-mono">
                              {toEnglishDigits(quote.leadTimeHours)} ساعة
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-white/80 flex items-center gap-1">
                              <Package className="w-3 h-3 text-white/65" />
                              <span>الحد الأدنى للطلب:</span>
                            </span>
                            <span className="font-bold text-white font-mono">
                              {toEnglishDigits(quote.minOrderQuantity.toLocaleString('en-US'))} وحدة
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-white/80 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-white/65" />
                              <span>مؤشر الجودة:</span>
                            </span>
                            <span className="font-bold text-white font-mono">
                              {toEnglishDigits(quote.qualityRating)} من 5
                            </span>
                          </div>
                        </div>

                        {/* AI Reasoning */}
                        <div className="text-xs text-white/80 leading-relaxed bg-white/8 border border-white/40 p-3.5 rounded-[18px]">
                          <strong className="text-white flex items-center gap-1 text-[11px] mb-1 font-bold">
                            <Bot className="w-3.5 h-3.5 text-white" />
                            <span>تحليل الوكيل الذكي:</span>
                          </strong>
                          {quote.aiReasoning}
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => handleQuickOrder(quote.supplierName, selectedItem.name)}
                        className={`w-full py-2.5 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer mt-4 ${
                          isBest
                            ? 'bg-white/20 hover:bg-white/25 active:scale-95 text-white '
                            : 'bg-white/8 hover:bg-white/15 text-white border border-white/40'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>اعتماد وإصدار أمر شراء</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-white/65 text-sm bg-white/8 border border-white/40 rounded-[18px]">
                لا توجد عروض أسعار مسجلة لهذا الصنف حالياً
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Supplier Scorecards */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 glass border border-white/40 text-white rounded-[18px]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                بطاقات تقييم الموردين (Supplier Scorecard)
              </h2>
              <p className="text-xs text-white/80">
                تقييم حي ومتحرك للموردين المعتمدين وفق سرعة التوصيل وجودة البضاعة واستقرار السعر
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold text-white bg-white/8 border border-white/40 px-3.5 py-1.5 rounded-[18px]">
            {toEnglishDigits(suppliers.length)} موردين مسجلين
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {suppliers.map((sup, idx) => {
            const metrics = sup.metrics || {
              deliverySpeed: 95,
              qualityScore: 98,
              priceStability: 96,
            };

            return (
              <div
                key={sup.id}
                className="glass border border-white/40 rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 group relative"
              >
                <div className="space-y-4">
                  {/* Supplier Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-extrabold text-base text-white flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-white" />
                        <span>{sup.name}</span>
                      </h3>
                      <p className="text-xs text-white/80 mt-0.5">{sup.category}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Edit Supplier Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditSupplier(sup)}
                        className="p-1.5 rounded-[18px] bg-white/8 hover:bg-white/15 border border-white/40 text-white/80 transition-colors cursor-pointer"
                        title="تعديل بيانات المورد"
                      >
                        <Edit2 size={14} className="text-white/80" />
                      </button>

                      <span className="text-xs font-bold text-teal-100 bg-teal-600/15 border border-teal-300/30 px-2.5 py-1 rounded-[18px] flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-white" />
                        <span>{toEnglishDigits(sup.rating)} / 5</span>
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Animated Progress Bars */}
                  <div className="bg-white/8 border border-white/40 p-4 rounded-[18px] space-y-3">
                    <div className="text-xs font-bold text-white flex items-center justify-between border-b border-white/25 pb-2">
                      <span>مؤشرات أداء التوريد (KPIs)</span>
                      <span className="text-[10px] text-white/65 font-semibold">تحديث مستمر</span>
                    </div>

                    {/* 1. Delivery Speed */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/80 flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-white" />
                          <span>سرعة التوصيل</span>
                        </span>
                        <span className="font-extrabold text-white font-mono">{toEnglishDigits(metrics.deliverySpeed)}%</span>
                      </div>
                      <div className="w-full bg-white/8 border border-white/40 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${metrics.deliverySpeed}%` }}
                          transition={{ duration: 0.9, ease: 'easeOut', delay: idx * 0.1 }}
                          className="h-full bg-teal-500/60 rounded-full"
                        />
                      </div>
                    </div>

                    {/* 2. Product Quality */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/80 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-white" />
                          <span>جودة البضاعة</span>
                        </span>
                        <span className="font-extrabold text-white font-mono">{toEnglishDigits(metrics.qualityScore)}%</span>
                      </div>
                      <div className="w-full bg-white/8 border border-white/40 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${metrics.qualityScore}%` }}
                          transition={{ duration: 0.9, ease: 'easeOut', delay: idx * 0.1 + 0.1 }}
                          className="h-full bg-emerald-500/60 rounded-full"
                        />
                      </div>
                    </div>

                    {/* 3. Price Stability */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/80 flex items-center gap-1">
                          <Scale className="w-3.5 h-3.5 text-white" />
                          <span>استقرار السعر</span>
                        </span>
                        <span className="font-extrabold text-white font-mono">{toEnglishDigits(metrics.priceStability)}%</span>
                      </div>
                      <div className="w-full bg-white/8 border border-white/40 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${metrics.priceStability}%` }}
                          transition={{ duration: 0.9, ease: 'easeOut', delay: idx * 0.1 + 0.2 }}
                          className="h-full bg-amber-500/60 rounded-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Supplier Info Details */}
                  <div className="bg-white/8 border border-white/40 p-3.5 rounded-[18px] space-y-2 text-xs text-white/80">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-white" />
                        <span>الموقع الجغرافي:</span>
                      </span>
                      <strong className="text-white">{sup.city}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-white" />
                        <span>زمن التوريد المعتاد:</span>
                      </span>
                      <strong className="text-white font-mono">{toEnglishDigits(sup.leadTime)}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-white" />
                        <span>التصنيف المالي:</span>
                      </span>
                      <strong className="text-white">{sup.pricingTier}</strong>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {sup.tags.map(t => (
                      <span
                        key={t}
                        className="text-[10px] bg-white/8 border border-white/40 text-white/80 px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1"
                      >
                        <Tag className="w-2.5 h-2.5 text-white" />
                        <span>{t}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-4 mt-4 border-t border-white/25 flex justify-between items-center text-xs">
                  <span className="text-white/80 flex items-center gap-1 font-mono">
                    <Phone className="w-3 h-3 text-white" />
                    <span>{toEnglishDigits(sup.phone)}</span>
                  </span>
                  <span className="text-teal-100 font-bold bg-teal-600/15 border border-teal-300/30 px-2.5 py-0.5 rounded-lg font-mono">
                    {toEnglishDigits(sup.activeOrdersCount)} طلبات جارية
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal: View & Edit Purchase Order Details (PO Modal) */}
      {selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/[0.06] animate-in fade-in">
          <div className="font-sans glass-popover rounded-[24px] w-full max-w-lg p-6 space-y-5 text-white border relative">
            
            {/* Edit Button in Header (Far Left) */}
            <button
              type="button"
              onClick={isEditingPO ? () => setIsEditingPO(false) : handleOpenEditPO}
              className="absolute left-6 top-6 flex items-center gap-1.5 px-3 py-1.5 rounded-[18px] glass glass-card hover:bg-white/15 text-white border text-xs font-bold transition-all cursor-pointer z-10"
              title="تعديل تفاصيل أمر الشراء"
            >
              <Edit2 size={16} className="text-white/65" />
              <span>{isEditingPO ? 'إلغاء' : 'تعديل'}</span>
            </button>

            {/* Header */}
            <div className="flex justify-between items-start border-b border-white/14 pb-3 pl-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[18px] glass glass-card border flex items-center justify-center text-white/65">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    تفاصيل أمر الشراء ({toEnglishDigits(selectedPO.id)})
                  </h3>
                  <p className="text-xs text-white/65 mt-0.5">
                    سجل التوريد الرسمي لدى شبكة الموردين
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedPO(null);
                  setIsEditingPO(false);
                }}
                className="text-white/65 hover:text-white glass glass-card hover:bg-white/15 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-colors border"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Edit Mode Form */}
            {isEditingPO ? (
              <div className="glass glass-card rounded-[18px] p-4 border space-y-3.5 text-sm">
                <div className="text-center font-bold text-white border-b border-white/14 pb-2">
                  تعديل بيانات أمر الشراء
                </div>

                <div className="space-y-1 text-center">
                  <label className="text-xs font-bold text-white">المورد المعتمد:</label>
                  <GlassSelect
                    value={editPOSupplier}
                    onChange={(e) => setEditPOSupplier(e.target.value)}
                    className="w-full glass glass-card border rounded-[18px] p-2.5 text-sm text-white focus:outline-none focus:text-center"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.name}>{s.name} ({s.city})</option>
                    ))}
                  </GlassSelect>
                </div>

                <div className="space-y-1 text-center">
                  <label className="text-xs font-bold text-white">الكمية المطلوبة (وحدة):</label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={editPOQuantity}
                    onChange={(e) => setEditPOQuantity(Number(e.target.value))}
                    className="w-full glass glass-card border rounded-[18px] p-2.5 text-sm text-white focus:outline-none focus:text-center font-mono"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSavePOEdit}
                    className="flex-1 glass glass-card hover:bg-white/15 text-white font-bold py-2.5 rounded-[18px] transition-all text-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>حفظ التعديل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingPO(false)}
                    className="px-4 glass glass-card hover:bg-white/15 text-white border font-bold py-2.5 rounded-[18px] transition-all text-xs cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              /* Centered Details View */
              <div className="glass glass-card rounded-[18px] p-4 border divide-y divide-white/20 text-sm">
                
                {/* 1. PO Number */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">رقم أمر الشراء</span>
                  <span className="font-extrabold text-white font-mono text-base glass glass-active px-3 py-0.5 rounded-lg border mt-0.5">
                    {toEnglishDigits(selectedPO.id)}
                  </span>
                </div>

                {/* 2. Item Name */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">الصنف المطلوب</span>
                  <span className="font-bold text-white text-base mt-0.5">
                    {selectedPO.itemName}
                  </span>
                </div>

                {/* 3. Supplier Name */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">المورد المعتمد</span>
                  <span className="font-semibold text-white text-sm flex items-center justify-center gap-1.5 mt-0.5">
                    <Building2 className="w-4 h-4 text-white/65" />
                    <span>{selectedPO.supplierName}</span>
                  </span>
                </div>

                {/* 4. Quantity */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">الكمية المطلوبة</span>
                  <span className="font-bold text-white text-base font-mono mt-0.5">
                    {toEnglishDigits(selectedPO.quantity.toLocaleString('en-US'))} وحدة
                  </span>
                </div>

                {/* 5. Total Cost */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">التكلفة التقديرية الإجمالية</span>
                  <span className="font-extrabold text-white text-lg font-mono mt-0.5">
                    {toEnglishDigits(selectedPO.totalCost.toLocaleString('en-US'))} ر.س
                  </span>
                </div>

                {/* 6. Creation Time */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">توقيت الإنشاء</span>
                  <span className="text-white text-xs font-medium font-mono mt-0.5">
                    {toEnglishDigits(selectedPO.createdAt)}
                  </span>
                </div>

                {/* 7. Creator */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">جهة الإصدار</span>
                  <span className="text-xs font-bold text-white glass px-3 py-1 rounded-md border flex items-center justify-center gap-1.5 mt-1">
                    {selectedPO.createdBy === 'AI_AGENT' ? (
                      <>
                        <Bot className="w-3.5 h-3.5 text-white/65" />
                        <span>وكيل الذكاء الاصطناعي (AI Agent)</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3.5 h-3.5 text-white/65" />
                        <span>مسؤول المشتريات</span>
                      </>
                    )}
                  </span>
                </div>

                {/* 8. Status */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">الحالة الحالية</span>
                  <span className="text-xs font-bold px-3 py-1 rounded-full border glass glass-active text-white mt-1">
                    {selectedPO.status === 'PENDING_APPROVAL' && 'بانتظار الموافقة'}
                    {selectedPO.status === 'SENT' && 'تم إرسال الإيميل للمورد'}
                    {selectedPO.status === 'IN_TRANSIT' && 'جاري التوصيل الآن'}
                    {selectedPO.status === 'DELIVERED' && 'تم الاستلام بنجاح'}
                    {selectedPO.status === 'APPROVED' && 'معتمد'}
                  </span>
                </div>
              </div>
            )}

            {/* Status Flow Buttons */}
            <div className="space-y-2 pt-1">
              {selectedPO.status === 'PENDING_APPROVAL' && (
                <button
                  onClick={() => handleUpdatePOStatus(selectedPO.id, 'SENT')}
                  className="w-full py-3 px-6 rounded-[18px] font-bold glass glass-card hover:bg-white/15 text-white transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>تأكيد وإرسال الإيميل للمورد</span>
                </button>
              )}

              {selectedPO.status === 'SENT' && (
                <button
                  onClick={() => handleUpdatePOStatus(selectedPO.id, 'IN_TRANSIT')}
                  className="w-full py-3 px-6 rounded-[18px] font-bold glass glass-card hover:bg-white/15 text-white transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>تحديث إلى: جاري التوصيل (In Transit)</span>
                </button>
              )}

              {selectedPO.status === 'IN_TRANSIT' && (
                <button
                  onClick={() => handleUpdatePOStatus(selectedPO.id, 'DELIVERED')}
                  className="w-full py-3 px-6 rounded-[18px] font-bold glass glass-card hover:bg-white/15 text-white transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد استلام الشحنة وإضافتها للمخزون</span>
                </button>
              )}

              <button
                onClick={() => {
                  setSelectedPO(null);
                  setIsEditingPO(false);
                }}
                className="w-full glass glass-card hover:bg-white/15 text-white border font-bold py-2.5 rounded-[18px] transition-all text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Supplier (Supplier Form Modal) */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/[0.06] animate-in fade-in">
          <div className="font-sans glass-popover rounded-[24px] w-full max-w-md p-6 space-y-4 text-white border relative">
            <div className="flex justify-between items-center border-b border-white/14 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[18px] glass glass-card border flex items-center justify-center text-white/65">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
                </h3>
              </div>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-white/65 hover:text-white glass glass-card hover:bg-white/15 border p-1.5 rounded-full w-7 h-7 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-white mb-1">اسم المورد:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مصنع التغليف الحديث"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full glass glass-card border rounded-[18px] px-3 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none focus:"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-white mb-1">الموقع (المدينة):</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: الرياض"
                    value={supplierForm.city}
                    onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                    className="w-full glass glass-card border rounded-[18px] px-3 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none focus:"
                  />
                </div>

                <div>
                  <label className="block font-bold text-white mb-1">التقييم المبدئي (من 5):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    required
                    value={supplierForm.rating}
                    onChange={(e) => setSupplierForm({ ...supplierForm, rating: Number(e.target.value) })}
                    className="w-full glass glass-card border rounded-[18px] px-3 py-2 text-sm text-white focus:outline-none focus:font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-white mb-1">زمن التوريد المعتاد:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 24 ساعة"
                    value={supplierForm.leadTime}
                    onChange={(e) => setSupplierForm({ ...supplierForm, leadTime: e.target.value })}
                    className="w-full glass glass-card border rounded-[18px] px-3 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none focus:"
                  />
                </div>

                <div>
                  <label className="block font-bold text-white mb-1">رقم الهاتف:</label>
                  <input
                    type="text"
                    placeholder="+966 11 000 0000"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full glass glass-card border rounded-[18px] px-3 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none focus:font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-white mb-1">فئة التوريد:</label>
                <input
                  type="text"
                  placeholder="مثال: كرتون وورقيات"
                  value={supplierForm.category}
                  onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
                  className="w-full glass glass-card border rounded-[18px] px-3 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none focus:"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 glass glass-card hover:bg-white/15 active:scale-95 text-white font-bold py-2.5 rounded-[18px] transition-all text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 glass glass-card hover:bg-white/15 text-white border font-bold py-2.5 rounded-[18px] transition-all text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
