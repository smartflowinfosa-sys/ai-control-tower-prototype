"use client";

import { useState, useEffect } from 'react';
import { SupabaseInventoryItem } from '@/lib/supabaseService';
import { initialSuppliers, PurchaseOrder, getSessionPurchaseOrders, addPurchaseOrderToSession } from '@/lib/mockInventoryData';
import { useLanguage, CATEGORY_TRANSLATIONS, ITEM_NAME_TRANSLATIONS } from '@/components/common/LanguageContext';
import Link from 'next/link';
import GlassSelect from '@/components/common/GlassSelect';
import { Building2, Check, X, AlertTriangle, RefreshCw } from 'lucide-react';

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
  const { lang, t, isRtl } = useLanguage();
  const items = initialItems;
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItemForPO, setSelectedItemForPO] = useState<SupabaseInventoryItem | null>(null);
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

  // Bilingual Item Name Resolver
  const getItemDisplayName = (item: SupabaseInventoryItem): string => {
    if (lang === 'en') {
      return item.item_name_en || ITEM_NAME_TRANSLATIONS[item.item_name_ar] || item.item_name_ar;
    }
    return item.item_name_ar;
  };

  // Bilingual Category Key & Display
  const getItemCategoryKey = (item: SupabaseInventoryItem): string => {
    return item.category_ar || getItemCategory(item.item_name_ar);
  };

  const getItemCategoryDisplay = (item: SupabaseInventoryItem): string => {
    const arCat = getItemCategoryKey(item);
    if (lang === 'en') {
      if (item.category_en) return item.category_en;
      if (CATEGORY_TRANSLATIONS[arCat]) return CATEGORY_TRANSLATIONS[arCat].en;
      return arCat;
    }
    return arCat;
  };



  // Compute unique categories from real data
  const dynamicCategories = [
    'ALL',
    ...Array.from(new Set(items.map(item => getItemCategoryKey(item))))
  ];

  const filteredItems = items.filter(item => {
    const catKey = getItemCategoryKey(item);
    const catDisplay = getItemCategoryDisplay(item);
    const displayName = getItemDisplayName(item);

    const matchCat = selectedCategory === 'ALL' || catKey === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchSearch =
      item.item_name_ar.toLowerCase().includes(q) ||
      (item.item_name_en && item.item_name_en.toLowerCase().includes(q)) ||
      displayName.toLowerCase().includes(q) ||
      item.item_code.toLowerCase().includes(q) ||
      catKey.toLowerCase().includes(q) ||
      catDisplay.toLowerCase().includes(q);

    return matchCat && matchSearch;
  });

  const lowStockCount = items.filter(i => i.current_stock <= i.reorder_level).length;

  const handleOpenPO = (item: SupabaseInventoryItem) => {
    setSelectedItemForPO(item);
    const suggested = Math.max(item.reorder_level * 2, 1000);
    setPoQuantity(suggested);
    const cat = getItemCategoryKey(item);
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
      createdAt: new Date().toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
      createdBy: 'HUMAN',
    };

    addPurchaseOrderToSession(newPO);
    setPurchaseOrders(prev => [newPO, ...prev]);

    const msg = lang === 'ar'
      ? `تم إنشاء أمر الشراء ${newPO.id} لعدد ${toEnglishDigits(poQuantity)} وحدة من (${selectedSupplier}) بنجاح!`
      : `Purchase order ${newPO.id} for ${toEnglishDigits(poQuantity)} units from (${selectedSupplier}) created successfully!`;
    setSuccessToast(msg);
    setSelectedItemForPO(null);

    setTimeout(() => {
      setSuccessToast(null);
    }, 4500);
  };



  return (
    <div className="page-shell w-full mx-auto space-y-6 font-sans">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass-popover border border-white/40 text-white px-6 py-3.5 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 shadow-2xl">
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
              <p className="text-sm font-bold text-rose-200">{t('inventory.dbErrorTitle')}</p>
              <p className="text-xs text-white/80 mt-0.5">{fetchError}</p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-white/8 hover:bg-white/15 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/40 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('common.retry')}</span>
          </button>
        </div>
      )}

      {/* Header */}
      <header className="glass page-header mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">{t('inventory.title')}</h1>
          <p className="text-white/80 font-semibold text-sm mt-1.5">
            {t('inventory.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/suppliers"
            className="bg-white/8 hover:bg-white/15 text-white font-bold px-4 py-2.5 rounded-2xl border border-white/40 transition-all text-sm flex items-center gap-2 group cursor-pointer"
          >
            <Building2 className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
            <span>{t('inventory.suppliersDirectoryBtn')}</span>
          </Link>
        </div>
      </header>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-white/80">{t('inventory.kpiTotalItems')}</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2">{toEnglishDigits(items.length)}</div>
          <div className="text-xs text-white/65 font-semibold mt-1">{t('inventory.kpiTotalItemsDesc')}</div>
        </div>

        <div className="glass p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-white/80">{t('inventory.kpiLowStock')}</div>
          <div className={`text-3xl font-extrabold font-mono tracking-wider mt-2 ${lowStockCount > 0 ? 'text-rose-200' : 'text-white'}`}>
            {toEnglishDigits(lowStockCount)}
          </div>
          <div className="text-xs text-rose-200 font-semibold mt-1">{t('inventory.kpiLowStockDesc')}</div>
        </div>

        <div className="glass p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-white/80">{t('inventory.kpiActivePO')}</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2">{toEnglishDigits(purchaseOrders.length)}</div>
          <div className="text-xs text-white/65 font-semibold mt-1">{t('inventory.kpiActivePODesc')}</div>
        </div>

        <div className="glass p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-white/80">{t('inventory.kpiCoverage')}</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2">
            {items.length > 0 ? `${Math.round(((items.length - lowStockCount) / items.length) * 100)}%` : '0%'}
          </div>
          <div className="text-xs text-white/65 font-semibold mt-1">{t('inventory.kpiCoverageDesc')}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-sm font-bold text-white whitespace-nowrap">{t('inventory.categoryLabel')}</span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
            {dynamicCategories.map(cat => {
              const displayLabel = cat === 'ALL'
                ? t('inventory.categoryAll')
                : (lang === 'en' ? (CATEGORY_TRANSLATIONS[cat]?.en || cat) : cat);

              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? 'glass-active text-white'
                      : 'bg-white/8 text-white/80 hover:text-white hover:bg-white/15 border border-white/40'
                  }`}
                >
                  {displayLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder={t('inventory.searchPlaceholder')}
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
          const percentage = Math.min(100, Math.round((item.current_stock / item.reorder_level) * 100));
          const displayName = getItemDisplayName(item);
          const displayCategory = getItemCategoryDisplay(item);

          return (
            <div
              key={item.item_code}
              className={`glass p-6 flex flex-col justify-between transition-all duration-200 ${
                isLowStock ? 'border-rose-400/60' : ''
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-base text-white">{displayName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-semibold text-white/80 bg-white/8 px-2.5 py-0.5 rounded-lg border border-white/40 inline-block">
                        {displayCategory}
                      </span>
                      <span className="text-[10px] font-mono text-white font-bold">
                        {item.item_code}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border ${
                        isLowStock
                          ? 'bg-rose-500/15 text-rose-200 border-rose-300/30 animate-pulse'
                          : 'bg-teal-500/15 text-teal-100 border-teal-300/30'
                      }`}
                    >
                      {isLowStock ? t('inventory.statusLow') : t('inventory.statusStable')}
                    </span>
                    <span className={`text-xs font-mono font-bold ${percentage > 30 ? 'text-teal-500' : 'text-orange-500'}`}>
                      {toEnglishDigits(percentage)}%
                    </span>
                  </div>
                </div>

                {/* Stock Level Display */}
                <div className="glass p-4 rounded-xl border border-white/40 mb-4">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-xs text-white/80 font-medium">{t('inventory.currentStockLabel')}</span>
                    <span className={`text-xl font-extrabold font-mono ${isLowStock ? 'text-rose-200' : 'text-white'}`}>
                      {toEnglishDigits(item.current_stock.toLocaleString('en-US'))} <span className="text-xs text-white/65 font-normal">{t('common.unit')}</span>
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-white/80 mb-2 font-mono">
                    <span>{t('inventory.reorderLevelLabel')}: <strong className="text-white">{toEnglishDigits(item.reorder_level.toLocaleString('en-US'))}</strong></span>
                    <span>{t('inventory.itemCodeLabel')} <strong className="text-white">{item.item_code}</strong></span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-white/8 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        percentage <= 30
                          ? 'bg-orange-500'
                          : isLowStock
                          ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                          : 'bg-teal-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, percentage))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Button - Only when current_stock <= reorder_level */}
              {isLowStock && (
                <div>
                  <button
                    onClick={() => handleOpenPO(item)}
                    className="w-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                  >
                    <AlertTriangle className="w-4 h-4 text-white" />
                    <span>{lang === 'en' ? 'Issue Purchase Order' : 'إصدار أمر شراء'}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="glass border border-white/40 rounded-2xl p-12 text-center text-white">
          <p className="text-lg font-bold">{t('inventory.noItemsFound')}</p>
          <p className="text-xs text-white/80 mt-1">{t('inventory.noItemsFoundHint')}</p>
        </div>
      )}


      {/* Modal: Create Purchase Order */}
      {selectedItemForPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="font-sans glass-popover rounded-2xl w-full max-w-lg p-6 space-y-4 text-white border border-white/40 shadow-2xl">
            <div className="flex justify-between items-start border-b border-white/25 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{t('inventory.modalCreatePOTitle')}</span>
                </h3>
                <p className="text-xs text-white/80 mt-0.5 font-medium">
                  {t('inventory.modalRestockItem')} <strong className="text-white">{getItemDisplayName(selectedItemForPO)}</strong> ({selectedItemForPO.item_code})
                </p>
              </div>
              <button
                onClick={() => setSelectedItemForPO(null)}
                className="text-white/65 hover:text-white bg-white/8 hover:bg-white/15 border border-white/25 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-colors"
                aria-label={t('common.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-white mb-1">{t('inventory.modalSupplierLabel')}</label>
                <GlassSelect
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full bg-white/8 border border-white/25 rounded-xl p-2.5 text-sm text-white focus:outline-none"
                >
                  {initialSuppliers.map(sup => (
                    <option key={sup.id} value={sup.name}>
                      {sup.name} - ({sup.leadTime})
                    </option>
                  ))}
                </GlassSelect>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  {t('inventory.modalQuantityLabel')}
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
                <span className="text-white/80 font-medium">{t('inventory.modalTotalCostLabel')}</span>
                <span className="text-lg font-bold text-white font-mono">
                  {toEnglishDigits((poQuantity * (selectedItemForPO.cost_per_unit || 0.45)).toFixed(2))} {t('common.sar')}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreatePO}
                className="flex-1 bg-white/20 hover:bg-white/25 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm cursor-pointer shadow-lg"
              >
                {t('inventory.modalConfirmPOBtn')}
              </button>
              <button
                onClick={() => setSelectedItemForPO(null)}
                className="px-5 bg-white/8 hover:bg-white/15 text-white/80 font-bold py-3 rounded-xl border border-white/25 transition-all text-sm cursor-pointer"
              >
                {t('inventory.modalCancelBtn')}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
