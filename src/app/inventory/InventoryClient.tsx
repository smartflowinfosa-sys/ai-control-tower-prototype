"use client";

import { useState, useEffect, useRef } from 'react';
import { SupabaseInventoryItem, uploadInvoice, receivePurchaseOrder, fetchInventoryItems, fetchPurchaseOrders, fetchSuppliersForItem, SupabasePurchaseOrder } from '@/lib/supabaseService';
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
import { Building2, Check, X, AlertTriangle, RefreshCw, PackageCheck, UploadCloud, FileText, CheckCircle2, Loader2, ArrowUpRight, Sparkles } from 'lucide-react';
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

  // Receive Stock & Invoice Modal State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState<boolean>(false);
  const [receivePoId, setReceivePoId] = useState<string>('');
  const [receivedQty, setReceivedQty] = useState<number | ''>('');
  // Item Code (Golden Key, e.g. P1/P2/P4) typed by the warehouse receiver in the receipt modal
  const [receiveItemCode, setReceiveItemCode] = useState<string>('');

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
    if (po) {
      setReceivedQty(po.quantity);
    } else {
      setReceivedQty(1000);
    }
    setReceiveItemCode(po?.itemId || '');
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
      setReceiveItemCode(po.itemId || '');
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

    const inputCartons = Number(receivedQty);
    if (isNaN(inputCartons) || inputCartons <= 0) {
      setReceiptError('الرجاء إدخال كمية كراتين صحيحة أكبر من الصفر');
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

    const enteredCode = receiveItemCode.trim().toUpperCase();
    if (!enteredCode) {
      setReceiptError('الرجاء إدخال رمز الصنف (مثال: P1 أو P2)');
      return;
    }
    if (enteredCode !== String(po.itemId || '').toUpperCase()) {
      setReceiptError(`رمز الصنف (${enteredCode}) لا يطابق صنف أمر الشراء (${po.itemId})`);
      return;
    }

    // CRITICAL LOGIC FIX: Convert Cartons to Units automatically
    // Logic: StockToAdd = Input_Cartons * CARTON_SIZES[Item_Code]
    const cartonSize = CARTON_SIZES[enteredCode] || 1;
    const stockToAdd = inputCartons * cartonSize;

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

      // Step 2: Receive PO in Supabase: add converted stockToAdd to current_stock
      const result = await receivePurchaseOrder(
        po.id,
        stockToAdd,
        invoicePublicUrl,
        receiverSignature.trim(),
        enteredCode
      );

      // Step 3: Refresh local inventory items immediately and reset last_restock_date (maintain strict numerical order P1..P11)
      const nowIso = new Date().toISOString();
      setItems(prevItems =>
        [...prevItems.map(item =>
          item.item_code === (result.itemCode || enteredCode) || item.item_code.toUpperCase() === enteredCode
            ? { ...item, current_stock: result.itemCode ? result.newStock : item.current_stock, last_restock_date: nowIso }
            : item
        )].sort((a, b) => compareItemCodes(a.item_code, b.item_code))
      );

      // Step 3.5: Receipt converts cartons to units and deducts StockToAdd from unreplenished consumption counter
      setUnreplenished(prev => ({
        ...prev,
        [enteredCode]: Math.max(0, (prev[enteredCode] || 0) - stockToAdd),
      }));

      // Step 4: Update purchase orders state locally
      setPurchaseOrders(prev =>
        prev.map(p =>
          p.id === po.id
            ? {
                ...p,
                status: 'تم الاستلام',
                receivedQuantity: inputCartons,
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
          setItems([...fresh].sort((a, b) => compareItemCodes(a.item_code, b.item_code)));
        }
        if (freshPOs && freshPOs.length > 0) {
          setPurchaseOrders(freshPOs as unknown as PurchaseOrder[]);
        }
      } catch (syncErr) {
        console.warn('Background sync warning:', syncErr);
      }

      const isPerPiece = cartonSize === 1;
      const successMsg = lang === 'ar'
        ? `تم استلام ${toEnglishDigits(inputCartons)} ${isPerPiece ? 'حبة' : 'كرتون'} (ما يعادل ${toEnglishDigits(stockToAdd)} وحدة) بنجاح وتحديث المخزون وخصم الاستهلاك غير المعوض لأمر الشراء (${po.id}) ✨`
        : `Received ${toEnglishDigits(inputCartons)} cartons (${toEnglishDigits(stockToAdd)} units), updated stock & deducted unreplenished consumption for (${po.id}) ✨`;

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
      <header className="bg-white/10 backdrop-blur-xl border border-white/25 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] rounded-2xl mb-6 p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
        <div className="bg-white/10 backdrop-blur-xl border border-white/25 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] rounded-2xl p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-slate-100 drop-shadow-sm">{t('inventory.kpiTotalItems')}</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2 drop-shadow-sm">{toEnglishDigits(items.length)}</div>
          <div className="text-xs text-white/80 font-semibold mt-1 drop-shadow-sm">{t('inventory.kpiTotalItemsDesc')}</div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/25 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] rounded-2xl p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-slate-100 drop-shadow-sm">{t('inventory.kpiLowStock')}</div>
          <div className={`text-3xl font-extrabold font-mono tracking-wider mt-2 drop-shadow-sm ${lowStockCount > 0 ? 'text-rose-200' : 'text-white'}`}>
            {toEnglishDigits(lowStockCount)}
          </div>
          <div className="text-xs text-rose-200 font-semibold mt-1 drop-shadow-sm">{t('inventory.kpiLowStockDesc')}</div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/25 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] rounded-2xl p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-slate-100 drop-shadow-sm">{t('inventory.kpiActivePO')}</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2 drop-shadow-sm">{toEnglishDigits(activePOs.length)}</div>
          <div className="text-xs text-white/80 font-semibold mt-1 drop-shadow-sm">{t('inventory.kpiActivePODesc')}</div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/25 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] rounded-2xl p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-slate-100 drop-shadow-sm">{t('inventory.kpiCoverage')}</div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2 drop-shadow-sm">
            {items.length > 0 ? `${Math.round(((items.length - lowStockCount) / items.length) * 100)}%` : '0%'}
          </div>
          <div className="text-xs text-white/80 font-semibold mt-1 drop-shadow-sm">{t('inventory.kpiCoverageDesc')}</div>
        </div>
      </div>

      {/* Smart Filter Bar */}
      <div className="bg-white/10 backdrop-blur-xl border border-white/25 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
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
        className="bg-white/10 backdrop-blur-xl border border-white/25 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] rounded-2xl p-6 sm:p-7 space-y-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-white/15">
          <div>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Smart Auto PO
              </h2>
              <span className="text-xs sm:text-sm font-bold text-white/85">
                (محرك بناء أوامر الشراء التلقائي بناءً على الاستهلاك)
              </span>
            </div>
            <p className="text-xs text-white/70 font-medium mt-1">
              إصدار أمر الشراء لا يصفّر عداد الاستهلاك — يتم الخصم/التصفير فقط عند استلام الشحنة بإدخال رمز الصنف والكمية المستلمة.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsInvoiceModalOpen(true)}
              className="text-[11px] font-bold text-emerald-200 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
              title="محاكاة إصدار فاتورة كمية لخصم المخزون وزيادة الاستهلاك غير المعوض"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>محاكاة فاتورة كمية (خصم استهلاك)</span>
            </button>
            <span className="text-[11px] font-mono font-bold text-white bg-white/10 border border-white/25 px-3 py-1.5 rounded-full w-fit">
              حجم الكرتون ديناميكي حسب مواصفات الصنف
            </span>
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
              {[...filteredItems].sort((a, b) => compareItemCodes(a.item_code, b.item_code)).map(item => {
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
                    className={`hover:bg-white/5 transition-colors border-b ${
                      isCritical
                        ? 'bg-rose-500/10 border-rose-500/30 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.35)]'
                        : 'border-white/5'
                    }`}
                  >
                    <td className="py-3.5 px-3">
                      <span className="font-mono font-extrabold text-sm text-white bg-white/15 border border-white/25 px-2.5 py-0.5 rounded-lg">
                        {code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        {isCritical && (
                          <span className="relative flex h-2.5 w-2.5 shrink-0" title="مستوى حرج">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
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
                      <span className={`font-mono font-black text-lg ${isCritical ? 'text-rose-200' : 'text-white'}`}>
                        {toEnglishDigits(item.current_stock)}
                      </span>
                      <span className="text-xs text-white/60 ms-1">{t('common.unit')}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-base text-white/90">{toEnglishDigits(minLevel)}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      {leadDays != null ? (
                        <span className={`text-sm font-bold ${isCritical ? 'text-rose-200' : 'text-white'}`}>
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
        <div className="bg-white/10 backdrop-blur-xl border border-white/25 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] rounded-2xl p-12 text-center text-white">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in">
            <div className="font-sans bg-zinc-900/90 backdrop-blur-2xl rounded-3xl w-full max-w-lg p-6 sm:p-7 space-y-4 text-white border border-white/20 shadow-[0_16px_48px_0_rgba(0,0,0,0.5)]">
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-white/15 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xs text-white bg-white/15 border border-white/25 px-2 py-0.5 rounded-lg">
                      {selectedItemForPO.item_code}
                    </span>
                    <h3 className="text-lg font-black text-white">
                      {t('inventory.modalCreatePOTitle')}
                    </h3>
                  </div>
                  <p className="text-xs text-white/70 mt-1 font-medium">
                    {t('inventory.modalRestockItem')} <strong className="text-white">{getItemDisplayName(selectedItemForPO)}</strong>
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

              <div className="space-y-4">
                {/* 1. Supplier Selection (Real Approved Mappings from Supabase supplier_items) */}
                <div>
                  <label className="block text-xs font-bold text-white mb-1.5 flex justify-between items-center">
                    <span>{t('inventory.modalSupplierLabel')}</span>
                    {isLoadingSuppliers ? (
                      <span className="text-[11px] text-white/60 flex items-center gap-1 font-sans">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        جاري جلب الموردين من قاعدة البيانات...
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
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-2.5 text-sm text-white focus:outline-none"
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
                </div>

                {/* 2. Quantity Input in Cartons (not Units) */}
                <div>
                  <label className="block text-xs font-bold text-white mb-1.5 flex justify-between items-center">
                    <span>
                      {isPerPiece ? 'الكمية المطلوبة (بالقطعة / حبة)' : 'الكمية المطلوبة (بالكرتون)'}
                    </span>
                    <span className="text-[11px] text-emerald-400 font-mono font-bold">
                      الطلب المقترح: {toEnglishDigits(suggestedCartons > 0 ? suggestedCartons : 1)} {isPerPiece ? 'حبة' : 'كرتون'}
                    </span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={poQuantity}
                    onChange={(e) => setPoQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/25 font-mono text-lg font-bold"
                  />
                  <div className="flex justify-between items-center text-[11px] text-white/70 mt-1.5 px-0.5">
                    <span>
                      {isPerPiece
                        ? 'يتم طلب هذا الصنف بالقطعة مباشرة (1 حبة = 1 وحدة استهلاك)'
                        : `ما يعادل: ${toEnglishDigits(totalUnits)} وحدة (${toEnglishDigits(cartonSize)} وحدة/كرتون)`}
                    </span>
                    <span className="text-white/50 font-mono">
                      سعر الوحدة: {toEnglishDigits(unitCost)} ريال
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={handleCreatePO}
                  className="flex-1 bg-emerald-600/80 hover:bg-emerald-500 active:scale-95 text-white font-bold py-3 rounded-xl transition-all text-sm cursor-pointer shadow-lg border border-emerald-400/30 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('inventory.modalConfirmPOBtn')}</span>
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
                  value={invoiceSimQty}
                  onChange={(e) => setInvoiceSimQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono text-base font-bold"
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

      {/* Modal: Receive Stock & Upload Invoice */}
      {isReceiveModalOpen && (() => {
        const selectedReceivePO = purchaseOrders.find(p => p.id === receivePoId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
            <div className="font-sans bg-white/10 backdrop-blur-xl rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 sm:p-7 space-y-4 text-white border border-white/25 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] relative">
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-white/20 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/15 border border-white/25 rounded-2xl text-white shrink-0">
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
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/25"
                  >
                    <option value="" disabled>
                      {activePOs.length === 0
                        ? (lang === 'en' ? 'No pending active orders' : 'لا توجد أوامر شراء نشطة بانتظار الاستلام')
                        : t('inventory.selectPOPlaceholder')}
                    </option>
                    {activePOs.map(po => (
                      <option key={po.id} value={po.id}>
                        {po.id} ({po.itemId || '—'}) - {po.itemName} ({toEnglishDigits(po.quantity)} {t('common.unit')})
                      </option>
                    ))}
                  </GlassSelect>
                </div>

                {/* Selected PO Details Card */}
                {selectedReceivePO && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3.5 space-y-2 text-xs">
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
                          ? 'bg-white/15 text-white border-white/25'
                          : 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                      }`}>
                        {selectedReceivePO.status === 'تم الاستلام' ? t('inventory.poStatusReceived') : selectedReceivePO.status}
                      </span>
                    </div>
                    {selectedReceivePO.receiverSignature && (
                      <div className="flex justify-between items-center text-white/90">
                        <span className="text-white/70">{t('inventory.receiverSignatureLabel')}</span>
                        <span className="font-bold text-white">{selectedReceivePO.receiverSignature}</span>
                      </div>
                    )}
                    {selectedReceivePO.invoiceUrl && (
                      <div className="flex justify-between items-center pt-1.5 border-t border-white/10">
                        <span className="text-white font-medium">{t('inventory.invoiceUploadedBadge')}</span>
                        <a
                          href={selectedReceivePO.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="text-white hover:text-white/80 underline font-bold flex items-center gap-1"
                        >
                          <span>{t('inventory.viewInvoice')}</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* 1.5 Item Code (Golden Key): receipt by code adds stock and deducts the unreplenished counter */}
                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <label className="block text-xs font-bold text-white">
                      رمز الصنف (Item Code - e.g., P1, P2)
                    </label>
                    <span className="text-[10px] text-white/70 font-mono">
                      الرموز القياسية: P1..P10
                    </span>
                  </div>
                  <input
                    type="text"
                    dir="ltr"
                    list="standard-codes-list"
                    value={receiveItemCode}
                    onChange={(e) => {
                      setReceiveItemCode(e.target.value.toUpperCase());
                      if (receiptError) setReceiptError(null);
                    }}
                    placeholder="P1"
                    className="w-full bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 rounded-xl p-3 text-sm text-white font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-white/25 placeholder:text-white/40 text-left rtl:text-right"
                  />
                  <datalist id="standard-codes-list">
                    {[...STANDARD_ITEM_CODES]
                      .sort((a, b) => compareItemCodes(a.code, b.code))
                      .map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} - {c.nameAr}
                        </option>
                      ))}
                  </datalist>
                  <p className="text-[11px] text-white/65 mt-1.5 leading-relaxed">
                    إدخال رمز الصنف سيقوم تلقائياً بزيادة الرصيد وتصفير عداد الاستهلاك العكسي لهذا الصنف.
                  </p>
                </div>

                {/* 2. Input (Number): Actual Quantity Received (in Cartons) */}
                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <label className="text-xs font-bold text-white">
                      {lang === 'ar' ? 'الكمية المستلمة (بالكرتون)' : t('inventory.actualQuantityReceived')}
                    </label>
                    {receiveItemCode && (
                      <span className="text-[11px] text-emerald-400 font-mono font-bold">
                        {(() => {
                          const cCode = receiveItemCode.toUpperCase();
                          const cSize = CARTON_SIZES[cCode] || 1;
                          const inputCartons = Number(receivedQty) || 0;
                          const convertedUnits = inputCartons * cSize;
                          return cSize === 1
                            ? `يتم الاستلام بالقطعة (${toEnglishDigits(convertedUnits)} حبة)`
                            : `ما يعادل: ${toEnglishDigits(convertedUnits)} وحدة (${toEnglishDigits(cSize)} حبة/كرتون)`;
                        })()}
                      </span>
                    )}
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
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/25 font-mono text-left rtl:text-right [unicode-bidi:plaintext]"
                  />
                  <p className="text-[11px] text-white/60 mt-1">
                    يتم تحويل عدد الكراتين تلقائياً إلى وحدات فعلية في المخزون وخصمها من عداد الاستهلاك.
                  </p>
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
                        ? 'border-white/25 bg-white/15'
                        : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30'
                    }`}
                  >
                    {invoiceFile ? (
                      <div className="flex items-center justify-between gap-3 text-left rtl:text-right">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 bg-white/15 rounded-xl text-white shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate max-w-[240px]">
                              {invoiceFile.name}
                            </p>
                            <p className="text-[10px] text-white font-mono mt-0.5">
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
                        <UploadCloud className="w-7 h-7 text-white mb-2 animate-bounce" />
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
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/25 placeholder:text-white/40"
                  />
                </div>
              </div>

              {/* 5. Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={handleConfirmReceipt}
                  disabled={isSubmittingReceipt || !receivePoId || !invoiceFile || !receivedQty || !receiverSignature.trim() || !receiveItemCode.trim()}
                  className="flex-1 bg-white/20 hover:bg-white/30 border border-white/30 active:scale-95 text-white font-extrabold py-3.5 rounded-xl transition-all text-sm cursor-pointer shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
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
