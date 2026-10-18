"use client";

import { useState, useEffect } from 'react';
import { SupabaseInventoryItem } from '@/lib/supabaseService';
import { initialSuppliers, PurchaseOrder, getSessionPurchaseOrders, addPurchaseOrderToSession } from '@/lib/mockInventoryData';
import Link from 'next/link';
import GlassSelect from '@/components/common/GlassSelect';
import { Edit2, FileText, Building2, Bot, User, Check, Mail, X, AlertTriangle, RefreshCw } from 'lucide-react';

// Helper to ensure all digits are English (0-9)
const toEnglishDigits = (str: string | number): string => {
  if (str === null || str === undefined) return '';
  if (typeof str === 'number') {
    return str.toLocaleString('en-US');
  }
  return String(str).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

// Helper to infer or categorize items from Arabic name
const getItemCategory = (name: string): string => {
  if (name.includes('صحن') || name.includes('أطباق') || name.includes('Tray')) return 'صحون وأطباق';
  if (name.includes('كيس') || name.includes('أكياس') || name.includes('Bag')) return 'أكياس Holder';
  if (name.includes('صوص') || name.includes('علب') || name.includes('بلاستيك') || name.includes('Cup')) return 'علب وبلاستيك';
  if (name.includes('مائدة') || name.includes('Cutlery') || name.includes('مستلزمات')) return 'مستلزمات تقديم';
  if (name.includes('غطاء') || name.includes('أغطية') || name.includes('Sleeves') || name.includes('بوكس') || name.includes('تغليف')) return 'تغليف وعلب';
  return 'مواد تشغيلية وتغليف';
};

interface InventoryClientProps {
  initialItems: SupabaseInventoryItem[];
  fetchError?: string | null;
}

export default function InventoryClient({ initialItems, fetchError }: InventoryClientProps) {
  const items = initialItems;
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItemForPO, setSelectedItemForPO] = useState<SupabaseInventoryItem | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [isEditingPO, setIsEditingPO] = useState<boolean>(false);
  const [editPOQuantity, setEditPOQuantity] = useState<number>(0);
  const [editPOSupplier, setEditPOSupplier] = useState<string>('');
  const [poQuantity, setPoQuantity] = useState<number>(1000);
  const [selectedSupplier, setSelectedSupplier] = useState<string>(initialSuppliers[0].name);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => getSessionPurchaseOrders());
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    const handleNewAiPO: EventListener = (event) => {
      const purchaseOrder = (event as CustomEvent<PurchaseOrder>).detail;
      if (purchaseOrder) {
        setPurchaseOrders(prev => {
          if (prev.some(p => p.id === purchaseOrder.id)) return prev;
          return [purchaseOrder, ...prev];
        });
      }
    };

    window.addEventListener('ai_purchase_order_created', handleNewAiPO);
    return () => {
      window.removeEventListener('ai_purchase_order_created', handleNewAiPO);
    };
  }, []);

  // Compute unique categories from real data
  const dynamicCategories = [
    'ALL',
    ...Array.from(new Set(items.map(item => getItemCategory(item.item_name_ar))))
  ];

  const filteredItems = items.filter(item => {
    const category = getItemCategory(item.item_name_ar);
    const matchCat = selectedCategory === 'ALL' || category === selectedCategory;
    const matchSearch =
      item.item_name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const lowStockCount = items.filter(i => i.current_stock <= i.reorder_level).length;

  const handleOpenPO = (item: SupabaseInventoryItem) => {
    setSelectedItemForPO(item);
    // Suggest optimal reorder quantity based on reorder_level
    const suggested = Math.max(item.reorder_level * 2, 1000);
    setPoQuantity(suggested);
    // Auto pick matching supplier
    const cat = getItemCategory(item.item_name_ar);
    if (cat.includes('بلاستيك') || cat.includes('صحون') || cat.includes('تقديم')) {
      setSelectedSupplier('مصنع البلاستيك الوطني');
    } else {
      setSelectedSupplier('مورد التغليف السريع');
    }
  };

  const handleCreatePO = () => {
    if (!selectedItemForPO) return;

    const unitCost = selectedItemForPO.cost_per_unit || 0.45;
    const newPO: PurchaseOrder = {
      id: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
      itemId: selectedItemForPO.item_code,
      itemName: selectedItemForPO.item_name_ar,
      supplierName: selectedSupplier,
      quantity: poQuantity,
      totalCost: Number((poQuantity * unitCost).toFixed(2)),
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      createdBy: 'HUMAN',
    };

    addPurchaseOrderToSession(newPO);
    setPurchaseOrders(prev => [newPO, ...prev]);
    setSuccessToast(`تم إنشاء أمر الشراء ${newPO.id} لعدد ${toEnglishDigits(poQuantity)} وحدة من (${selectedSupplier}) بنجاح!`);
    setSelectedItemForPO(null);

    setTimeout(() => {
      setSuccessToast(null);
    }, 4500);
  };

  const handleConfirmAndSendPO = (poId: string) => {
    setPurchaseOrders(prev =>
      prev.map(p => (p.id === poId ? { ...p, status: 'SENT' } : p))
    );
    const existing = getSessionPurchaseOrders().find(p => p.id === poId);
    if (existing) {
      existing.status = 'SENT';
    }
    setSuccessToast(`تم اعتماد وإرسال أمر الشراء ${poId} للمورد رسمياً عبر البريد الإلكتروني!`);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4500);
  };

  const handleOpenEditPO = () => {
    if (!viewingPO) return;
    setEditPOQuantity(viewingPO.quantity);
    setEditPOSupplier(viewingPO.supplierName);
    setIsEditingPO(true);
  };

  const handleSavePOEdit = () => {
    if (!viewingPO) return;

    const matchedItem = items.find(i => i.item_code === viewingPO.itemId || i.item_name_ar === viewingPO.itemName);
    const unitCost = matchedItem?.cost_per_unit || 0.45;
    const newTotalCost = Number((editPOQuantity * unitCost).toFixed(2));

    const updatedPO: PurchaseOrder = {
      ...viewingPO,
      quantity: editPOQuantity,
      supplierName: editPOSupplier,
      totalCost: newTotalCost,
    };

    setPurchaseOrders(prev => prev.map(p => p.id === viewingPO.id ? updatedPO : p));
    setViewingPO(updatedPO);
    setIsEditingPO(false);
    setSuccessToast(`تم تحديث بيانات أمر الشراء ${updatedPO.id} بنجاح!`);

    setTimeout(() => {
      setSuccessToast(null);
    }, 4500);
  };

  return (
    <div className="page-shell w-full mx-auto space-y-6 font-sans">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass-popover border border-white/40 text-white px-6 py-3.5 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="text-xl">✨</span>
          <span className="text-sm font-bold">{successToast}</span>
        </div>
      )}

      {/* Database Error Banner if Supabase connection fails */}
      {fetchError && (
        <div className="bg-rose-500/10 border border-rose-400/30 rounded-2xl p-4 flex items-center justify-between gap-4 text-white">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-200 shrink-0" />
            <div>
              <p className="text-sm font-bold text-rose-200">تنبيه اتصال قاعدة البيانات (Supabase)</p>
              <p className="text-xs text-white/80 mt-0.5">{fetchError}</p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-white/8 hover:bg-white/15 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/40 flex items-center gap-1.5 transition-all cursor-pointer "
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      )}

      {/* Header */}
      <header className="glass page-header mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
            <span className="text-xs font-bold text-white">قاعدة بيانات مباشرة (Supabase Live)</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">إدارة المخزون والتوريد (Smart Inventory)</h1>
          <p className="text-white/80 font-semibold text-sm mt-1.5">
            مراقبة استهلاك المواد التشغيلية والتنبؤ بطلبيات إعادة الشحن التلقائية لعمليات زاهي
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/suppliers"
            className="bg-white/8 hover:bg-white/15 text-white font-bold px-4 py-2.5 rounded-2xl border border-white/40 transition-all text-sm flex items-center gap-2 group cursor-pointer "
          >
            <Building2 className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
            <span>دليل الموردين والعروض</span>
          </Link>
        </div>
      </header>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-white/80">إجمالي أصناف التشغيل</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2">{toEnglishDigits(items.length)}</div>
          <div className="text-xs text-white/65 font-semibold mt-1">أصناف مسجلة في قاعدة البيانات</div>
        </div>

        <div className="glass p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-white/80">أصناف تحت الحد الأدنى</div>
          <div className={`text-3xl font-extrabold font-mono tracking-wider mt-2 ${lowStockCount > 0 ? 'text-rose-200' : 'text-white'}`}>
            {toEnglishDigits(lowStockCount)}
          </div>
          <div className="text-xs text-rose-200 font-semibold mt-1">تتطلب إصدار أوامر شراء فورية</div>
        </div>

        <div className="glass p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-white/80">أوامر الشراء النشطة (PO)</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2">{toEnglishDigits(purchaseOrders.length)}</div>
          <div className="text-xs text-white/65 font-semibold mt-1">قيد المراجعة والمطابقة</div>
        </div>

        <div className="glass p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-white/80">نسبة تغطية المخزون</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2">
            {items.length > 0 ? `${Math.round(((items.length - lowStockCount) / items.length) * 100)}%` : '0%'}
          </div>
          <div className="text-xs text-white/65 font-semibold mt-1">جاهزية التوريد واستقرار العمليات</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-sm font-bold text-white whitespace-nowrap">التصنيف:</span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
            {dynamicCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'glass-active text-white '
                    : 'bg-white/8 text-white/80 hover:text-white hover:bg-white/15 border border-white/40'
                }`}
              >
                {cat === 'ALL' ? 'الكل' : cat}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="بحث بالاسم أو الكود أو التصنيف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full glass border border-white/40 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none focus:ring-2 focus:ring-white/25"
          />
        </div>
      </div>

      {/* Inventory Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map(item => {
          const isLowStock = item.current_stock <= item.reorder_level;
          const targetCapacity = Math.max(item.current_stock, item.reorder_level * 3);
          const percentage = Math.min(100, Math.max(8, Math.round((item.current_stock / targetCapacity) * 100)));
          const category = getItemCategory(item.item_name_ar);

          return (
            <div
              key={item.item_code}
              className={`glass p-6 flex flex-col justify-between transition-all duration-200 ${
                isLowStock ? 'border-rose-400/60 ' : ''
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-base text-white">{item.item_name_ar}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-semibold text-white/80 bg-white/8 px-2.5 py-0.5 rounded-lg border border-white/40 inline-block">
                        {category}
                      </span>
                      <span className="text-[10px] font-mono text-white font-bold">
                        {item.item_code}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border ${
                      isLowStock
                        ? 'bg-rose-500/15 text-rose-200 border-rose-300/30 animate-pulse'
                        : 'bg-teal-500/15 text-teal-100 border-teal-300/30'
                    }`}
                  >
                    {isLowStock ? 'تحت الحد الأدنى' : 'المخزون مستقر'}
                  </span>
                </div>

                {/* Stock Level Display */}
                <div className="glass p-4 rounded-xl border border-white/40 mb-4">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-xs text-white/80 font-medium">الكمية الحالية (current_stock):</span>
                    <span className={`text-xl font-extrabold font-mono ${isLowStock ? 'text-rose-200' : 'text-white'}`}>
                      {toEnglishDigits(item.current_stock.toLocaleString('en-US'))} <span className="text-xs text-white/65 font-normal">وحدة</span>
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-white/80 mb-2 font-mono">
                    <span>الحد الأدنى (reorder_level): <strong className="text-white">{toEnglishDigits(item.reorder_level.toLocaleString('en-US'))}</strong></span>
                    <span>كود الصنف: <strong className="text-white">{item.item_code}</strong></span>
                  </div>

                  {/* Progress Bar based on current_stock vs targetCapacity */}
                  <div className="w-full bg-white/8 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLowStock ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-teal-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-left text-[10px] text-white/65 mt-1 font-mono">
                    مستوى التغطية: {toEnglishDigits(percentage)}% (مستوى إعادة الطلب: {toEnglishDigits(item.reorder_level.toLocaleString('en-US'))})
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div>
                {isLowStock ? (
                  <button
                    onClick={() => handleOpenPO(item)}
                    className="w-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer "
                  >
                    <AlertTriangle className="w-4 h-4 text-white" />
                    <span>إنشاء أمر شراء عاجل (PO)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenPO(item)}
                    className="w-full bg-white/8 hover:bg-white/15 text-white text-xs font-bold py-2.5 px-4 rounded-xl border border-white/40 transition-all flex items-center justify-center gap-1 cursor-pointer "
                  >
                    طلب توريد استباقي
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="glass border border-white/40 rounded-2xl p-12 text-center text-white">
          <p className="text-lg font-bold">لم يتم العثور على أي أصناف مخزون مطابقة للبحث</p>
          <p className="text-xs text-white/80 mt-1">جرّب اختيار تصنيف آخر أو مسح كلمة البحث.</p>
        </div>
      )}

      {/* Recent Purchase Orders Table */}
      <div className="glass mt-8 overflow-hidden">
        <div className="p-5 border-b border-white/25 flex justify-between items-center bg-white/8">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-white" />
            <span>سجل أوامر الشراء المنشأة حديثاً (Purchase Orders)</span>
          </h3>
          <span className="text-xs bg-teal-600/15 text-teal-100 border border-teal-300/30 px-3 py-1 rounded-full font-bold font-mono">
            {toEnglishDigits(purchaseOrders.length)} أوامر
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm text-white">
            <thead className="bg-white/8 text-white/80 text-xs uppercase font-bold border-b border-white/25">
              <tr>
                <th className="px-5 py-3.5">رقم الأمر</th>
                <th className="px-5 py-3.5">الصنف</th>
                <th className="px-5 py-3.5">المورد</th>
                <th className="px-5 py-3.5">الكمية</th>
                <th className="px-5 py-3.5">التكلفة التقديرية</th>
                <th className="px-5 py-3.5">المُنشئ</th>
                <th className="px-5 py-3.5">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/15">
              {purchaseOrders.map(po => (
                <tr key={po.id} className="hover:bg-white/15 transition-colors">
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => {
                        setViewingPO(po);
                        setIsEditingPO(false);
                      }}
                      className="font-bold text-white underline decoration-white/25 hover:text-white cursor-pointer transition-colors flex items-center gap-1.5 group font-mono"
                      title="عرض تفاصيل أمر الشراء"
                    >
                      <span>{toEnglishDigits(po.id)}</span>
                      <span className="text-[10px] opacity-70 group-hover:opacity-100 transition-opacity">↗</span>
                    </button>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-white">{po.itemName}</td>
                  <td className="px-5 py-3.5 text-white/80">{po.supplierName}</td>
                  <td className="px-5 py-3.5 font-bold text-white font-mono">{toEnglishDigits(po.quantity.toLocaleString('en-US'))}</td>
                  <td className="px-5 py-3.5 font-bold text-white font-mono">{toEnglishDigits(po.totalCost.toLocaleString('en-US'))} ر.س</td>
                  <td className="px-5 py-3.5">
                    {po.createdBy === 'AI_AGENT' ? (
                      <span className="text-xs bg-purple-500/15 text-purple-200 border border-purple-300/30 px-2.5 py-0.5 rounded-lg font-bold inline-flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-purple-200" /> AI Agent
                      </span>
                    ) : (
                      <span className="text-xs bg-white/8 text-white/80 border border-white/25 px-2.5 py-0.5 rounded-lg font-medium inline-flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-white/65" /> موظف المشتريات
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {po.status === 'SENT' ? (
                      <span className="text-xs bg-emerald-500/15 text-emerald-200 border border-emerald-300/30 px-3 py-1 rounded-full font-bold inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-200" /> تم الإرسال
                      </span>
                    ) : po.status === 'APPROVED' ? (
                      <span className="text-xs bg-teal-500/15 text-teal-100 border border-teal-300/30 px-3 py-1 rounded-full font-bold">
                        معتمد
                      </span>
                    ) : (
                      <span className="text-xs bg-amber-500/15 text-amber-200 border border-amber-300/30 px-3 py-1 rounded-full font-bold">
                        بانتظار الموافقة النهائية
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Purchase Order */}
      {selectedItemForPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
          <div className="font-sans glass-popover rounded-2xl w-full max-w-lg p-6 space-y-4 text-white border border-white/40 ">
            <div className="flex justify-between items-start border-b border-white/25 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>إنشاء أمر شراء جديد (Purchase Order)</span>
                </h3>
                <p className="text-xs text-white/80 mt-0.5 font-medium">
                  إعادة تزويد مخزون: <strong className="text-white">{selectedItemForPO.item_name_ar}</strong> ({selectedItemForPO.item_code})
                </p>
              </div>
              <button
                onClick={() => setSelectedItemForPO(null)}
                className="text-white/65 hover:text-white bg-white/8 hover:bg-white/15 border border-white/25 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-white mb-1">المورد المعتمد:</label>
                <GlassSelect
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full bg-white/8 border border-white/25 rounded-xl p-2.5 text-sm text-white focus:outline-none"
                >
                  {initialSuppliers.map(sup => (
                    <option key={sup.id} value={sup.name}>
                      {sup.name} - (توصيل: {sup.leadTime})
                    </option>
                  ))}
                </GlassSelect>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  الكمية المطلوبة (وحدة):
                </label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={poQuantity}
                  onChange={(e) => setPoQuantity(Number(e.target.value))}
                  className="w-full bg-white/8 border border-white/25 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/25 font-mono"
                />
              </div>

              <div className="bg-white/8 border border-white/25 p-3.5 rounded-xl flex justify-between items-center text-sm">
                <span className="text-white/80 font-medium">التكلفة التقديرية الإجمالية:</span>
                <span className="text-lg font-bold text-white font-mono">
                  {toEnglishDigits((poQuantity * (selectedItemForPO.cost_per_unit || 0.45)).toFixed(2))} ر.س
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreatePO}
                className="flex-1 bg-white/20 hover:bg-white/25 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm cursor-pointer "
              >
                تأكيد وإصدار أمر الشراء
              </button>
              <button
                onClick={() => setSelectedItemForPO(null)}
                className="px-5 bg-white/8 hover:bg-white/15 text-white/80 font-bold py-3 rounded-xl border border-white/25 transition-all text-sm cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View & Edit Purchase Order Details */}
      {viewingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in">
          <div className="font-sans glass-popover rounded-2xl w-full max-w-lg p-6 space-y-5 text-white border border-white/40 relative ">
            {/* Edit Button in Header (Far Left) */}
            <button
              type="button"
              onClick={isEditingPO ? () => setIsEditingPO(false) : handleOpenEditPO}
              className="absolute left-6 top-6 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/8 hover:bg-white/15 text-white/80 border border-white/25 text-xs font-bold transition-all cursor-pointer z-10"
              title="تعديل تفاصيل أمر الشراء"
            >
              <Edit2 size={16} className="text-white/65" />
              <span>{isEditingPO ? 'إلغاء' : 'تعديل'}</span>
            </button>

            {/* Header */}
            <div className="flex justify-between items-start border-b border-white/25 pb-3 pl-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-300/30 flex items-center justify-center text-teal-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    تفاصيل أمر الشراء ({toEnglishDigits(viewingPO.id)})
                  </h3>
                  <p className="text-xs text-white/65 mt-0.5 font-medium">
                    مستند توريد رسمي موجه للمورد
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setViewingPO(null);
                  setIsEditingPO(false);
                }}
                className="text-white/65 hover:text-white bg-white/8 hover:bg-white/15 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-colors border border-white/25"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Edit Mode Form */}
            {isEditingPO ? (
              <div className="bg-white/8 rounded-xl p-4 border border-white/25 space-y-3.5 text-sm">
                <div className="text-center font-bold text-white border-b border-white/25 pb-2">
                  تعديل بيانات أمر الشراء
                </div>

                <div className="space-y-1 text-center">
                  <label className="text-xs font-bold text-white">المورد المعتمد:</label>
                  <GlassSelect
                    value={editPOSupplier}
                    onChange={(e) => setEditPOSupplier(e.target.value)}
                    className="w-full bg-white/8 border border-white/25 rounded-xl p-2.5 text-sm text-white focus:outline-none"
                  >
                    {initialSuppliers.map(s => (
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
                    className="w-full bg-white/8 border border-white/25 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/25 font-mono"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSavePOEdit}
                    className="flex-1 bg-white/20 hover:bg-white/25 text-white font-bold py-2.5 rounded-xl transition-all text-xs cursor-pointer flex items-center justify-center gap-1.5 "
                  >
                    <Check className="w-4 h-4" />
                    <span>حفظ التعديل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingPO(false)}
                    className="px-4 bg-white/8 hover:bg-white/15 text-white/80 font-bold py-2.5 rounded-xl border border-white/25 transition-all text-xs cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              /* Centered Details View */
              <div className="bg-white/8 rounded-xl p-4 border border-white/25 divide-y divide-white/25 text-sm">
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">رقم أمر الشراء</span>
                  <span className="font-extrabold text-teal-100 font-mono text-base bg-teal-500/15 px-3 py-0.5 rounded-lg border border-teal-300/30 mt-0.5">
                    {toEnglishDigits(viewingPO.id)}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">الصنف المطلوب</span>
                  <span className="font-bold text-white text-base mt-0.5">
                    {viewingPO.itemName}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">المورد المعتمد</span>
                  <span className="font-semibold text-white text-sm flex items-center justify-center gap-1.5 mt-0.5">
                    <Building2 className="w-4 h-4 text-white" />
                    <span>{viewingPO.supplierName}</span>
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">الكمية المطلوبة</span>
                  <span className="font-bold text-white text-base font-mono mt-0.5">
                    {toEnglishDigits(viewingPO.quantity.toLocaleString('en-US'))} وحدة
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">التكلفة التقديرية الإجمالية</span>
                  <span className="font-extrabold text-white text-lg font-mono mt-0.5">
                    {toEnglishDigits(viewingPO.totalCost.toLocaleString('en-US'))} ر.س
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">تاريخ الإنشاء</span>
                  <span className="text-white/80 text-xs font-medium font-mono mt-0.5">
                    {toEnglishDigits(viewingPO.createdAt)}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">جهة الإصدار</span>
                  <span className="text-xs font-bold text-white bg-white/8 px-3 py-1 rounded-md border border-white/25 flex items-center justify-center gap-1.5 mt-1">
                    {viewingPO.createdBy === 'AI_AGENT' ? (
                      <>
                        <Bot className="w-3.5 h-3.5 text-purple-200" />
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

                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">حالة الأمر الحالية</span>
                  <span className="text-xs font-bold px-3 py-1 rounded-full border mt-1">
                    {viewingPO.status === 'SENT' ? (
                      <span className="text-emerald-200 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-200" /> تم الإرسال للمورد
                      </span>
                    ) : viewingPO.status === 'APPROVED' ? (
                      <span className="text-white">معتمد</span>
                    ) : (
                      <span className="text-amber-200">بانتظار الموافقة النهائية</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => handleConfirmAndSendPO(viewingPO.id)}
                disabled={viewingPO.status === 'SENT'}
                className={`w-full py-3.5 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm ${
                  viewingPO.status === 'SENT'
                    ? 'bg-white/8 text-white/65 cursor-not-allowed border border-white/25'
                    : 'bg-white/20 hover:bg-white/25 active:scale-[0.99] text-white cursor-pointer '
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>{viewingPO.status === 'SENT' ? 'تم تأكيد وإرسال هذا الأمر للمورد مسبقاً' : 'تأكيد وإرسال للمورد (عبر الإيميل)'}</span>
              </button>

              <button
                onClick={() => {
                  setViewingPO(null);
                  setIsEditingPO(false);
                }}
                className="w-full bg-white/8 hover:bg-white/15 text-white/80 font-bold py-2.5 rounded-xl border border-white/25 transition-all text-xs cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
