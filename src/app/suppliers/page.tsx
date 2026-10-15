"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
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
    const item = initialInventoryItems.find(i => i.name === itemName);
    const quantity = item ? item.minThreshold * 2 : 1000;
    const unitCost = item ? item.unitCost : 0.48;
    const newPO: PurchaseOrder = {
      id: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
      itemId: item ? item.id : 'inv-5',
      itemName: itemName,
      supplierName: supplierName,
      quantity: quantity,
      totalCost: Number((quantity * unitCost).toFixed(2)),
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      createdBy: 'AI_AGENT',
    };

    addPurchaseOrderToSession(newPO);
    setPurchaseOrders(prev => [newPO, ...prev]);
    showToast(`تم إصدار أمر الشراء ${toEnglishDigits(newPO.id)} لـ (${itemName}) من (${supplierName}) بنجاح`);
  };

  const handleUpdatePOStatus = (poId: string, nextStatus: PurchaseOrder['status']) => {
    setPurchaseOrders(prev =>
      prev.map(p => (p.id === poId ? { ...p, status: nextStatus } : p))
    );
    const sessionList = getSessionPurchaseOrders();
    const target = sessionList.find(p => p.id === poId);
    if (target) {
      target.status = nextStatus;
    }
    if (selectedPO && selectedPO.id === poId) {
      setSelectedPO({ ...selectedPO, status: nextStatus });
    }
    showToast(`تم تحديث حالة أمر الشراء ${toEnglishDigits(poId)} بنجاح`);
  };

  const handleOpenEditPO = () => {
    if (!selectedPO) return;
    setEditPOQuantity(selectedPO.quantity);
    setEditPOSupplier(selectedPO.supplierName);
    setIsEditingPO(true);
  };

  const handleSavePOEdit = () => {
    if (!selectedPO) return;
    const item = initialInventoryItems.find(i => i.name === selectedPO.itemName || i.id === selectedPO.itemId);
    const unitCost = item ? item.unitCost : selectedPO.totalCost / selectedPO.quantity;
    const updatedTotalCost = Number((editPOQuantity * unitCost).toFixed(2));

    const updatedPO: PurchaseOrder = {
      ...selectedPO,
      quantity: editPOQuantity,
      supplierName: editPOSupplier,
      totalCost: updatedTotalCost,
    };

    setPurchaseOrders(prev => prev.map(p => (p.id === selectedPO.id ? updatedPO : p)));
    const sessionList = getSessionPurchaseOrders();
    const targetIdx = sessionList.findIndex(p => p.id === selectedPO.id);
    if (targetIdx !== -1) {
      sessionList[targetIdx] = updatedPO;
    }

    setSelectedPO(updatedPO);
    setIsEditingPO(false);
    showToast(`تم حفظ تعديلات أمر الشراء ${toEnglishDigits(selectedPO.id)} بنجاح`);
  };

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
      setSuppliers(prev =>
        prev.map(s =>
          s.id === editingSupplier.id
            ? {
                ...s,
                name: supplierForm.name,
                city: supplierForm.city,
                rating: Number(supplierForm.rating) || s.rating,
                leadTime: supplierForm.leadTime,
                category: supplierForm.category,
                phone: supplierForm.phone,
                pricingTier: supplierForm.pricingTier,
              }
            : s
        )
      );
      showToast(`تم تحديث بيانات المورد (${supplierForm.name}) بنجاح`);
    } else {
      const newSup: Supplier = {
        id: `sup-${Date.now()}`,
        name: supplierForm.name,
        category: supplierForm.category || 'توريد ومستلزمات عامة',
        city: supplierForm.city || 'الرياض',
        phone: supplierForm.phone || '+966 11 000 0000',
        email: 'sales@supplier.sa',
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
    <div className="max-w-6xl w-full mx-auto space-y-8 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-teal-600/95 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border border-teal-400/50 animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-5 h-5 text-teal-200" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20">
              <Truck className="w-6 h-6" />
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
              إدارة الموردين والمشتريات الذكية
            </h1>
          </div>
          <p className="text-slate-500 text-sm mt-1.5">
            لوحة تتبع أوامر الشراء التفاعلية، بطاقات تقييم الموردين، والمفاضلة الذكية بعروض الأسعار
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Add Supplier Button */}
          <button
            onClick={handleOpenAddSupplier}
            className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 active:scale-95 text-white font-bold px-4 py-2.5 rounded-xl shadow-md shadow-teal-600/25 transition-all text-sm flex items-center gap-2 cursor-pointer border border-teal-500/30"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مورد جديد +</span>
          </button>

          <Link
            href="/inventory"
            className="bg-white/60 hover:bg-white text-teal-700 font-bold px-4 py-2.5 rounded-xl border border-white/60 shadow-sm transition-all text-sm flex items-center gap-2 group"
          >
            <Package className="w-4 h-4 text-teal-600 group-hover:scale-110 transition-transform" />
            <span>العودة للمخزون</span>
            <ChevronRight className="w-4 h-4 text-teal-500 rotate-180" />
          </Link>
        </div>
      </header>

      {/* KPI Stats Strip (3 Cards Only - Removed Approved Suppliers Card) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-sm rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">إجمالي الأوامر (POs)</div>
            <div className="text-2xl font-bold text-teal-700 mt-1">{toEnglishDigits(purchaseOrders.length)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">أمر شراء مسجل</div>
          </div>
          <div className="p-3 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-sm rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">جاري التوصيل</div>
            <div className="text-2xl font-bold text-teal-600 mt-1">{toEnglishDigits(inTransitCount)}</div>
            <div className="text-[11px] text-teal-600 font-medium mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" /> في طريقها للفروع
            </div>
          </div>
          <div className="p-3 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-sm rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">بانتظار الموافقة</div>
            <div className="text-2xl font-bold text-slate-700 mt-1">{toEnglishDigits(pendingCount)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">تتطلب اعتماد المشتريات</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-100 text-slate-500 border border-slate-200">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
        </div>
      </div>

      {/* 1. Animated Purchase Orders Tracker (لوحة تتبع أوامر الشراء التفاعلية) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-500/10 text-teal-600 border border-teal-500/20 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                لوحة تتبع أوامر الشراء التفاعلية (Animated PO Tracker)
              </h2>
              <p className="text-xs text-slate-500">
                متابعة آنية ودقيقة لحالة أوامر الشراء الصادرة من الـ AI والمشتريات
              </p>
            </div>
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-white/40 backdrop-blur-md p-1 rounded-xl border border-white/60 overflow-x-auto">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeStatusFilter === tab.id
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  activeStatusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-600'
                }`}>
                  {toEnglishDigits(tab.count)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* PO Glass Table */}
        <div className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-sm rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm text-slate-700">
              <thead className="bg-white/40 text-slate-600 text-xs font-bold border-b border-white/60">
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
              <tbody className="divide-y divide-white/40">
                {filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-500 text-sm">
                      لا توجد أوامر شراء مطابقة لهذا الفلتر حالياً
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => {
                    return (
                      <tr
                        key={po.id}
                        className="hover:bg-white/50 transition-colors group"
                      >
                        {/* ID */}
                        <td className="px-5 py-4 font-mono font-bold text-teal-700">
                          <button
                            onClick={() => {
                              setSelectedPO(po);
                              setIsEditingPO(false);
                            }}
                            className="hover:underline flex items-center gap-1 group/btn cursor-pointer"
                            title="عرض تفاصيل أمر الشراء"
                          >
                            <span>{toEnglishDigits(po.id)}</span>
                            <ExternalLink className="w-3 h-3 opacity-50 group-hover/btn:opacity-100 transition-opacity" />
                          </button>
                        </td>

                        {/* Item Name */}
                        <td className="px-5 py-4 font-bold text-slate-800">
                          {po.itemName}
                        </td>

                        {/* Supplier Name */}
                        <td className="px-5 py-4 text-slate-600 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>{po.supplierName}</span>
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="px-5 py-4 font-bold text-slate-800">
                          {toEnglishDigits(po.quantity.toLocaleString('en-US'))}
                        </td>

                        {/* Total Cost */}
                        <td className="px-5 py-4 font-bold text-teal-700">
                          {toEnglishDigits(po.totalCost.toLocaleString('en-US'))} ر.س
                        </td>

                        {/* Created By */}
                        <td className="px-5 py-4">
                          {po.createdBy === 'AI_AGENT' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200/60 shadow-xs">
                              <Bot className="w-3.5 h-3.5 text-teal-600" />
                              <span>وكيل الذكاء الاصطناعي</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/60 shadow-xs">
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              <span>مسؤول المشتريات</span>
                            </span>
                          )}
                        </td>

                        {/* Created At */}
                        <td className="px-5 py-4 text-xs text-slate-500 font-medium">
                          {toEnglishDigits(po.createdAt)}
                        </td>

                        {/* Status (Animated Icons - NO EMOJIS) */}
                        <td className="px-5 py-4">
                          {po.status === 'PENDING_APPROVAL' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100/90 border border-slate-200 text-slate-700 shadow-xs">
                              <Clock className="w-3.5 h-3.5 text-slate-500 animate-pulse" />
                              <span>بانتظار الموافقة</span>
                            </span>
                          )}

                          {po.status === 'SENT' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 border border-sky-200/80 text-sky-700 shadow-xs">
                              <motion.div
                                animate={{ y: [0, -3, 0] }}
                                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                              >
                                <Mail className="w-3.5 h-3.5 text-sky-500" />
                              </motion.div>
                              <span>تم إرسال الإيميل</span>
                            </span>
                          )}

                          {po.status === 'IN_TRANSIT' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 border border-teal-200/80 text-teal-700 shadow-xs">
                              <Loader2 className="w-3.5 h-3.5 text-teal-500 animate-spin" />
                              <span>جاري التوصيل</span>
                            </span>
                          )}

                          {po.status === 'DELIVERED' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-100/80 border border-teal-300 text-teal-800 shadow-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                              <span>تم الاستلام</span>
                            </span>
                          )}

                          {po.status === 'APPROVED' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 border border-teal-200 text-teal-700 shadow-xs">
                              <BadgeCheck className="w-3.5 h-3.5 text-teal-600" />
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
                            className="text-xs font-bold text-teal-700 bg-white/70 hover:bg-white border border-teal-200/60 px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
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

      {/* 2. Smart Bidding Comparison (شاشة المفاضلة الذكية) */}
      <section className="bg-white/50 backdrop-blur-xl border border-teal-300/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-6 space-y-6">
        <div className="border-b border-teal-100/60 pb-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20">
                  <Bot className="w-5 h-5" />
                </span>
                <h2 className="text-xl font-bold text-slate-800">
                  شاشة المفاضلة الذكية (Smart Bidding Comparison)
                </h2>
                <span className="bg-teal-100 text-teal-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  AI Procurement
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                مقارنة أسعار الموردين جنباً إلى جنب (مورد سريع vs مورد جملة) وتوصيات الوكيل الذكي
              </p>
            </div>

            <div className="text-xs font-semibold text-teal-700 bg-teal-50/80 px-3.5 py-1.5 rounded-xl border border-teal-200/50 self-start sm:self-auto flex items-center gap-1.5">
              <span>أصناف تتطلب إعادة توريد:</span>
              <span className="font-extrabold text-teal-900 bg-white/80 px-2 py-0.5 rounded-md border border-teal-100">
                {toEnglishDigits(lowStockItems.length)}
              </span>
            </div>
          </div>

          {/* Sub-navigation Pills */}
          <div className="flex flex-row items-center gap-2.5 overflow-x-auto pb-1 pt-1 bg-white/40 backdrop-blur-md p-2 rounded-2xl border border-teal-100/60 shadow-inner">
            <span className="text-xs font-bold text-slate-500 shrink-0 px-2 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-teal-600" />
              <span>اختر صنفاً للمقارنة:</span>
            </span>
            {lowStockItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleAnalyzeQuotes(item.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-xs ${
                  analyzingItemId === item.id
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30 ring-2 ring-teal-400/50 scale-[1.02]'
                    : 'bg-white/80 text-slate-700 border border-white hover:bg-white hover:border-teal-200 hover:text-teal-700'
                }`}
              >
                <span>{item.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors ${
                  analyzingItemId === item.id ? 'bg-white/20 text-white' : 'bg-teal-50 text-teal-700 border border-teal-100'
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
              <div className="text-sm font-bold text-slate-700 flex items-center gap-2 flex-wrap">
                <span className="text-slate-500">عروض الأسعار المتاحة لصنف:</span>
                <span className="text-teal-800 font-extrabold text-base bg-teal-50 px-3 py-1 rounded-lg border border-teal-200/60">
                  {selectedItem.name}
                </span>
                <span className="text-xs text-slate-500 font-semibold bg-white/60 px-2 py-1 rounded-lg border border-white/80">
                  المخزون الحالي: {toEnglishDigits(selectedItem.currentStock)} / الحد الأدنى: {toEnglishDigits(selectedItem.minThreshold)}
                </span>
              </div>

              {bestQuote && (
                <div className="bg-teal-50 text-teal-800 border border-teal-200 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  </motion.div>
                  <span>التوصية الذكية المعتمدة:</span>
                  <span className="font-extrabold">{bestQuote.supplierName}</span>
                  <span className="text-[10px] bg-teal-200/60 px-1.5 py-0.5 rounded text-teal-900 font-semibold">
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
                      className={`rounded-2xl p-5 border transition-all flex flex-col justify-between relative ${
                        isBest
                          ? 'bg-white/70 border-teal-400 ring-2 ring-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.15)]'
                          : 'bg-white/40 border-white/60 hover:bg-white/60 shadow-sm'
                      }`}
                    >
                      {/* Floating Badge for Best AI Choice */}
                      {isBest && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-teal-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md backdrop-blur-md border border-teal-400/60 flex items-center gap-1.5 z-10 whitespace-nowrap">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                          >
                            <Sparkles className="w-3.5 h-3.5 text-teal-200" />
                          </motion.div>
                          <span>توصية الـ AI Agent</span>
                        </div>
                      )}

                      <div className="space-y-3 pt-1">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
                              <span>{quote.supplierName}</span>
                            </h4>
                            <span className="text-[11px] text-slate-500">
                              {quote.leadTimeHours <= 18 ? 'مورد سريع (توريد فوري)' : quote.leadTimeHours <= 24 ? 'مورد معتمد (مباشر)' : 'مورد جملة (كميات كبيرة)'}
                            </span>
                          </div>
                        </div>

                        {/* Specs Card */}
                        <div className="bg-white/70 p-3.5 rounded-xl border border-white/80 space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">سعر الوحدة:</span>
                            <span className="font-extrabold text-teal-700 text-lg">
                              {toEnglishDigits(quote.unitPrice)} ر.س
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>مدة التوصيل:</span>
                            </span>
                            <span className="font-bold text-slate-700">
                              {toEnglishDigits(quote.leadTimeHours)} ساعة
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 flex items-center gap-1">
                              <Package className="w-3 h-3 text-slate-400" />
                              <span>الحد الأدنى للطلب:</span>
                            </span>
                            <span className="font-bold text-slate-700">
                              {toEnglishDigits(quote.minOrderQuantity.toLocaleString('en-US'))} وحدة
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-teal-600" />
                              <span>مؤشر الجودة:</span>
                            </span>
                            <span className="font-bold text-teal-700">
                              {toEnglishDigits(quote.qualityRating)} من 5
                            </span>
                          </div>
                        </div>

                        {/* AI Reasoning */}
                        <div className="text-xs text-slate-600 leading-relaxed bg-teal-50/50 p-3 rounded-xl border border-teal-100/60">
                          <strong className="text-teal-800 flex items-center gap-1 text-[11px] mb-1 font-bold">
                            <Bot className="w-3.5 h-3.5 text-teal-600" />
                            <span>تحليل الوكيل الذكي:</span>
                          </strong>
                          {quote.aiReasoning}
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => handleQuickOrder(quote.supplierName, selectedItem.name)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer mt-4 ${
                          isBest
                            ? 'bg-teal-600 hover:bg-teal-700 active:scale-95 text-white shadow-md shadow-teal-600/30'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
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
              <div className="p-8 text-center text-slate-500 text-sm bg-white/30 rounded-xl">
                لا توجد عروض أسعار مسجلة لهذا الصنف حالياً
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Supplier Scorecards (بطاقات تقييم الموردين التفاعلية) */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-500/10 text-teal-600 border border-teal-500/20 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                بطاقات تقييم الموردين (Supplier Scorecard)
              </h2>
              <p className="text-xs text-slate-500">
                تقييم حي ومتحرك للموردين المعتمدين وفق سرعة التوصيل وجودة البضاعة واستقرار السعر
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold text-slate-500 bg-white/60 px-3 py-1.5 rounded-xl border border-white/60">
            {toEnglishDigits(suppliers.length)} موردين مسجلين
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {suppliers.map((sup, idx) => {
            const metrics = sup.metrics || {
              deliverySpeed: 95,
              qualityScore: 98,
              priceStability: 96,
            };

            return (
              <div
                key={sup.id}
                className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-sm rounded-2xl p-6 flex flex-col justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-300 group relative"
              >
                <div className="space-y-4">
                  {/* Supplier Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-teal-600" />
                        <span>{sup.name}</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">{sup.category}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Edit Supplier Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditSupplier(sup)}
                        className="p-1.5 rounded-lg bg-white/70 hover:bg-white text-slate-500 hover:text-teal-600 border border-white/80 shadow-xs transition-colors cursor-pointer"
                        title="تعديل بيانات المورد"
                      >
                        <Edit2 size={14} />
                      </button>

                      <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                        <span>{toEnglishDigits(sup.rating)} / 5</span>
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Animated Progress Bars */}
                  <div className="bg-white/70 p-4 rounded-xl border border-white/80 space-y-3">
                    <div className="text-xs font-bold text-slate-700 flex items-center justify-between border-b border-slate-100 pb-2">
                      <span>مؤشرات أداء التوريد (KPIs)</span>
                      <span className="text-[10px] text-teal-600 font-semibold">تحديث مستمر</span>
                    </div>

                    {/* 1. Delivery Speed */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-teal-600" />
                          <span>سرعة التوصيل</span>
                        </span>
                        <span className="font-extrabold text-teal-700">{toEnglishDigits(metrics.deliverySpeed)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/40">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${metrics.deliverySpeed}%` }}
                          transition={{ duration: 0.9, ease: 'easeOut', delay: idx * 0.1 }}
                          className="h-full bg-gradient-to-l from-teal-500 to-sky-500 rounded-full"
                        />
                      </div>
                    </div>

                    {/* 2. Product Quality */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                          <span>جودة البضاعة</span>
                        </span>
                        <span className="font-extrabold text-teal-700">{toEnglishDigits(metrics.qualityScore)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/40">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${metrics.qualityScore}%` }}
                          transition={{ duration: 0.9, ease: 'easeOut', delay: idx * 0.1 + 0.1 }}
                          className="h-full bg-gradient-to-l from-teal-600 to-teal-400 rounded-full"
                        />
                      </div>
                    </div>

                    {/* 3. Price Stability */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 flex items-center gap-1">
                          <Scale className="w-3.5 h-3.5 text-sky-600" />
                          <span>استقرار السعر</span>
                        </span>
                        <span className="font-extrabold text-sky-700">{toEnglishDigits(metrics.priceStability)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/40">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${metrics.priceStability}%` }}
                          transition={{ duration: 0.9, ease: 'easeOut', delay: idx * 0.1 + 0.2 }}
                          className="h-full bg-gradient-to-l from-sky-600 to-sky-400 rounded-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Supplier Info Details */}
                  <div className="bg-white/40 p-3.5 rounded-xl border border-white/60 space-y-2 text-xs text-slate-600">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>الموقع الجغرافي:</span>
                      </span>
                      <strong className="text-slate-800">{sup.city}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>زمن التوريد المعتاد:</span>
                      </span>
                      <strong className="text-teal-700">{toEnglishDigits(sup.leadTime)}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-slate-400" />
                        <span>التصنيف المالي:</span>
                      </span>
                      <strong className="text-slate-700">{sup.pricingTier}</strong>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {sup.tags.map(t => (
                      <span
                        key={t}
                        className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200/50 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1"
                      >
                        <Tag className="w-2.5 h-2.5 text-teal-500" />
                        <span>{t}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-4 mt-4 border-t border-white/60 flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{toEnglishDigits(sup.phone)}</span>
                  </span>
                  <span className="text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/50">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="font-sans bg-white/95 backdrop-blur-2xl border border-white/80 rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-5 text-slate-800 relative">
            
            {/* Edit Button in Header (Far Left) */}
            <button
              type="button"
              onClick={isEditingPO ? () => setIsEditingPO(false) : handleOpenEditPO}
              className="absolute left-6 top-6 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-bold transition-all shadow-xs cursor-pointer z-10"
              title="تعديل تفاصيل أمر الشراء"
            >
              <Edit2 size={16} />
              <span>{isEditingPO ? 'إلغاء' : 'تعديل'}</span>
            </button>

            {/* Header */}
            <div className="flex justify-between items-start border-b border-teal-100/60 pb-3 pl-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-600 shadow-inner">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    تفاصيل أمر الشراء ({toEnglishDigits(selectedPO.id)})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    سجل التوريد الرسمي لدى شبكة الموردين
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedPO(null);
                  setIsEditingPO(false);
                }}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Edit Mode Form */}
            {isEditingPO ? (
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/60 space-y-3.5 text-sm">
                <div className="text-center font-bold text-slate-800 border-b border-slate-200/60 pb-2">
                  تعديل بيانات أمر الشراء
                </div>

                <div className="space-y-1 text-center">
                  <label className="text-xs font-bold text-slate-600">المورد المعتمد:</label>
                  <select
                    value={editPOSupplier}
                    onChange={(e) => setEditPOSupplier(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-800 focus:outline-none focus:border-teal-500 text-center shadow-xs"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.name}>{s.name} ({s.city})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 text-center">
                  <label className="text-xs font-bold text-slate-600">الكمية المطلوبة (وحدة):</label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={editPOQuantity}
                    onChange={(e) => setEditPOQuantity(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-800 focus:outline-none focus:border-teal-500 text-center shadow-xs font-mono"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSavePOEdit}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl shadow-md shadow-teal-600/30 transition-all text-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>حفظ التعديل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingPO(false)}
                    className="px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-xl transition-all text-xs cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              /* Centered Details View */
              <div className="bg-slate-50/70 backdrop-blur-md rounded-2xl p-4 border border-slate-200/60 divide-y divide-slate-200/50 text-sm">
                
                {/* 1. PO Number */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-slate-500 text-xs font-medium">رقم أمر الشراء</span>
                  <span className="font-extrabold text-teal-800 font-mono text-base bg-teal-50 px-3 py-0.5 rounded-lg border border-teal-200/60 mt-0.5">
                    {toEnglishDigits(selectedPO.id)}
                  </span>
                </div>

                {/* 2. Item Name */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-slate-500 text-xs font-medium">الصنف المطلوب</span>
                  <span className="font-bold text-slate-800 text-base mt-0.5">
                    {selectedPO.itemName}
                  </span>
                </div>

                {/* 3. Supplier Name */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-slate-500 text-xs font-medium">المورد المعتمد</span>
                  <span className="font-semibold text-slate-700 text-sm flex items-center justify-center gap-1.5 mt-0.5">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>{selectedPO.supplierName}</span>
                  </span>
                </div>

                {/* 4. Quantity */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-slate-500 text-xs font-medium">الكمية المطلوبة</span>
                  <span className="font-bold text-slate-800 text-base font-mono mt-0.5">
                    {toEnglishDigits(selectedPO.quantity.toLocaleString('en-US'))} وحدة
                  </span>
                </div>

                {/* 5. Total Cost */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-slate-500 text-xs font-medium">التكلفة التقديرية الإجمالية</span>
                  <span className="font-extrabold text-teal-700 text-lg font-mono mt-0.5">
                    {toEnglishDigits(selectedPO.totalCost.toLocaleString('en-US'))} ر.س
                  </span>
                </div>

                {/* 6. Creation Time */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-slate-500 text-xs font-medium">توقيت الإنشاء</span>
                  <span className="text-slate-600 text-xs font-medium font-mono mt-0.5">
                    {toEnglishDigits(selectedPO.createdAt)}
                  </span>
                </div>

                {/* 7. Creator */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-slate-500 text-xs font-medium">جهة الإصدار</span>
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-md border border-teal-200 flex items-center justify-center gap-1.5 mt-1">
                    {selectedPO.createdBy === 'AI_AGENT' ? (
                      <>
                        <Bot className="w-3.5 h-3.5 text-teal-600" />
                        <span>وكيل الذكاء الاصطناعي (AI Agent)</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3.5 h-3.5 text-slate-600" />
                        <span>مسؤول المشتريات</span>
                      </>
                    )}
                  </span>
                </div>

                {/* 8. Status */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-slate-500 text-xs font-medium">الحالة الحالية</span>
                  <span className="text-xs font-bold px-3 py-1 rounded-full border mt-1">
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
                  className="w-full py-3 px-6 rounded-2xl font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/30 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>تأكيد وإرسال الإيميل للمورد</span>
                </button>
              )}

              {selectedPO.status === 'SENT' && (
                <button
                  onClick={() => handleUpdatePOStatus(selectedPO.id, 'IN_TRANSIT')}
                  className="w-full py-3 px-6 rounded-2xl font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/30 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>تحديث إلى: جاري التوصيل (In Transit)</span>
                </button>
              )}

              {selectedPO.status === 'IN_TRANSIT' && (
                <button
                  onClick={() => handleUpdatePOStatus(selectedPO.id, 'DELIVERED')}
                  className="w-full py-3 px-6 rounded-2xl font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/30 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
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
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-all text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Supplier (Supplier Form Modal) */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="font-sans bg-white/95 backdrop-blur-2xl border border-white/80 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 text-slate-800 relative">
            <div className="flex justify-between items-center border-b border-teal-100/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  {editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
                </h3>
              </div>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-full w-7 h-7 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المورد:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مصنع التغليف الحديث"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-500 shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الموقع (المدينة):</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: الرياض"
                    value={supplierForm.city}
                    onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">التقييم المبدئي (من 5):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    required
                    value={supplierForm.rating}
                    onChange={(e) => setSupplierForm({ ...supplierForm, rating: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-500 shadow-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">زمن التوريد المعتاد:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 24 ساعة"
                    value={supplierForm.leadTime}
                    onChange={(e) => setSupplierForm({ ...supplierForm, leadTime: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                  <input
                    type="text"
                    placeholder="+966 11 000 0000"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-500 shadow-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">فئة التوريد:</label>
                <input
                  type="text"
                  placeholder="مثال: كرتون وورقيات"
                  value={supplierForm.category}
                  onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-500 shadow-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold py-2.5 rounded-xl shadow-md shadow-teal-600/30 transition-all text-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-all text-xs cursor-pointer"
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
