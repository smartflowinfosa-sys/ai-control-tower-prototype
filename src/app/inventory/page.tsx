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
    setViewingPO(null);
    setSuccessToast("تم تأكيد الطلب وإرسال الإيميل للمورد بنجاح");
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
    const item = items.find(i => i.name === viewingPO.itemName || i.id === viewingPO.itemId);
    const unitCost = item ? item.unitCost : viewingPO.totalCost / viewingPO.quantity;
    const updatedTotalCost = Number((editPOQuantity * unitCost).toFixed(2));

    const updatedPO: PurchaseOrder = {
      ...viewingPO,
      quantity: editPOQuantity,
      supplierName: editPOSupplier,
      totalCost: updatedTotalCost,
    };

    setPurchaseOrders(prev => prev.map(p => (p.id === viewingPO.id ? updatedPO : p)));
    const sessionList = getSessionPurchaseOrders();
    const targetIdx = sessionList.findIndex(p => p.id === viewingPO.id);
    if (targetIdx !== -1) {
      sessionList[targetIdx] = updatedPO;
    }

    setViewingPO(updatedPO);
    setIsEditingPO(false);
    setSuccessToast(`تم حفظ تعديلات أمر الشراء ${toEnglishDigits(viewingPO.id)} بنجاح`);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4500);
  };

  return (
    <div className="max-w-6xl w-full mx-auto space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border border-teal-400/50 animate-in fade-in slide-in-from-top-4">
          <span className="text-xl">✨</span>
          <span className="text-sm font-bold">{successToast}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">إدارة المخزون والتوريد (Smart Inventory)</h1>
          <p className="text-slate-500 text-sm mt-1">
            مراقبة استهلاك المواد التشغيلية والتنبؤ بطلبيات إعادة الشحن التلقائية لعمليات زاهي
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/suppliers"
            className="bg-white/60 hover:bg-white text-teal-700 font-bold px-4 py-2.5 rounded-xl border border-white/60 shadow-sm transition-all text-sm flex items-center gap-2"
          >
            <Building2 className="w-4 h-4 text-teal-600" />
            <span>دليل الموردين والعروض</span>
          </Link>
        </div>
      </header>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-5">
          <div className="text-xs font-semibold text-slate-500">إجمالي أصناف التشغيل</div>
          <div className="text-3xl font-bold text-[#0ABAB5] mt-2">{toEnglishDigits(items.length)}</div>
          <div className="text-xs text-slate-400 mt-1">مواد استهلاكية وتغليف</div>
        </div>

        <div className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-5">
          <div className="text-xs font-semibold text-slate-500">أصناف تحت الحد الأدنى</div>
          <div className={`text-3xl font-bold mt-2 ${lowStockCount > 0 ? 'text-rose-500' : 'text-[#0ABAB5]'}`}>
            {toEnglishDigits(lowStockCount)}
          </div>
          <div className="text-xs text-slate-400 mt-1">تتطلب إصدار أوامر شراء فورية</div>
        </div>

        <div className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-5">
          <div className="text-xs font-semibold text-slate-500">أوامر الشراء النشطة (PO)</div>
          <div className="text-3xl font-bold text-[#0ABAB5] mt-2">{toEnglishDigits(purchaseOrders.length)}</div>
          <div className="text-xs text-slate-400 mt-1">قيد المراجعة والمطابقة</div>
        </div>

        <div className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-5">
          <div className="text-xs font-semibold text-slate-500">نسبة تغطية المخزون</div>
          <div className="text-3xl font-bold text-[#0ABAB5] mt-2">86%</div>
          <div className="text-xs text-slate-400 mt-1">تكفي العمليات لـ 5 أيام قادمة</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-sm font-bold text-slate-700 whitespace-nowrap">التصنيف:</span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-white/60 text-slate-600 hover:bg-white'
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
            className="w-full bg-white/70 border border-white/80 rounded-xl px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Inventory Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredItems.map(item => {
          const isLowStock = item.currentStock <= item.minThreshold;
          const percentage = Math.min(100, Math.round((item.currentStock / item.maxCapacity) * 100));

          return (
            <div
              key={item.id}
              className={`bg-white/50 backdrop-blur-xl border rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between transition-all duration-300 hover:bg-white/70 hover:shadow-lg ${
                isLowStock ? 'border-rose-300/80' : 'border-white/60'
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-base text-slate-800">{item.name}</h3>
                    <span className="text-[11px] font-semibold text-slate-500 bg-white/60 px-2 py-0.5 rounded-md border border-white/80 mt-1 inline-block">
                      {item.category}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border shadow-sm ${
                      isLowStock
                        ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'
                        : 'bg-teal-50 text-teal-700 border-teal-200'
                    }`}
                  >
                    {isLowStock ? 'تحت الحد الأدنى' : 'المخزون مستقر'}
                  </span>
                </div>

                {/* Stock Level Display */}
                <div className="bg-white/40 p-3.5 rounded-xl border border-white/60 mb-4">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-xs text-slate-500">الكمية الحالية:</span>
                    <span className={`text-xl font-extrabold ${isLowStock ? 'text-rose-600' : 'text-[#0ABAB5]'}`}>
                      {toEnglishDigits(item.currentStock.toLocaleString('en-US'))} <span className="text-xs text-slate-500 font-normal">{item.unit}</span>
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500 mb-2">
                    <span>الحد الأدنى: <strong>{toEnglishDigits(item.minThreshold.toLocaleString('en-US'))}</strong> {item.unit}</span>
                    <span>الاستهلاك: <strong>{toEnglishDigits(item.dailyConsumption)}</strong> /يوم</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200/60 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLowStock ? 'bg-rose-500' : 'bg-[#0ABAB5]'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-left text-[10px] text-slate-400 mt-1">
                    السعة: {toEnglishDigits(percentage)}% من {toEnglishDigits(item.maxCapacity.toLocaleString('en-US'))} {item.unit}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div>
                {isLowStock ? (
                  <button
                    onClick={() => handleOpenPO(item)}
                    className="w-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md shadow-rose-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>إنشاء أمر شراء (PO)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenPO(item)}
                    className="w-full bg-white/70 hover:bg-white text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl border border-white/80 shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer"
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
      <div className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden mt-8">
        <div className="p-4 border-b border-white/60 flex justify-between items-center bg-white/30">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" />
            <span>سجل أوامر الشراء المنشأة حديثاً (Purchase Orders)</span>
          </h3>
          <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 rounded-lg font-bold">
            {toEnglishDigits(purchaseOrders.length)} أوامر
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm text-slate-700">
            <thead className="bg-white/40 text-slate-600 text-xs uppercase font-bold border-b border-white/60">
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
            <tbody className="divide-y divide-white/40">
              {purchaseOrders.map(po => (
                <tr key={po.id} className="hover:bg-white/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => {
                        setViewingPO(po);
                        setIsEditingPO(false);
                      }}
                      className="font-bold text-teal-600 hover:text-teal-800 underline decoration-teal-400 hover:decoration-teal-600 underline-offset-4 cursor-pointer transition-colors flex items-center gap-1.5 group"
                      title="عرض تفاصيل أمر الشراء"
                    >
                      <span>{toEnglishDigits(po.id)}</span>
                      <span className="text-[10px] opacity-70 group-hover:opacity-100 transition-opacity">↗</span>
                    </button>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{po.itemName}</td>
                  <td className="px-5 py-3.5 text-slate-600">{po.supplierName}</td>
                  <td className="px-5 py-3.5 font-bold text-slate-800">{toEnglishDigits(po.quantity.toLocaleString('en-US'))}</td>
                  <td className="px-5 py-3.5 font-bold text-teal-700">{toEnglishDigits(po.totalCost.toLocaleString('en-US'))} ر.س</td>
                  <td className="px-5 py-3.5">
                    {po.createdBy === 'AI_AGENT' ? (
                      <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-md font-bold inline-flex items-center gap-1">
                        <Bot className="w-3 h-3 text-teal-600" /> AI Agent
                      </span>
                    ) : (
                      <span className="text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-600" /> موظف المشتريات
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {po.status === 'SENT' ? (
                      <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                        <Check className="w-3 h-3" /> تم الإرسال
                      </span>
                    ) : po.status === 'APPROVED' ? (
                      <span className="text-xs bg-teal-100 text-teal-800 border border-teal-300 px-2.5 py-0.5 rounded-full font-bold">
                        معتمد
                      </span>
                    ) : (
                      <span className="text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full font-bold">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="font-sans bg-white/90 backdrop-blur-2xl border border-white/80 rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span>إنشاء أمر شراء جديد (Purchase Order)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  إعادة تزويد مخزون: <strong className="text-teal-700">{selectedItemForPO.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedItemForPO(null)}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المورد المعتمد:</label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-800 focus:outline-none focus:border-teal-500 shadow-sm"
                >
                  {initialSuppliers.map(sup => (
                    <option key={sup.id} value={sup.name}>
                      {sup.name} - (توصيل: {sup.leadTime})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الكمية المطلوبة ({selectedItemForPO.unit}):
                </label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={poQuantity}
                  onChange={(e) => setPoQuantity(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm text-slate-800 focus:outline-none focus:border-teal-500 shadow-sm font-mono"
                />
              </div>

              <div className="bg-teal-50/60 border border-teal-200/60 p-3.5 rounded-xl flex justify-between items-center text-sm">
                <span className="text-slate-600 font-medium">التكلفة التقديرية الإجمالية:</span>
                <span className="text-lg font-bold text-teal-800 font-mono">
                  {toEnglishDigits((poQuantity * selectedItemForPO.unitCost).toFixed(2))} ر.س
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreatePO}
                className="flex-1 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold py-3 rounded-xl shadow-md shadow-teal-600/30 transition-all text-sm cursor-pointer"
              >
                تأكيد وإصدار أمر الشراء
              </button>
              <button
                onClick={() => setSelectedItemForPO(null)}
                className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all text-sm cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View & Edit Purchase Order Details */}
      {viewingPO && (
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
                    تفاصيل أمر الشراء ({toEnglishDigits(viewingPO.id)})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    مستند توريد رسمي موجه للمورد
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setViewingPO(null);
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
                    {initialSuppliers.map(s => (
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
                    {toEnglishDigits(viewingPO.id)}
                  </span>
                </div>

                {/* 2. Item Name */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-slate-500 text-xs font-medium">الصنف المطلوب</span>
                  <span className="font-bold text-slate-800 text-base mt-0.5">
                    {viewingPO.itemName}
                  </span>
                </div>

                {/* 3. Supplier Name */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-slate-500 text-xs font-medium">المورد المعتمد</span>
                  <span className="font-semibold text-slate-700 text-sm flex items-center justify-center gap-1.5 mt-0.5">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>{viewingPO.supplierName}</span>
                  </span>
                </div>

                {/* 4. Quantity */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-slate-500 text-xs font-medium">الكمية المطلوبة</span>
                  <span className="font-bold text-slate-800 text-base font-mono mt-0.5">
                    {toEnglishDigits(viewingPO.quantity.toLocaleString('en-US'))} وحدة
                  </span>
                </div>

                {/* 5. Total Cost */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-slate-500 text-xs font-medium">التكلفة التقديرية الإجمالية</span>
                  <span className="font-extrabold text-teal-700 text-lg font-mono mt-0.5">
                    {toEnglishDigits(viewingPO.totalCost.toLocaleString('en-US'))} ر.س
                  </span>
                </div>

                {/* 6. Creation Time */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-slate-500 text-xs font-medium">تاريخ الإنشاء</span>
                  <span className="text-slate-600 text-xs font-medium font-mono mt-0.5">
                    {toEnglishDigits(viewingPO.createdAt)}
                  </span>
                </div>

                {/* 7. Creator */}
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-slate-500 text-xs font-medium">جهة الإصدار</span>
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-md border border-teal-200 flex items-center justify-center gap-1.5 mt-1">
                    {viewingPO.createdBy === 'AI_AGENT' ? (
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
                  <span className="text-slate-500 text-xs font-medium">حالة الأمر الحالية</span>
                  <span className="text-xs font-bold px-3 py-1 rounded-full border mt-1">
                    {viewingPO.status === 'SENT' ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> تم الإرسال للمورد
                      </span>
                    ) : viewingPO.status === 'APPROVED' ? (
                      <span className="text-teal-700">معتمد</span>
                    ) : (
                      <span className="text-slate-700">بانتظار الموافقة النهائية</span>
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
                className={`w-full py-3.5 px-6 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-sm ${
                  viewingPO.status === 'SENT'
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white shadow-teal-600/30 active:scale-[0.99] cursor-pointer'
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
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-all text-xs cursor-pointer"
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
