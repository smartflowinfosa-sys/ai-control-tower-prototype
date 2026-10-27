"use client";

import { useState, useEffect, useRef } from 'react';
import { SupabaseInventoryItem, uploadInvoice, receivePurchaseOrder, batchReceiveInventory, fetchInventoryItems, fetchPurchaseOrders, fetchSuppliersForItem, SupabasePurchaseOrder } from '@/lib/supabaseService';
import { initialSuppliers, PurchaseOrder, getSessionPurchaseOrders, addPurchaseOrderToSession } from '@/lib/mockInventoryData';
import { useLanguage, CATEGORY_TRANSLATIONS, ITEM_NAME_TRANSLATIONS } from '@/components/common/LanguageContext';
import Link from 'next/link';
import GlassSelect from '@/components/common/GlassSelect';
import {
  STANDARD_ITEM_CODES,
  compareItemCodes,
  CARTON_SIZES,
  REAL_INVENTORY_STOCK,
  INITIAL_UNREPLENISHED_CONSUMPTION,
  getStandardCodeInfo,
  getStockPolicy,
  getMockRestockDate,
  getDaysSinceRestock,
} from '@/constants/inventoryCodes';
import { triggerLowStockEmail } from '@/lib/notifications';
import { Building2, Check, X, AlertTriangle, RefreshCw, PackageCheck, UploadCloud, FileText, CheckCircle2, Loader2, ArrowUpRight, Sparkles, Trash2, Plus, ArrowUpDown, ChevronDown } from 'lucide-react';
import { useSession } from 'next-auth/react';

// Helper to ensure all digits are strictly English / Western (0-9)
const toEnglishDigits = (str: string | number): string => {
  if (str === null || str === undefined) return '';
  if (typeof str === 'number') {
    return new Intl.NumberFormat('en-US', { useGrouping: true }).format(str);
  }
  const clean = String(str).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
  const num = Number(clean);
  if (!isNaN(num) && clean.trim() !== '' && !clean.includes(':') && !clean.includes('-') && !clean.includes('/')) {
    return new Intl.NumberFormat('en-US', { useGrouping: true }).format(num);
  }
  return clean;
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

// Attaches the real min_stock_level / lead_time_days / last_restock_date (DB value wins, constants/mocks are the fallback).
const applyStockPolicy = (item: SupabaseInventoryItem): SupabaseInventoryItem => {
  const policy = getStockPolicy(item.item_code);
  const code = item.item_code.toUpperCase();
  return {
    ...item,
    min_stock_level: item.min_stock_level ?? policy.min_stock_level ?? null,
    lead_time_days: item.lead_time_days ?? policy.lead_time_days ?? null,
    last_restock_date: item.last_restock_date || getMockRestockDate(code),
  };
};

// Effective critical threshold: min_stock_level when known, otherwise legacy reorder_level.
const getMinLevel = (item: SupabaseInventoryItem): number =>
  item.min_stock_level ?? item.reorder_level;

export interface ReceivedItemRow {
  id: string;
  itemCode: string;
  quantityCartons: number | '';
}

interface InventoryClientProps {
  initialItems: SupabaseInventoryItem[];
  initialPurchaseOrders?: SupabasePurchaseOrder[];
  initialSupplierMappings?: Record<string, Array<{ id: string; name: string }>>;
  fetchError?: string | null;
}

export default function InventoryClient({
  initialItems,
  initialPurchaseOrders = [],
  initialSupplierMappings = {},
  fetchError
}: InventoryClientProps) {
  const { lang, t, isRtl, currentUser } = useLanguage();
  const [items, setItems] = useState<SupabaseInventoryItem[]>(() => {
    const fallbackItems: SupabaseInventoryItem[] = STANDARD_ITEM_CODES.map(std => ({
      item_code: std.code,
      item_name_ar: std.nameAr,
      item_name_en: std.nameEn,
      current_stock: REAL_INVENTORY_STOCK[std.code] ?? 0,
      reorder_level: 2000,
      cost_per_unit: 1.0,
      category_ar: 'صحون وأطباق',
      category_en: 'Plates & Dishes',
    }));
    const baseItems = initialItems && initialItems.length > 0 ? initialItems : fallbackItems;
    const merged = baseItems.map(item => {
      const code = item.item_code.toUpperCase();
      if (REAL_INVENTORY_STOCK[code] !== undefined) {
        return {
          ...item,
          current_stock: REAL_INVENTORY_STOCK[code],
          item_name_ar: STANDARD_ITEM_CODES.find(s => s.code === code)?.nameAr || item.item_name_ar,
        };
      }
      return item;
    });

    if (!merged.some(i => i.item_code.toUpperCase() === 'P11')) {
      merged.push({
        item_code: 'P11',
        item_name_ar: 'صحن غير مقسم 24',
        item_name_en: 'Main Tray - Undivided 24',
        current_stock: 6000,
        reorder_level: 2000,
        cost_per_unit: 0.85,
        category_ar: 'صحون وأطباق',
        category_en: 'Plates & Dishes',
      });
    }

    return merged.map(applyStockPolicy).sort((a, b) => compareItemCodes(a.item_code, b.item_code));
  });

  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      const merged = initialItems.map(item => {
        const code = item.item_code.toUpperCase();
        if (REAL_INVENTORY_STOCK[code] !== undefined) {
          return {
            ...item,
            current_stock: REAL_INVENTORY_STOCK[code],
            item_name_ar: STANDARD_ITEM_CODES.find(s => s.code === code)?.nameAr || item.item_name_ar,
          };
        }
        return item;
      });
      if (!merged.some(i => i.item_code.toUpperCase() === 'P11')) {
        merged.push({
          item_code: 'P11',
          item_name_ar: 'صحن غير مقسم 24',
          item_name_en: 'Main Tray - Undivided 24',
          current_stock: 6000,
          reorder_level: 2000,
          cost_per_unit: 0.85,
          category_ar: 'صحون وأطباق',
          category_en: 'Plates & Dishes',
        });
      }
      setItems(merged.map(applyStockPolicy).sort((a, b) => compareItemCodes(a.item_code, b.item_code)));
    }
  }, [initialItems]);

  // Fire the (mock) low-stock email hook once per item when it first breaches its minimum level.
  const notifiedCodes = useRef<Set<string>>(new Set());
  useEffect(() => {
    items.forEach(item => {
      const code = item.item_code.toUpperCase();
      const minQty = getMinLevel(item);
      if (item.current_stock <= minQty) {
        if (!notifiedCodes.current.has(code)) {
          notifiedCodes.current.add(code);
          triggerLowStockEmail(code, item.item_name_ar, item.current_stock, minQty);
        }
      } else {
        notifiedCodes.current.delete(code);
      }
    });
  }, [items]);

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  type SmartPOSortOption = 'default_priority' | 'highest_stock' | 'most_consumed';
  const [sortBy, setSortBy] = useState<SmartPOSortOption>('default_priority');
  const [selectedItemForPO, setSelectedItemForPO] = useState<SupabaseInventoryItem | null>(null);
  const [poQuantity, setPoQuantity] = useState<number>(10);
  const [itemSuppliers, setItemSuppliers] = useState<Record<string, Array<{ id: string; name: string }>>>(
    initialSupplierMappings || {}
  );
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState<boolean>(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);
  const [invoiceSimItem, setInvoiceSimItem] = useState<string>('P1');
  const [invoiceSimQty, setInvoiceSimQty] = useState<number>(150);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() =>
    initialPurchaseOrders && initialPurchaseOrders.length > 0
      ? (initialPurchaseOrders as unknown as PurchaseOrder[])
      : getSessionPurchaseOrders()
  );
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Active Purchase Orders (dynamically filtered: received orders disappear immediately; strictly sorted by item code P1..P10)
  const activePOs = purchaseOrders
    .filter(po => {
      const orig = (po.status || '').trim();
      const lower = orig.toLowerCase();
      return orig !== 'تم الاستلام' && orig !== 'تم الاستلام بنجاح' && lower !== 'received' && lower !== 'delivered';
    })
    .sort((a, b) => compareItemCodes(a.itemId, b.itemId));

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

  // Receive Stock & Multi-Item Invoice Modal State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState<boolean>(false);
  const [receivePoId, setReceivePoId] = useState<string>('');
  const [receivedItems, setReceivedItems] = useState<ReceivedItemRow[]>([
    { id: 'row-1', itemCode: '', quantityCartons: 1 },
  ]);

  /**
   * Consumption-Based Replenishment flow (mock UI state):
   * - `unreplenished` holds, per item code, the kitchen consumption that has NOT yet been replenished.
   * - Issuing a Purchase Order does NOT reset this counter.
   * - ONLY when the warehouse receiver enters the Item Code (e.g. P1) and the Received Quantity in the
   *   Receipt Modal does the system add to the actual stock AND deduct/reset the unreplenished counter.
   */
  const [unreplenished, setUnreplenished] = useState<Record<string, number>>(INITIAL_UNREPLENISHED_CONSUMPTION);
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
    if (po && po.itemId) {
      const cCode = po.itemId.toUpperCase();
      const cSize = CARTON_SIZES[cCode] || 1;
      const initialCartons = Math.max(1, Math.round(po.quantity / cSize));
      setReceivedItems([{
        id: `row-${Date.now()}-1`,
        itemCode: cCode,
        quantityCartons: initialCartons,
      }]);
    } else {
      setReceivedItems([{
        id: `row-${Date.now()}-1`,
        itemCode: '',
        quantityCartons: 1,
      }]);
    }
    setReceiverSignature('');
    setInvoiceFile(null);
    setReceiptError(null);
    setIsReceiveModalOpen(true);
  };

  const handleSelectPO = (poId: string) => {
    setReceivePoId(poId);
    const po = purchaseOrders.find(p => p.id === poId);
    if (po && po.itemId) {
      const cCode = po.itemId.toUpperCase();
      const cSize = CARTON_SIZES[cCode] || 1;
      const initialCartons = Math.max(1, Math.round(po.quantity / cSize));
      setReceivedItems(prev => {
        if (prev.length === 1 && (!prev[0].itemCode || prev[0].itemCode === '')) {
          return [{ id: prev[0].id, itemCode: cCode, quantityCartons: initialCartons }];
        }
        return [{ id: `row-${Date.now()}`, itemCode: cCode, quantityCartons: initialCartons }, ...prev.filter(r => r.itemCode !== cCode)];
      });
    }
    setReceiptError(null);
  };

  const handleAddReceivedItemRow = () => {
    setReceivedItems(prev => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemCode: '',
        quantityCartons: 1,
      }
    ]);
  };

  const handleRemoveReceivedItemRow = (id: string) => {
    setReceivedItems(prev => {
      if (prev.length <= 1) {
        return [{ id: `row-${Date.now()}-1`, itemCode: '', quantityCartons: 1 }];
      }
      return prev.filter(row => row.id !== id);
    });
  };

  const handleUpdateReceivedItemRow = (id: string, field: 'itemCode' | 'quantityCartons', value: any) => {
    setReceivedItems(prev => prev.map(row => {
      if (row.id !== id) return row;
      if (field === 'itemCode') {
        return { ...row, itemCode: String(value).toUpperCase() };
      }
      if (field === 'quantityCartons') {
        const strVal = String(value)
          .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
          .replace(/[^0-9]/g, '');
        return { ...row, quantityCartons: strVal === '' ? '' : Number(strVal) };
      }
      return row;
    }));
    if (receiptError) setReceiptError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setInvoiceFile(e.target.files[0]);
      setReceiptError(null);
    }
  };

  const handleConfirmReceipt = async () => {
    if (receivedItems.length === 0) {
      setReceiptError('الرجاء إضافة صنف واحد على الأقل للاستلام');
      return;
    }

    const hasEmptyItem = receivedItems.some(i => !i.itemCode.trim());
    if (hasEmptyItem) {
      setReceiptError('الرجاء تحديد الصنف لجميع بنود الفاتورة');
      return;
    }

    const hasInvalidQty = receivedItems.some(i => !i.quantityCartons || Number(i.quantityCartons) <= 0);
    if (hasInvalidQty) {
      setReceiptError('الرجاء التأكد من إدخال كميات صحيحة بالكرتون (أكبر من الصفر) لجميع البنود');
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
      // Step 1: Sanitize File Name (Safe ASCII filename)
      const rawExt = invoiceFile.name && invoiceFile.name.includes('.')
        ? invoiceFile.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'pdf'
        : 'pdf';
      const safeRandom = Math.random().toString(36).substring(7);
      const safeFileName = `invoice-${Date.now()}-${safeRandom}.${rawExt}`;
      const sanitizedInvoiceFile = new File([invoiceFile], safeFileName, {
        type: invoiceFile.type || 'application/pdf',
      });

      // Upload invoice to Supabase Storage 'invoices' bucket
      const invoicePublicUrl = await uploadInvoice(sanitizedInvoiceFile, receivePoId || `multi-${Date.now()}`);

      // Step 1.5: Trigger n8n Webhook for automated Google Drive archiving
      if (invoicePublicUrl) {
        try {
          const po = purchaseOrders.find(p => p.id === receivePoId);
          const supplierName = po?.supplierName || (po as any)?.supplier_name || 'فاتورة استلام مجمعة';
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
              po_number: receivePoId || null,
              received_items: receivedItems.map(row => ({
                code: row.itemCode,
                cartons: Number(row.quantityCartons) || 0,
                units: (Number(row.quantityCartons) || 0) * (CARTON_SIZES[row.itemCode] || 1)
              }))
            }),
          }).catch((webhookErr) => {
            console.warn('n8n webhook notification error (silent):', webhookErr);
          });
        } catch (triggerErr) {
          console.warn('n8n webhook trigger error (silent):', triggerErr);
        }
      }

      // Step 2: Batch Receive in Supabase: add converted units to current_stock for each item
      const batchPayload = receivedItems.map(row => ({
        itemCode: row.itemCode,
        quantityCartons: Number(row.quantityCartons) || 0,
      }));

      await batchReceiveInventory(
        batchPayload,
        receivePoId || undefined,
        invoicePublicUrl,
        receiverSignature.trim()
      );

      // Step 3: Compute added units map for local state update
      const nowIso = new Date().toISOString();
      const addedUnitsMap: Record<string, number> = {};
      receivedItems.forEach(row => {
        const code = row.itemCode.toUpperCase();
        const cartons = Number(row.quantityCartons) || 0;
        const cSize = CARTON_SIZES[code] || 1;
        const units = cartons * cSize;
        addedUnitsMap[code] = (addedUnitsMap[code] || 0) + units;
      });

      // Update local inventory items immediately and set last_restock_date to nowIso
      setItems(prevItems =>
        [...prevItems.map(item => {
          const code = item.item_code.toUpperCase();
          const added = addedUnitsMap[code];
          if (added !== undefined) {
            return {
              ...item,
              current_stock: (Number(item.current_stock) || 0) + added,
              last_restock_date: nowIso,
            };
          }
          return item;
        })].sort((a, b) => compareItemCodes(a.item_code, b.item_code))
      );

      // Step 3.5: Deduct AddedUnits from unreplenished_consumption counter (can go to 0)
      setUnreplenished(prev => {
        const next = { ...prev };
        Object.entries(addedUnitsMap).forEach(([code, addedUnits]) => {
          next[code] = Math.max(0, (next[code] || 0) - addedUnits);
        });
        return next;
      });

      // Step 4: Update purchase orders state locally if linked
      if (receivePoId) {
        setPurchaseOrders(prev =>
          prev.map(p =>
            p.id === receivePoId
              ? {
                  ...p,
                  status: 'تم الاستلام',
                  receiverSignature: receiverSignature.trim(),
                  invoiceUrl: invoicePublicUrl,
                  receivedAt: new Date().toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
                }
              : p
          )
        );
      }

      // Background re-fetch to ensure complete sync with database
      try {
        const [fresh, freshPOs] = await Promise.all([
          fetchInventoryItems(),
          fetchPurchaseOrders().catch(() => []),
        ]);
        if (fresh && fresh.length > 0) {
          setItems([...fresh].sort((a, b) => compareItemCodes(a.item_code, b.item_code)));
        }
        if (freshPOs && freshPOs.length > 0) {
          setPurchaseOrders(freshPOs as unknown as PurchaseOrder[]);
        }
      } catch (syncErr) {
        console.warn('Background sync warning:', syncErr);
      }

      const totalCartons = receivedItems.reduce((acc, i) => acc + (Number(i.quantityCartons) || 0), 0);
      const totalUnits = Object.values(addedUnitsMap).reduce((acc, u) => acc + u, 0);

      const successMsg = lang === 'ar'
        ? `تم استلام الفاتورة بنجاح: ${toEnglishDigits(receivedItems.length)} أصناف (${toEnglishDigits(totalCartons)} كرتون / ما يعادل ${toEnglishDigits(totalUnits)} وحدة) وتحديث المخزون وتصفير الاستهلاك ✨`
        : `Invoice received successfully: ${toEnglishDigits(receivedItems.length)} items (${toEnglishDigits(totalCartons)} cartons / ${toEnglishDigits(totalUnits)} units) ✨`;

      setSuccessToast(successMsg);
      setIsReceiveModalOpen(false);
      setInvoiceFile(null);
      setReceivePoId('');
      setReceivedItems([{ id: 'row-1', itemCode: '', quantityCartons: 1 }]);
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

  // Smart Auto PO Sorting Engine
  const sortedTableItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'highest_stock') {
      return (b.current_stock ?? 0) - (a.current_stock ?? 0);
    }

    if (sortBy === 'most_consumed') {
      const consumedA = unreplenished[a.item_code.toUpperCase()] || 0;
      const consumedB = unreplenished[b.item_code.toUpperCase()] || 0;
      if (consumedB !== consumedA) {
        return consumedB - consumedA;
      }
      return compareItemCodes(a.item_code, b.item_code);
    }

    // Default Priority Sorting Hierarchy:
    const minA = getMinLevel(a);
    const minB = getMinLevel(b);
    const isCriticalA = (a.current_stock ?? 0) <= minA;
    const isCriticalB = (b.current_stock ?? 0) <= minB;

    // 1. Critical items (current_stock <= min_stock_level) MUST appear at the very top
    if (isCriticalA && !isCriticalB) return -1;
    if (!isCriticalA && isCriticalB) return 1;

    // 2. Among critical items:
    if (isCriticalA && isCriticalB) {
      // Sort by lead_time_days in DESCENDING order (items taking longest to arrive are first)
      const leadA = a.lead_time_days ?? 0;
      const leadB = b.lead_time_days ?? 0;
      if (leadB !== leadA) {
        return leadB - leadA;
      }
      // 3. Then sort by unreplenished_consumption in DESCENDING order (highest consumption first)
      const consumedA = unreplenished[a.item_code.toUpperCase()] || 0;
      const consumedB = unreplenished[b.item_code.toUpperCase()] || 0;
      if (consumedB !== consumedA) {
        return consumedB - consumedA;
      }
      return compareItemCodes(a.item_code, b.item_code);
    }

    // 4. For non-critical items, sort by unreplenished_consumption DESCENDING, then standard P-code
    const consumedA = unreplenished[a.item_code.toUpperCase()] || 0;
    const consumedB = unreplenished[b.item_code.toUpperCase()] || 0;
    if (consumedB !== consumedA) {
      return consumedB - consumedA;
    }
    return compareItemCodes(a.item_code, b.item_code);
  });

  const lowStockCount = items.filter(i => i.current_stock <= getMinLevel(i)).length;

  /**
   * Interactive Consumption Link (Simulating a Quantity Invoice):
   * When triggered:
   * A. Deducts `consumedUnits` from the item's `current_quantity` (`item.current_stock`).
   * B. Adds `consumedUnits` to the item's `unreplenished_consumption` counter (`unreplenished`).
   */
  const handleQuantityConsumption = (itemCode: string, consumedUnits: number) => {
    const code = (itemCode || '').trim().toUpperCase();
    const qty = Math.max(0, Number(consumedUnits) || 0);
    if (!code || qty <= 0) return;

    // A. Deduct consumedUnits from item's current_quantity (current_stock)
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.item_code.toUpperCase() === code) {
          const updatedStock = Math.max(0, (item.current_stock ?? 0) - qty);
          return {
            ...item,
            current_stock: updatedStock,
          };
        }
        return item;
      })
    );

    // B. Add consumedUnits to item's unreplenished_consumption counter
    setUnreplenished(prev => ({
      ...prev,
      [code]: (prev[code] || 0) + qty,
    }));

    const std = STANDARD_ITEM_CODES.find(s => s.code === code);
    const itemName = std?.nameAr || code;
    const msg = lang === 'ar'
      ? `[فاتورة كمية] تم خصم ${toEnglishDigits(qty)} وحدة من رصيد (${code} - ${itemName})، وإضافتها إلى الاستهلاك غير المعوَّض.`
      : `[Quantity Invoice] Deducted ${toEnglishDigits(qty)} units from (${code}) stock, added to unreplenished consumption.`;
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4500);
  };

  // Expose handleQuantityConsumption to window and custom events for seamless integration
  useEffect(() => {
    const onInvoiceEvent = (e: any) => {
      const { itemCode, consumedUnits } = e.detail || {};
      if (itemCode && consumedUnits) {
        handleQuantityConsumption(itemCode, consumedUnits);
      }
    };
    window.addEventListener('quantity_consumption_invoice', onInvoiceEvent as EventListener);
    (window as any).handleQuantityConsumption = handleQuantityConsumption;

    return () => {
      window.removeEventListener('quantity_consumption_invoice', onInvoiceEvent as EventListener);
      delete (window as any).handleQuantityConsumption;
    };
  }, []);

  const handleOpenPO = async (item: SupabaseInventoryItem, initialCartons?: number) => {
    setSelectedItemForPO(item);
    const code = item.item_code.toUpperCase();
    const cartonSize = CARTON_SIZES[code] || 1;
    const consumed = unreplenished[code] || 0;
    const calcCartons = Math.ceil(consumed / cartonSize);

    // Quantity MUST default to Suggested Order in Cartons (الطلب المقترح), NOT units!
    const defaultCartons = initialCartons !== undefined && initialCartons > 0
      ? initialCartons
      : (calcCartons > 0 ? calcCartons : Math.max(1, Math.ceil((getMinLevel(item) - item.current_stock) / cartonSize)));

    setPoQuantity(Math.max(1, defaultCartons));

    // Dynamic approved suppliers mapping fetched from Supabase supplier_items table
    const cached = itemSuppliers[code];
    if (cached && cached.length > 0) {
      setSelectedSupplier(cached[0].name);
    } else {
      setSelectedSupplier('');
    }

    setIsLoadingSuppliers(true);
    try {
      const dbSuppliers = await fetchSuppliersForItem(code);
      if (dbSuppliers && dbSuppliers.length > 0) {
        setItemSuppliers(prev => ({ ...prev, [code]: dbSuppliers }));
        setSelectedSupplier(dbSuppliers[0].name);
      } else if (!cached || cached.length === 0) {
        setSelectedSupplier('');
      }
    } catch (err) {
      console.error('Error fetching suppliers for item from DB:', err);
    } finally {
      setIsLoadingSuppliers(false);
    }
  };

  const handleCreatePO = () => {
    if (!selectedItemForPO) return;

    const code = selectedItemForPO.item_code.toUpperCase();
    const cartonSize = CARTON_SIZES[code] || 1;
    const isPerPiece = cartonSize === 1;
    const totalUnits = isPerPiece ? poQuantity : poQuantity * cartonSize;
    const unitCost = selectedItemForPO.cost_per_unit || 0.45;
    const totalCost = Number((totalUnits * unitCost).toFixed(2));

    const newPO: PurchaseOrder = {
      id: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
      itemId: selectedItemForPO.item_code,
      itemName: selectedItemForPO.item_name_ar,
      supplierName: selectedSupplier,
      quantity: poQuantity, // In cartons (or pieces for P6)
      totalCost,
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
      createdBy: 'HUMAN',
    };

    addPurchaseOrderToSession(newPO);
    setPurchaseOrders(prev => [newPO, ...prev]);

    const unitLabel = isPerPiece ? 'حبة' : 'كرتون';
    const msg = lang === 'ar'
      ? `تم إنشاء أمر الشراء ${newPO.id} لعدد ${toEnglishDigits(poQuantity)} ${unitLabel} (${toEnglishDigits(totalUnits)} وحدة) من (${selectedSupplier}) بنجاح!`
      : `Purchase order ${newPO.id} for ${toEnglishDigits(poQuantity)} ${isPerPiece ? 'pieces' : 'cartons'} from (${selectedSupplier}) created successfully!`;
    setSuccessToast(msg);
    setSelectedItemForPO(null);

    setTimeout(() => {
      setSuccessToast(null);
    }, 4500);
  };

  // Replenishment table action: opens the PO modal pre-filled with the carton-equivalent quantity.
  // NOTE: Issuing a PO does NOT reset the unreplenished consumption counter.
  const handleReplenishPO = (code: string, cartons: number) => {
    const item = items.find(i => i.item_code.toUpperCase() === code);
    if (!item) {
      setSuccessToast(`لا يوجد صنف مرتبط بالرمز ${code} في المخزون`);
      setTimeout(() => setSuccessToast(null), 4000);
      return;
    }
    handleOpenPO(item, cartons);
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
      <header className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl mb-6 p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
        <div className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-slate-100 drop-shadow-sm">{t('inventory.kpiTotalItems')}</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2 drop-shadow-sm">{toEnglishDigits(items.length)}</div>
          <div className="text-xs text-white/80 font-semibold mt-1 drop-shadow-sm">{t('inventory.kpiTotalItemsDesc')}</div>
        </div>

        <div className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-slate-100 drop-shadow-sm">{t('inventory.kpiLowStock')}</div>
          <div className={`text-3xl font-extrabold font-mono tracking-wider mt-2 drop-shadow-sm ${lowStockCount > 0 ? 'text-rose-200' : 'text-white'}`}>
            {toEnglishDigits(lowStockCount)}
          </div>
          <div className="text-xs text-rose-200 font-semibold mt-1 drop-shadow-sm">{t('inventory.kpiLowStockDesc')}</div>
        </div>

        <div className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-slate-100 drop-shadow-sm">{t('inventory.kpiActivePO')}</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2 drop-shadow-sm">{toEnglishDigits(activePOs.length)}</div>
          <div className="text-xs text-white/80 font-semibold mt-1 drop-shadow-sm">{t('inventory.kpiActivePODesc')}</div>
        </div>

        <div className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-slate-100 drop-shadow-sm">{t('inventory.kpiCoverage')}</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2 drop-shadow-sm">
            {items.length > 0 ? `${Math.round(((items.length - lowStockCount) / items.length) * 100)}%` : '0%'}
          </div>
          <div className="text-xs text-white/80 font-semibold mt-1 drop-shadow-sm">{t('inventory.kpiCoverageDesc')}</div>
        </div>
      </div>

      {/* Smart Filter Bar */}
      <div className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
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

      {/* Smart Auto PO Table — the primary inventory view (Consumption-Based Replenishment Engine) */}
      <section
        aria-label="Smart Auto PO"
        className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-6 sm:p-7 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/15">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Smart Auto PO
            </h2>
            <span className="text-xs sm:text-sm font-bold text-white/85">
              (محرك بناء أوامر الشراء التلقائي بناءً على الاستهلاك)
            </span>
          </div>

          {/* Sorting Dropdown Menu */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <label htmlFor="smart-po-sort" className="text-xs font-bold text-white/80 flex items-center gap-1.5 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-white/70" />
              <span>ترتيب حسب:</span>
            </label>
            <div className="relative">
              <select
                id="smart-po-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SmartPOSortOption)}
                className="bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-3.5 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-white/25 cursor-pointer appearance-none pe-8"
              >
                <option value="default_priority" className="bg-slate-900 text-white font-bold">
                  الأولوية الافتراضية
                </option>
                <option value="highest_stock" className="bg-slate-900 text-white font-bold">
                  الأعلى رصيداً
                </option>
                <option value="most_consumed" className="bg-slate-900 text-white font-bold">
                  الأكثر استهلاكاً
                </option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-white/60 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-white text-sm">
                <th scope="col" className="py-3.5 px-3 w-24 font-bold">الرمز</th>
                <th scope="col" className="py-3.5 px-4 text-right font-bold">الصنف</th>
                <th scope="col" className="py-3.5 px-4 font-bold">الرصيد الحالي</th>
                <th scope="col" className="py-3.5 px-4 font-bold">الحد الأدنى</th>
                <th scope="col" className="py-3.5 px-4 font-bold">مدة التوريد</th>
                <th scope="col" className="py-3.5 px-4 font-bold">الكمية المستهلكة</th>
                <th scope="col" className="py-3.5 px-4 font-bold">الطلب المقترح</th>
                <th scope="col" className="py-3.5 px-4 font-bold">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedTableItems.map(item => {
                const code = item.item_code.toUpperCase();
                const std = getStandardCodeInfo(code);
                const consumed = unreplenished[code] || 0;
                const cartonSize = CARTON_SIZES[code] || 1;
                const cartons = Math.ceil(consumed / cartonSize);
                const pendingPOs = activePOs.filter(po => String(po.itemId).toUpperCase() === code).length;
                const isPerPiece = cartonSize === 1;
                const minLevel = getMinLevel(item);
                const isCritical = item.current_stock <= minLevel;
                const leadDays = item.lead_time_days;

                return (
                  <tr
                    key={code}
                    className="hover:bg-white/[0.04] transition-colors border-b border-white/5"
                  >
                    <td className="py-3.5 px-3">
                      <span className="font-mono font-extrabold text-sm text-white bg-white/15 border border-white/25 px-2.5 py-0.5 rounded-lg">
                        {code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        {isCritical && (
                          <span className="flex items-center gap-1.5 text-rose-400 shrink-0" title="مستوى حرج">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                            </span>
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                          </span>
                        )}
                        <span>{getItemDisplayName(item)}</span>
                        {isCritical && (
                          <span className="text-[10px] font-bold text-rose-200 bg-rose-500/20 border border-rose-400/40 px-2 py-0.5 rounded-full">
                            مستوى حرج
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/60 font-mono" dir="ltr">{std?.nameEn || item.item_name_en}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`font-mono font-black text-lg ${isCritical ? 'text-rose-400 font-extrabold' : 'text-white'}`}>
                        {toEnglishDigits(item.current_stock)}
                      </span>
                      <span className="text-xs text-white/60 ms-1">{t('common.unit')}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-base text-white/90">{toEnglishDigits(minLevel)}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      {leadDays != null ? (
                        <span className="text-sm font-bold text-white">
                          <span className="font-mono">{toEnglishDigits(leadDays)}</span> يوم
                        </span>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold font-mono text-base text-white">
                        {toEnglishDigits(consumed)} <span className="text-sm font-normal text-white/70">وحدة</span>
                      </div>
                      <div className="text-xs text-white/50 mt-0.5">
                        (منذ {toEnglishDigits(getDaysSinceRestock(item.last_restock_date))} أيام)
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col items-center">
                        <div>
                          <span className="font-mono font-black text-lg text-white">{toEnglishDigits(cartons)}</span>
                          <span className="text-xs text-white/70 ms-1 font-semibold">
                            {isPerPiece ? 'حبة (بالقطعة)' : (lang === 'en' ? 'cartons' : 'كرتون')}
                          </span>
                        </div>
                        <span className="text-[10px] text-white/50 font-mono mt-0.5">
                          {isPerPiece ? 'طلب بالقطعة (1:1)' : `(${toEnglishDigits(cartonSize)} وحدة/كرتون)`}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => (consumed > 0 ? handleReplenishPO(code, cartons) : handleOpenPO(item))}
                          disabled={consumed <= 0 && !isCritical}
                          className={`backdrop-blur-md border text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                            isCritical
                              ? 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-400/50'
                              : 'bg-white/10 hover:bg-white/20 border-white/25'
                          }`}
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>إصدار أمر شراء</span>
                        </button>
                        {pendingPOs > 0 && (
                          <span className="text-[10px] text-white/60">
                            {toEnglishDigits(pendingPOs)} أمر شراء بانتظار الاستلام
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {filteredItems.length === 0 && (
        <div className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-12 text-center text-white">
          <p className="text-lg font-bold drop-shadow-sm">{t('inventory.noItemsFound')}</p>
          <p className="text-xs text-white/80 mt-1 drop-shadow-sm">{t('inventory.noItemsFoundHint')}</p>
        </div>
      )}


      {/* Modal: Create Purchase Order (Smart Auto PO) */}
      {selectedItemForPO && (() => {
        const code = selectedItemForPO.item_code.toUpperCase();
        const cartonSize = CARTON_SIZES[code] || 1;
        const isPerPiece = cartonSize === 1;
        const totalUnits = isPerPiece ? poQuantity : poQuantity * cartonSize;
        const unitCost = selectedItemForPO.cost_per_unit || 0.45;
        const currentSuppliers = itemSuppliers[code] || [];
        const consumed = unreplenished[code] || 0;
        const suggestedCartons = Math.ceil(consumed / cartonSize);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-md animate-in fade-in duration-200">
            <div className="font-sans bg-black/75 backdrop-blur-2xl rounded-3xl w-full max-w-3xl lg:max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4 text-white border border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.7)] relative flex flex-col">
              {/* Modal Header */}
              <div className="flex justify-between items-center border-b border-white/15 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xs text-white bg-white/15 border border-white/25 px-2.5 py-0.5 rounded-lg" dir="ltr" lang="en">
                      {selectedItemForPO.item_code}
                    </span>
                    <h3 className="text-lg sm:text-xl font-extrabold text-white">
                      {t('inventory.modalCreatePOTitle')}
                    </h3>
                  </div>
                  <p className="text-xs text-white/70 mt-1 font-medium">
                    {t('inventory.modalRestockItem')} <strong className="text-white">{getItemDisplayName(selectedItemForPO)}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedItemForPO(null)}
                  className="text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/20 p-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center w-9 h-9"
                  aria-label={t('common.close')}
                  title={t('common.close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Landscape Multi-Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Supplier Selection (Real Approved Mappings from Supabase supplier_items) */}
                <div className="space-y-1.5 flex flex-col justify-between">
                  <label className="block text-xs font-bold text-white flex justify-between items-center">
                    <span>{t('inventory.modalSupplierLabel')}</span>
                    {isLoadingSuppliers ? (
                      <span className="text-[11px] text-white/60 flex items-center gap-1 font-sans">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        جاري جلب الموردين...
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-400 font-semibold font-sans">
                        {toEnglishDigits(currentSuppliers.length)} {currentSuppliers.length === 1 ? 'مورد معتمد' : 'موردين معتمدين'} للصنف
                      </span>
                    )}
                  </label>
                  <GlassSelect
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    disabled={isLoadingSuppliers || currentSuppliers.length === 0}
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none"
                  >
                    {currentSuppliers.length > 0 ? (
                      currentSuppliers.map((sup: { id: string; name: string }) => (
                        <option key={sup.id || sup.name} value={sup.name} className="bg-zinc-900 text-white py-1">
                          {sup.name}
                        </option>
                      ))
                    ) : (
                      <option value="" className="bg-zinc-900 text-white py-1">
                        {isLoadingSuppliers ? 'جاري التحميل...' : 'لا يوجد موردين مسجلين في supplier_items'}
                      </option>
                    )}
                  </GlassSelect>
                  <span className="text-[10px] text-white/50 block">
                    يتم جلب الموردين المعتمدين ديناميكياً من قاعدة البيانات لهذا الصنف
                  </span>
                </div>

                {/* 2. Quantity Input in Cartons (not Units) */}
                <div className="space-y-1.5 flex flex-col justify-between">
                  <label className="block text-xs font-bold text-white flex justify-between items-center">
                    <span>
                      {isPerPiece ? 'الكمية المطلوبة (بالقطعة / حبة)' : 'الكمية المطلوبة (بالكرتون)'}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-mono font-bold" dir="ltr" lang="en">
                      الطلب المقترح: {toEnglishDigits(suggestedCartons > 0 ? suggestedCartons : 1)} {isPerPiece ? 'حبة' : 'كرتون'}
                    </span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    dir="ltr"
                    lang="en"
                    value={poQuantity}
                    onChange={(e) => {
                      const clean = String(e.target.value).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^0-9]/g, '');
                      setPoQuantity(clean === '' ? 1 : Math.max(1, parseInt(clean, 10)));
                    }}
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/25 font-mono text-base font-bold text-center"
                  />
                  <div className="flex justify-between items-center text-[11px] text-white/70 px-0.5">
                    <span>
                      {isPerPiece
                        ? 'يتم طلب هذا الصنف بالقطعة مباشرة (1:1)'
                        : `ما يعادل: ${toEnglishDigits(totalUnits)} وحدة (${toEnglishDigits(cartonSize)} وحدة/كرتون)`}
                    </span>
                    <span className="text-white/50 font-mono" dir="ltr" lang="en">
                      سعر الوحدة: {toEnglishDigits(unitCost)} ريال
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2 border-t border-white/10">
                <button
                  onClick={handleCreatePO}
                  className="flex-1 bg-emerald-600/40 hover:bg-emerald-600/55 active:scale-95 text-white font-bold py-2.5 rounded-xl transition-all text-xs sm:text-sm cursor-pointer shadow-lg border border-emerald-400/35 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('inventory.modalConfirmPOBtn')}</span>
                </button>
                <button
                  onClick={() => setSelectedItemForPO(null)}
                  className="px-6 bg-white/8 hover:bg-white/15 text-white/80 font-bold py-2.5 rounded-xl border border-white/20 transition-all text-xs sm:text-sm cursor-pointer"
                >
                  {t('inventory.modalCancelBtn')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Simulate Quantity Invoice Consumption */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in">
          <div className="font-sans bg-zinc-900/90 backdrop-blur-2xl rounded-3xl w-full max-w-md p-6 sm:p-7 space-y-4 text-white border border-white/20 shadow-[0_16px_48px_0_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-start border-b border-white/15 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-emerald-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    محاكاة فاتورة كمية (خصم استهلاك)
                  </h3>
                  <p className="text-[11px] text-white/70">
                    ربط استهلاك وجبات المطبخ بمخزون مواد التغليف
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInvoiceModalOpen(false)}
                className="text-white/65 hover:text-white bg-white/8 hover:bg-white/15 border border-white/20 p-1.5 rounded-full w-7 h-7 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-white mb-1.5">
                  اختر الصنف المستهلك
                </label>
                <GlassSelect
                  value={invoiceSimItem}
                  onChange={(e) => setInvoiceSimItem(e.target.value)}
                  className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-2.5 text-sm text-white focus:outline-none"
                >
                  {items.map(it => (
                    <option key={it.item_code} value={it.item_code} className="bg-zinc-900 text-white">
                      {it.item_code} - {getItemDisplayName(it)} (الرصيد: {toEnglishDigits(it.current_stock)})
                    </option>
                  ))}
                </GlassSelect>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1.5">
                  الكمية المستهلكة (بالوحدة)
                </label>
                <input
                  type="number"
                  min="1"
                  step="50"
                  dir="ltr"
                  lang="en"
                  value={invoiceSimQty}
                  onChange={(e) => {
                    const clean = String(e.target.value).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^0-9]/g, '');
                    setInvoiceSimQty(clean === '' ? 1 : Math.max(1, parseInt(clean, 10)));
                  }}
                  className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono text-base font-bold text-center"
                />
                <span className="text-[10px] text-white/60 block mt-1">
                  سيتم خصم هذه الكمية فوراً من الرصيد الحالي وإضافتها لعداد الاستهلاك غير المعوَّض.
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleQuantityConsumption(invoiceSimItem, invoiceSimQty);
                  setIsInvoiceModalOpen(false);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2.5 rounded-xl transition-all text-xs cursor-pointer shadow-lg border border-emerald-400/30 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>تسجيل الاستهلاك وخصم المخزون</span>
              </button>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="px-4 bg-white/8 hover:bg-white/15 text-white/80 font-bold py-2.5 rounded-xl border border-white/20 transition-all text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Receive Stock & Multi-Item Supplier Invoice */}
      {isReceiveModalOpen && (() => {
        const selectedReceivePO = purchaseOrders.find(p => p.id === receivePoId);
        const totalCartons = receivedItems.reduce((acc, i) => acc + (Number(i.quantityCartons) || 0), 0);
        const totalUnits = receivedItems.reduce((acc, i) => {
          const cCode = i.itemCode.toUpperCase();
          const cSize = CARTON_SIZES[cCode] || 1;
          return acc + ((Number(i.quantityCartons) || 0) * cSize);
        }, 0);
        const isFormValid =
          receivedItems.length > 0 &&
          receivedItems.every(i => i.itemCode.trim() && i.quantityCartons && Number(i.quantityCartons) > 0) &&
          Boolean(invoiceFile) &&
          Boolean(receiverSignature.trim());

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200">
            <div className="font-sans bg-black/75 backdrop-blur-2xl rounded-3xl w-full max-w-5xl lg:max-w-6xl max-h-[96vh] overflow-y-auto p-4 sm:p-5 lg:p-6 space-y-3 sm:space-y-3.5 text-white border border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.7)] relative flex flex-col">
              {/* Modal Header */}
              <div className="flex justify-between items-center border-b border-white/15 pb-2.5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 border border-white/25 rounded-xl text-emerald-300 shrink-0 shadow-inner">
                    <PackageCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                      <span>{t('inventory.modalReceiveTitle')}</span>
                    </h3>
                    <p className="text-[11px] text-white/70 font-medium">
                      {t('inventory.modalReceiveSubtitle')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!isSubmittingReceipt) setIsReceiveModalOpen(false);
                  }}
                  disabled={isSubmittingReceipt}
                  className="text-white/60 hover:text-white bg-white/5 hover:bg-white/15 border border-white/15 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
                  aria-label={t('common.close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Error Banner */}
              {receiptError && (
                <div className="bg-rose-500/20 border border-rose-400/40 rounded-xl p-2.5 flex items-center gap-2 text-xs text-rose-200">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-300" />
                  <span>{receiptError}</span>
                </div>
              )}

              {/* Top Controls: Link to Active PO (Optional) & Receiver Signature */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white/[0.04] border border-white/15 rounded-xl p-2.5 sm:p-3">
                {/* 1. Dropdown: Select Purchase Order */}
                <div>
                  <label className="block text-[11px] font-bold text-white mb-1 flex items-center justify-between">
                    <span>{t('inventory.selectPO')}</span>
                    <span className="text-[10px] text-white/50">(اختياري / ربط بأمر شراء نشط)</span>
                  </label>
                  <GlassSelect
                    value={receivePoId}
                    onChange={(e) => handleSelectPO(e.target.value)}
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/25 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-white">
                      {lang === 'ar' ? 'بدون أمر شراء مسبق (استلام مباشر بالفاتورة)' : 'Direct invoice receipt (No prior PO)'}
                    </option>
                    {activePOs.map(po => (
                      <option key={po.id} value={po.id} className="bg-slate-900 text-white" dir="ltr" lang="en">
                        {po.id} ({po.itemId || '—'}) - {po.itemName} ({toEnglishDigits(po.quantity)} {t('common.unit')})
                      </option>
                    ))}
                  </GlassSelect>
                </div>

                {/* Receiver Signature / ID */}
                <div>
                  <label className="block text-[11px] font-bold text-white mb-1">
                    {t('inventory.receiverSignatureLabel')} <span className="text-rose-400">*</span>
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
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/25 placeholder:text-white/40"
                  />
                </div>
              </div>

              {/* Selected PO Details Badge (if linked) */}
              {selectedReceivePO && (
                <div className="bg-white/5 border border-white/15 rounded-xl px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-white/70 text-[11px]">أمر الشراء المرتبط:</span>
                    <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded border border-white/20 text-xs" dir="ltr" lang="en">
                      {selectedReceivePO.id}
                    </span>
                    <span className="text-white/90 font-bold text-xs">• {selectedReceivePO.supplierName}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs">
                    <span className="text-white/70 font-mono text-[11px]" dir="ltr" lang="en">
                      الكمية المطلوبة: {toEnglishDigits(selectedReceivePO.quantity)} وحدة
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-amber-500/20 text-amber-200 border-amber-400/40">
                      {selectedReceivePO.status}
                    </span>
                  </div>
                </div>
              )}

              {/* 2. Dynamic Multiple Items Table / Rows Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                    <span>📦 بنود وأصناف الفاتورة المستلمة</span>
                    <span className="text-[11px] bg-white/10 border border-white/20 px-2 py-0.5 rounded-full font-mono text-teal-300" dir="ltr" lang="en">
                      {toEnglishDigits(receivedItems.length)} {receivedItems.length === 1 ? 'صنف' : 'أصناف'}
                    </span>
                  </h4>
                </div>

                {/* Rows Header for Desktop */}
                <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1 text-[11px] font-bold text-white/60 border-b border-white/10">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-6">الصنف (الرمز القياسي ومواصفات الكرتون)</div>
                  <div className="col-span-2 text-center">الكمية (بالكرتون)</div>
                  <div className="col-span-2 text-center">المعادل بالوحدات</div>
                  <div className="col-span-1 text-center">إجراء</div>
                </div>

                {/* Scrollable Rows Container */}
                <div className="space-y-1.5 max-h-40 sm:max-h-48 overflow-y-auto pr-1">
                  {receivedItems.map((row, index) => {
                    const code = row.itemCode.toUpperCase();
                    const cartonSize = CARTON_SIZES[code] || 1;
                    const cartons = Number(row.quantityCartons) || 0;
                    const unitsEquivalent = cartons * cartonSize;

                    return (
                      <div
                        key={row.id}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white/[0.05] hover:bg-white/[0.08] border border-white/15 rounded-xl px-2.5 py-1.5 transition-colors"
                      >
                        {/* Row Index */}
                        <div className="sm:col-span-1 flex items-center justify-between sm:justify-center">
                          <span className="w-5 h-5 rounded bg-white/10 border border-white/20 text-white/80 font-mono text-xs font-bold flex items-center justify-center shrink-0" dir="ltr" lang="en">
                            {toEnglishDigits(index + 1)}
                          </span>
                          <span className="sm:hidden text-xs text-white/60 font-bold">بند رقم {toEnglishDigits(index + 1)}</span>
                        </div>

                        {/* Item Select Dropdown */}
                        <div className="sm:col-span-6">
                          <label className="text-[10px] text-white/60 sm:hidden block mb-1">الصنف</label>
                          <select
                            value={row.itemCode}
                            onChange={(e) => handleUpdateReceivedItemRow(row.id, 'itemCode', e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/25 cursor-pointer"
                          >
                            <option value="" disabled className="bg-slate-900 text-white/60">
                              اختر الصنف من القائمة...
                            </option>
                            {[...STANDARD_ITEM_CODES]
                              .sort((a, b) => compareItemCodes(a.code, b.code))
                              .map((c) => (
                                <option key={c.code} value={c.code} className="bg-slate-900 text-white py-1">
                                  {c.code} - {c.nameAr} ({CARTON_SIZES[c.code] === 1 ? 'بالقطعة' : `${toEnglishDigits(CARTON_SIZES[c.code])} حبة/كرتون`})
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Quantity in Cartons Input */}
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-white/60 sm:hidden block mb-1">الكمية بالكرتون</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              dir="ltr"
                              lang="en"
                              value={row.quantityCartons}
                              onChange={(e) => handleUpdateReceivedItemRow(row.id, 'quantityCartons', e.target.value)}
                              placeholder="1"
                              className="w-full bg-white/10 border border-white/20 rounded-lg py-1 px-2 text-xs text-white font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-white/25"
                            />
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-white/50 pointer-events-none">
                              {cartonSize === 1 ? 'حبة' : 'كرتون'}
                            </span>
                          </div>
                        </div>

                        {/* Equivalent Units */}
                        <div className="sm:col-span-2 flex items-center justify-center">
                          <div className="w-full py-1 px-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-xs font-mono font-bold text-center" dir="ltr" lang="en">
                            {toEnglishDigits(unitsEquivalent)} <span className="font-sans text-[11px]">{t('common.unit')}</span>
                          </div>
                        </div>

                        {/* Remove Row Button */}
                        <div className="sm:col-span-1 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveReceivedItemRow(row.id)}
                            disabled={receivedItems.length === 1 && index === 0}
                            className="p-1 text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-rose-400 border border-transparent hover:border-rose-400/30 rounded-lg transition-all cursor-pointer shrink-0"
                            title="حذف هذا الصنف من الفاتورة"
                            aria-label="حذف الصنف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Another Item Button */}
                <button
                  type="button"
                  onClick={handleAddReceivedItemRow}
                  className="w-full py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-dashed border-white/25 hover:border-white/40 rounded-lg text-xs font-bold text-teal-200 hover:text-teal-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>➕ إضافة صنف للفاتورة</span>
                </button>
              </div>

              {/* Lower Landscape Row: 3. File Upload Box + 4. Overall Batch Summary Strip side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
                {/* 3. Streamlined File Upload Box */}
                <div className="flex flex-col justify-between">
                  <label className="block text-[11px] font-bold text-white mb-1 flex items-center justify-between">
                    <span>{t('inventory.uploadInvoiceLabel')} <span className="text-rose-400">*</span></span>
                    <span className="text-[10px] text-white/50">صورة أو PDF</span>
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
                    className={`border-2 border-dashed rounded-xl px-3 py-2 cursor-pointer transition-all flex items-center justify-between gap-2.5 h-[52px] ${
                      invoiceFile
                        ? 'border-emerald-400/40 bg-emerald-500/10'
                        : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30'
                    }`}
                  >
                    {invoiceFile ? (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-lg text-emerald-300 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-[280px]">
                              {invoiceFile.name}
                            </p>
                            <p className="text-[10px] text-white/60 font-mono" dir="ltr" lang="en">
                              {toEnglishDigits((invoiceFile.size / 1024).toFixed(1))} KB • جاهز للأرشفة
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
                          className="text-white/80 hover:text-white text-[11px] px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-md shrink-0 cursor-pointer border border-white/20"
                        >
                          {t('common.edit')}
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-white/80 w-full py-1">
                        <UploadCloud className="w-4 h-4 text-white/70 shrink-0" />
                        <span className="text-xs font-bold text-white">انقر لرفع ملف الفاتورة المجمعة (صورة أو PDF)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Overall Batch Summary Strip (Retained at bottom intact) */}
                <div className="flex flex-col justify-between">
                  <div className="text-[11px] font-bold text-white mb-1">ملخص الشحنة الإجمالي</div>
                  <div className="grid grid-cols-3 gap-2 p-2 bg-white/[0.04] border border-white/15 rounded-xl text-center h-[52px] items-center">
                    <div>
                      <div className="text-[10px] text-white/60">الأصناف</div>
                      <div className="text-xs sm:text-sm font-bold font-mono text-white mt-0.5" dir="ltr" lang="en">
                        {toEnglishDigits(receivedItems.length)} <span className="font-sans text-[10px]">{receivedItems.length === 1 ? 'صنف' : 'أصناف'}</span>
                      </div>
                    </div>
                    <div className="border-x border-white/10 px-1">
                      <div className="text-[10px] text-white/60">الكراتين</div>
                      <div className="text-xs sm:text-sm font-bold font-mono text-teal-300 mt-0.5" dir="ltr" lang="en">
                        {toEnglishDigits(totalCartons)} <span className="font-sans text-[10px]">كرتون</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/60">الوحدات الفعلية</div>
                      <div className="text-xs sm:text-sm font-bold font-mono text-emerald-300 mt-0.5" dir="ltr" lang="en">
                        {toEnglishDigits(totalUnits)} <span className="font-sans text-[10px]">وحدة</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Action Buttons */}
              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={handleConfirmReceipt}
                  disabled={isSubmittingReceipt || !isFormValid}
                  className="flex-1 bg-emerald-600/35 hover:bg-emerald-600/50 border border-emerald-400/40 active:scale-95 text-white font-extrabold py-2.5 rounded-xl transition-all text-xs sm:text-sm cursor-pointer shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
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
                  className="px-5 bg-white/8 hover:bg-white/15 text-white/80 font-bold py-2.5 rounded-xl border border-white/20 transition-all text-xs sm:text-sm cursor-pointer disabled:opacity-50"
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
