"use client";

import { useState } from 'react';
import { initialSuppliers, initialInventoryItems, supplierQuotesMatrix, Supplier, InventoryItem } from '@/lib/mockInventoryData';
import Link from 'next/link';

export default function SuppliersPage() {
  const [suppliers] = useState<Supplier[]>(initialSuppliers);
  const [analyzingItemId, setAnalyzingItemId] = useState<string | null>('inv-5'); // Default analyze "أدوات المائدة"
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [orderedItemSuccess, setOrderedItemSuccess] = useState<string | null>(null);

  const lowStockItems = initialInventoryItems.filter(item => item.currentStock <= item.minThreshold);

  const handleAnalyzeQuotes = (itemId: string) => {
    setIsAiLoading(true);
    setAnalyzingItemId(itemId);
    setTimeout(() => {
      setIsAiLoading(false);
    }, 600);
  };

  const handleQuickOrder = (supplierName: string, itemName: string) => {
    setOrderedItemSuccess(`تم إصدار مسودة أمر شراء فوري لـ (${itemName}) من (${supplierName}) بنجاح!`);
    setTimeout(() => {
      setOrderedItemSuccess(null);
    }, 4500);
  };

  const currentQuotes = analyzingItemId ? supplierQuotesMatrix[analyzingItemId] || [] : [];
  const selectedItem = initialInventoryItems.find(i => i.id === analyzingItemId);
  const bestQuote = currentQuotes.length > 0
    ? [...currentQuotes].sort((a, b) => b.aiRecommendationScore - a.aiRecommendationScore)[0]
    : null;

  return (
    <div className="max-w-6xl w-full mx-auto space-y-6">
      {/* Toast */}
      {orderedItemSuccess && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border border-teal-400/50 animate-in fade-in slide-in-from-top-4">
          <span className="text-xl">✨</span>
          <span className="text-sm font-bold">{orderedItemSuccess}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">شبكة الموردين وعروض الشراء الذكية (Suppliers & AI Quotes)</h1>
          <p className="text-slate-500 text-sm mt-1">
            إدارة الموردين المعتمدين والمفاضلة الذكية بين عروض التوريد وسرعة التسليم لعمليات زاهي
          </p>
        </div>
        <Link
          href="/inventory"
          className="bg-white/60 hover:bg-white text-teal-700 font-bold px-4 py-2.5 rounded-xl border border-white/60 shadow-sm transition-all text-sm flex items-center gap-2"
        >
          <span>📦</span> العودة للمخزون
        </Link>
      </header>

      {/* Low Stock AI Procurement Section */}
      <div className="bg-white/50 backdrop-blur-xl border border-teal-300/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-6">
        <div className="border-b border-teal-100/60 pb-5 mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl animate-pulse">🧠</span>
                <h2 className="text-xl font-bold text-slate-800">تحليل العروض والمفاضلة بـ AI Agent</h2>
                <span className="bg-teal-100 text-teal-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  Smart Procurement
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                اختر صنفاً تحت الحد الأدنى لمقارنة عروض الأسعار واختيار المورد الأنسب تشغيلياً
              </p>
            </div>
            <div className="text-xs font-semibold text-teal-700 bg-teal-50/80 px-3 py-1.5 rounded-xl border border-teal-200/50 self-start sm:self-auto">
              أصناف بحاجة لتوريد: <span className="font-bold text-teal-900">{lowStockItems.length}</span>
            </div>
          </div>

          {/* Sub-navigation Horizontal Pills Bar */}
          <div className="flex flex-row items-center gap-3 overflow-x-auto pb-1 pt-1 bg-white/40 backdrop-blur-md p-2 rounded-2xl border border-teal-100/60 shadow-inner">
            <span className="text-xs font-bold text-slate-500 shrink-0 px-2 flex items-center gap-1.5">
              <span>🎯</span> أصناف حرجة:
            </span>
            {lowStockItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleAnalyzeQuotes(item.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-sm ${
                  analyzingItemId === item.id
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30 ring-2 ring-teal-400/50 scale-[1.02]'
                    : 'bg-white/80 text-slate-700 border border-white hover:bg-white hover:border-teal-200 hover:text-teal-700'
                }`}
              >
                <span>⚠️ {item.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors ${
                  analyzingItemId === item.id ? 'bg-white/20 text-white' : 'bg-teal-50 text-teal-700 border border-teal-100'
                }`}>
                  تحليل العروض بـ AI Agent
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* AI Selected Item Comparison Matrix */}
        {selectedItem && (
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span>عروض الأسعار المتاحة لصنف:</span>
                <span className="text-teal-800 font-extrabold text-base bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200/60">
                  {selectedItem.name}
                </span>
                <span className="text-xs text-rose-500 font-semibold">
                  (المخزون الحالي: {selectedItem.currentStock} / الحد الأدنى: {selectedItem.minThreshold})
                </span>
              </h3>

              {bestQuote && !isAiLoading && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
                  <span>✨ التوصية الأذكى:</span>
                  <span>{bestQuote.supplierName}</span>
                  <span className="text-[10px] bg-emerald-200/60 px-1.5 py-0.5 rounded">تطابق {bestQuote.aiRecommendationScore}%</span>
                </div>
              )}
            </div>

            {isAiLoading ? (
              <div className="p-12 text-center text-teal-700 font-bold flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                <span>يقوم وكيل الذكاء الاصطناعي بمطابقة التكاليف وسرعات التسليم...</span>
              </div>
            ) : currentQuotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {currentQuotes.map((quote, idx) => {
                  const isBest = quote.supplierId === bestQuote?.supplierId;

                  return (
                    <div
                      key={quote.supplierId}
                      className={`rounded-2xl p-4.5 border transition-all flex flex-col justify-between ${
                        isBest
                          ? 'bg-white/80 border-teal-400 shadow-[0_8px_30px_rgba(13,148,136,0.15)] ring-2 ring-teal-500/20'
                          : 'bg-white/40 border-white/60 hover:bg-white/60'
                      }`}
                    >
                      <div>
                        {/* Card Top */}
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-slate-800 text-sm">{quote.supplierName}</h4>
                          {isBest && (
                            <span className="bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                              الخيار الأفضل
                            </span>
                          )}
                        </div>

                        {/* Price & Lead Time */}
                        <div className="bg-white/60 p-3 rounded-xl border border-white/80 mb-3 space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">سعر الوحدة:</span>
                            <span className="font-extrabold text-teal-800 text-base">{quote.unitPrice} ر.س</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">مدة التوصيل:</span>
                            <span className="font-bold text-slate-700">{quote.leadTimeHours} ساعة</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">الحد الأدنى للطلب:</span>
                            <span className="font-bold text-slate-700">{quote.minOrderQuantity.toLocaleString('ar-SA')} حبة</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">تقييم الجودة:</span>
                            <span className="font-bold text-amber-600">⭐ {quote.qualityRating} / 5</span>
                          </div>
                        </div>

                        {/* AI Reasoning */}
                        <div className="text-xs text-slate-600 leading-relaxed bg-teal-50/40 p-2.5 rounded-lg border border-teal-100/50 mb-3">
                          <strong className="text-teal-800 block mb-0.5 text-[11px]">تحليل الوكيل الذكي:</strong>
                          {quote.aiReasoning}
                        </div>
                      </div>

                      <button
                        onClick={() => handleQuickOrder(quote.supplierName, selectedItem.name)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          isBest
                            ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/30'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span>⚡</span> اعتماد وإصدار أمر شراء
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
      </div>

      {/* Suppliers Master Directory */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span>🏢</span> دليل الموردين المعتمدين (Approved Suppliers)
          </h2>
          <span className="text-xs font-semibold text-slate-500 bg-white/60 px-3 py-1 rounded-lg border border-white/60">
            {suppliers.length} موردين معتمدين
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {suppliers.map(sup => (
            <div
              key={sup.id}
              className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-5 flex flex-col justify-between hover:bg-white/70 hover:shadow-lg transition-all"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-base text-slate-800">{sup.name}</h3>
                    <p className="text-xs text-slate-500">{sup.category}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    ⭐ {sup.rating}
                  </span>
                </div>

                <div className="bg-white/40 p-3 rounded-xl border border-white/60 space-y-1.5 text-xs text-slate-600 mb-3">
                  <div className="flex justify-between">
                    <span>الموقع:</span>
                    <strong className="text-slate-800">{sup.city}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>زمن التوريد المعتاد:</span>
                    <strong className="text-teal-800">{sup.leadTime}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>نسبة الموثوقية:</span>
                    <strong className="text-emerald-700">{sup.reliability}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>التصنيف المالي:</span>
                    <strong className="text-slate-700">{sup.pricingTier}</strong>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {sup.tags.map(t => (
                    <span key={t} className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200/50 px-2 py-0.5 rounded-md font-semibold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-white/60 flex justify-between items-center text-xs">
                <span className="text-slate-500">هاتف: {sup.phone}</span>
                <span className="text-teal-700 font-bold">{sup.activeOrdersCount} طلبيات جارية</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
