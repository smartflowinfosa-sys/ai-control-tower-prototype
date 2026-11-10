"use client";

import { useState, useEffect, useRef, useMemo, useCallback, type CSSProperties } from 'react';
import { SupabaseInventoryItem, SupabaseConsumptionHistoryRow, uploadInvoice, batchReceiveInventory, fetchInventoryItems, fetchItemConsumptionHistory, fetchAllItemsConsumption, fetchConsumptionHistoryByDateRange, fetchPurchaseOrders, createPurchaseOrder, fetchSuppliersForItem, SupabasePurchaseOrder } from '@/lib/supabaseService';
import { getAuthenticatedPOUser } from '@/lib/poAuth';
import { initialSuppliers, PurchaseOrder, getSessionPurchaseOrders, addPurchaseOrderToSession } from '@/lib/mockInventoryData';
import { useLanguage, CATEGORY_TRANSLATIONS, ITEM_NAME_TRANSLATIONS } from '@/components/common/LanguageContext';
import Link from 'next/link';
import GlassSelect from '@/components/common/GlassSelect';
import EnglishDatePicker from '@/components/common/EnglishDatePicker';
import {
  STANDARD_ITEM_CODES,
  compareItemCodes,
  CARTON_SIZES,
  LEAD_TIME_DAYS,
  getStandardCodeInfo,
  getDaysSinceRestock,
} from '@/constants/inventoryCodes';
import { triggerLowStockEmail } from '@/lib/notifications';
import { Building2, Check, X, AlertTriangle, RefreshCw, PackageCheck, UploadCloud, FileText, CheckCircle2, Loader2, ArrowUpRight, Sparkles, ArrowUpDown, ChevronDown, Clock, Calendar, SlidersHorizontal, PlusCircle, MinusCircle, Scale, Search, Package, ShieldAlert, User } from 'lucide-react';
import { useSession } from 'next-auth/react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('en');

const SAUDI_TZ = 'Asia/Riyadh';

// Enforce standard English font & Western Arabic numerals (0-9) via CSS & OpenType features
const englishNumericStyle: CSSProperties = {
  fontFamily: 'var(--font-inter), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  fontFeatureSettings: '"locl" 0, "lnum" 1, "tnum" 1',
  fontVariantNumeric: 'lining-nums tabular-nums',
  direction: 'ltr',
};

const ZAHI_PACKAGE_OPTIONS = [
  'غداء العمل - وجبة رئيسية + 1 سناك',
  'منيو العمل - 1 وجبة عمل+ 1 سناك',
  'نزول وزن - فطور + وجبة رئيسية + 1 سناك',
  'نزول وزن - وجبتين + 1 سناك',
  'نزول وزن - فطور + وجبتين رئيسية + 1 سناك',
  'نزول وزن - 3 وجبات رئيسية + 1 سناك',
  'تخسيس مضاعف - فطور + وجبة رئيسية + 1 سناك',
  'تخسيس مضاعف - وجبتين + 1 سناك',
  'تخسيس مضاعف - 1 فطور + وجبتين رئيسية + 1 سناك',
  'تخسيس مضاعف - 3 وجبات رئيسية + 1 سناك',
  'لو كارب - فطور + وجبة رئيسية + 1 سناك',
  'لو كارب - وجبتين + 1 سناك',
  'لو كارب - 1 فطور + وجبتين رئيسية + 1 سناك',
  'لو كارب - 3 وجبات رئيسية + 1 سناك',
  'لايف ستايل - فطور + وجبة رئيسية + 1 سناك',
  'لايف ستايل - وجبتين + 1 سناك',
  'لايف ستايل - فطور + وجبتين رئيسية + 1 سناك',
  'لايف ستايل - 3 وجبات رئيسية + 1 سناك',
];

// Helper to get YYYY-MM-DD for N days ago
const getDateStringDaysAgo = (daysAgo: number = 0): string => {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
};

// Helper to get the earliest upcoming valid delivery target date where adjustment is allowed
const getNextValidTargetDate = (): string => {
  const now = dayjs().tz(SAUDI_TZ).locale('en');
  // Kitchen prepares meals 2 days before delivery; cutoff is 9:00 PM (21:00) KSA on Prep Day.
  // If current hour is >= 21, cutoff for delivery (now + 2 days) has passed, so next valid delivery is (now + 3 days).
  const daysAhead = now.hour() >= 21 ? 3 : 2;
  return now.add(daysAhead, 'day').format('YYYY-MM-DD');
};

// Helper to ensure all digits are strictly English / Western (0-9), preserving negative numbers cleanly
const toEnglishDigits = (str: string | number): string => {
  if (str === null || str === undefined) return '';
  if (typeof str === 'number') {
    return Number(str).toLocaleString('en-US');
  }
  const clean = String(str)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
  const trimmed = clean.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed).toLocaleString('en-US');
  }
  return clean;
};

// Helper to strictly ensure date strings always use English / Western numerals (YYYY-MM-DD)
const formatEnglishDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  return String(dateStr)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .trim();
};

// Helper to strictly ensure all numbers in strings are English numerals (0-9)
const toEnglishDigitsStr = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .trim();
};

// Helper to convert ISO date (YYYY-MM-DD) strictly to DD/MM/YYYY with English numerals
const formatDisplayDate = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '';
  const clean = toEnglishDigitsStr(isoDate).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
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

// Strictly preserves live current_stock, reorder_level, and consumed_quantity from Supabase; only maps lead_time_days metadata.
const normalizeLiveInventoryItem = (item: SupabaseInventoryItem): SupabaseInventoryItem => {
  const code = String(item.item_code || '').trim().toUpperCase();
  const firstRel = Array.isArray(item.supplier_items) ? item.supplier_items[0] : undefined;
  const firstSup = firstRel
    ? Array.isArray(firstRel.suppliers)
      ? firstRel.suppliers[0]
      : firstRel.suppliers
    : undefined;
  const derivedLeadDays =
    firstSup?.delivery_time_hours != null
      ? Math.max(1, Math.ceil(Number(firstSup.delivery_time_hours) / 24))
      : null;

  return {
    ...item,
    current_stock: Number(item.current_stock ?? 0),
    reorder_level: Number(item.reorder_level ?? 0),
    consumed_quantity: Number(item.consumed_quantity ?? 0),
    lead_time_days: item.lead_time_days ?? LEAD_TIME_DAYS[code] ?? derivedLeadDays,
    last_restock_date: item.last_restock_date || null,
  };
};

export interface SuggestedOrderCalculation {
  needsOrder: boolean;
  consumedQuantity: number;
  cartonSize: number;
  isPerPiece: boolean;
  suggestedCartons: number;
  totalUnitsToOrder: number;
}

/**
 * 1:1 Replenishment Suggested Order Logic:
 * - Required Amount = consumed_quantity
 * - Suggested Cartons = Math.ceil(consumed_quantity / carton_size)
 * - If consumed_quantity is 0, displays "—" (No order needed).
 */
export const calculateSuggestedOrder = (
  itemOrCode: SupabaseInventoryItem | string,
  consumedQuantity: number = 0
): SuggestedOrderCalculation => {
  const code = typeof itemOrCode === 'string'
    ? itemOrCode.trim().toUpperCase()
    : String(itemOrCode?.item_code || '').trim().toUpperCase();

  const cartonSize = CARTON_SIZES[code] || 1;
  const isPerPiece = cartonSize === 1;
  const consumed = Math.max(0, Number(consumedQuantity) || 0);

  if (consumed === 0) {
    return {
      needsOrder: false,
      consumedQuantity: 0,
      cartonSize,
      isPerPiece,
      suggestedCartons: 0,
      totalUnitsToOrder: 0,
    };
  }

  const suggestedCartons = Math.ceil(consumed / cartonSize);
  const totalUnitsToOrder = isPerPiece ? suggestedCartons : suggestedCartons * cartonSize;

  return {
    needsOrder: true,
    consumedQuantity: consumed,
    cartonSize,
    isPerPiece,
    suggestedCartons,
    totalUnitsToOrder,
  };
};

const extractSupplierMappings = (
  rows: SupabaseInventoryItem[]
): Record<string, Array<{ id: string; name: string }>> => {
  const mappings: Record<string, Array<{ id: string; name: string }>> = {};
  for (const item of rows) {
    const code = String(item.item_code || '').trim().toUpperCase();
    if (!code || !Array.isArray(item.supplier_items)) continue;
    for (const rel of item.supplier_items) {
      const sup = Array.isArray(rel.suppliers) ? rel.suppliers[0] : rel.suppliers;
      if (!sup) continue;
      const name = (sup.name_ar || sup.name_en || '').trim();
      if (!name) continue;
      if (!mappings[code]) mappings[code] = [];
      if (!mappings[code].some(x => x.name === name)) {
        mappings[code].push({ id: sup.id, name });
      }
    }
  }
  return mappings;
};

export interface ReceivedItemRow {
  id: string;
  itemCode: string;
  itemName?: string;
  requestedUnits?: number;
  requestedCartons?: number;
  quantityCartons: number | '';
  isFromPO?: boolean;
}

interface InventoryClientProps {
  initialItems?: SupabaseInventoryItem[];
  initialPurchaseOrders?: SupabasePurchaseOrder[];
  initialSupplierMappings?: Record<string, Array<{ id: string; name: string }>>;
  fetchError?: string | null;
}

export default function InventoryClient({
  initialItems = [],
  initialPurchaseOrders = [],
  initialSupplierMappings = {},
  fetchError
}: InventoryClientProps) {
  const { lang, t } = useLanguage();
  const [inventoryItems, setInventoryItems] = useState<SupabaseInventoryItem[]>(() =>
    initialItems && initialItems.length > 0
      ? initialItems.map(normalizeLiveInventoryItem).sort((a, b) => compareItemCodes(a.item_code, b.item_code))
      : []
  );
  const [isLoadingInventory, setIsLoadingInventory] = useState<boolean>(
    !(initialItems && initialItems.length > 0)
  );
  const [liveFetchError, setLiveFetchError] = useState<string | null>(fetchError || null);

  // Fire the low-stock email hook once per item when it breaches its DB reorder_level.
  const notifiedCodes = useRef<Set<string>>(new Set());
  useEffect(() => {
    inventoryItems.forEach(item => {
      const code = item.item_code.toUpperCase();
      const reorderLevel = Number(item.reorder_level ?? 0);
      if (item.current_stock <= reorderLevel) {
        if (!notifiedCodes.current.has(code)) {
          notifiedCodes.current.add(code);
          triggerLowStockEmail(code, item.item_name_ar, item.current_stock, reorderLevel);
        }
      } else {
        notifiedCodes.current.delete(code);
      }
    });
  }, [inventoryItems]);

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  type SmartPOSortOption = 'default_priority' | 'highest_stock' | 'most_consumed';
  const [sortBy, setSortBy] = useState<SmartPOSortOption>('default_priority');
  const [selectedItemForPO, setSelectedItemForPO] = useState<SupabaseInventoryItem | null>(null);
  const [poQuantity, setPoQuantity] = useState<number>(10);
  const [itemSuppliers, setItemSuppliers] = useState<Record<string, Array<{ id: string; name: string }>>>(
    initialSupplierMappings || {}
  );

  // Total Historical Consumption for Smart Auto PO (grand total of all rows in inventory_consumption_history)
  const [totalHistoricalConsumption, setTotalHistoricalConsumption] = useState<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;
    fetchAllItemsConsumption()
      .then(map => {
        if (isMounted) {
          setTotalHistoricalConsumption(map);
        }
      })
      .catch(err => {
        console.error('Failed to load total historical consumption:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Historical Consumption Drawer (Slide-over) State — defaults to Today (Start Date = Today, End Date = Today)
  const [historyDrawerItem, setHistoryDrawerItem] = useState<SupabaseInventoryItem | null>(null);
  const [historyStartDate, setHistoryStartDate] = useState<string>(() => getDateStringDaysAgo(0));
  const [historyEndDate, setHistoryEndDate] = useState<string>(() => getDateStringDaysAgo(0));
  const [historyRows, setHistoryRows] = useState<SupabaseConsumptionHistoryRow[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // PDF Report Single Date Filter State (specifically for daily PDF Export, defaults strictly to Today's date)
  const [pdfReportDate, setPdfReportDate] = useState<string>(() => getDateStringDaysAgo(0));
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const loadConsumptionHistory = useCallback(
    async (itemCode: string, start: string, end: string) => {
      setIsLoadingHistory(true);
      setHistoryError(null);
      try {
        const rows = await fetchItemConsumptionHistory(itemCode, start, end);
        setHistoryRows(rows);
      } catch (err: unknown) {
        console.error('Failed to fetch item consumption history:', err);
        setHistoryError(
          err instanceof Error ? err.message : 'تعذر جلب سجل الاستهلاك التاريخي من قاعدة البيانات'
        );
        setHistoryRows([]);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    []
  );

  const handleOpenHistoryDrawer = (item: SupabaseInventoryItem) => {
    const defaultStart = getDateStringDaysAgo(0);
    const defaultEnd = getDateStringDaysAgo(0);
    setHistoryStartDate(defaultStart);
    setHistoryEndDate(defaultEnd);
    setHistoryDrawerItem(item);
    void loadConsumptionHistory(item.item_code, defaultStart, defaultEnd);
  };

  const handleHistoryDateChange = (newStart: string, newEnd: string) => {
    const cleanStart = formatEnglishDate(newStart);
    const cleanEnd = formatEnglishDate(newEnd);
    setHistoryStartDate(cleanStart);
    setHistoryEndDate(cleanEnd);
    if (historyDrawerItem) {
      void loadConsumptionHistory(historyDrawerItem.item_code, cleanStart, cleanEnd);
    }
  };

  const totalHistoryConsumed = useMemo(
    () => historyRows.reduce((sum, row) => sum + (Number(row.quantity_consumed) || 0), 0),
    [historyRows]
  );

  const refreshLiveInventory = useCallback(async () => {
    setIsLoadingInventory(true);
    setLiveFetchError(null);
    try {
      void fetchAllItemsConsumption().then(map => setTotalHistoricalConsumption(map));
      const liveRows = await fetchInventoryItems();
      const normalized = liveRows
        .map(normalizeLiveInventoryItem)
        .sort((a, b) => compareItemCodes(a.item_code, b.item_code));
      setInventoryItems(normalized);
      const extracted = extractSupplierMappings(liveRows);
      if (Object.keys(extracted).length > 0) {
        setItemSuppliers(prev => ({ ...prev, ...extracted }));
      }
    } catch (err: unknown) {
      console.error('Failed to fetch live inventory_items from Supabase:', err);
      setLiveFetchError(
        err instanceof Error ? err.message : 'تعذر الاتصال بقاعدة بيانات Supabase لجلب المخزون الحي'
      );
    } finally {
      setIsLoadingInventory(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchInventoryItems()
      .then(liveRows => {
        if (!isMounted) return;
        const normalized = liveRows
          .map(normalizeLiveInventoryItem)
          .sort((a, b) => compareItemCodes(a.item_code, b.item_code));
        setInventoryItems(normalized);
        const extracted = extractSupplierMappings(liveRows);
        if (Object.keys(extracted).length > 0) {
          setItemSuppliers(prev => ({ ...prev, ...extracted }));
        }
        setLiveFetchError(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        console.error('Failed to fetch live inventory_items from Supabase:', err);
        setLiveFetchError(
          err instanceof Error ? err.message : 'تعذر الاتصال بقاعدة بيانات Supabase لجلب المخزون الحي'
        );
      })
      .finally(() => {
        if (isMounted) setIsLoadingInventory(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);
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
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [isCreatingPO, setIsCreatingPO] = useState<boolean>(false);

  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 4500);
  };

  interface ConsolidatedOrder {
    id: string;
    itemId: string;
    supplierName: string;
    status: string;
    items: Array<{ itemId: string; itemName: string; quantity: number }>;
    distinctItemsCount: number;
    totalQuantity: number;
  }

  // Active Consolidated Orders (grouped strictly by unified Order ID / PO Number; received orders disappear immediately)
  const activePOs: ConsolidatedOrder[] = useMemo(() => {
    const orderMap = new Map<string, ConsolidatedOrder>();

    for (const po of purchaseOrders) {
      if (!po?.id) continue;
      const orig = (po.status || '').trim();
      const lower = orig.toLowerCase();
      const isNotReceived =
        orig !== 'تم الاستلام' &&
        orig !== 'تم الاستلام بنجاح' &&
        lower !== 'received' &&
        lower !== 'delivered';
      if (!isNotReceived) continue;

      const orderId = po.id.trim();
      let consolidated = orderMap.get(orderId);
      if (!consolidated) {
        consolidated = {
          id: orderId,
          itemId: String(po.itemId || '').trim().toUpperCase(),
          supplierName: po.supplierName || (po as unknown as { supplier_name?: string }).supplier_name || 'المورد المعتمد',
          status: orig || 'PENDING_APPROVAL',
          items: [],
          distinctItemsCount: 0,
          totalQuantity: 0,
        };
        orderMap.set(orderId, consolidated);
      }

      const lineSource =
        Array.isArray(po.items) && po.items.length > 0
          ? po.items
          : po.itemId
          ? [{ itemId: po.itemId, itemName: po.itemName || po.itemId, quantity: Number(po.quantity) || 0 }]
          : [];

      for (const line of lineSource) {
        const cCode = String(line.itemId || '').trim().toUpperCase();
        if (!cCode) continue;
        const qty = Number(line.quantity) || 0;
        const existingItem = consolidated.items.find(it => it.itemId === cCode);
        if (existingItem) {
          existingItem.quantity += qty;
        } else {
          const catalogItem = inventoryItems.find(i => i.item_code.toUpperCase() === cCode);
          const stdInfo = getStandardCodeInfo(cCode);
          const cleanLineName = (line.itemName || '').replace(/\s*\(\+\d+\)\s*$/, '').trim();
          consolidated.items.push({
            itemId: cCode,
            itemName: catalogItem?.item_name_ar || stdInfo?.nameAr || cleanLineName || cCode,
            quantity: qty,
          });
        }
      }
    }

    return Array.from(orderMap.values()).map(order => {
      const sortedItems = [...order.items].sort((a, b) => compareItemCodes(a.itemId, b.itemId));
      return {
        ...order,
        itemId: sortedItems[0]?.itemId || order.itemId,
        items: sortedItems,
        distinctItemsCount: Math.max(1, sortedItems.length),
        totalQuantity: sortedItems.reduce((sum, it) => sum + it.quantity, 0),
      };
    });
  }, [purchaseOrders, inventoryItems]);

  // Strict Session Authentication: Only authenticated NextAuth sessions can create or execute POs
  const { data: session } = useSession();
  const authenticatedUser = useMemo(() => getAuthenticatedPOUser(session, lang), [session, lang]);
  const isAuthorized = Boolean(authenticatedUser);

  // Derive authenticated employee name from active NextAuth session
  const sessionEmployeeName = useMemo(() => {
    const u = session?.user as {
      name_ar?: string;
      name_en?: string;
      name?: string | null;
      username?: string;
      email?: string;
    } | undefined;
    return (
      u?.name_ar ||
      u?.name_en ||
      u?.name ||
      u?.username ||
      authenticatedUser?.displayName ||
      ''
    ).trim();
  }, [session, authenticatedUser]);

  // Fallback employee list for audit logging
  const employeeRoster = useMemo(() => {
    const base = [
      'abdullatif mahdi',
      'فريق المطبخ والإنتاج',
      'مدير النظام',
      'مسؤول المستودع والتخزين',
      'مشرف العمليات والتوريد',
      'موظف خدمة العملاء',
    ];
    if (sessionEmployeeName && !base.includes(sessionEmployeeName)) {
      return [sessionEmployeeName, ...base];
    }
    return base;
  }, [sessionEmployeeName]);

  // Receive Stock & Multi-Item Invoice Modal State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState<boolean>(false);
  const [receivePoId, setReceivePoId] = useState<string>('');
  const [receivedItems, setReceivedItems] = useState<ReceivedItemRow[]>([]);

  /**
   * Consumption-Based Replenishment flow:
   * - Starts clean with 0 consumed quantity by default.
   * - Daily deduction logs / receipt events dynamically update this tracker.
   */
  const [unreplenished, setUnreplenished] = useState<Record<string, number>>({});
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [receiverSignature, setReceiverSignature] = useState<string>('');
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState<boolean>(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [, setStorageNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Manual Inventory Adjustment & Subscription Requests Modal State
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState<boolean>(false);
  const [adjActiveTab, setAdjActiveTab] = useState<'single' | 'deconstruct'>('deconstruct');
  const [adjItemCode, setAdjItemCode] = useState<string>('');
  const [adjType, setAdjType] = useState<'add' | 'deduct'>('add');
  const [adjQuantity, setAdjQuantity] = useState<number | string>(1);
  const [adjReason, setAdjReason] = useState<string>('تسويق');
  const [adjNotes, setAdjNotes] = useState<string>('');
  const [adjEmployeeName, setAdjEmployeeName] = useState<string>('');
  const [isSubmittingAdj, setIsSubmittingAdj] = useState<boolean>(false);
  const [adjError, setAdjError] = useState<string | null>(null);

  // Tab 1: Subscription Requests (إدارة طلبات المشتركين) State
  const [deconstructSubId, setDeconstructSubId] = useState<string>('');
  const [deconstructTargetDate, setDeconstructTargetDate] = useState<string>(() => getNextValidTargetDate());
  const [deconstructNotes, setDeconstructNotes] = useState<string>('');
  const [isFetchingMealData, setIsFetchingMealData] = useState<boolean>(false);
  const [deconstructFetched, setDeconstructFetched] = useState<boolean>(false);
  const [isDeconstructAdminOverride, setIsDeconstructAdminOverride] = useState<boolean>(false);
  const [deconstructSubInfo, setDeconstructSubInfo] = useState<{
    found_in_db: boolean;
    subscription_number: string;
    customer_name: string;
    package_name: string;
    items_count: number;
    district: string;
    delivery_window: string;
    report_date: string;
    matched_report_date: string | null;
    status: string;
  } | null>(null);
  const [deconstructMealSlots, setDeconstructMealSlots] = useState<
    Array<{
      slot_index: number;
      slot_label: string;
      category_filter: string;
      selected_meal_code: string;
      selected_meal_name_ar: string;
    }>
  >([]);
  const [deconstructMenuList, setDeconstructMenuList] = useState<
    Array<{
      meal_code: string;
      meal_name_ar: string;
      category_ar: string;
      bom: Array<{ inventory_item_code: string; quantity_used: number }>;
    }>
  >([]);
  const [deconstructItems, setDeconstructItems] = useState<
    Array<{
      item_code: string;
      item_name_ar: string;
      quantity: number;
      source: string;
      current_stock: number;
    }>
  >([]);

  // Live inventory items list from Supabase `inventory_items`
  interface RawMaterialItem {
    code: string;
    nameAr: string;
    nameEn?: string;
    categoryAr?: string;
  }

  const rawMaterialsList: RawMaterialItem[] = useMemo(() => {
    return inventoryItems
      .map(it => ({
        code: it.item_code.toUpperCase(),
        nameAr: it.item_name_ar,
        nameEn: it.item_name_en,
        categoryAr: it.category_ar,
      }))
      .sort((a, b) => compareItemCodes(a.code, b.code));
  }, [inventoryItems]);



  useEffect(() => {
    const handleStorageError: EventListener = (event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      if (detail?.message) {
        setStorageNotice(detail.message);
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
      const detail = (event as CustomEvent<{ id?: string; poNumber?: string; invoiceUrl?: string; receivedQuantity?: number }>).detail;
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

    // Only fetch purchase orders on client mount if SSR cache did not already supply them
    if (!initialPurchaseOrders || initialPurchaseOrders.length === 0) {
      fetchPurchaseOrders()
        .then(pos => {
          if (pos && pos.length > 0) {
            setPurchaseOrders(pos as unknown as PurchaseOrder[]);
          }
        })
        .catch(err => {
          console.warn('Background PO refresh warning:', err);
        });
    }

    return () => {
      window.removeEventListener('ai_purchase_order_created', handleNewAiPO);
      window.removeEventListener('ai_purchase_order_updated', handleUpdatePO);
      window.removeEventListener('purchase_order_received', handlePOReceived);
    };
  }, [initialPurchaseOrders]);

  // Builds the complete pre-populated invoice rows array from all items associated with a specific PO
  const buildInvoiceRowsFromPO = (poId: string): ReceivedItemRow[] => {
    const matchingPOs = purchaseOrders.filter(p => p.id === poId);
    if (matchingPOs.length === 0) return [];

    const aggregated = new Map<string, { itemCode: string; itemName: string; quantityUnits: number }>();

    matchingPOs.forEach(po => {
      if (Array.isArray(po.items) && po.items.length > 0) {
        po.items.forEach(line => {
          const cCode = String(line.itemId || '').trim().toUpperCase();
          if (!cCode) return;
          const qty = Number(line.quantity) || 0;
          const existing = aggregated.get(cCode);
          if (existing) {
            existing.quantityUnits += qty;
          } else {
            aggregated.set(cCode, {
              itemCode: cCode,
              itemName: line.itemName || cCode,
              quantityUnits: qty,
            });
          }
        });
      } else if (po.itemId) {
        const cCode = String(po.itemId).trim().toUpperCase();
        const qty = Number(po.quantity) || 0;
        const existing = aggregated.get(cCode);
        if (existing) {
          existing.quantityUnits += qty;
        } else {
          aggregated.set(cCode, {
            itemCode: cCode,
            itemName: po.itemName || cCode,
            quantityUnits: qty,
          });
        }
      }
    });

    return Array.from(aggregated.values())
      .sort((a, b) => compareItemCodes(a.itemCode, b.itemCode))
      .map((entry, idx) => {
        const cSize = CARTON_SIZES[entry.itemCode] || 1;
        const reqCartons = Math.max(1, Math.round(entry.quantityUnits / cSize));
        const catalogItem = inventoryItems.find(i => i.item_code.toUpperCase() === entry.itemCode);
        const stdInfo = getStandardCodeInfo(entry.itemCode);
        const cleanEntryName = (entry.itemName || '').replace(/\s*\(\+\d+\)\s*$/, '').trim();
        return {
          id: `po-row-${poId}-${entry.itemCode}-${idx}-${Date.now()}`,
          itemCode: entry.itemCode,
          itemName: catalogItem?.item_name_ar || stdInfo?.nameAr || cleanEntryName || entry.itemCode,
          requestedUnits: entry.quantityUnits,
          requestedCartons: reqCartons,
          quantityCartons: reqCartons,
          isFromPO: true,
        };
      });
  };

  const openReceiveModal = (defaultPoId?: string) => {
    const authUser = getAuthenticatedPOUser(session, lang);
    if (!authUser) {
      showError(
        lang === 'en'
          ? 'Unauthorized: Cannot execute or receive a Purchase Order without an authenticated user session.'
          : 'عذراً، لا يمكن استلام شحنة أو تنفيذ أمر شراء بدون جلسة مستخدم موثقة. يرجى تسجيل الدخول أولاً.'
      );
      return;
    }

    const targetId = defaultPoId || '';
    setReceivePoId(targetId);
    if (targetId) {
      setReceivedItems(buildInvoiceRowsFromPO(targetId));
    } else {
      setReceivedItems([]);
    }
    setReceiverSignature('');
    setInvoiceFile(null);
    setReceiptError(null);
    setIsReceiveModalOpen(true);
  };

  const handleSelectPO = (poId: string) => {
    setReceivePoId(poId);
    if (!poId) {
      setReceivedItems([]);
      setReceiptError(null);
      return;
    }

    // Auto-populate the consolidated items table with ALL items in the selected Order ID
    const autoPopulatedRows = buildInvoiceRowsFromPO(poId);
    setReceivedItems(autoPopulatedRows);
    setReceiptError(null);
  };

  const handleUpdateReceivedItemRow = (id: string, field: 'itemCode' | 'quantityCartons', value: string | number) => {
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
    const authUser = getAuthenticatedPOUser(session, lang);
    if (!authUser) {
      const msg = lang === 'en'
        ? 'Unauthorized: Cannot execute receipt without an authenticated user session.'
        : 'عذراً، لا يمكن تأكيد الاستلام أو تنفيذ أمر الشراء بدون جلسة مستخدم موثقة.';
      setReceiptError(msg);
      showError(msg);
      return;
    }

    if (!receivePoId) {
      setReceiptError(
        lang === 'ar'
          ? 'الرجاء اختيار رقم الطلب (Order ID / PO) أولاً'
          : 'Please select an Order ID (PO) first'
      );
      return;
    }

    if (receivedItems.length === 0) {
      setReceiptError('لا توجد أصناف مرتبطة بهذا الطلب للاستلام');
      return;
    }

    const hasMissingInput = receivedItems.some(
      i => !i.itemCode.trim() || i.quantityCartons === '' || Number(i.quantityCartons) < 0
    );
    if (hasMissingInput) {
      setReceiptError('الرجاء إدخال الكمية المستلمة بالكرتون لكل بند من بنود الطلب');
      return;
    }

    const totalSubmittedCartons = receivedItems.reduce((acc, i) => acc + (Number(i.quantityCartons) || 0), 0);
    if (totalSubmittedCartons <= 0) {
      setReceiptError('الرجاء إدخال كمية مستلمة أكبر من الصفر لكرتون واحد على الأقل');
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
      const invoicePublicUrl = await uploadInvoice(sanitizedInvoiceFile, receivePoId);

      // Step 1.5: Trigger n8n Webhook for automated Google Drive archiving
      if (invoicePublicUrl) {
        try {
          const po = purchaseOrders.find(p => p.id === receivePoId);
          const supplierName =
            po?.supplierName ||
            (po as unknown as { supplier_name?: string })?.supplier_name ||
            'فاتورة استلام مجمعة';
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
              po_number: receivePoId,
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
        receivePoId,
        invoicePublicUrl,
        receiverSignature.trim()
      );

      // Step 3: Compute added units map for local state update
      const nowIso = new Date().toISOString();
      const addedUnitsMap: Record<string, number> = {};
      receivedItems.forEach(row => {
        const code = row.itemCode.toUpperCase();
        const cartons = Number(row.quantityCartons) || 0;
        if (cartons <= 0) return;
        const cSize = CARTON_SIZES[code] || 1;
        const units = cartons * cSize;
        addedUnitsMap[code] = (addedUnitsMap[code] || 0) + units;
      });

      // Update local inventory items immediately and set last_restock_date to nowIso
      setInventoryItems(prevItems =>
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

      // Step 4: Update purchase orders state locally
      setPurchaseOrders(prev =>
        prev.map(p =>
          p.id === receivePoId
            ? {
                ...p,
                status: 'تم الاستلام',
                receiverSignature: receiverSignature.trim(),
                invoiceUrl: invoicePublicUrl,
                receivedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
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
          setInventoryItems(
            fresh.map(normalizeLiveInventoryItem).sort((a, b) => compareItemCodes(a.item_code, b.item_code))
          );
        }
        if (freshPOs && freshPOs.length > 0) {
          setPurchaseOrders(freshPOs as unknown as PurchaseOrder[]);
        }
      } catch (syncErr) {
        console.warn('Background sync warning:', syncErr);
      }

      const totalCartons = receivedItems.reduce((acc, i) => acc + (Number(i.quantityCartons) || 0), 0);
      const totalUnits = Object.values(addedUnitsMap).reduce((acc, u) => acc + u, 0);
      const distinctReceivedCount = Object.keys(addedUnitsMap).length;

      const successMsg = lang === 'ar'
        ? `تم استلام الطلب #${receivePoId} بنجاح: ${toEnglishDigits(distinctReceivedCount)} أصناف (${toEnglishDigits(totalCartons)} كرتون / ${toEnglishDigits(totalUnits)} وحدة) وتحديث المخزون ✨`
        : `Order #${receivePoId} received successfully: ${toEnglishDigits(distinctReceivedCount)} items (${toEnglishDigits(totalCartons)} cartons / ${toEnglishDigits(totalUnits)} units) ✨`;

      setSuccessToast(successMsg);
      setIsReceiveModalOpen(false);
      setInvoiceFile(null);
      setReceivePoId('');
      setReceivedItems([]);
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

  const handleOpenManualAdjustment = (preselectedItemCode?: string, initialTab: 'single' | 'deconstruct' = 'deconstruct') => {
    const fallbackCode = inventoryItems[0]?.item_code || 'P1';
    setAdjActiveTab(initialTab);
    setAdjItemCode(preselectedItemCode || fallbackCode);
    setAdjType('add');
    setAdjQuantity(1);
    setAdjReason('تسويق');
    setAdjNotes('');
    setAdjEmployeeName(sessionEmployeeName || employeeRoster[0] || '');
    setAdjError(null);
    setIsDeconstructAdminOverride(false);
    setDeconstructTargetDate(getNextValidTargetDate());
    setDeconstructSubId('');
    setDeconstructFetched(false);
    setDeconstructSubInfo(null);
    setDeconstructMealSlots([]);
    setDeconstructItems([]);
    setIsAdjustmentModalOpen(true);
  };

  // UI-level Smart Block Cut-off calculation (Prep Day = Target Date minus 2 days; Cut-off = 9:00 PM KSA)
  const deconstructCutoffState = useMemo(() => {
    const cleanDate = formatEnglishDate(deconstructTargetDate).split('T')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      return {
        isValid: false,
        prepDay: '',
        cutoffFormatted: '',
        isCutoffExceeded: false,
      };
    }
    const deliveryDayAST = dayjs.tz(cleanDate, SAUDI_TZ).locale('en').startOf('day');
    if (!deliveryDayAST.isValid()) {
      return {
        isValid: false,
        prepDay: '',
        cutoffFormatted: '',
        isCutoffExceeded: false,
      };
    }
    const prepDayAST = deliveryDayAST.subtract(2, 'day').locale('en');
    const cutoffDeadlineAST = prepDayAST.hour(21).minute(0).second(0).millisecond(0);
    const nowAST = dayjs().tz(SAUDI_TZ).locale('en');
    const isCutoffExceeded = nowAST.isAfter(cutoffDeadlineAST);

    const prepDayFormatted = toEnglishDigitsStr(prepDayAST.locale('en').format('YYYY-MM-DD'));
    return {
      isValid: true,
      prepDay: prepDayFormatted,
      cutoffFormatted: `${prepDayFormatted} (09:00 PM KSA)`,
      isCutoffExceeded,
    };
  }, [deconstructTargetDate]);

  const userRoleUpper = String((session?.user as { role?: string } | undefined)?.role || '').toUpperCase();
  const isAdminUser = !session?.user || userRoleUpper === 'ADMIN' || userRoleUpper === 'SUPERADMIN';

  const handleFetchMealData = async (
    overridePkg?: string,
    overrideMealCodes?: string[]
  ) => {
    setAdjError(null);
    const cleanSubId = toEnglishDigitsStr(deconstructSubId).trim();
    if (!cleanSubId) {
      setAdjError('يرجى إدخال رقم الاشتراك أولاً قبل جلب بيانات الوجبة.');
      return;
    }
    const cleanDate = formatEnglishDate(deconstructTargetDate).split('T')[0];
    if (!cleanDate) {
      setAdjError('يرجى تحديد تاريخ الإلغاء أولاً.');
      return;
    }

    try {
      setIsFetchingMealData(true);
      const params = new URLSearchParams({
        subscription_id: cleanSubId,
        target_date: cleanDate,
      });
      if (overridePkg) {
        params.set('package_name', overridePkg);
      }
      if (overrideMealCodes && overrideMealCodes.length > 0) {
        params.set('meal_codes', overrideMealCodes.join(','));
      }

      const res = await fetch(`/api/inventory/adjust?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'تعذر جلب بيانات الوجبة للاشتراك المحدد');
      }

      setDeconstructSubInfo(data.subscription || null);
      setDeconstructMealSlots(data.meal_slots || []);
      setDeconstructMenuList(data.menu_items || []);
      setDeconstructItems(data.deconstructed_items || []);
      setDeconstructFetched(true);
    } catch (err: unknown) {
      console.error('Error fetching subscription meal data:', err);
      setAdjError(err instanceof Error ? err.message : 'حدث خطأ أثناء جلب بيانات الوجبة');
    } finally {
      setIsFetchingMealData(false);
    }
  };

  const handleDeconstructMealSlotChange = (slotIndex: number, newMealCode: string) => {
    const updatedSlots = deconstructMealSlots.map((slot) => {
      if (slot.slot_index !== slotIndex) return slot;
      const foundMeal = deconstructMenuList.find((m) => m.meal_code === newMealCode);
      return {
        ...slot,
        selected_meal_code: newMealCode,
        selected_meal_name_ar: foundMeal?.meal_name_ar || slot.selected_meal_name_ar,
      };
    });
    setDeconstructMealSlots(updatedSlots);

    // Recalculate BOM items client-side immediately
    const pkgName = deconstructSubInfo?.package_name || '';
    const p8Qty = 1;
    const p7Qty = pkgName.includes('غداء العمل') || pkgName.includes('منيو العمل') ? 1 : 2;

    const map = new Map<string, { quantity: number; sources: Set<string> }>();
    const addComp = (code: string, qty: number, src: string) => {
      const upper = code.toUpperCase();
      const cur = map.get(upper) || { quantity: 0, sources: new Set<string>() };
      cur.quantity += qty;
      cur.sources.add(src);
      map.set(upper, cur);
    };

    addComp('P8', p8Qty, 'كيس التوصيل الأساسي (1 لكل اشتراك)');
    addComp('P7', p7Qty, 'أدوات المائدة حسب الباقة');

    for (const slot of updatedSlots) {
      const mealObj = deconstructMenuList.find((m) => m.meal_code === slot.selected_meal_code);
      const bomRows = mealObj?.bom || [];
      if (bomRows.length > 0) {
        for (const b of bomRows) {
          addComp(b.inventory_item_code, b.quantity_used, `${slot.slot_label}: ${slot.selected_meal_name_ar}`);
        }
      } else {
        addComp('P1', 1, slot.slot_label);
        addComp('P6', 1, slot.slot_label);
      }
    }

    const recalculated = Array.from(map.entries())
      .map(([code, info]) => {
        const liveItem = inventoryItems.find((i) => i.item_code.toUpperCase() === code);
        const std = getStandardCodeInfo(code);
        return {
          item_code: code,
          item_name_ar: liveItem?.item_name_ar || std?.nameAr || code,
          quantity: info.quantity,
          source: Array.from(info.sources).join(' + '),
          current_stock: Number(liveItem?.current_stock ?? 0),
        };
      })
      .sort((a, b) => compareItemCodes(a.item_code, b.item_code));

    setDeconstructItems(recalculated);
  };

  const handleDeconstructSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjError(null);

    const cleanSubId = toEnglishDigitsStr(deconstructSubId).trim();
    if (!cleanSubId) {
      setAdjError('يرجى إدخال رقم الاشتراك.');
      return;
    }

    if (!deconstructFetched || deconstructItems.length === 0) {
      setAdjError('يرجى الضغط على "جلب بيانات الوجبة" أولاً لعرض المواد المراد إرجاعها.');
      return;
    }

    const isAfterCutoff = deconstructCutoffState.isCutoffExceeded;
    if (isAfterCutoff && !isDeconstructAdminOverride) {
      setAdjError(
        '⚠️ تم تحضير الوجبة مسبقاً (تجاوزت الساعة 9 مساءً من يوم التحضير). لا يمكن إرجاع المواد للمخزون.'
      );
      return;
    }

    // Before cut-off -> bulk 'add'; After cut-off with Admin Override -> bulk 'redirect'
    const actionType: 'add' | 'redirect' = isAfterCutoff ? 'redirect' : 'add';
    const pkgLabel = deconstructSubInfo?.package_name || 'باقة اشتراك';
    const reasonText =
      actionType === 'redirect'
        ? 'إلغاء وتوجيه وجبة للتوالف (تجاوز إداري)'
        : 'إرجاع وتفكيك اشتراك';
    const defaultNote =
      deconstructNotes.trim() ||
      `تفكيك اشتراك #${cleanSubId} (${pkgLabel}) - تاريخ التوصيل: ${deconstructTargetDate}`;

    const finalEmployee = (adjEmployeeName || sessionEmployeeName || '').trim();
    if (!finalEmployee) {
      setAdjError('يرجى تحديد اسم الموظف المسؤول عن العملية (حقل إلزامي للرقابة والتدقيق).');
      return;
    }

    const payload = deconstructItems.map((item) => ({
      item_code: item.item_code,
      adjustment_type: actionType,
      quantity: item.quantity,
      reason: reasonText,
      notes: `${defaultNote} [${item.source}]`,
      reference_id: cleanSubId,
      target_date: deconstructTargetDate,
      employee_name: finalEmployee,
      isAdminOverride: isDeconstructAdminOverride,
      allowRedirect: actionType === 'redirect',
    }));

    try {
      setIsSubmittingAdj(true);

      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok || !resData?.success) {
        throw new Error(resData?.message || resData?.error || 'فشلت عملية تفكيك الاشتراك');
      }

      const totalUnits = deconstructItems.reduce((sum, i) => sum + i.quantity, 0);
      const toastMsg =
        actionType === 'redirect'
          ? `تم توجيه وجبة الاشتراك (#${cleanSubId}) للتوالف وتوثيق (${toEnglishDigits(deconstructItems.length)}) أصناف في السجل دون إرجاع للمخزون الفعلي.`
          : `تم إرجاع وتفكيك الاشتراك (#${cleanSubId}) بنجاح: تمت إعادة (${toEnglishDigits(totalUnits)}) وحدة موزعة على (${toEnglishDigits(deconstructItems.length)}) أصناف إلى المخزون الفعلي ✨`;

      setSuccessToast(toastMsg);
      setTimeout(() => setSuccessToast(null), 5500);

      setIsAdjustmentModalOpen(false);
      setDeconstructFetched(false);
      setDeconstructNotes('');
      setIsDeconstructAdminOverride(false);
      setAdjError(null);

      await refreshLiveInventory();
    } catch (err: unknown) {
      console.error('Subscription deconstruction error:', err);
      setAdjError(err instanceof Error ? err.message : 'حدث خطأ أثناء تنفيذ عملية تفكيك الاشتراك');
    } finally {
      setIsSubmittingAdj(false);
    }
  };

  const handleManualAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjError(null);

    if (!adjItemCode) {
      setAdjError(lang === 'en' ? 'Please select an item.' : 'يرجى تحديد الصنف المراد تسويته.');
      return;
    }

    const numQty = Number(adjQuantity);
    if (!Number.isFinite(numQty) || numQty <= 0) {
      setAdjError(lang === 'en' ? 'Quantity must be greater than 0.' : 'يجب إدخال كمية صحيحة أكبر من صفر.');
      return;
    }

    if (!adjReason) {
      setAdjError(lang === 'en' ? 'Please select a reason.' : 'يرجى اختيار سبب التسوية.');
      return;
    }

    const finalEmployee = (adjEmployeeName || sessionEmployeeName || '').trim();
    if (!finalEmployee) {
      setAdjError('يرجى تحديد اسم الموظف المسؤول عن العملية (حقل إلزامي للرقابة والتدقيق).');
      return;
    }

    const selectedItem = inventoryItems.find(
      i => (i.item_code || '').toUpperCase() === adjItemCode.toUpperCase()
    );

    try {
      setIsSubmittingAdj(true);

      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            item_code: adjItemCode,
            adjustment_type: adjType,
            quantity: numQty,
            reason: adjReason,
            notes: adjNotes,
            employee_name: finalEmployee,
          },
        ]),
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok || !resData?.success) {
        throw new Error(resData?.message || resData?.error || 'فشلت عملية التسوية المخزنية');
      }

      const itemLabel = selectedItem ? (selectedItem.item_name_ar || adjItemCode) : adjItemCode;
      const actionLabel = adjType === 'add' ? 'إضافة' : 'خصم';
      const successMsg = lang === 'en'
        ? `Stock adjusted successfully: ${adjType === 'add' ? '+' : '-'}${toEnglishDigits(numQty)} units for (${adjItemCode}).`
        : `تمت التسوية بنجاح: ${actionLabel} ${toEnglishDigits(numQty)} وحدة للصنف (${adjItemCode} - ${itemLabel})`;

      setSuccessToast(successMsg);
      setTimeout(() => setSuccessToast(null), 5000);

      setIsAdjustmentModalOpen(false);
      setAdjNotes('');
      setAdjError(null);

      // Immediately refresh live stock from database
      await refreshLiveInventory();
    } catch (err: unknown) {
      console.error('Manual adjustment error:', err);
      setAdjError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء حفظ التسوية');
    } finally {
      setIsSubmittingAdj(false);
    }
  };

  // Bilingual Item Name Resolver
  const getItemDisplayName = useCallback((item: SupabaseInventoryItem): string => {
    if (lang === 'en') {
      return item.item_name_en || ITEM_NAME_TRANSLATIONS[item.item_name_ar] || item.item_name_ar;
    }
    return item.item_name_ar;
  }, [lang]);

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



  // Compute unique categories from live database data
  const dynamicCategories = [
    'ALL',
    ...Array.from(new Set(inventoryItems.map(item => getItemCategoryKey(item))))
  ];

  const filteredItems = inventoryItems.filter(item => {
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

  // Resolves total historical consumed_quantity from inventory_consumption_history (grand total of all rows) (+ any runtime simulation delta)
  const getItemConsumedQuantity = useCallback(
    (item: SupabaseInventoryItem): number => {
      const code = String(item.item_code || '').trim().toUpperCase();
      const historyTotal = totalHistoricalConsumption[code];
      const baseConsumed = historyTotal !== undefined ? Number(historyTotal) : Number(item.consumed_quantity ?? 0);
      const localAdded = Number(unreplenished[code] ?? 0);
      return Math.max(0, baseConsumed + localAdded);
    },
    [totalHistoricalConsumption, unreplenished]
  );

  // Smart Auto PO Sorting Engine (strictly driven by live current_stock, reorder_level & consumed_quantity from Supabase)
  const sortedTableItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'highest_stock') {
      return (b.current_stock ?? 0) - (a.current_stock ?? 0);
    }

    if (sortBy === 'most_consumed') {
      const consumedA = getItemConsumedQuantity(a);
      const consumedB = getItemConsumedQuantity(b);
      if (consumedB !== consumedA) {
        return consumedB - consumedA;
      }
      return compareItemCodes(a.item_code, b.item_code);
    }

    // Default Priority Sorting Hierarchy:
    const minA = Number(a.reorder_level ?? 0);
    const minB = Number(b.reorder_level ?? 0);
    const isCriticalA = (a.current_stock ?? 0) <= minA;
    const isCriticalB = (b.current_stock ?? 0) <= minB;

    // 1. Critical items (current_stock <= reorder_level) MUST appear at the very top
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
      // 3. Then sort by consumed_quantity in DESCENDING order (highest consumption first)
      const consumedA = getItemConsumedQuantity(a);
      const consumedB = getItemConsumedQuantity(b);
      if (consumedB !== consumedA) {
        return consumedB - consumedA;
      }
      return compareItemCodes(a.item_code, b.item_code);
    }

    // 4. For non-critical items, sort by consumed_quantity DESCENDING, then standard P-code
    const consumedA = getItemConsumedQuantity(a);
    const consumedB = getItemConsumedQuantity(b);
    if (consumedB !== consumedA) {
      return consumedB - consumedA;
    }
    return compareItemCodes(a.item_code, b.item_code);
  });

  const lowStockCount = inventoryItems.filter(i => i.current_stock <= Number(i.reorder_level ?? 0)).length;

  /**
   * PDF Export for Daily Consumption Report (Physical Cross-Check Report):
   * 1. Fetches data strictly from `inventory_consumption_history` for the selected single day (pdfReportDate).
   * 2. Maps `item_code` from history with `inventory_items` to get `item_name_ar`.
   * 3. 5 Columns in exact Right-To-Left order:
   *    - الرمز (item_code)
   *    - اسم الصنف (item_name_ar)
   *    - الرصيد الافتتاحي (balance_before from history)
   *    - الكمية المستهلكة (quantity_consumed from history)
   *    - الرصيد الحالي (balance_after from history)
   * 4. Numbers strictly formatted in standard English digits (0-9).
   * 5. No grand totals row.
   */
  const exportConsumptionReportPdf = useCallback(async () => {
    setIsExportingPdf(true);

    try {
      const targetDate = (pdfReportDate || getDateStringDaysAgo(0)).trim();
      const displayDate = formatDisplayDate(targetDate);

      // 1. Fetch from inventory_consumption_history based on selected single date
      const historyRecords = await fetchConsumptionHistoryByDateRange(targetDate, targetDate);

      if (!historyRecords || historyRecords.length === 0) {
        setSuccessToast(
          lang === 'en'
            ? `No consumption history records found for ${displayDate}.`
            : `لا توجد سجلات استهلاك تاريخية محفوظة للتاريخ المحدد (${displayDate}). يرجى اختيار تاريخ تم فيه خصم المخزون.`
        );
        setTimeout(() => setSuccessToast(null), 4500);
        return;
      }

      // 2. Map item_code from history with inventory_items array to get item_name_ar
      const itemNameMap = new Map<string, string>();
      for (const item of inventoryItems) {
        const code = (item.item_code || '').trim().toUpperCase();
        if (code) {
          itemNameMap.set(code, item.item_name_ar || getItemDisplayName(item));
        }
      }

      const getItemNameAr = (code: string): string => {
        const c = code.trim().toUpperCase();
        if (itemNameMap.has(c)) return itemNameMap.get(c)!;
        const std = getStandardCodeInfo(c);
        return std?.nameAr || c;
      };

      // Group records by item_code (in case multiple records exist for the day)
      const itemsByCode = new Map<string, SupabaseConsumptionHistoryRow[]>();
      for (const row of historyRecords) {
        const code = String(row.item_code || '').trim().toUpperCase();
        if (!code) continue;
        if (!itemsByCode.has(code)) {
          itemsByCode.set(code, []);
        }
        itemsByCode.get(code)!.push(row);
      }

      // 3. Prepare Report Data with exact RTL columns:
      // [item_code] | [item_name_ar] | [balance_before] | [quantity_consumed] | [balance_after]
      const reportRows: Array<{
        item_code: string;
        item_name_ar: string;
        balance_before: number;
        quantity_consumed: number;
        balance_after: number;
      }> = [];

      for (const [code, rowsForCode] of itemsByCode.entries()) {
        rowsForCode.sort((a, b) => (a.target_date || '').localeCompare(b.target_date || '') || ((Number(a.id) || 0) - (Number(b.id) || 0)));
        const earliest = rowsForCode[0];
        const latest = rowsForCode[rowsForCode.length - 1];
        const totalConsumed = rowsForCode.reduce((acc, r) => acc + Number(r.quantity_consumed ?? 0), 0);

        reportRows.push({
          item_code: code,
          item_name_ar: getItemNameAr(code),
          balance_before: Number(earliest.balance_before ?? 0),
          quantity_consumed: totalConsumed,
          balance_after: Number(latest.balance_after ?? 0),
        });
      }

      // Sort by standard item codes (P1, P2, ... P11)
      reportRows.sort((a, b) => compareItemCodes(a.item_code, b.item_code));

      const escapeHtml = (val: string | number | null | undefined): string => {
        if (val === null || val === undefined) return '';
        return String(val)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };

      const tableRowsHtml = reportRows
        .map(row => {
          const isConsumed = row.quantity_consumed > 0;
          return `
          <tr>
            <td style="text-align:center;"><span class="item-code" dir="ltr">${escapeHtml(row.item_code)}</span></td>
            <td class="item-name">${escapeHtml(row.item_name_ar)}</td>
            <td class="num-cell" style="text-align:center;"><span dir="ltr">${toEnglishDigits(row.balance_before)}</span></td>
            <td class="consumed-cell ${isConsumed ? 'consumed-active' : 'consumed-zero'}" style="text-align:center;"><span dir="ltr">${toEnglishDigits(row.quantity_consumed)}</span></td>
            <td class="num-cell" style="text-align:center;"><span dir="ltr">${toEnglishDigits(row.balance_after)}</span></td>
          </tr>`;
        })
        .join('');

      const htmlDoc = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title></title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 16px;
      font-size: 12px;
      line-height: 1.5;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #059669;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .report-title {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      margin: 0;
    }
    .report-date {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }
    .date-badge {
      display: inline-block;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 800;
      color: #0f172a;
      direction: ltr;
      text-align: center;
      font-family: monospace;
      font-size: 13px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      vertical-align: middle;
    }
    th {
      background-color: #1e293b !important;
      color: #ffffff !important;
      font-weight: 800;
      font-size: 12px;
    }
    th:nth-child(1), td:nth-child(1) {
      width: 12%;
      text-align: center;
    }
    th:nth-child(2), td:nth-child(2) {
      width: 34%;
      text-align: right;
    }
    th:nth-child(3), td:nth-child(3) {
      width: 18%;
      text-align: center;
    }
    th:nth-child(4), td:nth-child(4) {
      width: 18%;
      text-align: center;
    }
    th:nth-child(5), td:nth-child(5) {
      width: 18%;
      text-align: center;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .item-code {
      font-family: monospace;
      font-weight: 800;
      color: #0f172a;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
    }
    .item-name {
      font-weight: 700;
      color: #1e293b;
    }
    .num-cell, .consumed-cell, .date-badge, .item-code {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, monospace;
      direction: ltr !important;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .num-cell {
      font-size: 13px;
      font-weight: 700;
      color: #334155;
    }
    .consumed-cell {
      font-size: 13px;
      font-weight: 800;
    }
    .consumed-active {
      color: #047857 !important;
      background-color: #d1fae5 !important;
      font-weight: 900;
    }
    .consumed-zero {
      color: #94a3b8 !important;
    }
  </style>
</head>
<body>
  <div class="header-container">
    <h1 class="report-title">تقرير الاستهلاك اليومي للمخزون</h1>
    <div class="report-date">
      <span>تاريخ التقرير:</span>
      <span class="date-badge"><span dir="ltr">${toEnglishDigitsStr(displayDate)}</span></span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>الرمز</th>
        <th>اسم الصنف</th>
        <th>الرصيد الافتتاحي</th>
        <th>الكمية المستهلكة</th>
        <th>الرصيد الحالي</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  <script>
    window.onload = function() {
      try {
        document.title = "";
      } catch (e) {}
      setTimeout(function() {
        window.focus();
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

      const printWin = window.open('', '_blank', 'width=1000,height=900');
      if (!printWin) {
        let iframe = document.getElementById('consumption-report-print-iframe') as HTMLIFrameElement;
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'consumption-report-print-iframe';
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          document.body.appendChild(iframe);
        }
        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(htmlDoc);
          doc.title = '';
          doc.close();
        }
      } else {
        printWin.document.open();
        printWin.document.write(htmlDoc);
        printWin.document.title = '';
        printWin.document.close();
      }

      setSuccessToast(
        lang === 'en'
          ? `PDF report prepared successfully for ${toEnglishDigits(reportRows.length)} items (${displayDate})`
          : `تم تجهيز تقرير PDF لـ (${toEnglishDigits(reportRows.length)}) صنف لتاريخ (${displayDate}) بنجاح`
      );
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: unknown) {
      console.error('Error generating consumption history PDF report:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setSuccessToast(
        lang === 'en'
          ? `Failed generating PDF: ${msg}`
          : `تعذر إنشاء تقرير PDF: ${msg}`
      );
      setTimeout(() => setSuccessToast(null), 4000);
    } finally {
      setIsExportingPdf(false);
    }
  }, [pdfReportDate, inventoryItems, getItemDisplayName, lang]);

  /**
   * Interactive Consumption Link (Simulating a Quantity Invoice):
   * When triggered:
   * A. Deducts `consumedUnits` from the item's `current_quantity` (`item.current_stock`).
   * B. Adds `consumedUnits` to the item's `unreplenished_consumption` counter (`unreplenished`).
   */
  const handleQuantityConsumption = useCallback((itemCode: string, consumedUnits: number) => {
    const code = (itemCode || '').trim().toUpperCase();
    const qty = Math.max(0, Number(consumedUnits) || 0);
    if (!code || qty <= 0) return;

    // A. Deduct consumedUnits from item's current_quantity (current_stock)
    setInventoryItems(prevItems =>
      prevItems.map(item => {
        if (item.item_code.toUpperCase() === code) {
          const updatedStock = (item.current_stock ?? 0) - qty;
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
  }, [lang]);

  // Expose handleQuantityConsumption to window and custom events for seamless integration
  useEffect(() => {
    type WindowWithConsumption = Window & {
      handleQuantityConsumption?: (itemCode: string, consumedUnits: number) => void;
    };
    const onInvoiceEvent: EventListener = (event) => {
      const { itemCode, consumedUnits } =
        (event as CustomEvent<{ itemCode?: string; consumedUnits?: number }>).detail || {};
      if (itemCode && consumedUnits) {
        handleQuantityConsumption(itemCode, consumedUnits);
      }
    };
    window.addEventListener('quantity_consumption_invoice', onInvoiceEvent);
    (window as WindowWithConsumption).handleQuantityConsumption = handleQuantityConsumption;

    return () => {
      window.removeEventListener('quantity_consumption_invoice', onInvoiceEvent);
      delete (window as WindowWithConsumption).handleQuantityConsumption;
    };
  }, [handleQuantityConsumption]);

  const handleOpenPO = async (item: SupabaseInventoryItem, initialCartons?: number) => {
    const authUser = getAuthenticatedPOUser(session, lang);
    if (!authUser) {
      showError(
        lang === 'en'
          ? 'Unauthorized: Cannot create a Purchase Order without an authenticated user session.'
          : 'عذراً، لا يمكن إنشاء أمر شراء بدون جلسة مستخدم موثقة. يرجى تسجيل الدخول أولاً.'
      );
      return;
    }
    setSelectedItemForPO(item);
    const code = item.item_code.toUpperCase();
    const consumed = getItemConsumedQuantity(item);
    const orderCalc = calculateSuggestedOrder(code, consumed);

    // Quantity defaults to Suggested Order in Cartons (الطلب المقترح)
    const defaultCartons = initialCartons !== undefined && initialCartons > 0
      ? initialCartons
      : (orderCalc.needsOrder ? orderCalc.suggestedCartons : 1);

    setPoQuantity(Math.max(1, defaultCartons));

    // Use joined supplier mappings from SSR cache directly (eliminating N+1 query per item)
    const cached = itemSuppliers[code];
    if (cached && cached.length > 0) {
      setSelectedSupplier(cached[0].name);
      return;
    }

    setSelectedSupplier('');
    setIsLoadingSuppliers(true);
    try {
      const dbSuppliers = await fetchSuppliersForItem(code);
      if (dbSuppliers && dbSuppliers.length > 0) {
        setItemSuppliers(prev => ({ ...prev, [code]: dbSuppliers }));
        setSelectedSupplier(dbSuppliers[0].name);
      } else {
        setSelectedSupplier('');
      }
    } catch (err) {
      console.error('Error fetching suppliers for item from DB:', err);
    } finally {
      setIsLoadingSuppliers(false);
    }
  };

  const handleCreatePO = async () => {
    const authUser = getAuthenticatedPOUser(session, lang);
    if (!authUser) {
      showError(
        lang === 'en'
          ? 'Unauthorized: Cannot create a Purchase Order without an authenticated user session.'
          : 'عذراً، لا يمكن إنشاء أمر شراء بدون جلسة مستخدم موثقة. يرجى تسجيل الدخول أولاً.'
      );
      return;
    }

    if (!selectedItemForPO || isCreatingPO) return;
    setIsCreatingPO(true);

    const code = selectedItemForPO.item_code.toUpperCase();
    const cartonSize = CARTON_SIZES[code] || 1;
    const isPerPiece = cartonSize === 1;
    const totalUnits = isPerPiece ? poQuantity : poQuantity * cartonSize;
    const unitCost = selectedItemForPO.cost_per_unit || selectedItemForPO.supplier_items?.[0]?.price || 0.45;
    const totalCost = Number((totalUnits * unitCost).toFixed(2));
    const poNum = `PO-${Math.floor(1000 + Math.random() * 9000)}`;

    const supplierCandidates = itemSuppliers[code] || [];
    const matchedSup =
      supplierCandidates.find(s => s.name === selectedSupplier) ||
      initialSuppliers.find(s => s.name === selectedSupplier);
    const resolvedSupplierName = selectedSupplier || supplierCandidates[0]?.name || 'المورد المعتمد';

    const newPO: PurchaseOrder = {
      id: poNum,
      itemId: code,
      itemName: selectedItemForPO.item_name_ar,
      items: [{ itemId: code, itemName: selectedItemForPO.item_name_ar, quantity: totalUnits }],
      supplierName: resolvedSupplierName,
      supplier_id: matchedSup?.id,
      supplierId: matchedSup?.id,
      quantity: totalUnits,
      totalCost,
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      createdBy: authUser.displayName,
      createdById: authUser.id,
    };

    try {
      await createPurchaseOrder({
        po_number: poNum,
        supplier_id: matchedSup?.id,
        inventory_item_code: code,
        quantity: totalUnits,
        total_cost: totalCost,
        status: 'PENDING_APPROVAL',
        created_by: authUser.id,
      });
    } catch (dbErr) {
      console.warn('Supabase PO insert fallback to session store:', dbErr);
    } finally {
      setIsCreatingPO(false);
    }

    addPurchaseOrderToSession(newPO);
    setPurchaseOrders(prev => [newPO, ...prev.filter(p => p.id !== poNum)]);

    const unitLabel = isPerPiece ? 'حبة' : 'كرتون';
    const msg = lang === 'ar'
      ? `تم إنشاء أمر الشراء ${newPO.id} بواسطة (${authUser.displayName}) لعدد ${toEnglishDigits(poQuantity)} ${unitLabel} (${toEnglishDigits(totalUnits)} وحدة) من (${resolvedSupplierName}) بنجاح!`
      : `Purchase order ${newPO.id} created by (${authUser.displayName}) for ${toEnglishDigits(poQuantity)} ${isPerPiece ? 'pieces' : 'cartons'} from (${resolvedSupplierName})!`;
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

      {/* Auth / Validation Error Toast */}
      {errorToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-rose-950/95 border border-rose-400/50 text-rose-100 px-6 py-3.5 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 shadow-2xl">
          <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" />
          <span className="text-sm font-bold">{errorToast}</span>
        </div>
      )}

      {/* Database Error Banner if Supabase connection fails */}
      {liveFetchError && (
        <div className="bg-rose-500/10 border border-rose-400/30 rounded-2xl p-4 flex items-center justify-between gap-4 text-white">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-200 shrink-0" />
            <div>
              <p className="text-sm font-bold text-rose-200">{t('inventory.dbErrorTitle')}</p>
              <p className="text-xs text-white/80 mt-0.5">{liveFetchError}</p>
            </div>
          </div>
          <button
            onClick={refreshLiveInventory}
            disabled={isLoadingInventory}
            className="bg-white/8 hover:bg-white/15 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInventory ? 'animate-spin' : ''}`} />
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
          {/* Manual Inventory Adjustment Button (Glassmorphism) */}
          <button
            type="button"
            onClick={() => handleOpenManualAdjustment()}
            className="bg-white/[0.08] hover:bg-white/[0.16] backdrop-blur-md backdrop-saturate-150 border border-white/20 hover:border-white/35 text-white font-bold px-4 py-2.5 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all text-sm flex items-center gap-2 group cursor-pointer active:scale-95"
            title={lang === 'en' ? 'Manual Inventory Adjustment' : 'تعديل يدوي للمخزون'}
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-300 group-hover:rotate-12 transition-transform" />
            <span>{lang === 'en' ? 'Manual Inventory Adjustment' : 'تعديل يدوي للمخزون'}</span>
          </button>

          {/* Manual Adjustments Report Link (Glassmorphism) */}
          <Link
            href="/inventory/adjustments-report"
            className="bg-white/[0.06] hover:bg-white/[0.12] backdrop-blur-md border border-white/15 hover:border-white/30 text-white/90 hover:text-white font-bold px-3.5 py-2.5 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all text-sm flex items-center gap-1.5 cursor-pointer"
            title={lang === 'en' ? 'Manual Adjustments Report' : 'تقرير التعديلات اليدوية'}
          >
            <span>📑 {lang === 'en' ? 'Adjustments Report' : 'تقرير التعديلات'}</span>
          </Link>

          {/* Role-Based Access Control (RBAC): Only authorized roles (e.g., Warehouse Manager, Operations Manager, Admin) can access stock receiving */}
          {isAuthorized && (
            <button
                onClick={() => openReceiveModal()}
                className="px-4 py-2.5 text-sm bg-white/5 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-xl text-white hover:bg-white/10 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <PackageCheck className="w-4 h-4 shrink-0 text-white" />
                <span>{lang === 'en' ? 'Receive Inventory' : 'استلام مخزون'}</span>
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
          <div className="text-3xl font-extrabold text-white font-mono tracking-wider mt-2 drop-shadow-sm">
            {isLoadingInventory && inventoryItems.length === 0 ? (
              <Loader2 className="w-6 h-6 animate-spin text-white/70" />
            ) : (
              toEnglishDigits(inventoryItems.length)
            )}
          </div>
          <div className="text-xs text-white/80 font-semibold mt-1 drop-shadow-sm">{t('inventory.kpiTotalItemsDesc')}</div>
        </div>

        <div className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-6 flex flex-col justify-between transition-all duration-200">
          <div className="text-xs font-bold text-slate-100 drop-shadow-sm">{t('inventory.kpiLowStock')}</div>
          <div className={`text-3xl font-extrabold font-mono tracking-wider mt-2 drop-shadow-sm ${lowStockCount > 0 ? 'text-rose-200' : 'text-white'}`}>
            {isLoadingInventory && inventoryItems.length === 0 ? (
              <Loader2 className="w-6 h-6 animate-spin text-white/70" />
            ) : (
              toEnglishDigits(lowStockCount)
            )}
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
            {isLoadingInventory && inventoryItems.length === 0 ? (
              <Loader2 className="w-6 h-6 animate-spin text-white/70" />
            ) : (
              inventoryItems.length > 0 ? `${Math.round(((inventoryItems.length - lowStockCount) / inventoryItems.length) * 100)}%` : '0%'
            )}
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
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Smart Auto PO
            </h2>
          </div>

          {/* Controls: Live Refresh, Date Picker, Export PDF & Sorting */}
          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <button
              type="button"
              onClick={refreshLiveInventory}
              disabled={isLoadingInventory}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border bg-white/10 hover:bg-white/15 border-white/20 text-white/90 hover:text-white disabled:opacity-50"
              title={lang === 'en' ? 'Refresh live stock from Supabase' : 'تحديث الرصيد الحي من قاعدة البيانات'}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-300 ${isLoadingInventory ? 'animate-spin' : ''}`} />
              <span>{lang === 'en' ? 'Sync Live Stock' : 'تحديث الرصيد'}</span>
            </button>

            {/* PDF Report Single Date Picker & Export Button (Strictly defaults to Today) */}
            <div className="flex flex-wrap items-center gap-2 bg-white/[0.08] hover:bg-white/[0.12] border border-emerald-400/30 rounded-xl px-2.5 py-1.5 shadow-sm transition-all">
              <div className="flex items-center gap-1.5 text-xs text-white/90">
                <Calendar className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span className="font-bold text-[11px] text-white/80 shrink-0">
                  {lang === 'en' ? 'Date:' : 'تاريخ التقرير:'}
                </span>
                <input
                  type="date"
                  value={pdfReportDate}
                  onChange={(e) => setPdfReportDate(e.target.value)}
                  className="bg-black/30 hover:bg-black/40 border border-white/20 rounded-lg px-2.5 py-0.5 text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer [color-scheme:dark]"
                  title={lang === 'en' ? 'Report Date' : 'تاريخ التقرير'}
                />
              </div>

              <button
                type="button"
                onClick={exportConsumptionReportPdf}
                disabled={isExportingPdf}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border bg-emerald-600/30 hover:bg-emerald-600/50 border-emerald-400/50 text-emerald-200 hover:text-white disabled:opacity-50 shadow-sm"
                title={lang === 'en' ? 'Export Consumption Report (PDF)' : 'تصدير تقرير الاستهلاك (PDF)'}
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 text-emerald-300 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-emerald-300" />
                )}
                <span>{lang === 'en' ? 'Export PDF' : 'تصدير تقرير الاستهلاك (PDF)'}</span>
              </button>
            </div>

            {/* Sorting Dropdown Menu */}
            <div className="flex items-center gap-2">
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
              {isLoadingInventory && inventoryItems.length === 0 ? (
                <>
                  <tr>
                    <td colSpan={8} className="py-6 px-4 text-center">
                      <div className="inline-flex items-center gap-2.5 text-sm font-bold text-white/90 bg-white/10 border border-white/20 px-4 py-2 rounded-xl">
                        <Loader2 className="w-4 h-4 animate-spin text-teal-300 shrink-0" />
                        <span>
                          {lang === 'en'
                            ? 'Fetching live inventory stock from Supabase...'
                            : 'جاري جلب الأرصدة الحية من قاعدة البيانات (Supabase)...'}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {[1, 2, 3, 4, 5].map(rowIdx => (
                    <tr key={`skeleton-${rowIdx}`} className="animate-pulse border-b border-white/5">
                      <td className="py-4 px-3"><div className="h-6 w-12 mx-auto rounded-lg bg-white/10" /></td>
                      <td className="py-4 px-4"><div className="h-5 w-40 rounded-lg bg-white/10" /></td>
                      <td className="py-4 px-4"><div className="h-6 w-20 mx-auto rounded-lg bg-white/10" /></td>
                      <td className="py-4 px-4"><div className="h-5 w-16 mx-auto rounded-lg bg-white/10" /></td>
                      <td className="py-4 px-4"><div className="h-5 w-14 mx-auto rounded-lg bg-white/10" /></td>
                      <td className="py-4 px-4"><div className="h-5 w-20 mx-auto rounded-lg bg-white/10" /></td>
                      <td className="py-4 px-4"><div className="h-6 w-20 mx-auto rounded-lg bg-white/10" /></td>
                      <td className="py-4 px-4"><div className="h-8 w-28 mx-auto rounded-xl bg-white/10" /></td>
                    </tr>
                  ))}
                </>
              ) : (
                sortedTableItems.map(item => {
                  const code = item.item_code.toUpperCase();
                  const std = getStandardCodeInfo(code);
                  const consumed = getItemConsumedQuantity(item);
                  const orderCalc = calculateSuggestedOrder(code, consumed);
                  const pendingPOs = activePOs.filter(po =>
                    Array.isArray(po.items) && po.items.length > 0
                      ? po.items.some(it => String(it.itemId).toUpperCase() === code)
                      : String(po.itemId).toUpperCase() === code
                  ).length;
                  const reorderLevel = Number(item.reorder_level ?? 0);
                  const isCritical = item.current_stock <= reorderLevel;
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
                            <span className="flex items-center gap-1.5 text-rose-400 shrink-0" title="تنبيه: الرصيد الحالي أقل من أو يساوي الحد الأدنى">
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                              </span>
                              <AlertTriangle className="w-4 h-4 text-rose-400" />
                            </span>
                          )}
                          <span>{getItemDisplayName(item)}</span>
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryDrawer(item)}
                            title="سجل الاستهلاك التاريخي (🕒)"
                            aria-label={`عرض سجل الاستهلاك للصنف ${getItemDisplayName(item)}`}
                            className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/8 hover:bg-teal-500/25 border border-white/15 hover:border-teal-400/50 text-white/75 hover:text-teal-200 transition-all cursor-pointer active:scale-95"
                          >
                            <Clock className="w-3.5 h-3.5 text-teal-300" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenManualAdjustment(item.item_code, 'single')}
                            title={lang === 'en' ? `Adjust stock for ${code}` : `تعديل رصيد الصنف ${code}`}
                            aria-label={`تعديل رصيد الصنف ${getItemDisplayName(item)}`}
                            className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/8 hover:bg-indigo-500/25 border border-white/15 hover:border-indigo-400/50 text-white/75 hover:text-indigo-200 transition-all cursor-pointer active:scale-95"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-300" />
                          </button>
                        </div>
                        <div className="text-[11px] text-white/60 font-mono" dir="ltr">{item.item_name_en || std?.nameEn || ''}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block font-mono font-black text-lg ${isCritical ? 'text-rose-400 font-extrabold' : 'text-white'}`}
                          dir="ltr"
                        >
                          {toEnglishDigits(item.current_stock)}
                        </span>
                        <span className="text-xs text-white/60 ms-1">{t('common.unit')}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block font-mono font-bold text-base text-white/90" dir="ltr">
                          {toEnglishDigits(item.reorder_level)}
                        </span>
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
                        {item.last_restock_date && (
                          <div className="text-xs text-white/50 mt-0.5">
                            (منذ {toEnglishDigits(getDaysSinceRestock(item.last_restock_date))} أيام)
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold font-mono text-base text-amber-300">
                          {toEnglishDigits(consumed)} <span className="text-sm font-normal text-amber-200/80">وحدة</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenPO(item, orderCalc.needsOrder ? orderCalc.suggestedCartons : undefined)}
                            disabled={!orderCalc.needsOrder && !isCritical}
                            className={`backdrop-blur-md border text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                              isCritical
                                ? 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-400/50'
                                : orderCalc.needsOrder
                                ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/50'
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
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {!isLoadingInventory && filteredItems.length === 0 && (
        <div className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-12 text-center text-white">
          <p className="text-lg font-bold drop-shadow-sm">{t('inventory.noItemsFound')}</p>
          <p className="text-xs text-white/80 mt-1 drop-shadow-sm">{t('inventory.noItemsFoundHint')}</p>
        </div>
      )}


      {/* Modal: Create Purchase Order (Smart Auto PO) */}
      {selectedItemForPO && (() => {
        const code = selectedItemForPO.item_code.toUpperCase();
        const consumed = getItemConsumedQuantity(selectedItemForPO);
        const orderCalc = calculateSuggestedOrder(code, consumed);
        const cartonSize = CARTON_SIZES[code] || 1;
        const isPerPiece = cartonSize === 1;
        const totalUnits = isPerPiece ? poQuantity : poQuantity * cartonSize;
        const unitCost = selectedItemForPO.cost_per_unit || selectedItemForPO.supplier_items?.[0]?.price || 0.45;
        const currentSuppliers = itemSuppliers[code] || [];

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
                {/* 0. Raw Materials & Packaging Inventory Selection Dropdown */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-white flex justify-between items-center">
                    <span>{lang === 'en' ? 'Select Raw Material / Packaging Item:' : 'اختيار المادة الأولية / صنف التغليف من المخزون:'}</span>
                    <span className="text-[11px] text-emerald-400 font-mono font-bold" dir="ltr" lang="en">
                      {toEnglishDigits(rawMaterialsList.length)} {lang === 'en' ? 'inventory items' : 'صنف مخزون وتغليف'}
                    </span>
                  </label>
                  <GlassSelect
                    value={selectedItemForPO.item_code}
                    onChange={async (e) => {
                      const newCode = e.target.value.toUpperCase();
                      const inv = inventoryItems.find(i => i.item_code.toUpperCase() === newCode);
                      if (inv) {
                        setSelectedItemForPO(inv);
                        const newConsumed = getItemConsumedQuantity(inv);
                        const newCalc = calculateSuggestedOrder(newCode, newConsumed);
                        setPoQuantity(Math.max(1, newCalc.needsOrder ? newCalc.suggestedCartons : 1));
                      }
                      const cachedSuppliers = itemSuppliers[newCode];
                      if (cachedSuppliers && cachedSuppliers.length > 0) {
                        setSelectedSupplier(cachedSuppliers[0].name);
                        return;
                      }
                      setIsLoadingSuppliers(true);
                      try {
                        const dbSuppliers = await fetchSuppliersForItem(newCode);
                        if (dbSuppliers && dbSuppliers.length > 0) {
                          setItemSuppliers(prev => ({ ...prev, [newCode]: dbSuppliers }));
                          setSelectedSupplier(dbSuppliers[0].name);
                        } else {
                          setSelectedSupplier(initialSuppliers[0]?.name || 'الصندوق المناسب');
                        }
                      } catch {
                        setSelectedSupplier(initialSuppliers[0]?.name || 'الصندوق المناسب');
                      } finally {
                        setIsLoadingSuppliers(false);
                      }
                    }}
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none cursor-pointer"
                  >
                    <optgroup label={lang === 'en' ? 'Raw Materials & Packaging Inventory' : 'المواد الأولية وأصناف التغليف والمخزون'}>
                      {rawMaterialsList.map((rm) => (
                        <option key={rm.code} value={rm.code} className="bg-zinc-900 text-white py-1">
                          [{rm.code}] {lang === 'en' ? (rm.nameEn || rm.nameAr) : rm.nameAr}
                        </option>
                      ))}
                    </optgroup>
                  </GlassSelect>
                </div>

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
                      الطلب المقترح: {toEnglishDigits(consumed)} وحدة{!isPerPiece && orderCalc.suggestedCartons > 0 ? ` (${toEnglishDigits(orderCalc.suggestedCartons)} كرتون)` : ''}
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
                  {inventoryItems.map(it => (
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

      {/* Modal: Consolidated Order Receive Shipment & Invoice */}
      {isReceiveModalOpen && (() => {
        const distinctItemsCount = new Set(
          receivedItems
            .filter(i => i.itemCode.trim() && (Number(i.quantityCartons) || 0) > 0)
            .map(i => i.itemCode.trim().toUpperCase())
        ).size;
        const totalCartons = receivedItems.reduce((acc, i) => acc + (Number(i.quantityCartons) || 0), 0);
        const totalUnits = receivedItems.reduce((acc, i) => {
          const cCode = i.itemCode.toUpperCase();
          const cSize = CARTON_SIZES[cCode] || 1;
          return acc + ((Number(i.quantityCartons) || 0) * cSize);
        }, 0);
        const isFormValid =
          Boolean(receivePoId) &&
          receivedItems.length > 0 &&
          receivedItems.every(i => i.itemCode.trim() && i.quantityCartons !== '' && Number(i.quantityCartons) >= 0) &&
          totalCartons > 0 &&
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
                    if (!isSubmittingReceipt) {
                      setIsReceiveModalOpen(false);
                      setReceiverSignature('');
                    }
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

              {/* Top Controls: Consolidated Order ID Dropdown & Manual Receiver Signature */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white/[0.04] border border-white/15 rounded-xl p-2.5 sm:p-3">
                {/* 1. Primary Dropdown: Select Consolidated Order ID (Order ID / PO) */}
                <div>
                  <label className="block text-[11px] font-bold text-white mb-1">
                    {t('inventory.selectPO')} <span className="text-rose-400">*</span>
                  </label>
                  <GlassSelect
                    value={receivePoId}
                    onChange={(e) => handleSelectPO(e.target.value)}
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/25 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-white/60">
                      {t('inventory.selectPOPlaceholder')}
                    </option>
                    {activePOs.map(order => {
                      const cleanOrderCode = order.id.replace(/^#/, '');
                      const itemsWord = order.distinctItemsCount === 1 ? 'Item' : 'Items';
                      return (
                        <option key={order.id} value={order.id} className="bg-slate-900 text-white" dir="ltr" lang="en">
                          {`Order #${cleanOrderCode} (Supplier: ${order.supplierName} - ${toEnglishDigits(order.distinctItemsCount)} ${itemsWord})`}
                        </option>
                      );
                    })}
                  </GlassSelect>
                </div>

                {/* Receiver Signature / Name (Strictly Empty Initial State, Required Manual Input) */}
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
                    autoComplete="off"
                    required
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-white/25 placeholder:text-white/40"
                  />
                </div>
              </div>

              {/* 2. Consolidated Order Items Matching Table */}
              <div className="space-y-1.5">
                {/* Table Column Headers for Desktop */}
                <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1.5 text-[11px] font-bold text-white/60 border-b border-white/10">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-4">{lang === 'ar' ? 'الصنف المتوقع بالطلب' : 'Expected Order Item'}</div>
                  <div className="col-span-2 text-center">{lang === 'ar' ? 'الكمية المطلوبة' : 'Ordered Qty'}</div>
                  <div className="col-span-3 text-center">{lang === 'ar' ? 'الكمية المستلمة الفعليّة (بالكرتون)' : 'Actual Cartons Received'}</div>
                  <div className="col-span-2 text-center">{lang === 'ar' ? 'الوحدات الفعلية' : 'Calculated Units'}</div>
                </div>

                {/* Consolidated Order Items Rows */}
                {receivedItems.length === 0 ? (
                  <div className="bg-white/[0.03] border border-dashed border-white/15 rounded-xl p-6 text-center">
                    <p className="text-xs font-bold text-white/80">
                      {lang === 'ar'
                        ? 'الرجاء اختيار رقم الطلب (Order ID / PO) من الأعلى لعرض جميع أصناف الطلب ومطابقة الكراتين المستلمة'
                        : 'Select an Order ID (PO) above to auto-populate all order items and match received cartons'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 sm:max-h-60 overflow-y-auto pr-1">
                    {receivedItems.map((row, index) => {
                      const code = row.itemCode.toUpperCase();
                      const cartonSize = CARTON_SIZES[code] || 1;
                      const cartons = Number(row.quantityCartons) || 0;
                      const unitsEquivalent = cartons * cartonSize;
                      const reqUnits = row.requestedUnits ?? 0;
                      const reqCartons = row.requestedCartons ?? 0;
                      const diffUnits = unitsEquivalent - reqUnits;
                      const rawInfo = rawMaterialsList.find(rm => rm.code === code);
                      const displayName =
                        lang === 'en'
                          ? (rawInfo?.nameEn || ITEM_NAME_TRANSLATIONS[row.itemName || ''] || row.itemName || code)
                          : (rawInfo?.nameAr || row.itemName || code);

                      return (
                        <div
                          key={row.id}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 rounded-xl px-3 py-2 transition-colors"
                        >
                          {/* Row Index */}
                          <div className="sm:col-span-1 flex items-center justify-between sm:justify-center">
                            <span className="w-5 h-5 rounded bg-white/10 border border-white/20 text-white/80 font-mono text-xs font-bold flex items-center justify-center shrink-0" dir="ltr" lang="en">
                              {toEnglishDigits(index + 1)}
                            </span>
                            <span className="sm:hidden text-xs text-white/60 font-bold">
                              #{toEnglishDigits(index + 1)}
                            </span>
                          </div>

                          {/* Expected Item Name & Pack Size */}
                          <div className="sm:col-span-4 flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[11px] font-extrabold text-teal-200 bg-teal-500/15 border border-teal-400/30 px-2 py-0.5 rounded-md shrink-0" dir="ltr" lang="en">
                              {code}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">
                                {displayName}
                              </div>
                              <div className="text-[10px] text-white/50 font-mono" dir="ltr" lang="en">
                                {cartonSize === 1
                                  ? (lang === 'ar' ? 'بالقطعة (1 وحدة)' : '1 unit / piece')
                                  : `${toEnglishDigits(cartonSize)} ${lang === 'ar' ? 'حبة/كرتون' : 'units/carton'}`}
                              </div>
                            </div>
                          </div>

                          {/* Requested Quantity from Order */}
                          <div className="sm:col-span-2 flex items-center justify-between sm:justify-center">
                            <span className="text-[10px] text-white/60 sm:hidden">
                              {lang === 'ar' ? 'المطلوب:' : 'Ordered:'}
                            </span>
                            <div className="text-center font-mono leading-tight" dir="ltr" lang="en">
                              <div className="text-xs font-bold text-white">
                                {toEnglishDigits(reqCartons)}{' '}
                                <span className="font-sans text-[10px] text-white/70">
                                  {cartonSize === 1 ? (lang === 'ar' ? 'حبة' : 'pcs') : (lang === 'ar' ? 'كرتون' : 'ctn')}
                                </span>
                              </div>
                              <div className="text-[10px] text-white/50">
                                ({toEnglishDigits(reqUnits)} {t('common.unit')})
                              </div>
                            </div>
                          </div>

                          {/* Actual Received Cartons Input */}
                          <div className="sm:col-span-3">
                            <label className="text-[10px] text-white/60 sm:hidden block mb-1">
                              {lang === 'ar' ? 'الكراتين المستلمة فعلياً' : 'Actual Cartons Received'}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                dir="ltr"
                                lang="en"
                                value={row.quantityCartons}
                                onChange={(e) => handleUpdateReceivedItemRow(row.id, 'quantityCartons', e.target.value)}
                                placeholder="0"
                                className="w-full bg-white/10 border border-white/20 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                              />
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/50 pointer-events-none">
                                {cartonSize === 1 ? (lang === 'ar' ? 'حبة' : 'pcs') : (lang === 'ar' ? 'كرتون' : 'ctn')}
                              </span>
                            </div>
                          </div>

                          {/* Auto-Calculated Received Units + Match Status */}
                          <div className="sm:col-span-2 flex flex-col items-center justify-center gap-0.5">
                            <div className="w-full py-1 px-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-xs font-mono font-bold text-center" dir="ltr" lang="en">
                              {toEnglishDigits(unitsEquivalent)}
                            </div>
                            {reqUnits > 0 && (
                              <span
                                className={`text-[10px] font-bold font-mono ${
                                  diffUnits === 0
                                    ? 'text-emerald-300'
                                    : diffUnits < 0
                                    ? 'text-amber-300'
                                    : 'text-teal-300'
                                }`}
                                dir="ltr"
                                lang="en"
                              >
                                {diffUnits === 0
                                  ? (lang === 'ar' ? 'مطابق ✓' : 'Matched ✓')
                                  : diffUnits < 0
                                  ? `${lang === 'ar' ? 'نقص' : 'Short'} (${toEnglishDigits(diffUnits)})`
                                  : `${lang === 'ar' ? 'زيادة' : 'Extra'} (+${toEnglishDigits(diffUnits)})`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Lower Landscape Row: 3. File Upload Box + 4. Streamlined Total Shipment Summary Footer */}
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

                {/* 4. Streamlined Total Shipment Summary Footer (Raw Aggregated Numbers Only) */}
                <div className="flex flex-col justify-between">
                  <div className="text-[11px] font-bold text-white mb-1">ملخص الشحنة الإجمالي</div>
                  <div className="grid grid-cols-3 gap-2 p-2 bg-white/[0.04] border border-white/15 rounded-xl text-center h-[52px] items-center">
                    <div>
                      <div className="text-[10px] text-white/60">الأصناف</div>
                      <div className="text-sm font-extrabold font-mono text-white mt-0.5" dir="ltr" lang="en">
                        {toEnglishDigits(distinctItemsCount)}
                      </div>
                    </div>
                    <div className="border-x border-white/10 px-1">
                      <div className="text-[10px] text-white/60">الكراتين</div>
                      <div className="text-sm font-extrabold font-mono text-teal-300 mt-0.5" dir="ltr" lang="en">
                        {toEnglishDigits(totalCartons)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-white/60">الوحدات الفعلية</div>
                      <div className="text-sm font-extrabold font-mono text-emerald-300 mt-0.5" dir="ltr" lang="en">
                        {toEnglishDigits(totalUnits)}
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
                    if (!isSubmittingReceipt) {
                      setIsReceiveModalOpen(false);
                      setReceiverSignature('');
                    }
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

      {/* Modal: Manual Inventory Adjustment & Subscription Deconstruction (تعديل يدوي للمخزون) */}
      {isAdjustmentModalOpen && (() => {
        const selectedItem = inventoryItems.find(
          i => (i.item_code || '').toUpperCase() === adjItemCode.toUpperCase()
        );
        const currentStock = selectedItem ? Number(selectedItem.current_stock ?? 0) : 0;
        const numQty = Number(adjQuantity) || 0;
        const projectedStock = adjType === 'add' ? currentStock + numQty : currentStock - numQty;
        const willBeNegative = adjType === 'deduct' && numQty > currentStock;

        const isCutoffExceeded = deconstructCutoffState.isCutoffExceeded;
        const canShowDeconstructPreview =
          deconstructFetched && (!isCutoffExceeded || isDeconstructAdminOverride);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-md animate-in fade-in duration-200">
            <div
              className="font-sans bg-black/85 backdrop-blur-2xl rounded-3xl w-full max-w-2xl lg:max-w-3xl max-h-[94vh] overflow-y-auto p-5 sm:p-6 space-y-4 text-white border border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.75)] relative flex flex-col tabular-nums"
              style={{
                fontFeatureSettings: '"locl" 0, "lnum" 1, "tnum" 1',
                fontVariantNumeric: 'lining-nums tabular-nums',
              }}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center border-b border-white/15 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/40 rounded-xl text-indigo-300 shrink-0 shadow-inner">
                    <SlidersHorizontal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                      <span>{lang === 'en' ? 'Manual Inventory Adjustment' : 'تعديل يدوي للمخزون'}</span>
                    </h3>
                    <p className="text-[11px] text-white/70 font-medium">
                      {lang === 'en'
                        ? 'Manage subscriber meal cancellation or adjust single item balance (BOM).'
                        : 'إدارة طلبات المشتركين وتفكيك الوجبات أو تعديل رصيد صنف محدد (BOM).'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isSubmittingAdj && !isFetchingMealData) {
                      setIsAdjustmentModalOpen(false);
                      setAdjError(null);
                    }
                  }}
                  disabled={isSubmittingAdj || isFetchingMealData}
                  className="text-white/60 hover:text-white bg-white/5 hover:bg-white/15 border border-white/15 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
                  aria-label={t('common.close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mandatory Employee Audit Field (حقل اسم الموظف الإلزامي للرقابة) */}
              <div className="bg-white/[0.04] border border-white/15 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 shrink-0">
                    <User className="w-4 h-4" />
                  </span>
                  <div>
                    <label htmlFor="modal-adj-employee" className="text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer">
                      <span>اسم الموظف المسؤول (Employee Name):</span>
                      <span className="text-rose-400 font-black text-sm">*</span>
                    </label>
                    {sessionEmployeeName ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 font-bold mt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>جلسة نشطة موثقة ({sessionEmployeeName})</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-300/80 font-medium mt-0.5 block">
                        يرجى اختيار الموظف للتوثيق في سجل الرقابة
                      </span>
                    )}
                  </div>
                </div>

                <div className="sm:w-64">
                  <select
                    id="modal-adj-employee"
                    value={adjEmployeeName || sessionEmployeeName}
                    onChange={(e) => setAdjEmployeeName(e.target.value)}
                    required
                    className="w-full bg-black/50 hover:bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] cursor-pointer"
                  >
                    <option value="" disabled className="bg-zinc-900 text-white/50">
                      -- اختر اسم الموظف --
                    </option>
                    {employeeRoster.map((emp) => (
                      <option key={emp} value={emp} className="bg-zinc-900 text-white">
                        {emp} {emp === sessionEmployeeName ? '(جلسة نشطة)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2 DISTINCT TABS SWITCHER */}
              <div className="grid grid-cols-2 gap-2.5 p-1.5 bg-white/[0.04] border border-white/15 rounded-2xl">
                {/* TAB 1: إدارة طلبات المشتركين (Subscription Requests / Deconstruction - DEFAULT) */}
                <button
                  type="button"
                  onClick={() => {
                    setAdjActiveTab('deconstruct');
                    setAdjError(null);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                    adjActiveTab === 'deconstruct'
                      ? 'bg-emerald-600/35 border border-emerald-400/60 text-white shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                      : 'text-white/65 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Package className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>{lang === 'en' ? 'Subscriber Requests' : 'إدارة طلبات المشتركين'}</span>
                </button>

                {/* TAB 2: تعديل رصيد صنف محدد (Single Item Adjustment) */}
                <button
                  type="button"
                  onClick={() => {
                    setAdjActiveTab('single');
                    setAdjError(null);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                    adjActiveTab === 'single'
                      ? 'bg-indigo-600/40 border border-indigo-400/60 text-white shadow-[0_0_20px_rgba(99,102,241,0.25)]'
                      : 'text-white/65 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4 text-indigo-300 shrink-0" />
                  <span>{lang === 'en' ? 'Item Balance Adjustment' : 'تعديل رصيد صنف محدد'}</span>
                </button>
              </div>

              {/* Error Banner */}
              {adjError && (
                <div className="bg-rose-500/20 border border-rose-400/40 rounded-xl p-3 flex items-center gap-2 text-xs text-rose-200 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-300" />
                  <span>{adjError}</span>
                </div>
              )}

              {/* ========================================================================
                  TAB 1: إدارة طلبات المشتركين (Subscription Requests / Deconstruction)
                 ======================================================================== */}
              {adjActiveTab === 'deconstruct' && (
                <form onSubmit={handleDeconstructSubmit} className="space-y-4">
                  {/* 1. Inputs: Subscription ID & Target Date + Fetch Meal Data Button */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white/[0.03] border border-white/15 rounded-2xl p-3.5">
                    <div className="sm:col-span-5 space-y-1.5">
                      <label className="block text-xs font-bold text-white/90">
                        رقم الاشتراك (Subscription ID):
                      </label>
                      <input
                        type="text"
                        value={deconstructSubId}
                        onChange={(e) => {
                          setDeconstructSubId(toEnglishDigitsStr(e.target.value));
                          setDeconstructFetched(false);
                        }}
                        disabled={isSubmittingAdj || isFetchingMealData}
                        placeholder="مثال: 2703326 أو 2578389"
                        className="w-full bg-black/40 hover:bg-black/50 border border-white/20 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-mono font-bold text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 tabular-nums"
                        style={englishNumericStyle}
                        dir="ltr"
                      />
                    </div>

                    <div className="sm:col-span-4 space-y-1.5">
                      <label className="block text-xs font-bold text-white/90">
                        تاريخ الإلغاء (Target Date):
                      </label>
                      <EnglishDatePicker
                        value={deconstructTargetDate}
                        onChange={(newDate) => {
                          setDeconstructTargetDate(formatEnglishDate(newDate));
                          setDeconstructFetched(false);
                          setIsDeconstructAdminOverride(false);
                        }}
                        disabled={isSubmittingAdj || isFetchingMealData}
                        placeholder="dd/mm/yyyy"
                        focusRingClass="focus-within:ring-2 focus-within:ring-emerald-400/50"
                        allowClear={false}
                      />
                    </div>

                    <div className="sm:col-span-3 flex items-end">
                      <button
                        type="button"
                        onClick={() => void handleFetchMealData()}
                        disabled={isFetchingMealData || isSubmittingAdj || !deconstructSubId.trim()}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-extrabold bg-emerald-600/35 hover:bg-emerald-600/50 border border-emerald-400/50 text-emerald-100 hover:text-white transition-all cursor-pointer shadow-sm disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        {isFetchingMealData ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-300 shrink-0" />
                            <span>جاري الجلب...</span>
                          </>
                        ) : (
                          <>
                            <Search className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                            <span>جلب بيانات الوجبة</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Prep Day & Cut-off Time Info Bar */}
                    {deconstructCutoffState.isValid && (
                      <div className="sm:col-span-12 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-[11px] text-white/75">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                          <span>يوم التحضير (قبل التوصيل بيومين):</span>
                          <strong className="font-mono text-white tabular-nums" style={englishNumericStyle} dir="ltr">
                            {deconstructCutoffState.prepDay}
                          </strong>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>آخر موعد مسموح للإرجاع للمخزون:</span>
                          <strong
                            className={`font-mono tabular-nums ${
                              isCutoffExceeded ? 'text-rose-300' : 'text-emerald-300'
                            }`}
                            style={englishNumericStyle}
                            dir="ltr"
                          >
                            {deconstructCutoffState.cutoffFormatted}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. THE SMART BLOCK LOGIC (UI Level) */}
                  {isCutoffExceeded && (
                    <div className="bg-rose-950/80 border-2 border-rose-500/60 rounded-2xl p-4 space-y-3 shadow-[0_0_25px_rgba(244,63,94,0.2)] animate-in fade-in">
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm font-extrabold text-rose-100 leading-relaxed">
                            ⚠️ تم تحضير الوجبة مسبقاً (تجاوزت الساعة{' '}
                            <span className="font-mono font-black" style={englishNumericStyle} dir="ltr">09:00 PM</span>{' '}
                            من يوم التحضير). لا يمكن إرجاع المواد للمخزون.
                          </p>
                          <p className="text-[11px] text-rose-200/80">
                            نظراً لتجاوز موعد الإغلاق النهائي ليوم التحضير (
                            <span className="font-mono font-bold" style={englishNumericStyle} dir="ltr">
                              {deconstructCutoffState.prepDay}
                            </span>{' '}
                            - <span className="font-mono font-bold" style={englishNumericStyle} dir="ltr">09:00 PM</span>)، تم استهلاك وتغليف المواد فعلياً.
                          </p>
                        </div>
                      </div>

                      {/* Admin Override Checkbox (Only shown if logged-in user is Admin) */}
                      {isAdminUser && (
                        <label className="flex items-center gap-2.5 pt-2.5 border-t border-rose-400/30 cursor-pointer select-none group">
                          <input
                            type="checkbox"
                            checked={isDeconstructAdminOverride}
                            onChange={(e) => setIsDeconstructAdminOverride(e.target.checked)}
                            disabled={isSubmittingAdj}
                            className="w-4 h-4 rounded border-rose-300 bg-black/50 text-amber-500 focus:ring-amber-400 cursor-pointer"
                          />
                          <span className="text-xs font-extrabold text-amber-200 group-hover:text-amber-100 transition-colors">
                            تجاوز المنع كمدير (إلغاء وتوجيه الوجبة للتوالف)
                          </span>
                        </label>
                      )}
                    </div>
                  )}

                  {/* 3. PREVIEW CARD: Shown if meal data fetched AND (before cut-off time OR Admin Override is checked) */}
                  {canShowDeconstructPreview && deconstructSubInfo && (
                    <div className="bg-white/[0.04] border border-white/15 rounded-2xl p-4 space-y-3.5 animate-in fade-in">
                      {/* Subscriber & Package Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/10">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 tabular-nums" style={englishNumericStyle} dir="ltr">
                              #{toEnglishDigitsStr(deconstructSubInfo.subscription_number)}
                            </span>
                            <span className="text-sm font-extrabold text-white">
                              {deconstructSubInfo.customer_name}
                            </span>
                            {deconstructSubInfo.found_in_db ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-500/20 border border-teal-400/30 text-teal-200">
                                مسجل في قاعدة البيانات
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-200">
                                محاكاة حسب الباقة القياسية
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-white/65 mt-1">
                            الحي: {deconstructSubInfo.district} | فترة التوصيل:{' '}
                            <span dir="ltr" className="font-mono tabular-nums" style={englishNumericStyle}>
                              {toEnglishDigitsStr(deconstructSubInfo.delivery_window)}
                            </span>
                          </div>
                        </div>

                        {/* Package Selector (pre-filled with subscriber's package, changeable) */}
                        <div className="w-full sm:w-72">
                          <label className="block text-[10px] font-bold text-white/70 mb-1">
                            الباقة المسجلة للمشترك:
                          </label>
                          <select
                            value={deconstructSubInfo.package_name}
                            onChange={(e) => void handleFetchMealData(e.target.value)}
                            disabled={isFetchingMealData || isSubmittingAdj}
                            className="w-full bg-black/50 border border-white/20 rounded-xl px-2.5 py-1.5 text-xs font-bold text-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-400 [color-scheme:dark] cursor-pointer"
                          >
                            {!ZAHI_PACKAGE_OPTIONS.includes(deconstructSubInfo.package_name) && (
                              <option value={deconstructSubInfo.package_name} className="bg-zinc-900 text-white">
                                {deconstructSubInfo.package_name}
                              </option>
                            )}
                            {ZAHI_PACKAGE_OPTIONS.map((pkg) => (
                              <option key={pkg} value={pkg} className="bg-zinc-900 text-white">
                                {pkg}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Meal Slots from BOM */}
                      {deconstructMealSlots.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-extrabold text-white/90 flex items-center justify-between">
                            <span>مكونات وجبات الباقة (مرتبطة بجدول BOM التغليف):</span>
                            <span className="text-[11px] font-mono text-emerald-300 tabular-nums" style={englishNumericStyle} dir="ltr">
                              {Number(deconstructMealSlots.length).toLocaleString('en-US')} وجبات/أصناف
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {deconstructMealSlots.map((slot) => (
                              <div
                                key={slot.slot_index}
                                className="bg-black/35 border border-white/10 rounded-xl p-2.5 space-y-1"
                              >
                                <div className="text-[10px] font-bold text-indigo-300">
                                  {toEnglishDigitsStr(slot.slot_label)}
                                </div>
                                <select
                                  value={slot.selected_meal_code}
                                  onChange={(e) =>
                                    handleDeconstructMealSlotChange(slot.slot_index, e.target.value)
                                  }
                                  disabled={isSubmittingAdj}
                                  className="w-full bg-white/5 border border-white/15 rounded-lg px-2 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-400 [color-scheme:dark] cursor-pointer"
                                >
                                  {deconstructMenuList.map((m) => (
                                    <option
                                      key={m.meal_code}
                                      value={m.meal_code}
                                      className="bg-zinc-900 text-white"
                                    >
                                      [{m.meal_code}] {m.meal_name_ar}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Deconstructed Packaging Items Table (P8 + P7 + BOM Items) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                            <PackageCheck className="w-4 h-4 text-emerald-300" />
                            <span>
                              {isCutoffExceeded && isDeconstructAdminOverride
                                ? 'معاينة المواد التي سيتم توثيق توجيهها للتوالف (P8 + P7 + BOM):'
                                : 'معاينة المواد التي سيتم إرجاعها للمخزون الفعلي (P8 + P7 + BOM):'}
                            </span>
                          </h4>
                          <span className="text-[11px] font-mono font-bold text-emerald-300 tabular-nums" style={englishNumericStyle} dir="ltr">
                            Total: {deconstructItems.reduce((s, i) => s + i.quantity, 0).toLocaleString('en-US')} units
                          </span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-white/15 bg-black/30">
                          <table className="w-full text-right text-xs">
                            <thead>
                              <tr className="border-b border-white/15 bg-white/[0.06] text-white/80 font-extrabold">
                                <th className="py-2 px-3">الرمز</th>
                                <th className="py-2 px-3">اسم الصنف</th>
                                <th className="py-2 px-3">المصدر (منطق الباقة / BOM)</th>
                                <th className="py-2 px-3 text-center">الكمية</th>
                                <th className="py-2 px-3 text-center">الرصيد بعد العملية</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {deconstructItems.map((item) => {
                                const liveItem = inventoryItems.find(
                                  (inv) => inv.item_code.toUpperCase() === item.item_code.toUpperCase()
                                );
                                const curStock = liveItem
                                  ? Number(liveItem.current_stock ?? 0)
                                  : item.current_stock;
                                const afterStock =
                                  isCutoffExceeded && isDeconstructAdminOverride
                                    ? curStock
                                    : curStock + item.quantity;

                                return (
                                  <tr key={item.item_code} className="hover:bg-white/[0.04]">
                                    <td className="py-2 px-3 font-mono font-black text-white" style={englishNumericStyle} dir="ltr">
                                      <span className="bg-white/15 border border-white/25 px-2 py-0.5 rounded-md">
                                        {item.item_code}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 font-bold text-white">
                                      {item.item_name_ar}
                                    </td>
                                    <td className="py-2 px-3 text-[11px] text-white/70">
                                      {toEnglishDigitsStr(item.source)}
                                    </td>
                                    <td className="py-2 px-3 text-center font-mono font-black tabular-nums" style={englishNumericStyle} dir="ltr">
                                      <span
                                        className={`px-2 py-0.5 rounded-lg border ${
                                          isCutoffExceeded && isDeconstructAdminOverride
                                            ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                                            : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                                        }`}
                                      >
                                        {isCutoffExceeded && isDeconstructAdminOverride
                                          ? `~${Number(item.quantity).toLocaleString('en-US')} (redirect)`
                                          : `+${Number(item.quantity).toLocaleString('en-US')}`}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-center font-mono font-bold text-white/90 tabular-nums" style={englishNumericStyle} dir="ltr">
                                      {Number(curStock).toLocaleString('en-US')} →{' '}
                                      <strong
                                        className={
                                          isCutoffExceeded && isDeconstructAdminOverride
                                            ? 'text-amber-300'
                                            : 'text-emerald-300'
                                        }
                                      >
                                        {Number(afterStock).toLocaleString('en-US')}
                                      </strong>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Optional Notes */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-white/85">
                          ملاحظات إضافية (اختياري):
                        </label>
                        <input
                          type="text"
                          value={deconstructNotes}
                          onChange={(e) => setDeconstructNotes(e.target.value)}
                          disabled={isSubmittingAdj}
                          placeholder="مثال: طلب إلغاء من خدمة العملاء..."
                          className="w-full bg-black/40 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        />
                      </div>
                    </div>
                  )}

                  {/* Modal Footer Actions for Tab 1 */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/15">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isSubmittingAdj && !isFetchingMealData) {
                          setIsAdjustmentModalOpen(false);
                          setAdjError(null);
                        }
                      }}
                      disabled={isSubmittingAdj || isFetchingMealData}
                      className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white font-bold rounded-xl border border-white/20 transition-all text-xs cursor-pointer disabled:opacity-50"
                    >
                      {t('common.cancel')}
                    </button>

                    {/* Submit button:
                        - Hidden if Cut-off is exceeded AND Admin Override is NOT checked!
                        - If before Cut-off: "تأكيد الإرجاع" (submits bulk 'add')
                        - If after Cut-off + Admin Override checked: "تأكيد وتوجيه الوجبة" (submits bulk 'redirect') */}
                    {(!isCutoffExceeded || isDeconstructAdminOverride) && (
                      <button
                        type="submit"
                        disabled={
                          isSubmittingAdj ||
                          isFetchingMealData ||
                          !deconstructFetched ||
                          deconstructItems.length === 0
                        }
                        className={`flex items-center gap-2 px-5 py-2.5 font-extrabold rounded-xl border shadow-lg transition-all text-xs sm:text-sm cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                          isCutoffExceeded && isDeconstructAdminOverride
                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white border-amber-300/50 shadow-amber-500/25'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white border-emerald-400/50 shadow-emerald-500/25'
                        }`}
                      >
                        {isSubmittingAdj ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>جاري التنفيذ...</span>
                          </>
                        ) : isCutoffExceeded && isDeconstructAdminOverride ? (
                          <>
                            <ShieldAlert className="w-4 h-4 text-white" />
                            <span>تأكيد وتوجيه الوجبة</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-white" />
                            <span>تأكيد الإرجاع</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* ========================================================================
                  TAB 2: تعديل رصيد صنف محدد (Single Item Adjustment)
                 ======================================================================== */}
              {adjActiveTab === 'single' && (
                <form onSubmit={handleManualAdjustmentSubmit} className="space-y-4">
                  {/* 1. Item Selection */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-white/90">
                      {lang === 'en' ? 'Select Inventory Item:' : 'اختر صنف المخزون (P1 - P11):'}
                    </label>
                    <select
                      value={adjItemCode}
                      onChange={(e) => setAdjItemCode(e.target.value)}
                      disabled={isSubmittingAdj}
                      className="w-full bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] cursor-pointer"
                    >
                      {inventoryItems.map((item) => (
                        <option key={item.item_code} value={item.item_code} className="bg-zinc-900 text-white py-1">
                          [{item.item_code}] {item.item_name_ar || getItemDisplayName(item)} — (الرصيد: {Number(item.current_stock ?? 0).toLocaleString('en-US')})
                        </option>
                      ))}
                    </select>

                    {/* Selected Item Stock Card Preview */}
                    {selectedItem && (
                      <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-bold text-white">{getItemDisplayName(selectedItem)}</div>
                          <div className="text-[11px] text-white/60 font-mono" style={englishNumericStyle} dir="ltr">{selectedItem.item_code}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-white/60 font-medium">{lang === 'en' ? 'Current Stock' : 'الرصيد الفعلي الحالي'}</div>
                          <div className="text-sm font-mono font-black text-emerald-300 tabular-nums" style={englishNumericStyle} dir="ltr">
                            {Number(currentStock).toLocaleString('en-US')} <span className="text-[10px] font-normal text-white/70">{t('common.unit')}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Operation Type (Add / Deduct) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-white/90">
                      {lang === 'en' ? 'Adjustment Type:' : 'نوع العملية:'}
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setAdjType('add')}
                        disabled={isSubmittingAdj}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                          adjType === 'add'
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400/50'
                            : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <PlusCircle className={`w-4 h-4 ${adjType === 'add' ? 'text-emerald-300' : 'text-white/60'}`} />
                        <span>{lang === 'en' ? 'Add Stock (+)' : 'إضافة رصيد (+)'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjType('deduct')}
                        disabled={isSubmittingAdj}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                          adjType === 'deduct'
                            ? 'bg-rose-500/25 border-rose-400 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.25)] ring-1 ring-rose-400/50'
                            : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <MinusCircle className={`w-4 h-4 ${adjType === 'deduct' ? 'text-rose-300' : 'text-white/60'}`} />
                        <span>{lang === 'en' ? 'Deduct Stock (-)' : 'خصم رصيد (-)'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 3. Quantity Input & Projected Stock Preview */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-white/90">
                        {lang === 'en' ? 'Quantity (Units):' : 'الكمية المراد تسويتها (بالوحدة):'}
                      </label>
                      {selectedItem && (
                        <span className="text-[11px] font-mono text-white/70">
                          {lang === 'en' ? 'Projected:' : 'الرصيد المتوقع بعد العملية:'}{' '}
                          <strong className={`font-black font-mono tabular-nums ${willBeNegative ? 'text-rose-400' : 'text-indigo-300'}`} style={englishNumericStyle} dir="ltr">
                            {Number(projectedStock).toLocaleString('en-US')}
                          </strong>
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      dir="ltr"
                      value={adjQuantity}
                      onChange={(e) => setAdjQuantity(e.target.value === '' ? '' : Math.max(1, parseInt(toEnglishDigitsStr(e.target.value), 10) || 1))}
                      disabled={isSubmittingAdj}
                      required
                      className="w-full bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] tabular-nums"
                      style={englishNumericStyle}
                      placeholder="1"
                    />
                    {willBeNegative && (
                      <p className="text-[11px] text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{lang === 'en' ? 'Notice: Deducting this quantity exceeds current stock.' : 'تنبيه: الكمية المخصومة أكبر من الرصيد الفعلي المتوفر حالياً.'}</span>
                      </p>
                    )}
                  </div>

                  {/* 4. Reason Dropdown */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-white/90">
                      {lang === 'en' ? 'Adjustment Reason:' : 'سبب التسوية:'}
                    </label>
                    <select
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      disabled={isSubmittingAdj}
                      className="w-full bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 [color-scheme:dark] cursor-pointer"
                    >
                      <option value="تسويق" className="bg-zinc-900 text-white">تسويق (Marketing)</option>
                      <option value="تعويض عميل" className="bg-zinc-900 text-white">تعويض عميل (Customer Compensation)</option>
                      <option value="توالف" className="bg-zinc-900 text-white">توالف (Spoilage)</option>
                      <option value="استلام مشتريات" className="bg-zinc-900 text-white">استلام مشتريات (New Stock / Purchases)</option>
                      <option value="أخرى" className="bg-zinc-900 text-white">أخرى (Other)</option>
                    </select>
                  </div>

                  {/* 5. Notes */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-white/90">
                      {lang === 'en' ? 'Notes / Justification (Optional):' : 'ملاحظات وتفاصيل إضافية (اختياري):'}
                    </label>
                    <textarea
                      value={adjNotes}
                      onChange={(e) => setAdjNotes(e.target.value)}
                      disabled={isSubmittingAdj}
                      rows={2}
                      placeholder={
                        lang === 'en'
                          ? 'e.g. Voucher number, receiver name, campaign details...'
                          : 'مثال: رقم إذن الصرف، اسم المستلم، تفاصيل الحملة الإعلانية...'
                      }
                      className="w-full bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 resize-none"
                    />
                  </div>

                  {/* Modal Footer Actions */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/15">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isSubmittingAdj) {
                          setIsAdjustmentModalOpen(false);
                          setAdjError(null);
                        }
                      }}
                      disabled={isSubmittingAdj}
                      className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white font-bold rounded-xl border border-white/20 transition-all text-xs cursor-pointer disabled:opacity-50"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingAdj || !adjItemCode || !adjQuantity || Number(adjQuantity) <= 0}
                      className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-bold rounded-xl border border-indigo-400/50 shadow-lg shadow-indigo-500/25 transition-all text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmittingAdj ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          <span>{lang === 'en' ? 'Processing...' : 'جاري الحفظ...'}</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>{lang === 'en' ? 'Confirm Adjustment' : 'تأكيد التسوية'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}

      {/* Slide-over Drawer: Detailed Consumption History */}
      {historyDrawerItem && (() => {
        const itemCode = historyDrawerItem.item_code.toUpperCase();
        const stdInfo = getStandardCodeInfo(itemCode);

        return (
          <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${getItemDisplayName(historyDrawerItem)} ${itemCode}`}>
            {/* Backdrop */}
            <div
              onClick={() => setHistoryDrawerItem(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            />

            {/* Right-side Slide-over Glassmorphism Panel */}
            <aside
              dir="rtl"
              className="relative z-10 w-full max-w-xl h-full bg-zinc-950/88 backdrop-blur-2xl border-r border-white/20 shadow-[0_0_70px_rgba(0,0,0,0.85)] flex flex-col text-white animate-in slide-in-from-right duration-300"
            >
              {/* Drawer Header with Item Name & Code */}
              <div className="p-5 sm:p-6 border-b border-white/15 bg-white/[0.03]">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-400/40 text-teal-300">
                        <Clock className="w-4 h-4" />
                      </span>
                      <h3 className="text-base sm:text-lg font-extrabold text-white">
                        {getItemDisplayName(historyDrawerItem)} {itemCode}
                      </h3>
                    </div>
                    {historyDrawerItem.item_name_en || stdInfo?.nameEn ? (
                      <p className="text-xs text-white/50 font-mono" dir="ltr">
                        {historyDrawerItem.item_name_en || stdInfo?.nameEn}
                      </p>
                    ) : null}

                    {/* Live Balance: الرصيد المتبقي: */}
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-500/10 border border-teal-400/30 text-xs sm:text-sm mt-1">
                      <span className="text-white/80 font-bold">الرصيد المتبقي:</span>
                      <strong className="font-mono font-black text-teal-300 text-sm sm:text-base" dir="ltr">
                        {toEnglishDigits(historyDrawerItem.current_stock)}
                      </strong>
                      <span className="text-white/60 text-xs">وحدة</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHistoryDrawerItem(null)}
                    className="text-white/70 hover:text-white bg-white/8 hover:bg-white/15 border border-white/20 p-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center w-9 h-9 shrink-0"
                    aria-label="إغلاق"
                    title="إغلاق"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Date Range Filter & Presets */}
              <div className="p-4 sm:p-5 border-b border-white/15 bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white/85">
                    <Calendar className="w-3.5 h-3.5 text-teal-300" />
                    <span>تحديد الفترة:</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const today = getDateStringDaysAgo(0);
                        handleHistoryDateChange(today, today);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/40 text-teal-200 cursor-pointer transition-colors"
                    >
                      اليوم
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHistoryDateChange(getDateStringDaysAgo(1), getDateStringDaysAgo(0))}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/8 hover:bg-white/15 border border-white/15 text-white/85 cursor-pointer transition-colors"
                    >
                      آخر يومين
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHistoryDateChange(getDateStringDaysAgo(6), getDateStringDaysAgo(0))}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/8 hover:bg-white/15 border border-white/15 text-white/85 cursor-pointer transition-colors"
                    >
                      آخر 7 أيام
                    </button>
                    <button
                      type="button"
                      onClick={() => handleHistoryDateChange('', '')}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/8 hover:bg-white/15 border border-white/15 text-white/85 cursor-pointer transition-colors"
                    >
                      الكل
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-white/75">
                      من تاريخ (Start Date)
                    </label>
                    <div className="relative flex items-center bg-white/8 hover:bg-white/12 border border-white/20 focus-within:border-teal-400/60 rounded-xl px-3 py-2 cursor-pointer transition-all">
                      <Calendar className="w-3.5 h-3.5 text-teal-300 me-2 shrink-0 pointer-events-none" />
                      <span dir="ltr" className="font-mono text-xs font-bold text-white select-none tracking-wider">
                        {formatDisplayDate(historyStartDate) || 'DD/MM/YYYY'}
                      </span>
                      <input
                        type="date"
                        dir="ltr"
                        lang="en"
                        value={toEnglishDigitsStr(historyStartDate)}
                        onChange={(e) => handleHistoryDateChange(toEnglishDigitsStr(e.target.value), historyEndDate)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-white/75">
                      إلى تاريخ (End Date)
                    </label>
                    <div className="relative flex items-center bg-white/8 hover:bg-white/12 border border-white/20 focus-within:border-teal-400/60 rounded-xl px-3 py-2 cursor-pointer transition-all">
                      <Calendar className="w-3.5 h-3.5 text-teal-300 me-2 shrink-0 pointer-events-none" />
                      <span dir="ltr" className="font-mono text-xs font-bold text-white select-none tracking-wider">
                        {formatDisplayDate(historyEndDate) || 'DD/MM/YYYY'}
                      </span>
                      <input
                        type="date"
                        dir="ltr"
                        lang="en"
                        value={toEnglishDigitsStr(historyEndDate)}
                        onChange={(e) => handleHistoryDateChange(historyStartDate, toEnglishDigitsStr(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Body: History Table */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                {isLoadingHistory ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3 text-white/80">
                    <Loader2 className="w-7 h-7 animate-spin text-teal-300" />
                    <span className="text-xs font-bold">جاري تحميل سجل الاستهلاك...</span>
                  </div>
                ) : historyError ? (
                  <div className="rounded-2xl bg-rose-500/15 border border-rose-400/35 p-4 text-center space-y-2">
                    <AlertTriangle className="w-6 h-6 text-rose-300 mx-auto" />
                    <p className="text-xs font-bold text-rose-200">{historyError}</p>
                    <button
                      type="button"
                      onClick={() =>
                        loadConsumptionHistory(historyDrawerItem.item_code, historyStartDate, historyEndDate)
                      }
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/20 text-white cursor-pointer"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                ) : historyRows.length === 0 ? (
                  <div className="py-16 px-4 text-center rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                    <Clock className="w-8 h-8 text-white/40 mx-auto" />
                    <p className="text-sm font-bold text-white/90">
                      لا توجد سجلات استهلاك مسجلة في هذه الفترة
                    </p>
                    <p className="text-xs text-white/60">
                      جرّب اختيار تاريخ آخر أو النقر على «الكل» لعرض كافة السجلات.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-white/15 bg-white/[0.03]">
                    <table className="w-full text-center border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-white/8 border-b border-white/15 text-white font-bold">
                          <th className="py-3 px-3">التاريخ</th>
                          <th className="py-3 px-3">الرصيد الافتتاحي</th>
                          <th className="py-3 px-3">الكمية المستهلكة</th>
                          <th className="py-3 px-3">الرصيد المتبقي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/8">
                        {historyRows.map((row, idx) => (
                          <tr
                            key={`${row.item_code}-${row.target_date}-${row.id || idx}`}
                            className="hover:bg-white/[0.05] transition-colors"
                          >
                            <td className="py-3 px-3 font-mono font-bold text-white" dir="ltr">
                              <span dir="ltr" className="font-mono">{formatDisplayDate(row.target_date)}</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-white/85" dir="ltr">
                              {toEnglishDigits(row.balance_before)}
                            </td>
                            <td className="py-3 px-3 font-mono font-black text-amber-300" dir="ltr">
                              {toEnglishDigits(row.quantity_consumed)}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-emerald-300" dir="ltr">
                              {toEnglishDigits(row.balance_after)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-white/10 border-t border-white/20 font-extrabold text-white">
                          <td className="py-3 px-3 text-right" colSpan={2}>
                            إجمالي المستهلك للفترة:
                          </td>
                          <td className="py-3 px-3 font-mono text-amber-300 text-base" dir="ltr">
                            {toEnglishDigits(totalHistoryConsumed)}
                          </td>
                          <td className="py-3 px-3 text-xs text-white/70">وحدة</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-white/15 bg-white/[0.03] flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setHistoryDrawerItem(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>
            </aside>
          </div>
        );
      })()}

    </div>
  );
}
