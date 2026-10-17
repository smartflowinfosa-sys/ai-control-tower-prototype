"use client";

import { useState, useEffect } from 'react';
import { initialInventoryItems, InventoryItem, initialSuppliers, PurchaseOrder, getSessionPurchaseOrders, addPurchaseOrderToSession } from '@/lib/mockInventoryData';
import Link from 'next/link';
import { Edit2, FileText, Building2, Bot, User, Check, Mail, X } from 'lucide-react';

// Helper to ensure all digits are English (0-9)
const toEnglishDigits = (str: string | number): string => {
  if (str === null || str === undefined) return '';
  if (typeof str === 'number') {
    return str.toLocaleString('en-US');
  }
  return String(str).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>(initialInventoryItems);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItemForPO, setSelectedItemForPO] = useState<InventoryItem | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [isEditingPO, setIsEditingPO] = useState<boolean>(false);
  const [editPOQuantity, setEditPOQuantity] = useState<number>(0);
  const [editPOSupplier, setEditPOSupplier] = useState<string>('');
  const [poQuantity, setPoQuantity] = useState<number>(1000);
  const [selectedSupplier, setSelectedSupplier] = useState<string>(initialSuppliers[0].name);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => getSessionPurchaseOrders());
  const [successToast, setSuccessToast] = useState<string | null>(null);

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

  const categories = ['ALL', 'تغليف وعلب', 'أكياس Holder', 'علب وبلاستيك', 'صحون وأطباق', 'مستلزمات تقديم'];

  const filteredItems = items.filter(item => {
    const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchSearch = item.name.includes(searchQuery) || item.category.includes(searchQuery);
    return matchCat && matchSearch;
  });

  const lowStockCount = items.filter(i => i.currentStock <= i.minThreshold).length;

  const handleOpenPO = (item: InventoryItem) => {
    setSelectedItemForPO(item);
    // Suggest optimal reorder quantity
    const suggested = Math.max(item.minThreshold * 2, item.maxCapacity - item.currentStock);
    setPoQuantity(suggested);
    // Auto pick matching supplier
    if (item.category.includes('بلاستيك') || item.category.includes('صحون') || item.category.includes('تقديم')) {
      setSelectedSupplier('مصنع البلاستيك الوطني');
    } else {
      setSelectedSupplier('مورد التغليف السريع');
    }
  };

  const handleCreatePO = () => {
    if (!selectedItemForPO) return;

    const newPO: PurchaseOrder = {
      id: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
      itemId: selectedItemForPO.id,
      itemName: selectedItemForPO.name,
      supplierName: selectedSupplier,
      quantity: poQuantity,
      totalCost: Number((poQuantity * selectedItemForPO.unitCost).toFixed(2)),
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      createdBy: 'HUMAN',
    };

    addPurchaseOrderToSession(newPO);
    setPurchaseOrders(prev => [newPO, ...prev]);
    setSuccessToast(`تم إنشاء أمر الشراء ${newPO.id} لعدد ${poQuantity} ${selectedItemForPO.unit} من (${selectedSupplier}) بنجاح!`);
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

    const matchedItem = items.find(i => i.id === viewingPO.itemId || i.name === viewingPO.itemName);
    const unitCost = matchedItem ? matchedItem.unitCost : 0.5;
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
    <div className="max-w-6xl w-full mx-auto space-y-6 font-sans">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass text-white px-6 py-3.5 rounded-[18px] flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="text-xl">✨</span>
          <span className="text-sm font-bold">{successToast}</span>
        </div>
      )}

      {/* Header */}
      <header className="glass rounded-[24px] p-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">إدارة المخزون والتوريد (Smart Inventory)</h1>
          <p className="text-white/65 text-sm mt-1.5">
            مراقبة استهلاك المواد التشغيلية والتنبؤ بطلبيات إعادة الشحن التلقائية لعمليات زاهي
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/suppliers"
            className="glass glass-card hover:bg-white/10 text-white font-bold px-4 py-2.5 rounded-[18px] border transition-all text-sm flex items-center gap-2 group cursor-pointer"
          >
            <Building2 className="w-4 h-4 text-white/65 group-hover:scale-110 transition-transform" />
            <span>دليل الموردين والعروض</span>
          </Link>
        </div>
      </header>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass glass-hover rounded-[18px] p-6 flex flex-col justify-between transition-all duration-300">
          <div className="text-xs font-semibold text-white/65">إجمالي أصناف التشغيل</div>
          <div className="text-3xl font-bold text-white font-mono tracking-wider mt-2">{toEnglishDigits(items.length)}</div>
          <div className="text-xs text-white/65 mt-1">مواد استهلاكية وتغليف</div>
        </div>

        <div className="glass glass-hover rounded-[18px] p-6 flex flex-col justify-between transition-all duration-300">
          <div className="text-xs font-semibold text-white/65">أصناف تحت الحد الأدنى</div>
          <div className={`text-3xl font-bold font-mono tracking-wider mt-2 ${lowStockCount > 0 ? 'text-rose-700' : 'text-white'}`}>
            {toEnglishDigits(lowStockCount)}
          </div>
          <div className="text-xs text-rose-700/80 mt-1">تتطلب إصدار أوامر شراء فورية</div>
        </div>

        <div className="glass glass-hover rounded-[18px] p-6 flex flex-col justify-between transition-all duration-300">
          <div className="text-xs font-semibold text-white/65">أوامر الشراء النشطة (PO)</div>
          <div className="text-3xl font-bold text-white font-mono tracking-wider mt-2">{toEnglishDigits(purchaseOrders.length)}</div>
          <div className="text-xs text-white/65 mt-1">قيد المراجعة والمطابقة</div>
        </div>

        <div className="glass glass-hover rounded-[18px] p-6 flex flex-col justify-between transition-all duration-300">
          <div className="text-xs font-semibold text-white/65">نسبة تغطية المخزون</div>
          <div className="text-3xl font-bold text-white font-mono tracking-wider mt-2">86%</div>
          <div className="text-xs text-white/65 mt-1">تكفي العمليات لـ 5 أيام قادمة</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass rounded-[18px] p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-sm font-bold text-white whitespace-nowrap">التصنيف:</span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'glass glass-active text-white'
                    : 'glass glass-card text-white/65 hover:text-white hover:bg-white/10 border'
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
            placeholder="بحث بالاسم أو التصنيف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full glass glass-card border rounded-[18px] px-4 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none focus:"
          />
        </div>
      </div>

      {/* Inventory Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map(item => {
          const isLowStock = item.currentStock <= item.minThreshold;
          const percentage = Math.min(100, Math.round((item.currentStock / item.maxCapacity) * 100));

          return (
            <div
              key={item.id}
              className={`glass rounded-[18px] p-6 flex flex-col justify-between transition-all duration-300 ${
                isLowStock ? 'border-rose-400/50' : ''
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-base text-white">{item.name}</h3>
                    <span className="text-[11px] font-semibold text-white/65 glass glass-card px-2.5 py-0.5 rounded-lg border mt-1 inline-block">
                      {item.category}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border  ${
                      isLowStock
                        ? 'bg-rose-500/20 text-rose-800 border-rose-400/30 animate-pulse'
                        : 'glass glass-card text-white/65'
                    }`}
                  >
                    {isLowStock ? 'تحت الحد الأدنى' : 'المخزون مستقر'}
                  </span>
                </div>

                {/* Stock Level Display */}
                <div className="glass glass-card p-4 rounded-[18px] border mb-4">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-xs text-white/65">الكمية الحالية:</span>
                    <span className={`text-xl font-extrabold font-mono ${isLowStock ? 'text-rose-700' : 'text-white'}`}>
                      {toEnglishDigits(item.currentStock.toLocaleString('en-US'))} <span className="text-xs text-white/65 font-normal">{item.unit}</span>
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-white/65 mb-2 font-mono">
                    <span>الحد الأدنى: <strong className="text-white">{toEnglishDigits(item.minThreshold.toLocaleString('en-US'))}</strong> {item.unit}</span>
                    <span>الاستهلاك: <strong className="text-white">{toEnglishDigits(item.dailyConsumption)}</strong> /يوم</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full glass glass-card rounded-full h-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLowStock ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-white/65'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-left text-[10px] text-white/65 mt-1 font-mono">
                    السعة: {toEnglishDigits(percentage)}% من {toEnglishDigits(item.maxCapacity.toLocaleString('en-US'))} {item.unit}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div>
                {isLowStock ? (
                  <button
                    onClick={() => handleOpenPO(item)}
                    className="w-full glass glass-card hover:bg-white/10 active:scale-95 text-white text-xs font-bold py-2.5 px-4 rounded-[18px] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>إنشاء أمر شراء (PO)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenPO(item)}
                    className="w-full glass glass-card hover:bg-white/10 text-white text-xs font-bold py-2.5 px-4 rounded-[18px] border transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    طلب توريد استباقي
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Purchase Orders Table */}
      <div className="glass rounded-[24px] mt-8">
        <div className="p-5 border-b flex justify-between items-center glass glass-card">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-white/65" />
            <span>سجل أوامر الشراء المنشأة حديثاً (Purchase Orders)</span>
          </h3>
          <span className="text-xs glass glass-active text-white px-3 py-1 rounded-full font-bold font-mono">
            {toEnglishDigits(purchaseOrders.length)} أوامر
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm text-white">
            <thead className="glass glass-card text-white text-xs uppercase font-bold border-b">
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
            <tbody className="divide-y divide-white/20">
              {purchaseOrders.map(po => (
                <tr key={po.id} className="hover:bg-white/10 transition-colors">
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => {
                        setViewingPO(po);
                        setIsEditingPO(false);
                      }}
                      className="font-bold text-white underline decoration-white/65 hover:text-white/65 cursor-pointer transition-colors flex items-center gap-1.5 group font-mono"
                      title="عرض تفاصيل أمر الشراء"
                    >
                      <span>{toEnglishDigits(po.id)}</span>
                      <span className="text-[10px] opacity-70 group-hover:opacity-100 transition-opacity">↗</span>
                    </button>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-white">{po.itemName}</td>
                  <td className="px-5 py-3.5 text-white/65">{po.supplierName}</td>
                  <td className="px-5 py-3.5 font-bold text-white font-mono">{toEnglishDigits(po.quantity.toLocaleString('en-US'))}</td>
                  <td className="px-5 py-3.5 font-bold text-white font-mono">{toEnglishDigits(po.totalCost.toLocaleString('en-US'))} ر.س</td>
                  <td className="px-5 py-3.5">
                    {po.createdBy === 'AI_AGENT' ? (
                      <span className="text-xs glass glass-active text-white px-2.5 py-0.5 rounded-lg font-bold inline-flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-white/65" /> AI Agent
                      </span>
                    ) : (
                      <span className="text-xs glass text-white/65 px-2.5 py-0.5 rounded-lg font-medium inline-flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-white/65" /> موظف المشتريات
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {po.status === 'SENT' ? (
                      <span className="text-xs glass glass-active text-white px-3 py-1 rounded-full font-bold inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-white/65" /> تم الإرسال
                      </span>
                    ) : po.status === 'APPROVED' ? (
                      <span className="text-xs glass glass-active text-white px-3 py-1 rounded-full font-bold">
                        معتمد
                      </span>
                    ) : (
                      <span className="text-xs glass text-white/65 px-3 py-1 rounded-full font-bold">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/[0.06] animate-in fade-in">
          <div className="font-sans glass rounded-[24px] w-full max-w-lg p-6 space-y-4 text-white border">
            <div className="flex justify-between items-start border-b border-white/14 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>إنشاء أمر شراء جديد (Purchase Order)</span>
                </h3>
                <p className="text-xs text-white/65 mt-0.5">
                  إعادة تزويد مخزون: <strong className="text-white">{selectedItemForPO.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedItemForPO(null)}
                className="text-white/65 hover:text-white glass glass-card hover:bg-white/10 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-colors border"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-white mb-1">المورد المعتمد:</label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full glass glass-card border rounded-[18px] p-2.5 text-sm text-white focus:outline-none focus:"
                >
                  {initialSuppliers.map(sup => (
                    <option key={sup.id} value={sup.name} className="text-white">
                      {sup.name} - (توصيل: {sup.leadTime})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  الكمية المطلوبة ({selectedItemForPO.unit}):
                </label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={poQuantity}
                  onChange={(e) => setPoQuantity(Number(e.target.value))}
                  className="w-full glass glass-card border rounded-[18px] p-2.5 text-sm text-white focus:outline-none focus:font-mono"
                />
              </div>

              <div className="glass glass-card border p-3.5 rounded-[18px] flex justify-between items-center text-sm">
                <span className="text-white/65 font-medium">التكلفة التقديرية الإجمالية:</span>
                <span className="text-lg font-bold text-white font-mono">
                  {toEnglishDigits((poQuantity * selectedItemForPO.unitCost).toFixed(2))} ر.س
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreatePO}
                className="flex-1 glass glass-card hover:bg-white/10 active:scale-95 text-white font-bold py-3 rounded-[18px] transition-all text-sm cursor-pointer"
              >
                تأكيد وإصدار أمر الشراء
              </button>
              <button
                onClick={() => setSelectedItemForPO(null)}
                className="px-5 glass glass-card hover:bg-white/10 text-white font-bold py-3 rounded-[18px] border transition-all text-sm cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View & Edit Purchase Order Details */}
      {viewingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/[0.06] animate-in fade-in">
          <div className="font-sans glass rounded-[24px] w-full max-w-lg p-6 space-y-5 text-white border relative">
            
            {/* Edit Button in Header (Far Left) */}
            <button
              type="button"
              onClick={isEditingPO ? () => setIsEditingPO(false) : handleOpenEditPO}
              className="absolute left-6 top-6 flex items-center gap-1.5 px-3 py-1.5 rounded-[18px] glass glass-card hover:bg-white/10 text-white border text-xs font-bold transition-all cursor-pointer z-10"
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
                    تفاصيل أمر الشراء ({toEnglishDigits(viewingPO.id)})
                  </h3>
                  <p className="text-xs text-white/65 mt-0.5">
                    مستند توريد رسمي موجه للمورد
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setViewingPO(null);
                  setIsEditingPO(false);
                }}
                className="text-white/65 hover:text-white glass glass-card hover:bg-white/10 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-colors border"
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
                  <select
                    value={editPOSupplier}
                    onChange={(e) => setEditPOSupplier(e.target.value)}
                    className="w-full glass glass-card border rounded-[18px] p-2.5 text-sm text-white focus:outline-none focus:text-center"
                  >
                    {initialSuppliers.map(s => (
                      <option key={s.id} value={s.name} className="text-white">{s.name} ({s.city})</option>
                    ))}
                  </select>
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
                    className="flex-1 glass glass-card hover:bg-white/10 text-white font-bold py-2.5 rounded-[18px] transition-all text-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>حفظ التعديل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingPO(false)}
                    className="px-4 glass glass-card hover:bg-white/10 text-white font-bold py-2.5 rounded-[18px] border transition-all text-xs cursor-pointer"
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
                    {toEnglishDigits(viewingPO.id)}
                  </span>
                </div>

                {/* 2. Item Name */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">الصنف المطلوب</span>
                  <span className="font-bold text-white text-base mt-0.5">
                    {viewingPO.itemName}
                  </span>
                </div>

                {/* 3. Supplier Name */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">المورد المعتمد</span>
                  <span className="font-semibold text-white text-sm flex items-center justify-center gap-1.5 mt-0.5">
                    <Building2 className="w-4 h-4 text-white/65" />
                    <span>{viewingPO.supplierName}</span>
                  </span>
                </div>

                {/* 4. Quantity */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">الكمية المطلوبة</span>
                  <span className="font-bold text-white text-base font-mono mt-0.5">
                    {toEnglishDigits(viewingPO.quantity.toLocaleString('en-US'))} وحدة
                  </span>
                </div>

                {/* 5. Total Cost */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">التكلفة التقديرية الإجمالية</span>
                  <span className="font-extrabold text-white text-lg font-mono mt-0.5">
                    {toEnglishDigits(viewingPO.totalCost.toLocaleString('en-US'))} ر.س
                  </span>
                </div>

                {/* 6. Creation Time */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">تاريخ الإنشاء</span>
                  <span className="text-white text-xs font-medium font-mono mt-0.5">
                    {toEnglishDigits(viewingPO.createdAt)}
                  </span>
                </div>

                {/* 7. Creator */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-white/65 text-xs font-medium">جهة الإصدار</span>
                  <span className="text-xs font-bold text-white glass px-3 py-1 rounded-md border flex items-center justify-center gap-1.5 mt-1">
                    {viewingPO.createdBy === 'AI_AGENT' ? (
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
                  <span className="text-white/65 text-xs font-medium">حالة الأمر الحالية</span>
                  <span className="text-xs font-bold px-3 py-1 rounded-full border border-white/14 mt-1">
                    {viewingPO.status === 'SENT' ? (
                      <span className="text-white flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-white/65" /> تم الإرسال للمورد
                      </span>
                    ) : viewingPO.status === 'APPROVED' ? (
                      <span className="text-white">معتمد</span>
                    ) : (
                      <span className="text-white/65">بانتظار الموافقة النهائية</span>
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
                className={`w-full py-3.5 px-6 rounded-2xl font-bold  transition-all flex items-center justify-center gap-2 text-sm ${
                  viewingPO.status === 'SENT'
                    ? 'glass text-white/65 cursor-not-allowed border'
                    : 'glass glass-card hover:bg-white/10 active:scale-[0.99] text-white cursor-pointer'
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
                className="w-full glass glass-card hover:bg-white/10 text-white font-bold py-2.5 rounded-[18px] border transition-all text-xs cursor-pointer"
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
