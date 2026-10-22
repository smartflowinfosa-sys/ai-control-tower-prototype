"use client";

import { useState, useEffect, useRef } from 'react';
import { SupabaseInventoryItem, uploadInvoice, receivePurchaseOrder, fetchInventoryItems, fetchPurchaseOrders, SupabasePurchaseOrder } from '@/lib/supabaseService';
import { initialSuppliers, PurchaseOrder, getSessionPurchaseOrders, addPurchaseOrderToSession } from '@/lib/mockInventoryData';
import { useLanguage, CATEGORY_TRANSLATIONS, ITEM_NAME_TRANSLATIONS } from '@/components/common/LanguageContext';
import Link from 'next/link';
import GlassSelect from '@/components/common/GlassSelect';
import { Building2, Check, X, AlertTriangle, RefreshCw, PackageCheck, UploadCloud, FileText, CheckCircle2, Loader2, ArrowUpRight } from 'lucide-react';
import { useSession } from 'next-auth/react';

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
  initialPurchaseOrders?: SupabasePurchaseOrder[];
  fetchError?: string | null;
}

export default function InventoryClient({ initialItems, initialPurchaseOrders = [], fetchError }: InventoryClientProps) {
  const { lang, t, isRtl, currentUser } = useLanguage();
  const [items, setItems] = useState<SupabaseInventoryItem[]>(() =>
    [...initialItems].sort((a, b) =>
      a.item_code.localeCompare(b.item_code, undefined, { numeric: true, sensitivity: 'base' })
    )
  );

  useEffect(() => {
    setItems([...initialItems].sort((a, b) =>
      a.item_code.localeCompare(b.item_code, undefined, { numeric: true, sensitivity: 'base' })
    ));
  }, [initialItems]);

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItemForPO, setSelectedItemForPO] = useState<SupabaseInventoryItem | null>(null);
  const [poQuantity, setPoQuantity] = useState<number>(1000);
  const [selectedSupplier, setSelectedSupplier] = useState<string>(initialSuppliers[0].name);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() =>
    initialPurchaseOrders && initialPurchaseOrders.length > 0
      ? (initialPurchaseOrders as unknown as PurchaseOrder[])
      : getSessionPurchaseOrders()
  );
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Active Purchase Orders (dynamically filtered: received orders disappear immediately)
  const activePOs = purchaseOrders.filter(po => {
    const orig = (po.status || '').trim();
    const lower = orig.toLowerCase();
    return orig !== 'تم الاستلام' && orig !== 'تم الاستلام بنجاح' && lower !== 'received' && lower !== 'delivered';
  });

  // Role-Based Access Control (RBAC): Only Warehouse Managers, Operations Managers, or Admins can receive stock
  const authorizedRoles = [
    'warehouse manager',
    'operations manager',
    'operations & logistics control',
    'admin',
    'مدير العمليات',
    'مدير المستودع',
    'مسؤول المستودع',
    'مشرف العمليات',
  ];
  const { data: session } = useSession();
  const sessionRole = ((session?.user?.role || (session?.user as any)?.role || '') as string).toLowerCase();
  const isSessionAdmin = sessionRole === 'admin' || sessionRole === 'superadmin';
  const userRole = (currentUser?.role_en || currentUser?.role_ar || '').toLowerCase();

  const isAuthorized = Boolean(
    isSessionAdmin ||
    (currentUser && (
      authorizedRoles.some(r => userRole.includes(r)) ||
      userRole.includes('manager') ||
      userRole.includes('admin') ||
      userRole.includes('ops')
    ))
  );

  // Receive Stock & Invoice Modal State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState<boolean>(false);
  const [receivePoId, setReceivePoId] = useState<string>('');
  const [receivedQty, setReceivedQty] = useState<number | ''>('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [receiverSignature, setReceiverSignature] = useState<string>('');
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState<boolean>(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleStorageError = (e: any) => {
      if (e.detail?.message) {
        setStorageNotice(e.detail.message);
      }
    };
    window.addEventListener('supabase_storage_bucket_error', handleStorageError);
    return () => {
      window.removeEventListener('supabase_storage_bucket_error', handleStorageError);
    };
  }, []);

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

    const handleUpdatePO: EventListener = (event) => {
      const updated = (event as CustomEvent<PurchaseOrder>).detail;
      if (updated) {
        setPurchaseOrders(prev => prev.map(p => p.id === updated.id ? updated : p));
      }
    };

    const handlePOReceived: EventListener = (event) => {
      const detail = (event as CustomEvent<any>).detail;
      if (detail?.id || detail?.poNumber) {
        const targetId = detail.id || detail.poNumber;
        setPurchaseOrders(prev =>
          prev.map(p =>
            p.id === targetId
              ? {
                  ...p,
                  status: 'تم الاستلام',
                  invoiceUrl: detail.invoiceUrl || p.invoiceUrl,
                  receivedQuantity: detail.receivedQuantity || p.receivedQuantity,
                }
              : p
          )
        );
      }
    };

    window.addEventListener('ai_purchase_order_created', handleNewAiPO);
    window.addEventListener('ai_purchase_order_updated', handleUpdatePO);
    window.addEventListener('purchase_order_received', handlePOReceived);

    // Fetch latest purchase orders directly from Supabase
    fetchPurchaseOrders()
      .then(pos => {
        if (pos && pos.length > 0) {
          setPurchaseOrders(pos as unknown as PurchaseOrder[]);
        }
      })
      .catch(err => {
        console.warn('Background PO refresh warning:', err);
      });

    return () => {
      window.removeEventListener('ai_purchase_order_created', handleNewAiPO);
      window.removeEventListener('ai_purchase_order_updated', handleUpdatePO);
      window.removeEventListener('purchase_order_received', handlePOReceived);
    };
  }, []);

  const openReceiveModal = (defaultPoId?: string) => {
    const targetId = defaultPoId || activePOs[0]?.id || '';
    setReceivePoId(targetId);
    const po = purchaseOrders.find(p => p.id === targetId);
    if (po) {
      setReceivedQty(po.quantity);
    } else {
      setReceivedQty(1000);
    }
    setReceiverSignature('');
    setInvoiceFile(null);
    setReceiptError(null);
    setIsReceiveModalOpen(true);
  };

  const handleSelectPO = (poId: string) => {
    setReceivePoId(poId);
    const po = purchaseOrders.find(p => p.id === poId);
    if (po) {
      setReceivedQty(po.quantity);
    }
    setReceiptError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setInvoiceFile(e.target.files[0]);
      setReceiptError(null);
    }
  };

  // Convert and enforce standard English numerals (0-9)
  const handleQuantityChange = (valStr: string) => {
    const converted = valStr
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[^0-9]/g, '');
    if (converted === '') {
      setReceivedQty('');
    } else {
      setReceivedQty(Number(converted));
    }
  };

  const handleConfirmReceipt = async () => {
    if (!receivePoId) {
      setReceiptError(t('inventory.noPOSelected'));
      return;
    }

    const po = purchaseOrders.find(p => p.id === receivePoId);
    if (!po) {
      setReceiptError(t('inventory.noPOSelected'));
      return;
    }

    const finalQty = Number(receivedQty);
    if (isNaN(finalQty) || finalQty <= 0) {
      setReceiptError(t('inventory.invalidQuantity'));
      return;
    }

    if (!invoiceFile) {
      setReceiptError(t('inventory.noInvoiceFile'));
      return;
    }

    if (!receiverSignature.trim()) {
      setReceiptError(t('inventory.signatureRequired'));
      return;
    }

    setIsSubmittingReceipt(true);
    setReceiptError(null);

    try {
      // Step 1: Sanitize File Name (Strip Arabic/special characters and generate safe ASCII filename)
      const rawExt = invoiceFile.name && invoiceFile.name.includes('.')
        ? invoiceFile.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'pdf'
        : 'pdf';
      const safeRandom = Math.random().toString(36).substring(7);
      const safeFileName = `invoice-${Date.now()}-${safeRandom}.${rawExt}`;
      const sanitizedInvoiceFile = new File([invoiceFile], safeFileName, {
        type: invoiceFile.type || 'application/pdf',
      });

      // Step 1: Upload invoice to Supabase Storage 'invoices' bucket
      const invoicePublicUrl = await uploadInvoice(sanitizedInvoiceFile, po.id);

      // Step 1.5: Trigger n8n Webhook for automated Google Drive archiving (STRICTLY inside success block)
      if (invoicePublicUrl) {
        try {
          const supplierName = po.supplierName || (po as any).supplier_name || 'المورد المعتمد';
          const invoiceDate = new Date().toISOString().split('T')[0];

          fetch('https://n8n-p10bgpahkliy9hghak21zv3e.178.105.219.96.sslip.io/webhook/zahi-invoice-upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              supplier_name: supplierName,
              invoice_date: invoiceDate,
              file_url: invoicePublicUrl,
            }),
          }).catch((webhookErr) => {
            console.warn('n8n webhook notification error (silent):', webhookErr);
          });
        } catch (triggerErr) {
          console.warn('n8n webhook trigger error (silent):', triggerErr);
        }
      }

      // Step 2: Receive PO in Supabase, update inventory_items current_stock, and log receiver signature for audit
      const result = await receivePurchaseOrder(
        po.id,
        finalQty,
        invoicePublicUrl,
        receiverSignature.trim(),
        po.itemId
      );

      // Step 3: Refresh local inventory items immediately
      if (result.itemCode) {
        setItems(prevItems =>
          prevItems.map(item =>
            item.item_code === result.itemCode
              ? { ...item, current_stock: result.newStock }
              : item
          )
        );
      }

      // Step 4: Update purchase orders state locally
      setPurchaseOrders(prev =>
        prev.map(p =>
          p.id === po.id
            ? {
                ...p,
                status: 'تم الاستلام',
                receivedQuantity: finalQty,
                receiverSignature: receiverSignature.trim(),
                invoiceUrl: invoicePublicUrl,
                receivedAt: new Date().toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
              }
            : p
        )
      );

      // Background re-fetch to ensure complete sync with database
      try {
        const [fresh, freshPOs] = await Promise.all([
          fetchInventoryItems(),
          fetchPurchaseOrders().catch(() => []),
        ]);
        if (fresh && fresh.length > 0) {
          setItems(fresh);
        }
        if (freshPOs && freshPOs.length > 0) {
          setPurchaseOrders(freshPOs as unknown as PurchaseOrder[]);
        }
      } catch (syncErr) {
        console.warn('Background sync warning:', syncErr);
      }

      const successMsg = lang === 'ar'
        ? `تم استلام ${toEnglishDigits(finalQty)} وحدة بنجاح وتحديث المخزون وتوثيق توقيع المستلم لأمر الشراء (${po.id}) ✨`
        : `Received ${toEnglishDigits(finalQty)} units, updated stock & logged receiver signature for (${po.id}) successfully ✨`;

      setSuccessToast(successMsg);
      setIsReceiveModalOpen(false);
      setInvoiceFile(null);
      setReceivePoId('');
      setReceivedQty('');
      setReceiverSignature('');

      setTimeout(() => {
        setSuccessToast(null);
      }, 5500);
    } catch (err: unknown) {
      console.error('Error during stock receiving:', err);
      setReceiptError(err instanceof Error ? err.message : 'حدث خطأ أثناء تأكيد الاستلام');
    } finally {
      setIsSubmittingReceipt(false);
    }
  };

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
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-black/80 border border-white/20 text-white px-6 py-3.5 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 shadow-2xl">
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
            className="bg-white/8 hover:bg-white/15 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('common.retry')}</span>
          </button>
        </div>
      )}

      {/* Header */}
      <header className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl mb-6 p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">{t('inventory.title')}</h1>
          <p className="text-slate-100 font-semibold text-sm mt-1.5 drop-shadow-sm">
            {t('inventory.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Role-Based Access Control (RBAC): Only authorized roles (e.g., Warehouse Manager, Operations Manager, Admin) can access stock receiving */}
          {isAuthorized && (
            <button
              onClick={() => openReceiveModal()}
              className="px-4 py-2.5 text-sm bg-white/5 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-xl text-white hover:bg-white/10 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <PackageCheck className="w-4 h-4 shrink-0 text-white" />
              <span>استلام مخزون</span>
            </button>
          )}

          <Link
            href="/suppliers"
            className="bg-white/5 hover:bg-white/15 text-white font-bold px-4 py-2.5 rounded-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all text-sm flex items-center gap-2 group cursor-pointer"
          >
            <Building2 className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
            <span>{t('inventory.suppliersDirectoryBtn')}</span>
          </Link>
        </div>
      </header>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-slate-100 drop-shadow-sm">{t('inventory.kpiTotalItems')}</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2 drop-shadow-sm">{toEnglishDigits(items.length)}</div>
          <div className="text-xs text-white/80 font-semibold mt-1 drop-shadow-sm">{t('inventory.kpiTotalItemsDesc')}</div>
        </div>

        <div className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-slate-100 drop-shadow-sm">{t('inventory.kpiLowStock')}</div>
          <div className={`text-3xl font-extrabold font-mono tracking-wider mt-2 drop-shadow-sm ${lowStockCount > 0 ? 'text-rose-200' : 'text-white'}`}>
            {toEnglishDigits(lowStockCount)}
          </div>
          <div className="text-xs text-rose-200 font-semibold mt-1 drop-shadow-sm">{t('inventory.kpiLowStockDesc')}</div>
        </div>

        <div className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-slate-100 drop-shadow-sm">{t('inventory.kpiActivePO')}</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2 drop-shadow-sm">{toEnglishDigits(activePOs.length)}</div>
          <div className="text-xs text-white/80 font-semibold mt-1 drop-shadow-sm">{t('inventory.kpiActivePODesc')}</div>
        </div>

        <div className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-slate-100 drop-shadow-sm">{t('inventory.kpiCoverage')}</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2 drop-shadow-sm">
            {items.length > 0 ? `${Math.round(((items.length - lowStockCount) / items.length) * 100)}%` : '0%'}
          </div>
          <div className="text-xs text-white/80 font-semibold mt-1 drop-shadow-sm">{t('inventory.kpiCoverageDesc')}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-sm font-bold text-white whitespace-nowrap drop-shadow-sm">{t('inventory.categoryLabel')}</span>
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
                      ? 'bg-white/20 border border-white/30 text-white font-extrabold'
                      : 'bg-white/8 text-white/80 hover:text-white hover:bg-white/15 border border-white/20'
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
            className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none focus:ring-2 focus:ring-white/25"
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
              className={`!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 ${
                isLowStock ? 'border-rose-400/60' : ''
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-base text-white">{displayName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-semibold text-white/80 bg-white/8 px-2.5 py-0.5 rounded-lg border border-white/20 inline-block">
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
                <div className="bg-white/5 p-4 rounded-xl border border-white/20 mb-4">
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
        <div className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-12 text-center text-white">
          <p className="text-lg font-bold drop-shadow-sm">{t('inventory.noItemsFound')}</p>
          <p className="text-xs text-white/80 mt-1 drop-shadow-sm">{t('inventory.noItemsFoundHint')}</p>
        </div>
      )}


      {/* Modal: Create Purchase Order */}
      {selectedItemForPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in">
          <div className="font-sans bg-zinc-950/90 rounded-2xl w-full max-w-lg p-6 space-y-4 text-white border border-white/20 shadow-2xl">
            <div className="flex justify-between items-start border-b border-white/20 pb-3">
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
                className="text-white/65 hover:text-white bg-white/8 hover:bg-white/15 border border-white/20 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-colors"
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
                  className="w-full bg-white/8 border border-white/20 rounded-xl p-2.5 text-sm text-white focus:outline-none"
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
                  className="w-full bg-white/8 border border-white/20 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/25 font-mono"
                />
              </div>

              <div className="bg-white/8 border border-white/20 p-3.5 rounded-xl flex justify-between items-center text-sm">
                <span className="text-white/80 font-medium">{t('inventory.modalTotalCostLabel')}</span>
                <span className="text-lg font-bold text-white font-mono">
                  {toEnglishDigits((poQuantity * (selectedItemForPO.cost_per_unit || 0.45)).toFixed(2))} {t('common.sar')}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreatePO}
                className="flex-1 bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm cursor-pointer shadow-lg border border-white/20"
              >
                {t('inventory.modalConfirmPOBtn')}
              </button>
              <button
                onClick={() => setSelectedItemForPO(null)}
                className="px-5 bg-white/8 hover:bg-white/15 text-white/80 font-bold py-3 rounded-xl border border-white/20 transition-all text-sm cursor-pointer"
              >
                {t('inventory.modalCancelBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Receive Stock & Upload Invoice */}
      {isReceiveModalOpen && (() => {
        const selectedReceivePO = purchaseOrders.find(p => p.id === receivePoId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in">
            <div className="font-sans bg-zinc-950/90 rounded-3xl w-full max-w-lg p-6 sm:p-7 space-y-4 text-white border border-white/20 shadow-2xl relative">
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-white/20 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/40 rounded-2xl text-emerald-300 shrink-0">
                    <PackageCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                      <span>{t('inventory.modalReceiveTitle')}</span>
                    </h3>
                    <p className="text-xs text-white/70 mt-0.5 font-medium">
                      {t('inventory.modalReceiveSubtitle')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!isSubmittingReceipt) setIsReceiveModalOpen(false);
                  }}
                  disabled={isSubmittingReceipt}
                  className="text-white/65 hover:text-white bg-white/8 hover:bg-white/15 border border-white/20 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
                  aria-label={t('common.close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Error Banner */}
              {receiptError && (
                <div className="bg-rose-500/20 border border-rose-400/40 rounded-xl p-3 flex items-center gap-2.5 text-xs text-rose-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-300" />
                  <span>{receiptError}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* 1. Dropdown: Select Purchase Order */}
                <div>
                  <label className="block text-xs font-bold text-white mb-1.5">
                    {t('inventory.selectPO')}
                  </label>
                  <GlassSelect
                    value={receivePoId}
                    onChange={(e) => handleSelectPO(e.target.value)}
                    className="w-full bg-white/8 border border-white/20 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  >
                    <option value="" disabled>
                      {activePOs.length === 0
                        ? (lang === 'en' ? 'No pending active orders' : 'لا توجد أوامر شراء نشطة بانتظار الاستلام')
                        : t('inventory.selectPOPlaceholder')}
                    </option>
                    {activePOs.map(po => (
                      <option key={po.id} value={po.id}>
                        {po.id} - {po.itemName} ({toEnglishDigits(po.quantity)} {t('common.unit')})
                      </option>
                    ))}
                  </GlassSelect>
                </div>

                {/* Selected PO Details Card */}
                {selectedReceivePO && (
                  <div className="bg-white/8 border border-white/20 rounded-2xl p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">{t('inventory.selectedPODetails')}</span>
                      <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded-lg border border-white/20" dir="ltr">
                        {selectedReceivePO.id}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-white/90">
                      <span className="text-white/70">{t('inventory.supplierNameLabel')}</span>
                      <span className="font-bold">{selectedReceivePO.supplierName}</span>
                    </div>
                    <div className="flex justify-between items-center text-white/90">
                      <span className="text-white/70">{t('inventory.orderedQuantity')}</span>
                      <span className="font-mono font-bold">{toEnglishDigits(selectedReceivePO.quantity)} {t('common.unit')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">{t('inventory.modalCurrentStatus')}</span>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        selectedReceivePO.status === 'تم الاستلام'
                          ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                          : 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                      }`}>
                        {selectedReceivePO.status === 'تم الاستلام' ? t('inventory.poStatusReceived') : selectedReceivePO.status}
                      </span>
                    </div>
                    {selectedReceivePO.receiverSignature && (
                      <div className="flex justify-between items-center text-white/90">
                        <span className="text-white/70">{t('inventory.receiverSignatureLabel')}</span>
                        <span className="font-bold text-emerald-300">{selectedReceivePO.receiverSignature}</span>
                      </div>
                    )}
                    {selectedReceivePO.invoiceUrl && (
                      <div className="flex justify-between items-center pt-1.5 border-t border-white/10">
                        <span className="text-emerald-300 font-medium">{t('inventory.invoiceUploadedBadge')}</span>
                        <a
                          href={selectedReceivePO.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="text-emerald-300 hover:text-emerald-200 underline font-bold flex items-center gap-1"
                        >
                          <span>{t('inventory.viewInvoice')}</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Input (Number): Actual Quantity Received */}
                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <label className="text-xs font-bold text-white">
                      {t('inventory.actualQuantityReceived')}
                    </label>
                    <span className="text-[10px] text-white/60">
                      {t('inventory.actualQuantityHint')}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    dir="ltr"
                    value={receivedQty}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
                      setReceivedQty(val === '' ? '' : Number(val));
                    }}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text');
                      if (pasted) {
                        e.preventDefault();
                        const val = pasted.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^0-9]/g, '');
                        setReceivedQty(val === '' ? '' : Number(val));
                      }
                    }}
                    placeholder="0"
                    style={{ direction: 'ltr', fontVariantNumeric: 'lining-nums tabular-nums' }}
                    className="w-full bg-white/8 border border-white/20 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40 font-mono text-left rtl:text-right [unicode-bidi:plaintext]"
                  />
                </div>

                {/* Storage Bucket Setup Alert Notice */}
                {storageNotice && (
                  <div className="p-3 bg-amber-500/20 border border-amber-400/50 rounded-xl text-amber-200 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                      <span className="font-bold">{storageNotice}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStorageNotice(null)}
                      className="text-white/60 hover:text-white p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* 3. File Upload (Input type="file"): Upload Invoice Copy */}
                <div>
                  <label className="block text-xs font-bold text-white mb-1.5">
                    {t('inventory.uploadInvoiceLabel')}
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,.pdf"
                    className="hidden"
                    id="invoice-file-input"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                      invoiceFile
                        ? 'border-emerald-400/60 bg-emerald-500/10'
                        : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30'
                    }`}
                  >
                    {invoiceFile ? (
                      <div className="flex items-center justify-between gap-3 text-left rtl:text-right">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-300 shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate max-w-[240px]">
                              {invoiceFile.name}
                            </p>
                            <p className="text-[10px] text-emerald-300 font-mono mt-0.5">
                              {(invoiceFile.size / 1024).toFixed(1)} KB • data
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInvoiceFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-white/70 hover:text-white text-xs px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg shrink-0 cursor-pointer border border-white/20"
                        >
                          {t('common.edit')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-2 text-white/80">
                        <UploadCloud className="w-7 h-7 text-emerald-300/80 mb-2 animate-bounce" />
                        <p className="text-xs font-bold text-white">انقر لاختيار ملف الفاتورة (صورة أو PDF)</p>
                        <p className="text-[10px] text-white/50 mt-1">{t('inventory.uploadInvoiceHint')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Receiver Signature / ID */}
                <div>
                  <label className="block text-xs font-bold text-white mb-1.5">
                    {t('inventory.receiverSignatureLabel')}
                  </label>
                  <input
                    type="text"
                    value={receiverSignature}
                    onChange={(e) => {
                      setReceiverSignature(e.target.value);
                      if (receiptError) setReceiptError(null);
                    }}
                    placeholder={t('inventory.receiverSignaturePlaceholder')}
                    required
                    className="w-full bg-white/8 border border-white/20 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40 placeholder:text-white/40"
                  />
                </div>
              </div>

              {/* 5. Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={handleConfirmReceipt}
                  disabled={isSubmittingReceipt || !receivePoId || !invoiceFile || !receivedQty || !receiverSignature.trim()}
                  className="flex-1 bg-emerald-600/85 hover:bg-emerald-600 active:scale-95 text-white font-extrabold py-3.5 rounded-xl transition-all text-sm cursor-pointer shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {isSubmittingReceipt ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>{t('inventory.receivingInProgress')}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>{t('inventory.confirmReceipt')}</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (!isSubmittingReceipt) setIsReceiveModalOpen(false);
                  }}
                  disabled={isSubmittingReceipt}
                  className="px-5 bg-white/8 hover:bg-white/15 text-white/80 font-bold py-3.5 rounded-xl border border-white/20 transition-all text-sm cursor-pointer disabled:opacity-50"
                >
                  {t('inventory.modalCancelBtn')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
