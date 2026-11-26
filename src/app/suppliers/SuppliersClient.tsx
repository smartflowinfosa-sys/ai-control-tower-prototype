"use client";

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import GlassSelect from '@/components/common/GlassSelect';
import { useLanguage } from '@/components/common/LanguageContext';
import {
  initialInventoryItems as mockInventoryItems,
  supplierQuotesMatrix,
  SupplierQuote,
  PurchaseOrder,
  getSessionPurchaseOrders,
  addPurchaseOrderToSession
} from '@/lib/mockInventoryData';
import {
  SupabaseSupplier,
  SupabaseInventoryItem,
  addSupplier,
  updateSupplier,
  sortSuppliersByDefault,
  fetchSupplierItems,
  addSupplierItem,
  updateSupplierItemPrice,
  deleteSupplierItem,
  SupplierItemRecord,
  fetchPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  updatePurchaseOrderDetails,
  deletePurchaseOrder,
  fetchAllSupplierItems,
  fetchSuppliersForItem,
  SupabasePurchaseOrder,
  SupabaseSupplierItem,
  SupabasePOPayment,
  fetchPOPayments,
  createPOPayment,
  updatePOPayment,
  deletePOPayment,
  uploadProcurementReceipt,
  checkAndTriggerDuePaymentReminders
} from '@/lib/supabaseService';
import { getAuthenticatedPOUser, formatPOCreatorDisplay } from '@/lib/poAuth';
import { useSession } from 'next-auth/react';
import { compareItemCodes, CARTON_SIZES } from '@/constants/inventoryCodes';
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
  Pencil,
  Trash2,
  Check,
  AlertTriangle,
  Calendar,
  Filter,
  RotateCcw,
  Bell,
  Upload,
  CreditCard,
  ClipboardCheck
} from 'lucide-react';

// Helper to ensure all digits are strictly English / Western (0-9)
const toEnglishDigits = (str: string | number): string => {
  if (str === null || str === undefined) return '';
  if (typeof str === 'number') {
    return new Intl.NumberFormat('en-US', { useGrouping: true, maximumFractionDigits: 4 }).format(str);
  }
  const clean = String(str)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
  const num = Number(clean);
  if (!isNaN(num) && clean.trim() !== '' && !clean.includes(':') && !clean.includes('-') && !clean.includes('/')) {
    return new Intl.NumberFormat('en-US', { useGrouping: true, maximumFractionDigits: 4 }).format(num);
  }
  return clean;
};

// Helper to sanitize text-based numeric inputs to strict Western/English numerals (0-9)
const sanitizeEnglishNumericInput = (val: string, allowDecimal = false): string => {
  const western = String(val ?? '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/٫/g, '.')
    .replace(/,/g, '.');
  if (!allowDecimal) {
    return western.replace(/[^0-9]/g, '');
  }
  const cleaned = western.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

/**
 * Clean RTL Date Input that renders type="text" with empty placeholder="" when no date is selected
 * so RTL Chrome never renders the reversed "ةنس/رهش/موي" placeholder text.
 */
function CleanRtlDateInput({
  value,
  onChange,
  required,
  className,
  min,
}: {
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  className?: string;
  min?: string;
}) {
  return (
    <div className="relative w-full">
      <input
        type={value ? 'date' : 'text'}
        placeholder=""
        dir="ltr"
        lang="en"
        required={required}
        min={min}
        value={value}
        onFocus={(e) => {
          e.currentTarget.type = 'date';
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // Ignore if showPicker requires direct user gesture
          }
        }}
        onClick={(e) => {
          if (e.currentTarget.type !== 'date') {
            e.currentTarget.type = 'date';
          }
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // Ignore if showPicker fails
          }
        }}
        onBlur={(e) => {
          if (!e.currentTarget.value) {
            e.currentTarget.type = 'text';
          }
        }}
        onChange={(e) => onChange(e.target.value)}
        className={
          className ||
          'w-full bg-white/10 border border-white/20 rounded-xl pl-8 pr-3 py-2 text-white text-xs outline-none focus:border-teal-300 font-mono cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden'
        }
      />
      <Calendar className="w-3.5 h-3.5 text-white/60 pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
    </div>
  );
}

interface SuppliersClientProps {
  initialSuppliers: SupabaseSupplier[];
  initialInventoryItems?: SupabaseInventoryItem[];
  initialPurchaseOrders?: SupabasePurchaseOrder[];
  initialSupplierItems?: SupabaseSupplierItem[];
  fetchError?: string | null;
}

export default function SuppliersClient({
  initialSuppliers,
  initialInventoryItems = [],
  initialPurchaseOrders = [],
  initialSupplierItems = [],
  fetchError
}: SuppliersClientProps) {
  const { lang, t } = useLanguage();
  const { data: session } = useSession();
  const authenticatedUser = useMemo(() => getAuthenticatedPOUser(session, lang), [session, lang]);

  // Resolve inventory items from database, strictly sorted alphanumerically (P1, P2... P9, P10)
  const [availableItems, setAvailableItems] = useState<SupabaseInventoryItem[]>(() => {
    const raw: SupabaseInventoryItem[] =
      initialInventoryItems && initialInventoryItems.length > 0 ? initialInventoryItems : [];
    return [...raw].sort((a, b) => compareItemCodes(a.item_code, b.item_code));
  });

  useEffect(() => {
    if (initialInventoryItems && initialInventoryItems.length > 0) {
      setAvailableItems(
        [...initialInventoryItems].sort((a, b) => compareItemCodes(a.item_code, b.item_code))
      );
    }
  }, [initialInventoryItems]);
  
  // State initialization directly from Supabase props (strictly sorted by default order)
  const [suppliers, setSuppliers] = useState<SupabaseSupplier[]>(() => sortSuppliersByDefault(initialSuppliers || []));
  const [analyzingItemId, setAnalyzingItemId] = useState<string>(() => {
    if (availableItems && availableItems.length > 0) {
      return availableItems[0].item_code;
    }
    return 'P1';
  });
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() =>
    initialPurchaseOrders && initialPurchaseOrders.length > 0
      ? (initialPurchaseOrders as unknown as PurchaseOrder[])
      : getSessionPurchaseOrders()
  );
  const [allSupplierItems, setAllSupplierItems] = useState<SupabaseSupplierItem[]>(() => initialSupplierItems || []);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [isSavingSupplier, setIsSavingSupplier] = useState<boolean>(false);
  const [isSubmittingQuickOrder, setIsSubmittingQuickOrder] = useState<boolean>(false);

  // Sync state if server props update
  useEffect(() => {
    if (initialSuppliers && initialSuppliers.length > 0) {
      setSuppliers(sortSuppliersByDefault(initialSuppliers));
    }
  }, [initialSuppliers]);

  useEffect(() => {
    if (initialPurchaseOrders && initialPurchaseOrders.length > 0) {
      setPurchaseOrders(initialPurchaseOrders as unknown as PurchaseOrder[]);
    }
  }, [initialPurchaseOrders]);

  useEffect(() => {
    if (initialSupplierItems && initialSupplierItems.length > 0) {
      setAllSupplierItems(initialSupplierItems);
    }
  }, [initialSupplierItems]);

  // Only fetch on client mount when SSR cache did not already provide initial data
  useEffect(() => {
    if (!initialPurchaseOrders || initialPurchaseOrders.length === 0) {
      fetchPurchaseOrders()
        .then(pos => {
          if (pos && pos.length > 0) {
            setPurchaseOrders(pos as unknown as PurchaseOrder[]);
          }
        })
        .catch(console.warn);
    }

    if (!initialSupplierItems || initialSupplierItems.length === 0) {
      fetchAllSupplierItems()
        .then(items => {
          if (items && items.length > 0) {
            setAllSupplierItems(items);
          }
        })
        .catch(console.warn);
    }
  }, [initialPurchaseOrders, initialSupplierItems]);

  useEffect(() => {
    if (availableItems && availableItems.length > 0 && !analyzingItemId) {
      setAnalyzingItemId(availableItems[0].item_code);
    }
  }, [availableItems, analyzingItemId]);

  // PO Edit & Delete State
  const [isEditingPO, setIsEditingPO] = useState<boolean>(false);
  const [editPOQuantity, setEditPOQuantity] = useState<number>(0);
  const [editPOUnitPrice, setEditPOUnitPrice] = useState<string>('0.5');
  const [editPOTotalCost, setEditPOTotalCost] = useState<string>('0');
  const [editPOExpectedDate, setEditPOExpectedDate] = useState<string>('');
  const [editPOStatus, setEditPOStatus] = useState<string>('PENDING_APPROVAL');
  const [editPOSupplier, setEditPOSupplier] = useState<string>('');
  const [poAvailableSuppliers, setPoAvailableSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingPOSuppliers, setIsLoadingPOSuppliers] = useState<boolean>(false);
  const [isSavingPOEdit, setIsSavingPOEdit] = useState<boolean>(false);
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
  const [isDeletingPO, setIsDeletingPO] = useState<boolean>(false);
  const [poToComplete, setPoToComplete] = useState<PurchaseOrder | null>(null);
  const [isCompletingPO, setIsCompletingPO] = useState<boolean>(false);

  // PO Partial Quantity & Payment Scheduling State
  const [poPayments, setPoPayments] = useState<SupabasePOPayment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState<boolean>(false);
  const [isCheckingReminders, setIsCheckingReminders] = useState<boolean>(false);
  const [partialReceivedQty, setPartialReceivedQty] = useState<string>('0');
  const [partialRemainingQty, setPartialRemainingQty] = useState<string>('0');
  const [isEditingPOQuantities, setIsEditingPOQuantities] = useState<boolean>(false);
  const [isSavingPartialQty, setIsSavingPartialQty] = useState<boolean>(false);

  // Add / Edit Scheduled Payment State
  const [isAddingPayment, setIsAddingPayment] = useState<boolean>(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [newPaymentTitle, setNewPaymentTitle] = useState<string>('دفعة مستحقة');
  const [newPaymentAmount, setNewPaymentAmount] = useState<string>('');
  const [newPaymentDueDate, setNewPaymentDueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isSavingPayment, setIsSavingPayment] = useState<boolean>(false);

  // Settle Payment & Receipt Upload Modal State
  const [paymentToSettle, setPaymentToSettle] = useState<SupabasePOPayment | null>(null);
  const [receiptFileToUpload, setReceiptFileToUpload] = useState<File | null>(null);
  const [isSettlingPayment, setIsSettlingPayment] = useState<boolean>(false);

  // Standalone / Supplier Profile Scheduled Payment Form State
  const [isAddingSupplierPayment, setIsAddingSupplierPayment] = useState<boolean>(false);
  const [editingSupplierPaymentId, setEditingSupplierPaymentId] = useState<string | null>(null);
  const [supPayPoRef, setSupPayPoRef] = useState<string>('دفعة عامة');
  const [supPayTitle, setSupPayTitle] = useState<string>('');
  const [supPayNotes, setSupPayNotes] = useState<string>('');
  const [supPayAmount, setSupPayAmount] = useState<string>('');
  const [supPayDueDate, setSupPayDueDate] = useState<string>('');
  const [isSavingSupplierPayment, setIsSavingSupplierPayment] = useState<boolean>(false);

  // Create Purchase Order Modal State (طلب توريد مع ملخص الاتفاق و 3 طرق دفع)
  const [isCreatePOModalOpen, setIsCreatePOModalOpen] = useState<boolean>(false);
  const [createPOSupplierId, setCreatePOSupplierId] = useState<string>('');
  const [createPOSupplierName, setCreatePOSupplierName] = useState<string>('');
  const [createPOItemCode, setCreatePOItemCode] = useState<string>('P1');
  const [createPOItemName, setCreatePOItemName] = useState<string>('');
  const [createPOQuantityUnits, setCreatePOQuantityUnits] = useState<number>(2500);
  const [createPOUnitPriceStr, setCreatePOUnitPriceStr] = useState<string>('0.45');
  const [createPONotes, setCreatePONotes] = useState<string>('');
  const [createPOPaymentType, setCreatePOPaymentType] = useState<
    'full_payment' | 'deposit_and_balance' | 'full_credit'
  >('full_payment');
  const [createPOFullPaidNow, setCreatePOFullPaidNow] = useState<boolean>(true);
  const [createPOFullDueDate, setCreatePOFullDueDate] = useState<string>('');
  const [createPODepositAmountStr, setCreatePODepositAmountStr] = useState<string>('');
  const [createPODepositPaidNow, setCreatePODepositPaidNow] = useState<boolean>(true);
  const [createPODepositDueDate, setCreatePODepositDueDate] = useState<string>('');
  const [createPOReceiptFile, setCreatePOReceiptFile] = useState<File | null>(null);
  const [createPOBalanceInstallments, setCreatePOBalanceInstallments] = useState<
    Array<{ title: string; amount: string; dueDate: string }>
  >([{ title: 'دفعة المتبقي #1', amount: '0', dueDate: '' }]);
  const [createPOCreditInstallments, setCreatePOCreditInstallments] = useState<
    Array<{ title: string; amount: string; dueDate: string }>
  >([{ title: 'دفعة آجل #1', amount: '0', dueDate: '' }]);

  // Certified Supplier Item Edit Price & Delete State
  const [editingSupplierItem, setEditingSupplierItem] = useState<{
    id?: string;
    supplier_id: string;
    item_code: string;
    name_ar: string;
    priceStr: string;
  } | null>(null);
  const [isSavingSupplierItemPrice, setIsSavingSupplierItemPrice] = useState<boolean>(false);
  const [supplierItemToDelete, setSupplierItemToDelete] = useState<{
    id?: string;
    supplier_id: string;
    item_code: string;
    name_ar: string;
  } | null>(null);
  const [isDeletingSupplierItem, setIsDeletingSupplierItem] = useState<boolean>(false);

  // Supplier Add / Edit Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<SupabaseSupplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    name_en: '',
    city: 'جدة',
    city_en: 'Jeddah',
    rating: 4.8,
    delivery_time_hours: 24,
    category: 'تغليف ومستلزمات تشغيل',
    phone: '+966 12 654 3210',
    phone_number: '+966 12 654 3210',
    pricingTier: 'أسعار جملة معتمدة',
    cr_number: '',
    tax_number: '',
  });

  // Supplier Profile Modal State: Tabs, Archive & Certified Items
  const [selectedProfileSupplier, setSelectedProfileSupplier] = useState<SupabaseSupplier | null>(null);
  const [profileActiveTab, setProfileActiveTab] = useState<'products' | 'archive' | 'kpis' | 'all'>('products');
  const [profileDateStart, setProfileDateStart] = useState<string>('');
  const [profileDateEnd, setProfileDateEnd] = useState<string>('');
  const [profileItemFilter, setProfileItemFilter] = useState<string>('ALL');
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  // Supplier Products (supplier_items junction) state
  const [supplierItems, setSupplierItems] = useState<SupplierItemRecord[]>([]);
  const [isLoadingSupplierItems, setIsLoadingSupplierItems] = useState<boolean>(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState<boolean>(false);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState<string>('');
  const [agreedUnitPrice, setAgreedUnitPrice] = useState<string>('0.10');
  const [isSavingNewItem, setIsSavingNewItem] = useState<boolean>(false);

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

  const loadSupplierItems = async (supplierId: string) => {
    setIsLoadingSupplierItems(true);
    try {
      const items = await fetchSupplierItems(supplierId);
      setSupplierItems(items);
    } catch (err) {
      console.warn('Failed to fetch supplier items:', err);
    } finally {
      setIsLoadingSupplierItems(false);
    }
  };

  const handleOpenSupplierProfile = (sup: SupabaseSupplier) => {
    setSelectedProfileSupplier(sup);
    setProfileActiveTab('products');
    setProfileDateStart('');
    setProfileDateEnd('');
    setProfileItemFilter('ALL');
    setIsAddingSupplierPayment(false);
    setEditingSupplierPaymentId(null);
    loadSupplierItems(sup.id);
    fetchPurchaseOrders()
      .then(pos => {
        if (pos && pos.length > 0) {
          setPurchaseOrders(pos as unknown as PurchaseOrder[]);
        }
      })
      .catch(console.warn);
    fetchPOPayments()
      .then(payments => {
        if (Array.isArray(payments)) {
          setPoPayments(payments);
        }
      })
      .catch(console.warn);
  };

  const handleCloseSupplierProfile = () => {
    setSelectedProfileSupplier(null);
    setIsAddItemModalOpen(false);
    setIsAddingSupplierPayment(false);
    setEditingSupplierPaymentId(null);
  };

  // Load all PO payments & automatically trigger due payment reminders when Suppliers page loads
  const loadAllPOPaymentsAndReminders = async (manualTrigger = false) => {
    if (manualTrigger) {
      setIsCheckingReminders(true);
    } else {
      setIsLoadingPayments(true);
    }
    try {
      const payments = await fetchPOPayments();
      setPoPayments(payments);

      const poSupMap: Record<string, string> = {};
      for (const po of purchaseOrders) {
        if (po.id && po.supplierName) {
          poSupMap[po.id] = po.supplierName;
        }
      }

      const reminderResult = await checkAndTriggerDuePaymentReminders(poSupMap);
      if (reminderResult.triggeredCount > 0) {
        const refreshed = await fetchPOPayments();
        setPoPayments(refreshed);
        showToast(
          `تم إصدار (${toEnglishDigits(reminderResult.triggeredCount)}) تذكرة تذكير سداد عالية الأولوية لقسم المالية والإدارة تلقائياً!`
        );
      } else if (manualTrigger) {
        showToast('تم فحص جدول المدفوعات: لا توجد دفعات مستحقة جديدة غير مُصدر لها تذكرة تذكير.');
      }
    } catch (err) {
      console.warn('Payment reminders check notice:', err);
      if (manualTrigger) {
        showError('تعذر فحص تذكيرات الدفعات المستحقة حالياً.');
      }
    } finally {
      setIsLoadingPayments(false);
      setIsCheckingReminders(false);
    }
  };

  useEffect(() => {
    void loadAllPOPaymentsAndReminders(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync partial quantity inputs whenever selectedPO changes
  useEffect(() => {
    if (selectedPO) {
      const agreed = Number(selectedPO.quantity) || 0;
      const rec =
        selectedPO.received_quantity !== undefined
          ? Number(selectedPO.received_quantity)
          : selectedPO.receivedQuantity !== undefined
          ? Number(selectedPO.receivedQuantity)
          : 0;
      const rem = Math.max(0, agreed - rec);
      setPartialReceivedQty(String(rec));
      setPartialRemainingQty(String(rem));
      setIsEditingPOQuantities(false);
      setIsAddingPayment(false);
      setEditingPaymentId(null);
      setNewPaymentTitle('دفعة توريد');
      setNewPaymentAmount(String(selectedPO.totalCost || ''));
      setNewPaymentDueDate('');
    }
  }, [selectedPO]);

  const handleSaveStandaloneSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileSupplier || isSavingSupplierPayment) return;

    const cleanAmount = parseFloat(
      String(supPayAmount)
        .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .trim()
    );
    if (!supPayTitle.trim() || isNaN(cleanAmount) || cleanAmount <= 0 || !supPayDueDate) {
      showError('يرجى إدخال البيان، المبلغ المستحق، وتاريخ الاستحقاق المحدد.');
      return;
    }

    setIsSavingSupplierPayment(true);
    try {
      if (editingSupplierPaymentId) {
        const updated = await updatePOPayment(editingSupplierPaymentId, {
          title: supPayTitle.trim(),
          amount: cleanAmount,
          due_date: supPayDueDate,
          notes: supPayNotes.trim() || null,
        });
        setPoPayments((prev) =>
          prev.map((p) => (p.id === editingSupplierPaymentId ? { ...p, ...updated } : p))
        );
        showToast('تم تحديث بيانات الدفعة المستحقة للمورد بنجاح');
      } else {
        const created = await createPOPayment({
          po_number: supPayPoRef.trim() || 'دفعة عامة',
          supplier_id: selectedProfileSupplier.id,
          title: supPayTitle.trim(),
          amount: cleanAmount,
          due_date: supPayDueDate,
          status: 'scheduled',
          notes: supPayNotes.trim() || undefined,
        });
        setPoPayments((prev) => [...prev, created]);
        showToast('تمت إضافة الدفعة المجدولة إلى سجل المورد بنجاح');
      }
      setIsAddingSupplierPayment(false);
      setEditingSupplierPaymentId(null);
      setSupPayPoRef('دفعة عامة');
      setSupPayTitle('');
      setSupPayNotes('');
      setSupPayAmount('');
      setSupPayDueDate('');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر حفظ الدفعة المجدولة للمورد.');
    } finally {
      setIsSavingSupplierPayment(false);
    }
  };

  const handleSavePOPartialQuantities = async () => {
    if (!selectedPO || isSavingPartialQty) return;
    const agreed = Number(selectedPO.quantity) || 0;
    const cleanRec = Math.max(
      0,
      Math.round(Number(sanitizeEnglishNumericInput(partialReceivedQty, false)) || 0)
    );
    const cleanRem = Math.max(0, agreed - cleanRec);

    setIsSavingPartialQty(true);
    try {
      await updatePurchaseOrderDetails({
        po_number: selectedPO.id,
        received_quantity: cleanRec,
      });

      const updatedPO: PurchaseOrder = {
        ...selectedPO,
        receivedQuantity: cleanRec,
        received_quantity: cleanRec,
      };
      setSelectedPO(updatedPO);
      setPartialReceivedQty(String(cleanRec));
      setPartialRemainingQty(String(cleanRem));
      setIsEditingPOQuantities(false);
      setPurchaseOrders((prev) => prev.map((p) => (p.id === updatedPO.id ? updatedPO : p)));
      showToast(
        `تم حفظ تحديث الكميات لأمر الشراء (${updatedPO.id}) بنجاح (بدون تعديل رصيد المخزون الآلي)`
      );
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر حفظ تحديث الكميات.');
    } finally {
      setIsSavingPartialQty(false);
    }
  };

  const handleSaveScheduledPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO || isSavingPayment) return;

    const cleanAmount = parseFloat(
      String(newPaymentAmount)
        .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .trim()
    );
    if (!newPaymentTitle.trim() || isNaN(cleanAmount) || cleanAmount <= 0 || !newPaymentDueDate) {
      showError('يرجى إدخال بيان الدفعة، المبلغ، وتاريخ الاستحقاق بشكل صحيح.');
      return;
    }

    const matchedSupplier = suppliers.find(
      (s) =>
        s.id === (selectedPO.supplier_id || selectedPO.supplierId) ||
        s.name_ar === selectedPO.supplierName ||
        s.name === selectedPO.supplierName
    );
    const resolvedSupId = selectedPO.supplier_id || selectedPO.supplierId || matchedSupplier?.id || null;

    setIsSavingPayment(true);
    try {
      if (editingPaymentId) {
        const updated = await updatePOPayment(editingPaymentId, {
          title: newPaymentTitle.trim(),
          amount: cleanAmount,
          due_date: newPaymentDueDate,
        });
        setPoPayments((prev) =>
          prev.map((p) => (p.id === editingPaymentId ? { ...p, ...updated } : p))
        );
        showToast('تم تعديل بيانات الدفعة المجدولة بنجاح');
      } else {
        const created = await createPOPayment({
          po_number: selectedPO.id,
          supplier_id: resolvedSupId,
          title: newPaymentTitle.trim(),
          amount: cleanAmount,
          due_date: newPaymentDueDate,
          status: 'scheduled',
        });
        setPoPayments((prev) => [...prev, created]);
        showToast('تمت إضافة الدفعة المجدولة إلى أمر الشراء بنجاح');
      }
      setIsAddingPayment(false);
      setEditingPaymentId(null);
      setNewPaymentTitle('دفعة توريد');
      setNewPaymentAmount('');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر حفظ الدفعة المجدولة.');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleDeleteScheduledPayment = async (paymentId: string) => {
    try {
      await deletePOPayment(paymentId);
      setPoPayments((prev) => prev.filter((p) => p.id !== paymentId));
      showToast('تم حذف الدفعة المجدولة بنجاح');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر حذف الدفعة المجدولة.');
    }
  };

  const handleConfirmSettlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentToSettle || isSettlingPayment) return;

    setIsSettlingPayment(true);
    try {
      let receiptUrl: string | null = paymentToSettle.receipt_url || null;
      let sizeNotice = '';

      if (receiptFileToUpload) {
        const uploaded = await uploadProcurementReceipt(
          receiptFileToUpload,
          paymentToSettle.po_number
        );
        receiptUrl = uploaded.publicUrl;
        if (receiptFileToUpload.type.startsWith('image/')) {
          sizeNotice = ` (تم ضغط صورة الإيصال إلى ~${toEnglishDigits(uploaded.compressedSizeKB)} KB)`;
        }
      }

      const paidTimestamp = new Date().toISOString();
      const updated = await updatePOPayment(paymentToSettle.id, {
        status: 'paid',
        paid_at: paidTimestamp,
        receipt_url: receiptUrl,
      });

      setPoPayments((prev) =>
        prev.map((p) =>
          p.id === paymentToSettle.id
            ? {
                ...p,
                ...updated,
                status: 'paid',
                paid_at: paidTimestamp,
                receipt_url: receiptUrl,
              }
            : p
        )
      );

      showToast(
        `تم تسجيل سداد الدفعة (${paymentToSettle.title}) بقيمة ${toEnglishDigits(paymentToSettle.amount)} ر.س بنجاح${sizeNotice}`
      );
      setPaymentToSettle(null);
      setReceiptFileToUpload(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر تسجيل سداد الدفعة.');
    } finally {
      setIsSettlingPayment(false);
    }
  };

  const handleAddCertifiedItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProfileSupplier || !selectedItemToAdd) return;
    const normalizedPriceStr = String(agreedUnitPrice)
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .trim();
    const parsedPrice = parseFloat(normalizedPriceStr);
    if (isNaN(parsedPrice) || parsedPrice < 0) return;

    setIsSavingNewItem(true);
    try {
      const record = await addSupplierItem(selectedProfileSupplier.id, selectedItemToAdd, parsedPrice);
      setSupplierItems(prev => {
        if (prev.some(p => p.item_code === selectedItemToAdd)) return prev;
        return [record, ...prev];
      });
      setIsAddItemModalOpen(false);
      fetchAllSupplierItems().then(items => { if (items?.length) setAllSupplierItems(items); }).catch(console.warn);
      const matched = availableItems.find(i => i.item_code === selectedItemToAdd);
      const name = matched?.item_name_ar || selectedItemToAdd;
      showToast(
        lang === 'en'
          ? `Product (${name}) added to certified supplier items successfully`
          : `تمت إضافة الصنف (${name}) لقائمة المنتجات المعتمدة للتوريد بنجاح`
      );
      setSelectedItemToAdd('');
    } catch (err) {
      console.error('Failed to add supplier item:', err);
    } finally {
      setIsSavingNewItem(false);
    }
  };

  const handleSaveSupplierItemPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplierItem || isSavingSupplierItemPrice) return;
    const normalizedStr = String(editingSupplierItem.priceStr)
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .trim();
    const parsedPrice = parseFloat(normalizedStr);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      showError('يرجى إدخال سعر توريد صحيح.');
      return;
    }

    setIsSavingSupplierItemPrice(true);
    try {
      const savedPrice = await updateSupplierItemPrice(
        editingSupplierItem.supplier_id,
        editingSupplierItem.item_code,
        parsedPrice,
        editingSupplierItem.id
      );

      setSupplierItems((prev) =>
        prev.map((si) =>
          si.item_code === editingSupplierItem.item_code
            ? { ...si, unit_price: savedPrice }
            : si
        )
      );
      setAllSupplierItems((prev) =>
        prev.map((si) =>
          si.supplier_id === editingSupplierItem.supplier_id &&
          si.inventory_item_code === editingSupplierItem.item_code
            ? { ...si, price: savedPrice }
            : si
        )
      );
      setEditingSupplierItem(null);
      showToast(`تم تحديث سعر التوريد للصنف (${editingSupplierItem.name_ar}) إلى ${savedPrice} ر.س بنجاح`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر تحديث سعر الصنف.');
    } finally {
      setIsSavingSupplierItemPrice(false);
    }
  };

  const handleConfirmDeleteSupplierItem = async () => {
    if (!supplierItemToDelete || isDeletingSupplierItem) return;
    setIsDeletingSupplierItem(true);
    try {
      await deleteSupplierItem(
        supplierItemToDelete.supplier_id,
        supplierItemToDelete.item_code,
        supplierItemToDelete.id
      );
      setSupplierItems((prev) =>
        prev.filter((si) => si.item_code !== supplierItemToDelete.item_code)
      );
      setAllSupplierItems((prev) =>
        prev.filter(
          (si) =>
            !(
              si.supplier_id === supplierItemToDelete.supplier_id &&
              si.inventory_item_code === supplierItemToDelete.item_code
            )
        )
      );
      showToast(`تم حذف الصنف (${supplierItemToDelete.name_ar}) من قائمة المورد بنجاح`);
      setSupplierItemToDelete(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر حذف الصنف من قائمة المورد.');
    } finally {
      setIsDeletingSupplierItem(false);
    }
  };

  // Sync with global purchase orders events (creation, update, receiving)
  useEffect(() => {
    const handleNewAiPO = (event: CustomEvent<PurchaseOrder>) => {
      if (event.detail) {
        setPurchaseOrders(prev => {
          if (prev.some(p => p.id === event.detail.id)) return prev;
          return [event.detail, ...prev];
        });
      }
    };

    const handleUpdatedPO = (event: CustomEvent<PurchaseOrder>) => {
      if (event.detail && event.detail.id) {
        setPurchaseOrders(prev =>
          prev.map(p => (p.id === event.detail.id ? { ...p, ...event.detail } : p))
        );
      }
    };

    const handleReceivedPO = (event: CustomEvent<any>) => {
      if (event.detail && event.detail.id) {
        setPurchaseOrders(prev =>
          prev.map(p =>
            p.id === event.detail.id
              ? {
                  ...p,
                  status: 'تم الاستلام',
                  invoiceUrl: event.detail.invoiceUrl || p.invoiceUrl,
                  supplier_id: event.detail.supplier_id || p.supplier_id,
                  supplierId: event.detail.supplierId || p.supplierId,
                  receivedQuantity: event.detail.receivedQuantity || p.receivedQuantity,
                }
              : p
          )
        );
      }
    };

    const handleSupplierItemsUpdate = (event: CustomEvent<SupplierItemRecord>) => {
      if (event.detail && selectedProfileSupplier && event.detail.supplier_id === selectedProfileSupplier.id) {
        setSupplierItems(prev => {
          if (prev.some(p => p.item_code === event.detail.item_code)) return prev;
          return [event.detail, ...prev];
        });
      }
    };

    window.addEventListener('ai_purchase_order_created' as any, handleNewAiPO);
    window.addEventListener('ai_purchase_order_updated' as any, handleUpdatedPO);
    window.addEventListener('purchase_order_received' as any, handleReceivedPO);
    window.addEventListener('supplier_items_updated' as any, handleSupplierItemsUpdate);

    return () => {
      window.removeEventListener('ai_purchase_order_created' as any, handleNewAiPO);
      window.removeEventListener('ai_purchase_order_updated' as any, handleUpdatedPO);
      window.removeEventListener('purchase_order_received' as any, handleReceivedPO);
      window.removeEventListener('supplier_items_updated' as any, handleSupplierItemsUpdate);
    };
  }, [selectedProfileSupplier]);

  const lowStockItems = availableItems.filter(item => (item.current_stock ?? 0) <= (item.reorder_level ?? 0));

  const handleAnalyzeQuotes = (itemId: string) => {
    setAnalyzingItemId(itemId);
  };

  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => {
      setErrorToast(null);
    }, 4500);
  };

  const handleQuickOrder = (
    supplierName: string,
    itemName: string,
    unitPrice?: number,
    explicitItemCode?: string,
    explicitSupplierId?: string
  ) => {
    const authUser = getAuthenticatedPOUser(session, lang);
    if (!authUser) {
      showError(
        lang === 'en'
          ? 'Unauthorized: Cannot create a Purchase Order without an authenticated user session.'
          : 'عذراً، لا يمكن إنشاء أمر شراء بدون جلسة مستخدم موثقة. يرجى تسجيل الدخول أولاً.'
      );
      return;
    }

    const normalizedExplicitCode = explicitItemCode ? explicitItemCode.trim().toUpperCase() : '';
    const matchedItem =
      (normalizedExplicitCode
        ? availableItems.find(
            (i) => (i.item_code || '').trim().toUpperCase() === normalizedExplicitCode
          )
        : undefined) ||
      availableItems.find(
        (i) => i.item_name_ar === itemName || i.item_name_en === itemName || i.item_code === itemName
      ) ||
      (!normalizedExplicitCode && !itemName
        ? availableItems.find((i) => i.item_code === analyzingItemId)
        : undefined);

    const matchedSupplier =
      (explicitSupplierId ? suppliers.find((s) => s.id === explicitSupplierId) : undefined) ||
      suppliers.find(
        (s) =>
          s.name_ar === supplierName ||
          s.name === supplierName ||
          s.name_en === supplierName
      );

    const resolvedSupplierId = explicitSupplierId || matchedSupplier?.id || '';
    const resolvedSupplierName =
      matchedSupplier?.name_ar || matchedSupplier?.name || supplierName || 'المورد المعتمد';
    const resolvedItemCode =
      normalizedExplicitCode || matchedItem?.item_code || analyzingItemId || 'P1';
    const resolvedItemName = matchedItem?.item_name_ar || itemName || resolvedItemCode;
    const uPerCarton =
      matchedItem?.units_per_carton != null && Number(matchedItem.units_per_carton) > 0
        ? Number(matchedItem.units_per_carton)
        : CARTON_SIZES[resolvedItemCode.toUpperCase()] || 1;
    const defaultCartons = Math.max(1, Math.round(2500 / uPerCarton));
    const defaultUnits = defaultCartons * uPerCarton;
    const unitCost = unitPrice ?? matchedItem?.cost_per_unit ?? 0.45;
    const initialTotal = Number((defaultUnits * unitCost).toFixed(2));
    const initialDeposit = Number((initialTotal * 0.3).toFixed(2));
    const initialBalance = Math.max(0, Number((initialTotal - initialDeposit).toFixed(2)));

    setCreatePOSupplierId(resolvedSupplierId);
    setCreatePOSupplierName(resolvedSupplierName);
    setCreatePOItemCode(resolvedItemCode);
    setCreatePOItemName(resolvedItemName);
    setCreatePOQuantityUnits(defaultUnits);
    setCreatePOUnitPriceStr(String(unitCost));
    setCreatePONotes('');
    setCreatePOPaymentType('full_payment');
    setCreatePOFullPaidNow(true);
    setCreatePOFullDueDate('');
    setCreatePODepositAmountStr(String(initialDeposit));
    setCreatePODepositPaidNow(true);
    setCreatePODepositDueDate('');
    setCreatePOReceiptFile(null);
    setCreatePOBalanceInstallments([
      { title: 'دفعة المتبقي #1', amount: String(initialBalance), dueDate: '' },
    ]);
    setCreatePOCreditInstallments([
      { title: 'دفعة آجل #1', amount: String(initialTotal), dueDate: '' },
    ]);
    setIsCreatePOModalOpen(true);
  };

  const handleSubmitCreatePOModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const authUser = getAuthenticatedPOUser(session, lang);
    if (!authUser) {
      showError('عذراً، لا يمكن إنشاء أمر شراء بدون جلسة مستخدم موثقة.');
      return;
    }
    if (isSubmittingQuickOrder) return;

    const unitCost = parseFloat(
      String(createPOUnitPriceStr)
        .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .trim()
    );
    const quantity = Math.max(1, Math.round(Number(createPOQuantityUnits) || 0));
    if (isNaN(unitCost) || unitCost <= 0 || quantity <= 0) {
      showError('يرجى إدخال الكمية وسعر التوريد بشكل صحيح.');
      return;
    }

    const totalCost = Number((quantity * unitCost).toFixed(2));
    const todayStr = new Date().toISOString().split('T')[0];

    // Validate selected payment method and explicit due dates
    if (createPOPaymentType === 'full_payment') {
      if (!createPOFullPaidNow && !createPOFullDueDate) {
        showError('يرجى تحديد تاريخ الاستحقاق الصريح للدفعة الكاملة.');
        return;
      }
    } else if (createPOPaymentType === 'deposit_and_balance') {
      const depVal = parseFloat(
        String(createPODepositAmountStr)
          .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
          .trim()
      );
      if (isNaN(depVal) || depVal <= 0 || depVal >= totalCost) {
        showError('قيمة العربون يجب أن تكون أكبر من الصفر وأقل من إجمالي قيمة أمر الشراء.');
        return;
      }
      if (!createPODepositPaidNow && !createPODepositDueDate) {
        showError('يرجى تحديد تاريخ استحقاق العربون.');
        return;
      }
      for (const inst of createPOBalanceInstallments) {
        const amt = parseFloat(
          String(inst.amount)
            .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
            .trim()
        );
        if (isNaN(amt) || amt <= 0 || !inst.dueDate) {
          showError('يرجى إدخال مبلغ وتاريخ استحقاق صريح لكل دفعة من دفعات المتبقي.');
          return;
        }
      }
    } else if (createPOPaymentType === 'full_credit') {
      for (const inst of createPOCreditInstallments) {
        const amt = parseFloat(
          String(inst.amount)
            .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
            .trim()
        );
        if (isNaN(amt) || amt <= 0 || !inst.dueDate) {
          showError('يرجى إدخال مبلغ وتاريخ استحقاق صريح لكل دفعة من دفعات الآجل.');
          return;
        }
      }
    }

    setIsSubmittingQuickOrder(true);
    try {
      const poNum = `PO-${Math.floor(1000 + Math.random() * 9000)}`;
      const cleanNotes = createPONotes.trim() || null;

      // 1. Insert Purchase Order into public.purchase_orders with notes and payment_type
      const createdFromDB = await createPurchaseOrder({
        po_number: poNum,
        supplier_id: createPOSupplierId || undefined,
        inventory_item_code: createPOItemCode,
        quantity,
        total_cost: totalCost,
        status: 'PENDING_APPROVAL',
        created_by: authUser.id,
        notes: cleanNotes,
        payment_type: createPOPaymentType,
      });

      const createdPO: PurchaseOrder = {
        ...createdFromDB,
        createdBy: createdFromDB.createdBy || authUser.displayName,
        createdById: authUser.id,
        notes: cleanNotes,
        payment_type: createPOPaymentType,
        items: [{ itemId: createPOItemCode, itemName: createPOItemName, quantity }],
      };
      addPurchaseOrderToSession(createdPO);

      // 2. Upload and compress optional receipt if full payment or deposit is paid now
      let uploadedReceiptUrl: string | null = null;
      if (
        createPOReceiptFile &&
        ((createPOPaymentType === 'full_payment' && createPOFullPaidNow) ||
          (createPOPaymentType === 'deposit_and_balance' && createPODepositPaidNow))
      ) {
        const uploaded = await uploadProcurementReceipt(createPOReceiptFile, poNum);
        uploadedReceiptUrl = uploaded.publicUrl;
      }

      // 3. Insert payment schedule rows into public.po_payments
      const createdPayments: SupabasePOPayment[] = [];
      const nowIso = new Date().toISOString();

      if (createPOPaymentType === 'full_payment') {
        const p = await createPOPayment({
          po_number: poNum,
          supplier_id: createPOSupplierId || null,
          title: 'دفع كامل',
          amount: totalCost,
          due_date: createPOFullPaidNow ? todayStr : createPOFullDueDate,
          status: createPOFullPaidNow ? 'paid' : 'scheduled',
          paid_at: createPOFullPaidNow ? nowIso : null,
          receipt_url: createPOFullPaidNow ? uploadedReceiptUrl : null,
          notes: cleanNotes || undefined,
        });
        createdPayments.push(p);
      } else if (createPOPaymentType === 'deposit_and_balance') {
        const depVal = Number(
          parseFloat(
            String(createPODepositAmountStr)
              .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
              .trim()
          ).toFixed(2)
        );
        const depPayment = await createPOPayment({
          po_number: poNum,
          supplier_id: createPOSupplierId || null,
          title: 'عربون مقدم',
          amount: depVal,
          due_date: createPODepositPaidNow ? todayStr : createPODepositDueDate,
          status: createPODepositPaidNow ? 'paid' : 'scheduled',
          paid_at: createPODepositPaidNow ? nowIso : null,
          receipt_url: createPODepositPaidNow ? uploadedReceiptUrl : null,
          notes: cleanNotes || undefined,
        });
        createdPayments.push(depPayment);

        for (let i = 0; i < createPOBalanceInstallments.length; i++) {
          const inst = createPOBalanceInstallments[i];
          const amt = Number(
            parseFloat(
              String(inst.amount)
                .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
                .trim()
            ).toFixed(2)
          );
          const balPay = await createPOPayment({
            po_number: poNum,
            supplier_id: createPOSupplierId || null,
            title: inst.title.trim() || `دفعة المتبقي #${i + 1}`,
            amount: amt,
            due_date: inst.dueDate,
            status: 'scheduled',
            notes: cleanNotes || undefined,
          });
          createdPayments.push(balPay);
        }
      } else if (createPOPaymentType === 'full_credit') {
        for (let i = 0; i < createPOCreditInstallments.length; i++) {
          const inst = createPOCreditInstallments[i];
          const amt = Number(
            parseFloat(
              String(inst.amount)
                .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
                .trim()
            ).toFixed(2)
          );
          const credPay = await createPOPayment({
            po_number: poNum,
            supplier_id: createPOSupplierId || null,
            title: inst.title.trim() || `دفعة آجل #${i + 1}`,
            amount: amt,
            due_date: inst.dueDate,
            status: 'scheduled',
            notes: cleanNotes || undefined,
          });
          createdPayments.push(credPay);
        }
      }

      setPoPayments((prev) => [...prev, ...createdPayments]);

      // 4. Refresh PO list and check payment reminder workflow
      const freshPOs = await fetchPurchaseOrders();
      if (freshPOs && freshPOs.length > 0) {
        const merged = (freshPOs as unknown as PurchaseOrder[]).map((p) =>
          p.id === poNum
            ? {
                ...p,
                createdBy: p.createdBy || authUser.displayName,
                createdById: p.createdById || authUser.id,
                notes: p.notes || cleanNotes,
                payment_type: p.payment_type || createPOPaymentType,
              }
            : p
        );
        setPurchaseOrders(merged);
      } else {
        setPurchaseOrders((prev) => [createdPO, ...prev.filter((p) => p.id !== poNum)]);
      }

      void checkAndTriggerDuePaymentReminders({ [poNum]: createPOSupplierName }).catch(
        console.warn
      );

      setIsCreatePOModalOpen(false);
      showToast(
        `تم إصدار أمر الشراء (${poNum}) وجدولة (${toEnglishDigits(createdPayments.length)}) دفعة للمورد (${createPOSupplierName}) بنجاح!`
      );
    } catch (err: unknown) {
      console.error('Failed to create purchase order with payment schedule:', err);
      showError(
        `تعذر إصدار أمر الشراء: ${err instanceof Error ? err.message : 'خطأ في قاعدة البيانات'}`
      );
    } finally {
      setIsSubmittingQuickOrder(false);
    }
  };

  const handleUpdatePOStatus = (poId: string, nextStatus: PurchaseOrder['status']) => {
    const authUser = getAuthenticatedPOUser(session, lang);
    if (!authUser) {
      showError(
        lang === 'en'
          ? 'Unauthorized: Cannot execute or update a Purchase Order without an authenticated user session.'
          : 'عذراً، لا يمكن تنفيذ أو تحديث أمر الشراء بدون جلسة مستخدم موثقة. يرجى تسجيل الدخول أولاً.'
      );
      return;
    }

    const dbStatus = nextStatus === 'DELIVERED' ? 'تم الاستلام' : nextStatus;
    setPurchaseOrders(prev =>
      prev.map(p => (p.id === poId ? { ...p, status: dbStatus } : p))
    );
    updatePurchaseOrderStatus(poId, dbStatus).catch(console.warn);

    if (selectedPO && selectedPO.id === poId) {
      setSelectedPO({ ...selectedPO, status: dbStatus });
    }
    showToast(
      lang === 'en'
        ? `Purchase order (${poId}) executed by ${authUser.displayName} successfully`
        : `تم تحديث وتنفيذ أمر الشراء (${poId}) بواسطة (${authUser.displayName}) بنجاح`
    );
  };

  const handleOpenEditPO = async (targetOrder?: PurchaseOrder) => {
    const authUser = getAuthenticatedPOUser(session, lang);
    if (!authUser) {
      showError(
        lang === 'en'
          ? 'Unauthorized: Sign in required to modify Purchase Orders.'
          : 'عذراً، يجب تسجيل الدخول أولاً لتعديل أوامر الشراء.'
      );
      return;
    }
    const orderToEdit = targetOrder || selectedPO;
    if (!orderToEdit) return;
    if (targetOrder) {
      setSelectedPO(targetOrder);
    }

    const qty = Number(orderToEdit.quantity) || 1;
    const tot = Number(orderToEdit.totalCost) || 0;
    const derivedUnitPrice = qty > 0 && tot > 0 ? Number((tot / qty).toFixed(4)) : 0.5;

    setEditPOQuantity(qty);
    setEditPOUnitPrice(String(derivedUnitPrice));
    setEditPOTotalCost(String(tot));
    setEditPOExpectedDate(
      (orderToEdit as unknown as { expectedDeliveryDate?: string }).expectedDeliveryDate ||
        new Date().toISOString().split('T')[0]
    );
    setEditPOStatus(orderToEdit.status || 'PENDING_APPROVAL');
    setEditPOSupplier(orderToEdit.supplierName);
    setIsEditingPO(true);

    // Resolve the itemCode for the specific item being edited
    const itemCode = (
      orderToEdit.itemId ||
      availableItems.find(i =>
        i.item_name_ar === orderToEdit.itemName ||
        i.item_name_en === orderToEdit.itemName ||
        i.item_code === orderToEdit.itemId
      )?.item_code ||
      mockInventoryItems.find(i =>
        i.item_name_ar === orderToEdit.itemName ||
        i.item_name_en === orderToEdit.itemName ||
        i.item_code === orderToEdit.itemId
      )?.item_code ||
      ''
    ).trim().toUpperCase();

    // 1. Initial resolution from allSupplierItems & suppliers for instant zero-latency display
    const localMatches = allSupplierItems.filter(
      si => (si.inventory_item_code || '').trim().toUpperCase() === itemCode && si.is_available !== false
    );

    const initialList: Array<{ id: string; name: string }> = [];
    const seen = new Set<string>();

    for (const rel of localMatches) {
      const sup = suppliers.find(s => s.id === rel.supplier_id);
      const name = (lang === 'en' ? (sup?.name_en || sup?.name_ar || sup?.name) : (sup?.name_ar || sup?.name)) || rel.suppliers?.name_ar || '';
      if (name && !seen.has(name)) {
        seen.add(name);
        initialList.push({ id: rel.supplier_id, name });
      }
    }

    for (const sup of suppliers) {
      const name = (lang === 'en' ? (sup.name_en || sup.name_ar || sup.name) : (sup.name_ar || sup.name)) || '';
      if (name && !seen.has(name)) {
        seen.add(name);
        initialList.push({ id: sup.id, name });
      }
    }

    if (initialList.length > 0) {
      setPoAvailableSuppliers(initialList);
      if (!initialList.some(s => s.name === orderToEdit.supplierName)) {
        setEditPOSupplier(initialList[0].name);
      }
    } else if (orderToEdit.supplierName) {
      setPoAvailableSuppliers([{ id: orderToEdit.supplier_id || orderToEdit.supplierId || 'curr', name: orderToEdit.supplierName }]);
    }

    // 2. Dynamic fetch directly from Supabase supplier_items junction table
    if (itemCode) {
      setIsLoadingPOSuppliers(initialList.length === 0);
      try {
        const dbSuppliers = await fetchSuppliersForItem(itemCode);
        if (dbSuppliers && dbSuppliers.length > 0) {
          const mergedSuppliers = [...dbSuppliers];
          for (const existing of initialList) {
            if (!mergedSuppliers.some(m => m.name === existing.name)) {
              mergedSuppliers.push(existing);
            }
          }
          setPoAvailableSuppliers(mergedSuppliers);
        }
      } catch (err) {
        console.error('Failed to fetch suppliers for PO item:', err);
      } finally {
        setIsLoadingPOSuppliers(false);
      }
    }
  };

  const handleSavePOEdit = async () => {
    const authUser = getAuthenticatedPOUser(session, lang);
    if (!authUser) {
      showError(
        lang === 'en'
          ? 'Unauthorized: Sign in required to save Purchase Order changes.'
          : 'عذراً، يجب تسجيل الدخول أولاً لحفظ تعديلات أمر الشراء.'
      );
      return;
    }
    if (!selectedPO || isSavingPOEdit) return;

    const parsedTotal = parseFloat(
      String(editPOTotalCost)
        .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .trim()
    );
    const parsedUnit = parseFloat(
      String(editPOUnitPrice)
        .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .trim()
    );
    const validUnitCost = !isNaN(parsedUnit) && parsedUnit >= 0 ? parsedUnit : 0.5;
    const newTotalCost =
      !isNaN(parsedTotal) && parsedTotal >= 0
        ? Number(parsedTotal.toFixed(4))
        : Number((editPOQuantity * validUnitCost).toFixed(4));

    const matchedSupplier =
      poAvailableSuppliers.find(s => s.name === editPOSupplier) ||
      suppliers.find(s => s.name_ar === editPOSupplier || s.name_en === editPOSupplier || s.name === editPOSupplier);
    const nextSupplierId = matchedSupplier?.id || selectedPO.supplier_id || selectedPO.supplierId || null;

    setIsSavingPOEdit(true);
    try {
      await updatePurchaseOrderDetails({
        po_number: selectedPO.id,
        quantity: editPOQuantity,
        total_cost: newTotalCost,
        supplier_id: nextSupplierId,
        supplierName: editPOSupplier,
        status: editPOStatus,
      });

      const updatedPO: PurchaseOrder = {
        ...selectedPO,
        quantity: editPOQuantity,
        supplierName: editPOSupplier,
        supplier_id: nextSupplierId || undefined,
        supplierId: nextSupplierId || undefined,
        totalCost: newTotalCost,
        status: editPOStatus as PurchaseOrder['status'],
      };

      setPurchaseOrders(prev => prev.map(p => p.id === selectedPO.id ? updatedPO : p));
      setSelectedPO(updatedPO);
      setIsEditingPO(false);
      showToast(
        lang === 'en'
          ? `Purchase order (${updatedPO.id}) updated in Supabase successfully`
          : `تم حفظ تعديلات أمر الشراء (${updatedPO.id}) في قاعدة البيانات بنجاح`
      );
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر حفظ تعديلات أمر الشراء.');
    } finally {
      setIsSavingPOEdit(false);
    }
  };

  const handleConfirmDeletePO = async () => {
    if (!poToDelete || isDeletingPO) return;
    setIsDeletingPO(true);
    try {
      await deletePurchaseOrder(poToDelete.id);
      setPurchaseOrders(prev => prev.filter(p => p.id !== poToDelete.id));
      if (selectedPO?.id === poToDelete.id) {
        setSelectedPO(null);
        setIsEditingPO(false);
      }
      showToast(
        lang === 'en'
          ? `Purchase order (${poToDelete.id}) deleted permanently`
          : `تم حذف أمر الشراء (${poToDelete.id}) نهائياً بنجاح`
      );
      setPoToDelete(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر حذف أمر الشراء.');
    } finally {
      setIsDeletingPO(false);
    }
  };

  const handleConfirmCompleteAndReceivePO = async () => {
    if (!poToComplete || isCompletingPO) return;

    const authUser = getAuthenticatedPOUser(session, lang);
    if (!authUser) {
      showError(
        lang === 'en'
          ? 'Unauthorized: Sign in required to complete and receive Purchase Orders.'
          : 'عذراً، يجب تسجيل الدخول أولاً لاستلام وإغلاق أمر الشراء.'
      );
      return;
    }

    const receivedUnits = Math.max(1, Number(poToComplete.quantity) || 1);
    const receivedTimestamp = new Date().toISOString();

    setIsCompletingPO(true);
    try {
      // ONLY update the Purchase Order in public.purchase_orders to status = 'completed' with received_at
      // DO NOT modify main_stock or current_stock in public.inventory_items or insert into inventory_adjustments
      await updatePurchaseOrderStatus(poToComplete.id, 'completed', receivedTimestamp);

      // Immediately update local purchaseOrders state to move order from active tracker to supplier archive
      setPurchaseOrders((prev) =>
        prev.map((p) =>
          p.id === poToComplete.id
            ? {
                ...p,
                status: 'completed' as PurchaseOrder['status'],
                receivedAt: receivedTimestamp,
                receivedQuantity: receivedUnits,
              }
            : p
        )
      );

      if (selectedPO?.id === poToComplete.id) {
        setSelectedPO(null);
        setIsEditingPO(false);
      }
      setPoToComplete(null);

      showToast(
        lang === 'en'
          ? `Order (${poToComplete.id}) confirmed as received, closed, and moved to supplier archive (${poToComplete.supplierName})`
          : `تم تأكيد استلام وإغلاق أمر الشراء (${poToComplete.id}) ونقله إلى أرشيف المورد (${poToComplete.supplierName}) بنجاح`
      );
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'تعذر استلام وإغلاق أمر الشراء.');
    } finally {
      setIsCompletingPO(false);
    }
  };

  // Supplier Add & Edit Handlers
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: '',
      name_en: '',
      city: 'جدة',
      city_en: 'Jeddah',
      rating: 4.8,
      delivery_time_hours: 24,
      category: 'تغليف ومستلزمات تشغيل',
      phone: '+966 12 654 3210',
      phone_number: '+966 12 654 3210',
      pricingTier: 'أسعار جملة معتمدة',
      cr_number: '',
      tax_number: '',
    });
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (sup: SupabaseSupplier) => {
    setEditingSupplier(sup);
    const phoneVal = sup.phone_number || sup.phone || '+966 12 654 3210';
    setSupplierForm({
      name: sup.name_ar || sup.name || '',
      name_en: sup.name_en || '',
      city: sup.location_ar || sup.city || 'جدة',
      city_en: sup.location_en || 'Jeddah',
      rating: sup.rating || 4.8,
      delivery_time_hours: sup.delivery_time_hours || 24,
      category: sup.category || 'تغليف ومستلزمات تشغيل',
      phone: phoneVal,
      phone_number: phoneVal,
      pricingTier: sup.pricingTier || 'أسعار جملة معتمدة',
      cr_number: sup.cr_number || '',
      tax_number: sup.tax_number || '',
    });
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim() || isSavingSupplier) return;

    setIsSavingSupplier(true);
    const hours = Number(supplierForm.delivery_time_hours) || 24;
    const ratingVal = parseFloat(String(supplierForm.rating)) || 4.8;
    const phoneVal = supplierForm.phone_number || supplierForm.phone || '+966 12 654 3210';

    try {
      if (editingSupplier) {
        // Edit existing supplier in Supabase
        const updatedSupFromDB = await updateSupplier(editingSupplier.id, {
          name_ar: supplierForm.name,
          name_en: supplierForm.name_en || supplierForm.name,
          delivery_time_hours: hours,
          rating: ratingVal,
          location_ar: supplierForm.city,
          location_en: supplierForm.city_en || 'Jeddah',
          category: supplierForm.category,
          phone: phoneVal,
          phone_number: phoneVal,
          pricingTier: supplierForm.pricingTier,
          cr_number: supplierForm.cr_number || null,
          tax_number: supplierForm.tax_number || null,
        });

        setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? updatedSupFromDB : s));
        showToast(
          lang === 'en'
            ? `Supplier (${updatedSupFromDB.name_en || updatedSupFromDB.name}) updated successfully`
            : `تم تعديل بيانات المورد (${updatedSupFromDB.name_ar || updatedSupFromDB.name}) بنجاح`
        );
      } else {
        // Add new supplier to Supabase
        const newSupFromDB = await addSupplier({
          name_ar: supplierForm.name,
          name_en: supplierForm.name_en || supplierForm.name,
          delivery_time_hours: hours,
          rating: ratingVal,
          location_ar: supplierForm.city,
          location_en: supplierForm.city_en || 'Jeddah',
          category: supplierForm.category,
          phone: phoneVal,
          phone_number: phoneVal,
          pricingTier: supplierForm.pricingTier,
          cr_number: supplierForm.cr_number || null,
          tax_number: supplierForm.tax_number || null,
        });

        setSuppliers(prev => sortSuppliersByDefault([newSupFromDB, ...prev]));
        showToast(
          lang === 'en'
            ? `New supplier (${newSupFromDB.name_en || newSupFromDB.name}) added to database successfully`
            : `تمت إضافة المورد الجديد (${newSupFromDB.name_ar || newSupFromDB.name}) بنجاح`
        );
      }
      setIsSupplierModalOpen(false);
    } catch (err: unknown) {
      console.error('Error saving supplier to Supabase:', err);
      // Fallback local update if network issue occurs, but notify user
      if (editingSupplier) {
        const localUpdated: SupabaseSupplier = {
          ...editingSupplier,
          name_ar: supplierForm.name,
          name_en: supplierForm.name_en || supplierForm.name,
          name: supplierForm.name,
          city: supplierForm.city,
          location_ar: supplierForm.city,
          location_en: supplierForm.city_en || 'Jeddah',
          rating: ratingVal,
          delivery_time_hours: hours,
          leadTime: `${hours} ساعة`,
          category: supplierForm.category,
          phone: phoneVal,
          phone_number: phoneVal,
          pricingTier: supplierForm.pricingTier,
          cr_number: supplierForm.cr_number || null,
          tax_number: supplierForm.tax_number || null,
        };
        setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? localUpdated : s));
      } else {
        const localNew: SupabaseSupplier = {
          id: `sup-${Date.now()}`,
          name: supplierForm.name,
          name_ar: supplierForm.name,
          name_en: supplierForm.name_en || supplierForm.name,
          delivery_time_hours: hours,
          leadTime: `${hours} ساعة`,
          rating: ratingVal,
          location_ar: supplierForm.city,
          location_en: supplierForm.city_en || 'Jeddah',
          city: supplierForm.city,
          category: supplierForm.category || 'تغليف ومستلزمات تشغيل',
          phone: phoneVal,
          phone_number: phoneVal,
          pricingTier: supplierForm.pricingTier || 'أسعار جملة معتمدة',
          cr_number: supplierForm.cr_number || null,
          tax_number: supplierForm.tax_number || null,
        };
        setSuppliers(prev => sortSuppliersByDefault([localNew, ...prev]));
      }
      showToast(
        lang === 'en'
          ? 'Supplier updated (local fallback notice)'
          : 'تم تحديث المورد محلياً (تنبيه تعذر اتصال Supabase)'
      );
      setIsSupplierModalOpen(false);
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const selectedItem = availableItems.find(i => i.item_code === analyzingItemId) || availableItems[0];

  // BUG 2 FIX: Dynamic Price Comparison strictly filtered from Supabase database relations
  // Removes hardcoded supplier cards; ONLY renders suppliers who actually have a relation to the selected item in Supabase
  const currentQuotes: SupplierQuote[] = useMemo(() => {
    if (!analyzingItemId) return [];

    // Filter relations from Supabase supplier_items strictly matching analyzingItemId
    const matchingRelations = allSupplierItems.filter(
      si => si.inventory_item_code === analyzingItemId && si.is_available !== false
    );

    return matchingRelations.map(rel => {
      const sup = (suppliers.find(s => s.id === rel.supplier_id) || rel.suppliers) as any;
      const supName = sup?.name_ar || sup?.name || rel.suppliers?.name_ar || 'المورد المعتمد';
      const unitPrice = Number(rel.price ?? sup?.cost_per_unit ?? 0.45);
      const leadTimeHours = Number(sup?.delivery_time_hours || (sup?.lead_time_days ? sup.lead_time_days * 24 : 24));
      const qualityRating = Number(sup?.rating || 4.8);

      // Check if curated analysis text exists for this supplier in mock data
      const mockQuote = (supplierQuotesMatrix[analyzingItemId] || []).find(
        q => q.supplierId === rel.supplier_id || q.supplierName === supName
      );

      const aiRecommendationScore = mockQuote?.aiRecommendationScore ??
        Math.min(99, Math.max(82, Math.round(92 - (unitPrice * 5) + (qualityRating * 2))));

      const aiReasoning = mockQuote?.aiReasoning ?? (
        lang === 'en'
          ? `Officially certified supplier in database for (${selectedItem?.item_name_en || selectedItem?.item_name_ar || analyzingItemId}) with verified delivery within ${leadTimeHours}h.`
          : `المورد المعتمد رسمياً في قاعدة البيانات لتوريد (${selectedItem?.item_name_ar || analyzingItemId}) بجودة موثوقة (${qualityRating}/5) وتسليم خلال ${leadTimeHours} ساعة.`
      );

      return {
        supplierId: rel.supplier_id,
        supplierName: supName,
        unitPrice,
        leadTimeHours,
        minOrderQuantity: mockQuote?.minOrderQuantity || 1000,
        qualityRating,
        aiRecommendationScore,
        aiReasoning,
      };
    });
  }, [analyzingItemId, allSupplierItems, suppliers, selectedItem, lang]);

  const bestQuote = currentQuotes.length > 0
    ? [...currentQuotes].sort((a, b) => b.aiRecommendationScore - a.aiRecommendationScore)[0]
    : null;

  // BUG 1 FIX: Filter out received orders and strictly deduplicate by ID
  // Guarantees no duplicate React keys and that displayedActivePOs reflects the single true state from Supabase
  const activePOs = useMemo(() => {
    const seen = new Set<string>();
    return purchaseOrders.filter(po => {
      if (!po || !po.id) return false;
      const status = (po.status || '').trim();
      const lower = status.toLowerCase();
      const isNotReceived = (
        status !== 'تم الاستلام' &&
        status !== 'تم الاستلام بنجاح' &&
        status !== 'مكتمل' &&
        lower !== 'completed' &&
        lower !== 'received' &&
        lower !== 'delivered'
      );
      if (!isNotReceived) return false;
      if (seen.has(po.id)) return false;
      seen.add(po.id);
      return true;
    });
  }, [purchaseOrders]);

  const filteredActivePOs = useMemo(() => {
    return activePOs.filter(po => {
      if (activeStatusFilter === 'ALL') return true;
      return po.status === activeStatusFilter;
    });
  }, [activePOs, activeStatusFilter]);

  const displayedActivePOs = filteredActivePOs;

  // Calculate active stats
  const pendingCount = activePOs.filter(p => p.status === 'PENDING_APPROVAL').length;
  const inTransitCount = activePOs.filter(p => p.status === 'IN_TRANSIT').length;
  const sentCount = activePOs.filter(p => p.status === 'SENT').length;

  // Due & Upcoming Scheduled Payments (due_date <= today + 3 days and status === 'scheduled')
  const dueOrUpcomingPayments = useMemo(() => {
    const cutoff = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return poPayments
      .filter((pay) => pay.status === 'scheduled' && pay.due_date && pay.due_date <= cutoff)
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
  }, [poPayments]);

  return (
    <div className="page-shell w-full mx-auto space-y-8 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-white/20 shadow-2xl text-white px-6 py-3.5 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-5 h-5 text-white" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Auth / Error Toast Notification */}
      {errorToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-rose-950/95 border border-rose-400/50 shadow-2xl text-rose-100 px-6 py-3.5 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" />
          <span className="text-sm font-bold">{errorToast}</span>
        </div>
      )}

      {/* Database Status Alert Banner */}
      {fetchError && (
        <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
          <div>
            <div className="font-bold">
              {lang === 'en' ? 'Supabase Connection Notice' : 'تنبيه اتصال قاعدة بيانات Supabase'}
            </div>
            <div className="text-xs opacity-90">{fetchError}</div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="glass-panel bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white/65">
              <Truck className="w-6 h-6" />
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
              {t('suppliers.title')}
            </h1>
          </div>
          <p className="text-slate-100 font-semibold text-sm mt-1.5 drop-shadow-sm">
            {t('suppliers.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Manual Trigger for Finance & Manager Payment Reminders */}
          <button
            type="button"
            onClick={() => void loadAllPOPaymentsAndReminders(true)}
            disabled={isCheckingReminders}
            className="bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 active:scale-95 text-amber-100 font-bold px-4 py-2.5 rounded-xl transition-all text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="فحص الدفعات المستحقة خلال 3 أيام وإصدار تذاكر تذكير للمالية والإدارة"
          >
            {isCheckingReminders ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
            ) : (
              <Bell className="w-4 h-4 text-amber-300" />
            )}
            <span>{lang === 'en' ? 'Check Reminders Now' : 'فحص التذكيرات الآن'}</span>
          </button>

          {/* Add Supplier Button */}
          <button
            onClick={handleOpenAddSupplier}
            className="bg-white/10 hover:bg-white/20 border border-white/20 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'en' ? 'Add New Supplier +' : 'إضافة مورد جديد +'}</span>
          </button>

          <Link
            href="/inventory"
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-4 py-2.5 rounded-xl transition-all text-sm flex items-center gap-2 group cursor-pointer"
          >
            <Package className="w-4 h-4 text-white/65 group-hover:scale-110 transition-transform" />
            <span>{lang === 'en' ? 'Back to Inventory' : 'العودة للمخزون'}</span>
            <ChevronRight className={`w-4 h-4 text-white/65 ${lang === 'ar' ? 'rotate-180' : ''}`} />
          </Link>
        </div>
      </header>

      {/* Due Scheduled Payments Banner (تنبيهات الدفعات المستحقة خلال 3 أيام أو متأخرة) */}
      {dueOrUpcomingPayments.length > 0 && (
        <section className="glass-card bg-amber-950/35 backdrop-blur-md border border-amber-400/40 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-400/20 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                  <span>تنبيهات الدفعات المستحقة (خلال 3 أيام أو متأخرة)</span>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/25 border border-amber-300/40 text-amber-200">
                    {toEnglishDigits(dueOrUpcomingPayments.length)}
                  </span>
                </h3>
                <p className="text-xs text-amber-200/80">
                  يتم إصدار تذاكر تذكير عالية الأولوية تلقائياً لقسم المالية والإدارة للدفعات المستحقة
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadAllPOPaymentsAndReminders(true)}
              disabled={isCheckingReminders}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer disabled:opacity-50"
            >
              {isCheckingReminders ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
              ) : (
                <Bell className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>فحص التذكيرات الآن</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dueOrUpcomingPayments.map((pay) => {
              const linkedPO = purchaseOrders.find((p) => p.id === pay.po_number);
              const matchedSup = suppliers.find((s) => s.id === pay.supplier_id);
              const supName =
                pay.suppliers?.name_ar ||
                matchedSup?.name_ar ||
                linkedPO?.supplierName ||
                'المورد المعتمد';
              const todayStr = new Date().toISOString().split('T')[0];
              const isOverdue = pay.due_date < todayStr;

              return (
                <div
                  key={pay.id}
                  className="bg-black/35 border border-amber-400/30 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-extrabold text-amber-200 bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 rounded-md" dir="ltr">
                        {toEnglishDigits(pay.po_number)}
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-white">
                        {supName} — {pay.title}
                      </span>
                      {pay.reminder_ticket_created && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-200">
                          تم إرسال تذكرة للمالية
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/75 flex items-center gap-3 flex-wrap">
                      <span>
                        المبلغ:{' '}
                        <strong className="font-mono text-emerald-300">
                          {toEnglishDigits(pay.amount.toLocaleString('en-US'))} ر.س
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        تاريخ الاستحقاق:{' '}
                        <strong className={`font-mono ${isOverdue ? 'text-rose-300' : 'text-amber-200'}`} dir="ltr">
                          {toEnglishDigits(pay.due_date)}
                        </strong>{' '}
                        {isOverdue ? '(متأخرة)' : '(مستحقة قريباً)'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentToSettle(pay);
                      setReceiptFileToUpload(null);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-extrabold border border-emerald-300/40 shadow-md transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>سداد وإرفاق إيصال</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Storage Bucket Setup Alert Notice */}
      {storageNotice && (
        <div className="p-4 rounded-2xl border border-amber-400/50 bg-amber-500/10 text-amber-200 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
            <span className="font-bold">{storageNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStorageNotice(null)}
            className="text-white/60 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Supplier Network Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass-card bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] hover:bg-white/[0.09] hover:border-white/[0.32] rounded-2xl p-6 flex items-center justify-between transition-all duration-200">
          <div>
            <div className="text-xs font-semibold text-slate-100 drop-shadow-sm">
              {lang === 'en' ? 'Registered Suppliers' : 'إجمالي الموردين المعتمدين'}
            </div>
            <div className="text-3xl font-bold text-white tracking-wider font-mono mt-1 drop-shadow-sm">
              {toEnglishDigits(suppliers.length)}
            </div>
            <div className="text-[11px] text-teal-200/90 mt-0.5">
              {lang === 'en' ? 'Active Network Partners' : 'شركاء سلاسل إمداد زاهي'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white/65">
            <Building2 className="w-6 h-6 text-teal-200" />
          </div>
        </div>

        <div className="glass-card bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] hover:bg-white/[0.09] hover:border-white/[0.32] rounded-2xl p-6 flex items-center justify-between transition-all duration-200">
          <div>
            <div className="text-xs font-semibold text-slate-100 drop-shadow-sm">
              {lang === 'en' ? 'Avg. Delivery Lead Time' : 'متوسط سرعة التوريد'}
            </div>
            <div className="text-3xl font-bold text-white tracking-wider font-mono mt-1 drop-shadow-sm">
              {toEnglishDigits(
                suppliers.length > 0
                  ? Math.round(suppliers.reduce((acc, s) => acc + (s.delivery_time_hours || 24), 0) / suppliers.length)
                  : 24
              )}{' '}
              <span className="text-sm font-normal text-white/60">{lang === 'en' ? 'hrs' : 'ساعة'}</span>
            </div>
            <div className="text-[11px] text-white/70 font-medium mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{lang === 'en' ? 'Standard Express Dispatch' : 'جاهزية توريد فورية'}</span>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white/65">
            <Clock className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="glass-card bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] hover:bg-white/[0.09] hover:border-white/[0.32] rounded-2xl p-6 flex items-center justify-between transition-all duration-200">
          <div>
            <div className="text-xs font-semibold text-slate-100 drop-shadow-sm">
              {lang === 'en' ? 'Network Quality Score' : 'متوسط تقييم الجودة'}
            </div>
            <div className="text-3xl font-bold text-white tracking-wider font-mono mt-1">
              {toEnglishDigits(
                suppliers.length > 0
                  ? (suppliers.reduce((acc, s) => acc + (s.rating || 4.5), 0) / suppliers.length).toFixed(1)
                  : '4.8'
              )}{' '}
              <span className="text-sm font-normal text-white/60">/ 5</span>
            </div>
            <div className="text-[11px] text-emerald-300 mt-0.5">
              {lang === 'en' ? 'Certified Quality Standards' : 'مطابقة لمعايير الجودة المعتمدة'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-emerald-300">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 1. Active Purchase Orders Tracker */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl">
              <Layers className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {lang === 'en' ? 'Purchase Orders Tracker' : 'لوحة تتبع أوامر الشراء'}
              </h2>
              <p className="text-xs text-white/80">
                {lang === 'en'
                  ? 'Real-time tracking of active orders (received orders are automatically archived in Supplier Profiles)'
                  : 'متابعة آنية للأوامر الجارية (تُنقل الأوامر المكتملة تلقائياً إلى أرشيف ملف المورد)'}
              </p>
            </div>
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/20 p-1.5 rounded-xl overflow-x-auto">
            {[
              { id: 'ALL', label: lang === 'en' ? 'All Active' : 'الكل النشط', count: activePOs.length },
              { id: 'PENDING_APPROVAL', label: lang === 'en' ? 'Pending' : 'بانتظار الموافقة', count: activePOs.filter(p => p.status === 'PENDING_APPROVAL').length },
              { id: 'SENT', label: lang === 'en' ? 'Sent' : 'تم الإرسال', count: activePOs.filter(p => p.status === 'SENT').length },
              { id: 'IN_TRANSIT', label: lang === 'en' ? 'In Transit' : 'جاري التوصيل', count: activePOs.filter(p => p.status === 'IN_TRANSIT').length },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeStatusFilter === tab.id
                    ? 'text-white bg-white/20 border border-white/20'
                    : 'text-white/80 hover:text-white hover:bg-white/15'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  activeStatusFilter === tab.id ? 'bg-teal-600/15 text-teal-100' : 'bg-white/8 text-white/80 border border-white/20'
                }`}>
                  {toEnglishDigits(tab.count)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* PO Table */}
        <div className="glass-card bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-white">
              <thead className="bg-white/8 text-white/80 text-xs font-bold border-b border-white/20">
                <tr>
                  <th className="px-4 py-3.5 text-center font-bold">{lang === 'en' ? 'PO #' : 'رقم الأمر'}</th>
                  <th className="px-4 py-3.5 text-center font-bold">{lang === 'en' ? 'Item' : 'الصنف المطلوب'}</th>
                  <th className="px-4 py-3.5 text-center font-bold">{lang === 'en' ? 'Assigned Supplier' : 'المورد المعتمد'}</th>
                  <th className="px-4 py-3.5 text-center font-bold">{lang === 'en' ? 'Quantity' : 'الكمية'}</th>
                  <th className="px-4 py-3.5 text-center font-bold">{lang === 'en' ? 'Estimated Cost' : 'التكلفة التقديرية'}</th>
                  <th className="px-4 py-3.5 text-center font-bold">{lang === 'en' ? 'Origin' : 'المُنشئ'}</th>
                  <th className="px-4 py-3.5 text-center font-bold">{lang === 'en' ? 'Created At' : 'توقيت الإنشاء'}</th>
                  <th className="px-4 py-3.5 text-center font-bold">{lang === 'en' ? 'Live Status' : 'الحالة الحركية'}</th>
                  <th className="px-4 py-3.5 text-center font-bold">{lang === 'en' ? 'Action' : 'إجراء'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/15">
                {displayedActivePOs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-white/65 text-sm">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="w-8 h-8 text-white/30" />
                        <span className="font-bold text-white/80">
                          {lang === 'en' ? 'No active orders pending receipt' : 'لا توجد أوامر شراء نشطة حالياً'}
                        </span>
                        <span className="text-xs text-white/50">
                          {lang === 'en'
                            ? 'Received orders are archived inside their respective Supplier Profiles'
                            : 'الأوامر المستلمة تم أرشفتها تلقائياً داخل ملف المورد المعتمد'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedActivePOs.map((po) => {
                      return (
                        <tr
                          key={po.id}
                          className="hover:bg-white/15 transition-colors group"
                        >
                          {/* ID */}
                          <td className="px-4 py-3.5 font-mono font-bold text-white text-center">
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPO(po);
                                  setIsEditingPO(false);
                                }}
                                className="hover:underline decoration-white/50 inline-flex items-center gap-1 group/btn cursor-pointer"
                                title={lang === 'en' ? 'View PO details' : 'عرض تفاصيل أمر الشراء'}
                              >
                                <span dir="ltr" lang="en">{toEnglishDigits(po.id)}</span>
                                <ExternalLink className="w-3 h-3 text-white/65 opacity-70 group-hover/btn:opacity-100 transition-opacity" />
                              </button>
                            </div>
                          </td>

                          {/* Item Name */}
                          <td className="px-4 py-3.5 font-bold text-white text-center">
                            {po.itemName}
                          </td>

                          {/* Supplier Name */}
                          <td className="px-4 py-3.5 text-white/80 font-medium text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Building2 className="w-4 h-4 text-white/65 shrink-0" />
                              <span>{po.supplierName}</span>
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="px-4 py-3.5 font-bold text-white font-mono text-center" dir="ltr" lang="en">
                            {toEnglishDigits(po.quantity.toLocaleString('en-US'))}
                          </td>

                          {/* Total Cost */}
                          <td className="px-4 py-3.5 font-bold text-white font-mono text-center" dir="ltr" lang="en">
                            <span>{toEnglishDigits(po.totalCost.toLocaleString('en-US'))}</span>{' '}
                            <span className="text-xs font-normal text-white/70">{lang === 'en' ? 'SAR' : 'ر.س'}</span>
                          </td>

                          {/* Created By (Clean Authenticated User Display Name Only) */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex items-center justify-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[18px] text-xs font-bold bg-white/10 backdrop-blur-md border border-white/20 text-white">
                                <User className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                                <span>{formatPOCreatorDisplay(po.createdBy, authenticatedUser)}</span>
                              </span>
                            </div>
                          </td>

                          {/* Created At */}
                          <td className="px-4 py-3.5 text-xs text-white/80 font-medium font-mono text-center" dir="ltr" lang="en">
                            {toEnglishDigits(po.createdAt)}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex items-center justify-center">
                              {po.status === 'PENDING_APPROVAL' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 border border-rose-400/30 text-rose-200">
                                  <Clock className="w-3.5 h-3.5 text-rose-200 animate-pulse" />
                                  <span>{lang === 'en' ? 'Pending Approval' : 'بانتظار الموافقة'}</span>
                                </span>
                              )}

                              {po.status === 'SENT' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-600/15 border border-teal-300/30 text-teal-100">
                                  <motion.div
                                    animate={{ y: [0, -3, 0] }}
                                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                  >
                                    <Mail className="w-3.5 h-3.5 text-white" />
                                  </motion.div>
                                  <span>{lang === 'en' ? 'Email Dispatched' : 'تم إرسال الإيميل'}</span>
                                </span>
                              )}

                              {po.status === 'IN_TRANSIT' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-200">
                                  <Loader2 className="w-3.5 h-3.5 text-amber-200 animate-spin" />
                                  <span>{lang === 'en' ? 'In Transit' : 'جاري التوصيل'}</span>
                                </span>
                              )}

                              {po.status === 'APPROVED' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-600/15 border border-teal-300/30 text-teal-100">
                                  <BadgeCheck className="w-3.5 h-3.5 text-white" />
                                  <span>{lang === 'en' ? 'Approved' : 'معتمد'}</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Action Quick Button: Details Only */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPO(po);
                                  setIsEditingPO(false);
                                }}
                                className="text-xs font-bold text-white bg-white/8 hover:bg-white/15 border border-white/20 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                              >
                                {lang === 'en' ? 'Details' : 'التفاصيل'}
                              </button>
                            </div>
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

      {/* 2. Smart Bidding Comparison */}
      <section className="glass-card bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl p-6 space-y-6">
        <div className="border-b border-white/20 pb-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-[18px] bg-white/10 backdrop-blur-md border border-white/20 text-white">
                  <Bot className="w-5 h-5" />
                </span>
                <h2 className="text-xl font-bold text-white">
                  {lang === 'en' ? 'Price Comparison' : 'مقارنة الأسعار'}
                </h2>
              </div>
              <p className="text-xs text-white/80 mt-1">
                {lang === 'en'
                  ? 'Side-by-side supplier quote comparison (Express vs Wholesale) with AI recommendations'
                  : 'مقارنة أسعار الموردين جنباً إلى جنب (مورد سريع vs مورد جملة) وتوصيات الوكيل الذكي'}
              </p>
            </div>

            <div className="text-xs font-semibold text-white bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-1.5 rounded-[18px] self-start sm:self-auto flex items-center gap-2">
              <span>{lang === 'en' ? 'Available Items for Comparison:' : 'أصناف متاحة للمقارنة:'}</span>
              <span className="font-extrabold text-teal-100 bg-teal-600/15 border border-teal-300/30 px-2 py-0.5 rounded-md font-mono">
                {toEnglishDigits(availableItems.length)}
              </span>
            </div>
          </div>

          {/* Item Selector Dropdown */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-[18px]">
            <label htmlFor="compare-item-select" className="text-xs font-bold text-white/90 shrink-0 px-1 flex items-center gap-2">
              <Package className="w-4 h-4 text-white" />
              <span>{lang === 'en' ? 'Choose item to compare:' : 'اختر صنفاً للمقارنة:'}</span>
            </label>
            <div className="w-full sm:w-80">
              <select
                id="compare-item-select"
                value={analyzingItemId || ''}
                onChange={(e) => handleAnalyzeQuotes(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white outline-none cursor-pointer"
              >
                {availableItems.map(item => {
                  const code = item.item_code;
                  const name = lang === 'en' ? (item.item_name_en || item.item_name_ar) : item.item_name_ar;
                  return (
                    <option key={code} value={code} className="bg-slate-900 text-white py-1">
                      {name} ({code})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Selected Item Bidding Matrix */}
        {selectedItem && (
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                <span className="text-white/80">
                  {lang === 'en' ? 'Available quotes for:' : 'عروض الأسعار المتاحة لصنف:'}
                </span>
                <span className="text-teal-100 font-extrabold text-base bg-teal-600/15 border border-teal-300/30 px-3 py-1 rounded-[18px]">
                  {lang === 'en' ? (selectedItem.item_name_en || selectedItem.item_name_ar) : selectedItem.item_name_ar}
                </span>
                <span className="text-xs text-white/80 font-semibold bg-white/10 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-[18px] font-mono">
                  {lang === 'en' ? 'Current Stock:' : 'المخزون الحالي:'} {toEnglishDigits((selectedItem.current_stock ?? 0).toLocaleString('en-US'))} / {lang === 'en' ? 'Reorder Level:' : 'الحد الأدنى:'} {toEnglishDigits((selectedItem.reorder_level ?? 0).toLocaleString('en-US'))}
                </span>
              </div>

              {bestQuote && (
                <div className="bg-teal-600/15 border border-teal-300/30 text-teal-100 px-3.5 py-1.5 rounded-[18px] text-xs font-bold flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </motion.div>
                  <span>{lang === 'en' ? 'AI Recommended Choice:' : 'التوصية الذكية المعتمدة:'}</span>
                  <span className="font-extrabold text-white">{bestQuote.supplierName}</span>
                  <span className="text-[10px] bg-white/10 backdrop-blur-md border border-white/20 px-1.5 py-0.5 rounded text-white/80 font-semibold">
                    {lang === 'en' ? 'Match' : 'مطابقة'} {toEnglishDigits(bestQuote.aiRecommendationScore)}%
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
                      className={`glass-card bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] hover:bg-white/[0.09] hover:border-white/[0.32] rounded-2xl p-6 transition-all flex flex-col justify-between relative ${
                        isBest
                          ? 'ring-2 ring-white/25 '
                          : ''
                      }`}
                    >
                      {/* Floating Badge for Best AI Choice */}
                      {isBest && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-teal-600/15 border border-teal-300/30 text-teal-100 text-xs font-bold px-3.5 py-1 rounded-full flex items-center gap-1.5 z-10 whitespace-nowrap ">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                          >
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                          </motion.div>
                          <span>{lang === 'en' ? 'AI Agent Pick' : 'توصية الـ AI Agent'}</span>
                        </div>
                      )}

                      <div className="space-y-3 pt-1">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-white text-base flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-white shrink-0" />
                              <span>{quote.supplierName}</span>
                            </h4>
                            <span className="text-[11px] text-white/80">
                              {quote.leadTimeHours <= 18
                                ? (lang === 'en' ? 'Express Supplier (Instant)' : 'مورد سريع (توريد فوري)')
                                : quote.leadTimeHours <= 24
                                ? (lang === 'en' ? 'Certified Supplier (Direct)' : 'مورد معتمد (مباشر)')
                                : (lang === 'en' ? 'Wholesale Supplier (Bulk)' : 'مورد جملة (كميات كبيرة)')}
                            </span>
                          </div>
                        </div>

                        {/* Specs Card */}
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-[18px] space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-white/80">{lang === 'en' ? 'Unit Price:' : 'سعر الوحدة:'}</span>
                            <span className="font-extrabold text-white text-lg font-mono">
                              {toEnglishDigits(quote.unitPrice)} {lang === 'en' ? 'SAR' : 'ر.س'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-white/80 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-white/65" />
                              <span>{lang === 'en' ? 'Delivery Time:' : 'مدة التوصيل:'}</span>
                            </span>
                            <span className="font-bold text-white font-mono">
                              {toEnglishDigits(quote.leadTimeHours)} {lang === 'en' ? 'hours' : 'ساعة'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-white/80 flex items-center gap-1">
                              <Package className="w-3 h-3 text-white/65" />
                              <span>{lang === 'en' ? 'Min Order Qty:' : 'الحد الأدنى للطلب:'}</span>
                            </span>
                            <span className="font-bold text-white font-mono">
                              {toEnglishDigits(quote.minOrderQuantity.toLocaleString('en-US'))} {lang === 'en' ? 'units' : 'وحدة'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-white/80 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-white/65" />
                              <span>{lang === 'en' ? 'Quality Score:' : 'مؤشر الجودة:'}</span>
                            </span>
                            <span className="font-bold text-white font-mono">
                              {toEnglishDigits(quote.qualityRating)} / 5
                            </span>
                          </div>
                        </div>

                        {/* AI Reasoning */}
                        <div className="text-xs text-white/80 leading-relaxed bg-white/10 backdrop-blur-md border border-white/20 p-3.5 rounded-[18px]">
                          <strong className="text-white flex items-center gap-1 text-[11px] mb-1 font-bold">
                            <Bot className="w-3.5 h-3.5 text-white" />
                            <span>{lang === 'en' ? 'AI Agent Analysis:' : 'تحليل الوكيل الذكي:'}</span>
                          </strong>
                          {quote.aiReasoning}
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() =>
                          handleQuickOrder(
                            quote.supplierName,
                            selectedItem.item_name_ar,
                            quote.unitPrice,
                            selectedItem.item_code,
                            quote.supplierId
                          )
                        }
                        disabled={isSubmittingQuickOrder}
                        className={`w-full py-2.5 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer mt-4 ${
                          isSubmittingQuickOrder ? 'opacity-50 cursor-not-allowed' : ''
                        } ${
                          isBest
                            ? 'bg-white/20 hover:bg-white/25 active:scale-95 text-white '
                            : 'bg-white/8 hover:bg-white/15 text-white border border-white/20'
                        }`}
                      >
                        {isSubmittingQuickOrder ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>{lang === 'en' ? 'Approve & Issue PO' : 'اعتماد وإصدار أمر شراء'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-white/65 text-sm bg-white/10 backdrop-blur-md border border-white/20 rounded-[18px]">
                {lang === 'en' ? 'No quotes registered for this item currently' : 'لا توجد عروض أسعار مسجلة لهذا الصنف حالياً'}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. Minimal Supplier Cards */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl">
              <Building2 className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {lang === 'en' ? 'Supplier Directory' : 'دليل الموردين المعتمدين'}
              </h2>
              <p className="text-xs text-white/80">
                {lang === 'en'
                  ? 'Official accredited suppliers for Zahi operations with direct profile access'
                  : 'قائمة الموردين المعتمدين لمطاعم زاهي مع إمكانية فتح ملف المورد والاطلاع على الأرشيف'}
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold text-white bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-1.5 rounded-[18px] font-mono">
            {toEnglishDigits(suppliers.length)} {lang === 'en' ? 'Suppliers Registered' : 'موردين مسجلين'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {suppliers.map((sup) => {
            const displayName = lang === 'en' ? (sup.name_en || sup.name_ar || sup.name) : (sup.name_ar || sup.name);

            return (
              <div
                key={sup.id}
                className="glass-card bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] hover:bg-white/[0.09] hover:border-white/[0.32] rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 group relative"
              >
                <div className="space-y-4">
                  {/* Top Header: Spacious, Prominent Supplier Name & Category */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-teal-200 shrink-0 mt-0.5">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-extrabold text-lg text-white leading-tight break-words" title={displayName}>
                          {displayName}
                        </h3>
                        <p className="text-xs text-white/60 mt-1 truncate">
                          {sup.category || (lang === 'en' ? 'Packaging & Operational Supplies' : 'تغليف ومستلزمات تشغيل')}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEditSupplier(sup)}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/20 text-white/70 hover:text-white transition-colors cursor-pointer shrink-0 mt-0.5"
                      title={lang === 'en' ? 'Edit supplier data' : 'تعديل بيانات المورد'}
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>

                  {/* Rating Badge Row: Sits neatly and symmetrically below the supplier name/category */}
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/15">
                    <span className="text-xs text-white/70 flex items-center gap-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-teal-300/80 shrink-0" />
                      <span className="truncate">{sup.location_ar || sup.city || 'جدة'}</span>
                    </span>

                    <span className="text-xs font-bold text-teal-100 bg-teal-500/20 border border-teal-300/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-mono shrink-0 shadow-sm">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
                      <span>{toEnglishDigits(sup.rating)} / 5</span>
                    </span>
                  </div>

                  {/* Commercial Registry & Tax Number ONLY */}
                  <div className="bg-white/5 border border-white/20 p-3.5 rounded-xl space-y-2 text-xs text-white/80">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-white/70">
                        <FileText className="w-3.5 h-3.5 text-white/60" />
                        <span>{lang === 'en' ? 'Commercial Registry:' : 'رقم السجل التجاري:'}</span>
                      </span>
                      <strong className="text-white font-mono">{toEnglishDigits(sup.cr_number || '—')}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-white/70">
                        <BadgeCheck className="w-3.5 h-3.5 text-white/60" />
                        <span>{lang === 'en' ? 'Tax Number:' : 'الرقم الضريبي:'}</span>
                      </span>
                      <strong className="text-white font-mono">{toEnglishDigits(sup.tax_number || '—')}</strong>
                    </div>
                  </div>
                </div>

                {/* Action Button: Open Profile */}
                <button
                  type="button"
                  onClick={() => handleOpenSupplierProfile(sup)}
                  className="mt-5 w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer group-hover:border-white/40"
                >
                  <ExternalLink className="w-4 h-4 text-teal-200" />
                  <span>{lang === 'en' ? 'Open Profile' : 'فتح ملف المورد'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Detailed Supplier Profile Modal */}
      {selectedProfileSupplier && (() => {
        const sup = selectedProfileSupplier;
        const displayName = lang === 'en' ? (sup.name_en || sup.name_ar || sup.name) : (sup.name_ar || sup.name);
        const metrics = sup.metrics || {
          deliverySpeed: Math.round(Math.min(99, Math.max(80, 100 - ((sup.delivery_time_hours || 24) - 20) * 0.5))),
          qualityScore: Math.round((sup.rating || 4.5) * 20),
          priceStability: 96,
        };

        const currentSupplierId = sup.id;
        const sNameAr = (sup.name_ar || sup.name || '').trim().toLowerCase();
        const sNameEn = (sup.name_en || '').trim().toLowerCase();

        // 1. Certified Supply Products (from supplier_items joined with availableItems)
        const certifiedItems = supplierItems.map(si => {
          const matched = availableItems.find(i => i.item_code === si.item_code);
          return {
            ...si,
            name_ar: matched?.item_name_ar || si.item_name_ar || si.item_code,
            name_en: matched?.item_name_en || si.item_name_en || '',
            category: matched?.category_ar || si.category_ar || (lang === 'en' ? 'Supply Item' : 'مواد تشغيل وتعبئة'),
            current_stock: matched?.current_stock ?? 0,
            cost_per_unit: si.unit_price ?? matched?.cost_per_unit ?? 0.5,
          };
        });

        // 2. Fetch both Active and Completed POs for this supplier (matching supplier_id or supplierName)
        const matchesThisSupplier = (po: PurchaseOrder) => {
          const poSupId = po.supplier_id || po.supplierId;
          if (poSupId && poSupId === currentSupplierId) return true;
          const poSupName = (po.supplierName || '').trim().toLowerCase();
          return Boolean(poSupName && (poSupName === sNameAr || (sNameEn && poSupName === sNameEn)));
        };

        const supplierActivePOs = purchaseOrders.filter(po => {
          if (!matchesThisSupplier(po)) return false;
          const status = (po.status || '').trim().toLowerCase();
          const orig = (po.status || '').trim();
          const isReceived =
            orig === 'تم الاستلام' ||
            orig === 'تم الاستلام بنجاح' ||
            orig === 'مكتمل' ||
            status === 'completed' ||
            status === 'received' ||
            status === 'delivered';
          return !isReceived;
        });

        const archivedPOs = purchaseOrders.filter(po => {
          if (!matchesThisSupplier(po)) return false;
          const status = (po.status || '').trim().toLowerCase();
          const orig = (po.status || '').trim();
          const isReceived =
            orig === 'تم الاستلام' ||
            orig === 'تم الاستلام بنجاح' ||
            orig === 'مكتمل' ||
            status === 'completed' ||
            status === 'received' ||
            status === 'delivered';
          return isReceived;
        });

        // Apply filters: Date (Start/End) and Item
        const filteredArchivedPOs = archivedPOs.filter(po => {
          if (profileItemFilter && profileItemFilter !== 'ALL') {
            if (po.itemId !== profileItemFilter && po.itemName !== profileItemFilter) {
              return false;
            }
          }
          if (profileDateStart) {
            const dateStr = po.receivedAt || po.createdAt || '';
            if (dateStr.length >= 10 && dateStr.includes('-') && dateStr.substring(0, 10) < profileDateStart) {
              return false;
            }
          }
          if (profileDateEnd) {
            const dateStr = po.receivedAt || po.createdAt || '';
            if (dateStr.length >= 10 && dateStr.includes('-') && dateStr.substring(0, 10) > profileDateEnd) {
              return false;
            }
          }
          return true;
        });

        // Calculate 4 Live Financial & Logistics KPIs for this Supplier
        const allSupplierPOs = purchaseOrders.filter(matchesThisSupplier);
        const supplierPoNumbers = new Set(allSupplierPOs.map((p) => p.id));
        const supplierPayments = poPayments.filter(
          (pay) =>
            (pay.supplier_id && pay.supplier_id === currentSupplierId) ||
            supplierPoNumbers.has(pay.po_number)
        );

        const totalTransactionsValue = Number(
          allSupplierPOs.reduce((sum, po) => sum + (Number(po.totalCost) || 0), 0).toFixed(2)
        );
        const totalPaidAmount = Number(
          supplierPayments
            .filter((pay) => pay.status === 'paid')
            .reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0)
            .toFixed(2)
        );
        const scheduledUnpaidSum = Number(
          supplierPayments
            .filter((pay) => pay.status === 'scheduled')
            .reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0)
            .toFixed(2)
        );
        const remainingBalanceOwed =
          scheduledUnpaidSum > 0
            ? scheduledUnpaidSum
            : Math.max(0, Number((totalTransactionsValue - totalPaidAmount).toFixed(2)));

        // FIFO Unpaid Payments Ledger: strictly status === 'scheduled', sorted by due_date ASC
        const fifoUnpaidPayments = [...supplierPayments]
          .filter((pay) => pay.status === 'scheduled')
          .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

        // Remaining Quantities POs: active/incomplete POs for this supplier where (quantity - COALESCE(received_quantity, 0)) > 0
        const supplierRemainingQtyPOs = supplierActivePOs.filter((po) => {
          const rec =
            po.received_quantity !== undefined
              ? Number(po.received_quantity)
              : po.receivedQuantity !== undefined
              ? Number(po.receivedQuantity)
              : 0;
          return Math.max(0, (Number(po.quantity) || 0) - rec) > 0;
        });

        const remainingUnitsWithSupplier = supplierRemainingQtyPOs.reduce((sum, po) => {
          const rec =
            po.received_quantity !== undefined
              ? Number(po.received_quantity)
              : po.receivedQuantity !== undefined
              ? Number(po.receivedQuantity)
              : 0;
          return sum + Math.max(0, (Number(po.quantity) || 0) - rec);
        }, 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in">
            <div className="font-sans bg-zinc-950/90 rounded-[28px] w-full max-w-5xl max-h-[92vh] overflow-y-auto p-6 md:p-8 space-y-6 text-white border border-white/20 shadow-2xl relative">
              
              {/* Modal Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/20 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-300/30 flex items-center justify-center text-teal-200 shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-xl md:text-2xl font-black text-white">
                        {displayName}
                      </h2>
                      <span className="text-xs font-bold text-teal-100 bg-teal-500/20 border border-teal-300/30 px-3 py-1 rounded-xl flex items-center gap-1 font-mono">
                        <ShieldCheck className="w-3.5 h-3.5 text-teal-200" />
                        <span>{toEnglishDigits(sup.rating)} / 5</span>
                      </span>
                      <span className="text-xs bg-white/10 border border-white/20 text-white/80 px-2.5 py-1 rounded-xl flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-white/60" />
                        <span>{sup.location_ar || sup.city || 'جدة'}</span>
                      </span>
                    </div>
                    <p className="text-xs text-white/70 mt-1 flex items-center gap-3 flex-wrap">
                      <span>{lang === 'en' ? 'Category:' : 'التصنيف:'} {sup.category || 'تغليف ومستلزمات تشغيل'}</span>
                      <span>•</span>
                      <span>{lang === 'en' ? 'CR:' : 'سجل تجاري:'} <strong className="font-mono text-white">{toEnglishDigits(sup.cr_number || '—')}</strong></span>
                      <span>•</span>
                      <span>{lang === 'en' ? 'Tax ID:' : 'الرقم الضريبي:'} <strong className="font-mono text-white">{toEnglishDigits(sup.tax_number || '—')}</strong></span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseSupplierProfile();
                      handleOpenEditSupplier(sup);
                    }}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Edit2 size={14} />
                    <span>{lang === 'en' ? 'Edit' : 'تعديل البيانات'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCloseSupplierProfile}
                    className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 p-2 rounded-xl w-9 h-9 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 1. Supplier Financial & Logistics Summary Bar (4 Live KPI Cards) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* KPI 1: إجمالي قيمة التعاملات */}
                <div className="bg-white/[0.05] border border-white/20 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-white/75 font-bold">
                    <span>إجمالي قيمة التعاملات</span>
                    <Coins className="w-4 h-4 text-teal-300" />
                  </div>
                  <div className="text-xl font-extrabold text-white font-mono mt-2" dir="ltr">
                    {toEnglishDigits(totalTransactionsValue.toLocaleString('en-US'))}{' '}
                    <span className="text-xs font-sans font-normal text-white/70">ر.س</span>
                  </div>
                  <div className="text-[11px] text-white/55 mt-1">
                    إجمالي أوامر الشراء ({toEnglishDigits(allSupplierPOs.length)})
                  </div>
                </div>

                {/* KPI 2: إجمالي المدفوع */}
                <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-emerald-200 font-bold">
                    <span>إجمالي المدفوع</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  </div>
                  <div className="text-xl font-extrabold text-emerald-300 font-mono mt-2" dir="ltr">
                    {toEnglishDigits(totalPaidAmount.toLocaleString('en-US'))}{' '}
                    <span className="text-xs font-sans font-normal text-emerald-200/80">ر.س</span>
                  </div>
                  <div className="text-[11px] text-emerald-200/70 mt-1">
                    الدفعات المسددة والموثقة بإيصال
                  </div>
                </div>

                {/* KPI 3: المتبقي علينا للمورد (Clickable -> scrolls to FIFO Unpaid Payments table) */}
                <button
                  type="button"
                  onClick={() => {
                    setProfileActiveTab('all');
                    setTimeout(() => {
                      document
                        .getElementById('supplier-fifo-payments-section')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 60);
                  }}
                  className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 hover:border-amber-300/60 rounded-2xl p-4 flex flex-col justify-between text-right transition-all cursor-pointer group"
                  title="اضغط للانتقال إلى جدول الدفعات المستحقة علينا (الأول فالأول)"
                >
                  <div className="flex items-center justify-between w-full text-xs text-amber-200 font-bold">
                    <span>المتبقي علينا للمورد</span>
                    <CreditCard className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-xl font-extrabold text-amber-200 font-mono mt-2" dir="ltr">
                    {toEnglishDigits(remainingBalanceOwed.toLocaleString('en-US'))}{' '}
                    <span className="text-xs font-sans font-normal text-amber-200/80">ر.س</span>
                  </div>
                  <div className="text-[11px] text-amber-200/75 mt-1 underline decoration-amber-400/40">
                    عرض الدفعات المستحقة ({toEnglishDigits(fifoUnpaidPayments.length)}) ←
                  </div>
                </button>

                {/* KPI 4: كميات متبقية لنا عند المورد (Clickable -> scrolls to Remaining Quantities table) */}
                <button
                  type="button"
                  onClick={() => {
                    setProfileActiveTab('all');
                    setTimeout(() => {
                      document
                        .getElementById('supplier-remaining-quantities-section')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 60);
                  }}
                  className="bg-teal-500/10 hover:bg-teal-500/20 border border-teal-400/30 hover:border-teal-300/60 rounded-2xl p-4 flex flex-col justify-between text-right transition-all cursor-pointer group"
                  title="اضغط للانتقال إلى جدول الكميات المتبقية لنا عند المورد"
                >
                  <div className="flex items-center justify-between w-full text-xs text-teal-200 font-bold">
                    <span>كميات متبقية لنا عند المورد</span>
                    <Package className="w-4 h-4 text-teal-300 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-xl font-extrabold text-teal-200 font-mono mt-2" dir="ltr">
                    {toEnglishDigits(remainingUnitsWithSupplier.toLocaleString('en-US'))}{' '}
                    <span className="text-xs font-sans font-normal text-teal-200/80">وحدة</span>
                  </div>
                  <div className="text-[11px] text-teal-200/75 mt-1 underline decoration-teal-400/40">
                    عرض الأوامر المتبقية ({toEnglishDigits(supplierRemainingQtyPOs.length)}) ←
                  </div>
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-white/20 pb-3 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setProfileActiveTab('products')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    profileActiveTab === 'products'
                      ? 'bg-teal-500/25 text-white border border-teal-300/40 shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Package className="w-4 h-4 text-teal-300" />
                  <span>{lang === 'en' ? 'Certified Products' : 'المنتجات المعتمدة للتوريد'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 font-mono">
                    {toEnglishDigits(certifiedItems.length)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setProfileActiveTab('archive')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    profileActiveTab === 'archive'
                      ? 'bg-teal-500/25 text-white border border-teal-300/40 shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <FileText className="w-4 h-4 text-teal-300" />
                  <span>{lang === 'en' ? 'PO & Invoices Archive' : 'أرشيف أوامر الشراء والفواتير'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-300/30 font-mono font-bold">
                    {toEnglishDigits(archivedPOs.length)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setProfileActiveTab('kpis')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    profileActiveTab === 'kpis'
                      ? 'bg-teal-500/25 text-white border border-teal-300/40 shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>{lang === 'en' ? 'Performance KPIs' : 'مؤشرات الأداء (KPIs)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProfileActiveTab('all')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    profileActiveTab === 'all'
                      ? 'bg-teal-500/25 text-white border border-teal-300/40 shadow-sm'
                      : 'text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{lang === 'en' ? 'View All' : 'عرض الكل'}</span>
                </button>
              </div>

              {/* Section 0A: Interactive FIFO Unpaid Payments Ledger (الدفعات المستحقة علينا - مرتبة بالأقدمية الأول فالأول) */}
              {(profileActiveTab === 'products' || profileActiveTab === 'archive' || profileActiveTab === 'all') && (
                <div
                  id="supplier-fifo-payments-section"
                  className="bg-amber-950/20 border border-amber-400/35 rounded-2xl p-4 sm:p-5 space-y-4 scroll-mt-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-400/20 pb-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-amber-300" />
                        <span>الدفعات المستحقة علينا (مرتبة بالأقدمية - الأول فالأول)</span>
                        <span
                          className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/25 border border-amber-300/40 text-amber-200"
                          dir="ltr"
                          lang="en"
                        >
                          {fifoUnpaidPayments.length.toLocaleString('en-US')}
                        </span>
                      </h3>
                      <p className="text-xs text-white/65 mt-0.5">
                        سجل مستقل للمدفوعات المجدولة على هذا المورد مرتبة تصاعدياً حسب تاريخ الاستحقاق
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingSupplierPaymentId(null);
                        setSupPayPoRef('دفعة عامة');
                        setSupPayTitle('');
                        setSupPayNotes('');
                        setSupPayAmount('');
                        setSupPayDueDate('');
                        setIsAddingSupplierPayment(!isAddingSupplierPayment);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-300/40 text-amber-100 text-xs font-extrabold transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAddingSupplierPayment ? 'إغلاق النموذج' : '+ إضافة دفعة مجدولة'}</span>
                    </button>
                  </div>

                  {isAddingSupplierPayment && (
                    <form
                      onSubmit={handleSaveStandaloneSupplierPayment}
                      className="bg-black/45 border border-amber-400/35 rounded-xl p-4 space-y-3 text-xs"
                    >
                      <div className="font-bold text-amber-200">
                        {editingSupplierPaymentId
                          ? 'تعديل بيانات الدفعة المستحقة'
                          : 'تسجيل دفعة مجدولة جديدة للمورد (مستقلة أو مرتبطة بأمر شراء)'}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="text-white/80 font-bold block">المرجع (اختياري):</label>
                          <select
                            value={supPayPoRef}
                            onChange={(e) => setSupPayPoRef(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-amber-400 cursor-pointer"
                          >
                            <option value="دفعة عامة" className="bg-slate-900 text-white">
                              دفعة عامة (مستقلة)
                            </option>
                            {allSupplierPOs.map((po) => (
                              <option key={`ref-opt-${po.id}`} value={po.id} className="bg-slate-900 text-white">
                                {po.id} — {po.itemName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-white/80 font-bold block">البيان / عنوان الدفعة:</label>
                          <input
                            type="text"
                            required
                            value={supPayTitle}
                            onChange={(e) => setSupPayTitle(e.target.value)}
                            placeholder="مثال: دفعة آجل / تسوية رصيد"
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-amber-400"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-white/80 font-bold block">المبلغ المستحق (ر.س):</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            lang="en"
                            required
                            value={supPayAmount}
                            onChange={(e) =>
                              setSupPayAmount(sanitizeEnglishNumericInput(e.target.value, true))
                            }
                            placeholder="0.00"
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-mono text-xs text-start outline-none focus:border-amber-400"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-white/80 font-bold block">تاريخ الاستحقاق:</label>
                          <CleanRtlDateInput
                            value={supPayDueDate}
                            onChange={setSupPayDueDate}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-white/80 font-bold block">
                          ملخص الاتفاق / ملاحظات الدفعة (اختياري):
                        </label>
                        <input
                          type="text"
                          value={supPayNotes}
                          onChange={(e) => setSupPayNotes(e.target.value)}
                          placeholder="أي تفاصيل أو شروط خاصة بهذه الدفعة..."
                          className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingSupplierPayment(false);
                            setEditingSupplierPaymentId(null);
                          }}
                          className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold border border-white/20 cursor-pointer"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingSupplierPayment}
                          className="px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold border border-emerald-400/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isSavingSupplierPayment ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>{editingSupplierPaymentId ? 'حفظ التعديل' : 'إضافة الدفعة'}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="bg-black/30 border border-white/15 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className={`w-full text-xs text-white ${lang === 'en' ? 'text-left' : 'text-right'}`}>
                        <thead className="bg-white/10 text-white/80 font-bold border-b border-white/15">
                          <tr>
                            <th className="px-4 py-3">المرجع</th>
                            <th className="px-4 py-3">البيان / ملخص الاتفاق</th>
                            <th className="px-4 py-3">المبلغ المستحق</th>
                            <th className="px-4 py-3">تاريخ الاستحقاق</th>
                            <th className="px-4 py-3">حالة المهلة</th>
                            <th className="px-4 py-3 text-center">إجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {fifoUnpaidPayments.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-white/60">
                                لا توجد دفعات مستحقة غير مسددة لهذا المورد حالياً
                              </td>
                            </tr>
                          ) : (
                            fifoUnpaidPayments.map((pay) => {
                              const linkedPO = allSupplierPOs.find((p) => p.id === pay.po_number);
                              const isPORef = Boolean(
                                pay.po_number &&
                                  pay.po_number !== 'دفعة عامة' &&
                                  pay.po_number !== 'GENERAL'
                              );
                              const todayStr = new Date().toISOString().split('T')[0];
                              const threeDaysStr = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                                .toISOString()
                                .split('T')[0];
                              const isOverdue = Boolean(pay.due_date && pay.due_date < todayStr);
                              const isDueSoon = Boolean(
                                pay.due_date &&
                                  pay.due_date >= todayStr &&
                                  pay.due_date <= threeDaysStr
                              );
                              const agreementSummary =
                                pay.notes || linkedPO?.notes || (linkedPO ? `أمر توريد: ${linkedPO.itemName}` : '');

                              return (
                                <tr key={`fifo-pay-${pay.id}`} className="hover:bg-white/10 transition-colors">
                                  <td className="px-4 py-3">
                                    {isPORef ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (linkedPO) {
                                            setSelectedPO(linkedPO);
                                            setIsEditingPO(false);
                                          }
                                        }}
                                        className="font-mono font-extrabold text-teal-200 bg-teal-500/20 hover:bg-teal-500/35 border border-teal-400/35 px-2.5 py-0.5 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                                        dir="ltr"
                                      >
                                        <span>{toEnglishDigits(pay.po_number)}</span>
                                        {linkedPO && <ExternalLink className="w-3 h-3" />}
                                      </button>
                                    ) : (
                                      <span className="font-bold text-white/80 bg-white/10 border border-white/20 px-2.5 py-0.5 rounded-lg">
                                        دفعة عامة
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-extrabold text-white">{pay.title}</div>
                                    {agreementSummary && (
                                      <div className="text-[11px] text-white/60 mt-0.5">
                                        {agreementSummary}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 font-mono font-extrabold text-amber-200" dir="ltr">
                                    {toEnglishDigits(pay.amount.toLocaleString('en-US'))} ر.س
                                  </td>
                                  <td className="px-4 py-3 font-mono text-white" dir="ltr">
                                    {toEnglishDigits(pay.due_date)}
                                  </td>
                                  <td className="px-4 py-3">
                                    {isOverdue ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-200 border border-rose-400/35">
                                        <AlertTriangle className="w-3 h-3 text-rose-300" />
                                        <span>متأخرة السداد</span>
                                      </span>
                                    ) : isDueSoon ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/35">
                                        <Clock className="w-3 h-3 text-amber-300" />
                                        <span>تستحق خلال 3 أيام</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/35">
                                        <Calendar className="w-3 h-3 text-emerald-300" />
                                        <span>مجدولة قادمة</span>
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPaymentToSettle(pay);
                                          setReceiptFileToUpload(null);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold border border-emerald-400/50 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                                      >
                                        <Upload className="w-3 h-3" />
                                        <span>سداد وإيصال</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingSupplierPaymentId(pay.id);
                                          setSupPayPoRef(pay.po_number || 'دفعة عامة');
                                          setSupPayTitle(pay.title);
                                          setSupPayNotes(pay.notes || '');
                                          setSupPayAmount(String(pay.amount));
                                          setSupPayDueDate(pay.due_date);
                                          setIsAddingSupplierPayment(true);
                                        }}
                                        className="p-1.5 text-teal-200 bg-teal-500/15 hover:bg-teal-500/30 border border-teal-400/35 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
                                        title="تعديل الدفعة"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => void handleDeleteScheduledPayment(pay.id)}
                                        className="p-1.5 text-rose-200 bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/35 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
                                        title="حذف الدفعة"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 0B: Remaining Quantities Table (كميات متبقية لنا عند المورد) */}
              {(profileActiveTab === 'products' || profileActiveTab === 'archive' || profileActiveTab === 'all') && (
                <div
                  id="supplier-remaining-quantities-section"
                  className="bg-teal-950/20 border border-teal-400/30 rounded-2xl p-4 sm:p-5 space-y-3 scroll-mt-4"
                >
                  <div className="flex items-center justify-between border-b border-teal-400/20 pb-2.5">
                    <div>
                      <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                        <Package className="w-4 h-4 text-teal-300" />
                        <span>كميات متبقية لنا عند المورد</span>
                      </h3>
                      <p className="text-xs text-white/65 mt-0.5">
                        أوامر الشراء التي تحتوي على رصيد كميات متبقية لم تُستلم بالكامل بعد
                      </p>
                    </div>
                    <span className="text-xs font-mono font-extrabold bg-teal-500/20 border border-teal-300/35 text-teal-200 px-3 py-1 rounded-xl" dir="ltr">
                      {toEnglishDigits(remainingUnitsWithSupplier.toLocaleString('en-US'))} وحدة متبقية
                    </span>
                  </div>

                  <div className="bg-black/30 border border-white/15 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className={`w-full text-xs text-white ${lang === 'en' ? 'text-left' : 'text-right'}`}>
                        <thead className="bg-white/10 text-white/80 font-bold border-b border-white/15">
                          <tr>
                            <th className="px-4 py-3">رقم الأمر</th>
                            <th className="px-4 py-3">الصنف</th>
                            <th className="px-4 py-3">الكمية المتفق عليها</th>
                            <th className="px-4 py-3">المستلم السليم</th>
                            <th className="px-4 py-3">المتبقي لنا</th>
                            <th className="px-4 py-3 text-center">إجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {supplierRemainingQtyPOs.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-white/60">
                                لا توجد كميات متبقية معلقة عند هذا المورد حالياً
                              </td>
                            </tr>
                          ) : (
                            supplierRemainingQtyPOs.map((po) => {
                              const agreed = Number(po.quantity) || 0;
                              const rec =
                                po.received_quantity !== undefined
                                  ? Number(po.received_quantity)
                                  : po.receivedQuantity !== undefined
                                  ? Number(po.receivedQuantity)
                                  : 0;
                              const rem = Math.max(0, agreed - rec);

                              return (
                                <tr key={`rem-qty-${po.id}`} className="hover:bg-white/10 transition-colors">
                                  <td className="px-4 py-3 font-mono font-bold text-white" dir="ltr">
                                    {toEnglishDigits(po.id)}
                                  </td>
                                  <td className="px-4 py-3 font-bold text-white">
                                    <div>{po.itemName}</div>
                                    {po.notes && (
                                      <div className="text-[11px] text-white/55 font-normal">
                                        {po.notes}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-white" dir="ltr">
                                    {toEnglishDigits(agreed.toLocaleString('en-US'))}
                                  </td>
                                  <td className="px-4 py-3 font-mono font-bold text-emerald-300" dir="ltr">
                                    {toEnglishDigits(rec.toLocaleString('en-US'))}
                                  </td>
                                  <td className="px-4 py-3 font-mono font-extrabold text-amber-300" dir="ltr">
                                    {toEnglishDigits(rem.toLocaleString('en-US'))} وحدة
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedPO(po);
                                        setIsEditingPO(false);
                                      }}
                                      className="text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
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
                </div>
              )}

              {/* Section 1: Certified Supply Products (supplier_items) */}
              {(profileActiveTab === 'products' || profileActiveTab === 'all') && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Package className="w-4 h-4 text-teal-300" />
                        <span>{lang === 'en' ? 'Certified Supply Products' : 'المنتجات المعتمدة للتوريد'}</span>
                      </h3>
                      <p className="text-xs text-white/65 mt-0.5">
                        {lang === 'en'
                          ? 'Official catalog of approved items mapped via supplier_items junction'
                          : 'الأصناف ومواد التشغيل المعتمد توريدها رسمياً من هذا المورد (مرتبطة بجدول supplier_items)'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          const firstItem = availableItems[0];
                          setSelectedItemToAdd(firstItem?.item_code || '');
                          setAgreedUnitPrice(
                            firstItem?.cost_per_unit && Number(firstItem.cost_per_unit) > 0
                              ? String(firstItem.cost_per_unit)
                              : '0.10'
                          );
                          setIsAddItemModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-teal-500/25 hover:bg-teal-500/35 text-white text-xs font-bold border border-teal-300/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5 text-teal-200" />
                        <span>{lang === 'en' ? 'Add Item to Supplier +' : 'إضافة صنف جديد للمورد +'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Certified Items Table */}
                  <div className="bg-white/5 border border-white/20 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className={`w-full text-xs text-white ${lang === 'en' ? 'text-left' : 'text-right'}`}>
                        <thead className="bg-white/10 text-white/80 font-bold border-b border-white/20">
                          <tr>
                            <th className="px-4 py-3.5">{lang === 'en' ? 'Item Code' : 'كود الصنف'}</th>
                            <th className="px-4 py-3.5">{lang === 'en' ? 'Item Name' : 'اسم الصنف'}</th>
                            <th className="px-4 py-3.5">{lang === 'en' ? 'Category' : 'التصنيف'}</th>
                            <th className="px-4 py-3.5">{lang === 'en' ? 'Agreed Unit Cost' : 'سعر التوريد المعتمد'}</th>
                            <th className="px-4 py-3.5">{lang === 'en' ? 'Warehouse Stock' : 'المخزون بالمستودع'}</th>
                            <th className="px-4 py-3.5">{lang === 'en' ? 'Status' : 'الحالة'}</th>
                            <th className="px-4 py-3.5 text-center">{lang === 'en' ? 'Action' : 'إجراء'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {certifiedItems.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-10 text-center text-white/60">
                                <div className="flex flex-col items-center justify-center gap-2">
                                  <Package className="w-8 h-8 text-white/30" />
                                  <span className="font-bold text-white/80">
                                    {lang === 'en' ? 'No items registered for this supplier yet' : 'لا توجد أصناف مسجلة لهذا المورد حتى الآن'}
                                  </span>
                                  <span className="text-[11px] text-white/50">
                                    {lang === 'en' ? 'Click "Add Item to Supplier +" to register catalog items for this supplier' : 'اضغط على "إضافة صنف جديد للمورد +" لإضافة الأصناف المعتمدة يدوياً'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            certifiedItems.map(item => (
                              <tr key={item.item_code} className="hover:bg-white/10 transition-colors">
                                <td className="px-4 py-3.5 font-mono font-bold text-teal-200">
                                  {toEnglishDigits(item.item_code)}
                                </td>
                                <td className="px-4 py-3.5 font-bold text-white">
                                  <div>{item.name_ar}</div>
                                  {item.name_en && (
                                    <div className="text-[10px] text-white/50 font-normal">{item.name_en}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 text-white/70">
                                  {item.category}
                                </td>
                                <td className="px-4 py-3.5 font-mono font-bold text-emerald-300">
                                  {toEnglishDigits(item.cost_per_unit)} {lang === 'en' ? 'SAR' : 'ر.س'}
                                </td>
                                <td className="px-4 py-3.5 font-mono text-white">
                                  {toEnglishDigits(item.current_stock.toLocaleString('en-US'))}
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/20 text-teal-200 border border-teal-300/30">
                                    <BadgeCheck className="w-3 h-3 text-teal-300" />
                                    <span>{lang === 'en' ? 'Certified' : 'معتمد للتوريد'}</span>
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                                    <button
                                      type="button"
                                      disabled={isSubmittingQuickOrder}
                                      onClick={() =>
                                        handleQuickOrder(
                                          sup.name_ar || sup.name || '',
                                          item.name_ar || item.item_code,
                                          item.cost_per_unit,
                                          item.item_code,
                                          sup.id
                                        )
                                      }
                                      className={`text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center gap-1 shrink-0 ${
                                        isSubmittingQuickOrder ? 'opacity-50 cursor-not-allowed' : ''
                                      }`}
                                      title={lang === 'en' ? 'Issue new PO for this item' : 'إصدار أمر شراء سريع لهذا الصنف'}
                                    >
                                      {isSubmittingQuickOrder ? (
                                        <Loader2 className="w-3 h-3 animate-spin text-teal-300" />
                                      ) : (
                                        <Send className="w-3 h-3 text-teal-300" />
                                      )}
                                      <span>{lang === 'en' ? 'Order' : 'طلب توريد'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingSupplierItem({
                                          id: item.id,
                                          supplier_id: sup.id,
                                          item_code: item.item_code,
                                          name_ar: item.name_ar || item.item_code,
                                          priceStr: String(item.cost_per_unit ?? '0.10'),
                                        })
                                      }
                                      className="p-1.5 text-teal-200 bg-teal-500/15 hover:bg-teal-500/30 border border-teal-400/35 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
                                      title={lang === 'en' ? 'Edit Price' : 'تعديل السعر'}
                                      aria-label={lang === 'en' ? 'Edit Price' : 'تعديل السعر'}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSupplierItemToDelete({
                                          id: item.id,
                                          supplier_id: sup.id,
                                          item_code: item.item_code,
                                          name_ar: item.name_ar || item.item_code,
                                        })
                                      }
                                      className="p-1.5 text-rose-200 bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/35 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center shrink-0"
                                      title={lang === 'en' ? 'Delete Item' : 'حذف الصنف'}
                                      aria-label={lang === 'en' ? 'Delete Item' : 'حذف الصنف'}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 2: Active & Archived POs for this Supplier */}
              {(profileActiveTab === 'archive' || profileActiveTab === 'all' || profileActiveTab === 'products') && (
                <div className="space-y-4">
                  {/* Active Purchase Orders for this Supplier */}
                  {supplierActivePOs.length > 0 && (
                    <div className="space-y-3 border-t border-white/20 pt-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-300" />
                          <span>{lang === 'en' ? 'Supplier Active Purchase Orders' : 'أوامر الشراء النشطة للمورد'}</span>
                        </h3>
                        <span className="text-xs bg-amber-500/20 border border-amber-400/30 text-amber-200 px-3 py-1 rounded-xl font-mono font-bold">
                          {toEnglishDigits(supplierActivePOs.length)} {lang === 'en' ? 'Active' : 'أمر نشط'}
                        </span>
                      </div>

                      <div className="bg-white/5 border border-white/20 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className={`w-full text-xs text-white ${lang === 'en' ? 'text-left' : 'text-right'}`}>
                            <thead className="bg-white/10 text-white/80 font-bold border-b border-white/20">
                              <tr>
                                <th className="px-4 py-3">{lang === 'en' ? 'PO #' : 'رقم الأمر'}</th>
                                <th className="px-4 py-3">{lang === 'en' ? 'Item' : 'الصنف المطلوب'}</th>
                                <th className="px-4 py-3">{lang === 'en' ? 'Quantity' : 'الكمية'}</th>
                                <th className="px-4 py-3">{lang === 'en' ? 'Cost' : 'التكلفة'}</th>
                                <th className="px-4 py-3">{lang === 'en' ? 'Status' : 'الحالة'}</th>
                                <th className="px-4 py-3 text-center">{lang === 'en' ? 'Action' : 'إجراء'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {supplierActivePOs.map((po) => (
                                <tr key={`sup-act-${po.id}`} className="hover:bg-white/10 transition-colors">
                                  <td className="px-4 py-3 font-mono font-bold text-white">{toEnglishDigits(po.id)}</td>
                                  <td className="px-4 py-3 font-bold text-white">{po.itemName}</td>
                                  <td className="px-4 py-3 font-mono text-white">{toEnglishDigits(po.quantity.toLocaleString('en-US'))}</td>
                                  <td className="px-4 py-3 font-mono font-bold text-teal-200">
                                    {toEnglishDigits(po.totalCost.toLocaleString('en-US'))} {lang === 'en' ? 'SAR' : 'ر.س'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-200 border border-amber-300/30">
                                      {po.status === 'PENDING_APPROVAL' ? 'بانتظار الموافقة' : po.status === 'SENT' ? 'تم إرسال الإيميل' : po.status === 'IN_TRANSIT' ? 'جاري التوصيل' : po.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedPO(po);
                                          setIsEditingPO(false);
                                        }}
                                        className="text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                      >
                                        {lang === 'en' ? 'Details' : 'التفاصيل'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {(profileActiveTab === 'archive' || profileActiveTab === 'all') && (
                    <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-white/20 pt-5">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-teal-300" />
                        <span>{lang === 'en' ? 'PO & Invoices Archive' : 'أرشيف أوامر الشراء والفواتير'}</span>
                      </h3>
                      <p className="text-xs text-white/65 mt-0.5">
                        {lang === 'en'
                          ? 'Archive of completed and received purchase orders with attached invoice files'
                          : 'سجل أوامر الشراء المستلمة والمكتملة رسمياً في المستودع والمقترنة بنسخ الفواتير (data)'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-emerald-500/20 border border-emerald-300/30 text-emerald-200 px-3 py-1 rounded-xl font-mono font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        <span>{toEnglishDigits(archivedPOs.length)} {lang === 'en' ? 'Received & Archived' : 'أمر مستلم ومؤرشف'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Filters Bar: Date (Start/End) and Item */}
                  <div className="bg-white/5 border border-white/20 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5 text-white/80 font-bold shrink-0">
                      <Filter className="w-4 h-4 text-teal-200" />
                      <span>{lang === 'en' ? 'Filters:' : 'الفلاتر:'}</span>
                    </div>

                    {/* Date Start */}
                    <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                      <span className="text-white/60 shrink-0">{lang === 'en' ? 'From:' : 'من تاريخ:'}</span>
                      <div className="relative w-full">
                        <input
                          type={profileDateStart ? 'date' : 'text'}
                          placeholder=""
                          dir="ltr"
                          value={profileDateStart}
                          onFocus={(e) => {
                            e.currentTarget.type = 'date';
                            try {
                              e.currentTarget.showPicker?.();
                            } catch {
                              // Ignore if showPicker requires direct user gesture
                            }
                          }}
                          onClick={(e) => {
                            if (e.currentTarget.type !== 'date') {
                              e.currentTarget.type = 'date';
                            }
                            try {
                              e.currentTarget.showPicker?.();
                            } catch {
                              // Ignore if showPicker fails
                            }
                          }}
                          onBlur={(e) => {
                            if (!e.currentTarget.value) {
                              e.currentTarget.type = 'text';
                            }
                          }}
                          onChange={(e) => setProfileDateStart(e.target.value)}
                          className="w-full bg-white/10 border border-white/20 rounded-xl pl-8 pr-3 py-2 text-white text-xs outline-none focus:border-teal-300 font-mono cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
                        />
                        <Calendar className="w-3.5 h-3.5 text-white/60 pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    {/* Date End */}
                    <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                      <span className="text-white/60 shrink-0">{lang === 'en' ? 'To:' : 'إلى تاريخ:'}</span>
                      <div className="relative w-full">
                        <input
                          type={profileDateEnd ? 'date' : 'text'}
                          placeholder=""
                          dir="ltr"
                          value={profileDateEnd}
                          onFocus={(e) => {
                            e.currentTarget.type = 'date';
                            try {
                              e.currentTarget.showPicker?.();
                            } catch {
                              // Ignore if showPicker requires direct user gesture
                            }
                          }}
                          onClick={(e) => {
                            if (e.currentTarget.type !== 'date') {
                              e.currentTarget.type = 'date';
                            }
                            try {
                              e.currentTarget.showPicker?.();
                            } catch {
                              // Ignore if showPicker fails
                            }
                          }}
                          onBlur={(e) => {
                            if (!e.currentTarget.value) {
                              e.currentTarget.type = 'text';
                            }
                          }}
                          onChange={(e) => setProfileDateEnd(e.target.value)}
                          className="w-full bg-white/10 border border-white/20 rounded-xl pl-8 pr-3 py-2 text-white text-xs outline-none focus:border-teal-300 font-mono cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
                        />
                        <Calendar className="w-3.5 h-3.5 text-white/60 pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    {/* Filter by Item - Strictly maps only this supplier's certified items */}
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <span className="text-white/60 shrink-0">{lang === 'en' ? 'Item:' : 'الصنف:'}</span>
                      <select
                        value={profileItemFilter}
                        onChange={(e) => setProfileItemFilter(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-teal-300 cursor-pointer"
                      >
                        <option value="ALL" className="bg-slate-800 text-white">
                          {lang === 'en' ? 'All Supplier Items' : 'جميع أصناف المورد'}
                        </option>
                        {certifiedItems.map(item => (
                          <option key={item.item_code} value={item.item_code} className="bg-slate-800 text-white">
                            {item.name_ar || item.item_code} ({item.item_code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Reset Filters */}
                    {(profileDateStart || profileDateEnd || profileItemFilter !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDateStart('');
                          setProfileDateEnd('');
                          setProfileItemFilter('ALL');
                        }}
                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{lang === 'en' ? 'Reset' : 'إعادة ضبط'}</span>
                      </button>
                    )}
                  </div>

                  {/* Table of Archived POs */}
                  <div className="bg-white/5 border border-white/20 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className={`w-full text-xs text-white ${lang === 'en' ? 'text-left' : 'text-right'}`}>
                        <thead className="bg-white/10 text-white/80 font-bold border-b border-white/20">
                          <tr>
                            <th className="px-4 py-3.5">{lang === 'en' ? 'PO #' : 'رقم الأمر'}</th>
                            <th className="px-4 py-3.5">{lang === 'en' ? 'Item' : 'الصنف المطلوب'}</th>
                            <th className="px-4 py-3.5">{lang === 'en' ? 'Quantity' : 'الكمية المستلمة'}</th>
                            <th className="px-4 py-3.5">{lang === 'en' ? 'Cost' : 'التكلفة'}</th>
                            <th className="px-4 py-3.5">{lang === 'en' ? 'Received Date' : 'تاريخ الاستلام'}</th>
                            <th className="px-4 py-3.5">{lang === 'en' ? 'Status' : 'الحالة'}</th>
                            <th className="px-4 py-3.5">{lang === 'en' ? 'Invoice Copy' : 'نسخة الفاتورة'}</th>
                            <th className="px-4 py-3.5 text-center">{lang === 'en' ? 'Action' : 'إجراء'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {filteredArchivedPOs.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-12 text-center text-white/60">
                                <div className="flex flex-col items-center justify-center gap-2">
                                  <FileText className="w-8 h-8 text-white/30" />
                                  <span className="font-bold text-white/80">
                                    {lang === 'en' ? 'No completed orders or archived invoices for this supplier' : 'لا توجد أوامر شراء مستلمة أو فواتير مؤرشفة لهذا المورد'}
                                  </span>
                                  <span className="text-[11px] text-white/50">
                                    {lang === 'en' ? 'Once an order is received from the inventory board, it automatically moves here' : 'عند استلام المخزون لأي أمر شراء، سينتقل تلقائياً من لوحة التتبع إلى هذا الأرشيف'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredArchivedPOs.map(po => (
                              <tr key={po.id} className="hover:bg-white/10 transition-colors">
                                <td className="px-4 py-3.5 font-mono font-bold text-white">
                                  {toEnglishDigits(po.id)}
                                </td>
                                <td className="px-4 py-3.5 font-bold text-white">
                                  {po.itemName}
                                </td>
                                <td className="px-4 py-3.5 font-mono text-white">
                                  {toEnglishDigits((po.receivedQuantity || po.quantity).toLocaleString('en-US'))}
                                </td>
                                <td className="px-4 py-3.5 font-mono font-bold text-teal-200">
                                  {toEnglishDigits(po.totalCost.toLocaleString('en-US'))} {lang === 'en' ? 'SAR' : 'ر.س'}
                                </td>
                                <td className="px-4 py-3.5 text-white/70 font-mono text-[11px]">
                                  {toEnglishDigits(po.receivedAt || po.createdAt)}
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-300/30">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                                    <span>{lang === 'en' ? 'Completed' : 'مكتمل'}</span>
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  {(po.invoiceUrl || (po as any).invoice_url) ? (
                                    <a
                                      href={po.invoiceUrl || (po as any).invoice_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-300/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-teal-300" />
                                      <span>data</span>
                                      <ExternalLink className="w-3 h-3 text-teal-300/70" />
                                    </a>
                                  ) : (
                                    <span className="text-[11px] text-white/40 italic">
                                      {lang === 'en' ? 'No invoice' : 'لا توجد فاتورة'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 text-center">
                                  <div className="flex items-center justify-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedPO(po);
                                        setIsEditingPO(false);
                                      }}
                                      className="text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                    >
                                      {lang === 'en' ? 'Details' : 'التفاصيل'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                    </>
                  )}
                </div>
              )}

              {/* Section 3: Performance KPIs */}
              {(profileActiveTab === 'kpis' || profileActiveTab === 'all') && (
                <div className="space-y-3 border-t border-white/20 pt-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-teal-300" />
                      <span>{lang === 'en' ? 'Performance KPIs' : 'مؤشرات أداء التوريد (KPIs)'}</span>
                    </h3>
                    <span className="text-xs text-white/60">
                      {lang === 'en' ? 'Live Operational Quality Analysis' : 'تحليل تشغيلي مستمر لمعايير الأداء'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* KPI 1: Delivery Speed */}
                    <div className="bg-white/5 border border-white/20 p-4 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/80 flex items-center gap-1.5 font-bold">
                          <Zap className="w-4 h-4 text-teal-300" />
                          <span>{lang === 'en' ? 'Delivery Speed' : 'سرعة التوصيل'}</span>
                        </span>
                        <span className="font-extrabold text-white text-base font-mono">{toEnglishDigits(metrics.deliverySpeed)}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${metrics.deliverySpeed}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full"
                        />
                      </div>
                      <p className="text-[11px] text-white/60">
                        {lang === 'en' ? 'Lead time:' : 'متوسط وقت التوريد:'} <strong className="text-white font-mono">{toEnglishDigits(sup.delivery_time_hours || 24)} {lang === 'en' ? 'hours' : 'ساعة'}</strong>
                      </p>
                    </div>

                    {/* KPI 2: Product Quality */}
                    <div className="bg-white/5 border border-white/20 p-4 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/80 flex items-center gap-1.5 font-bold">
                          <ShieldCheck className="w-4 h-4 text-emerald-300" />
                          <span>{lang === 'en' ? 'Product Quality' : 'جودة البضاعة'}</span>
                        </span>
                        <span className="font-extrabold text-white text-base font-mono">{toEnglishDigits(metrics.qualityScore)}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${metrics.qualityScore}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                          className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full"
                        />
                      </div>
                      <p className="text-[11px] text-white/60">
                        {lang === 'en' ? 'Supplier Rating:' : 'تقييم الجودة:'} <strong className="text-white font-mono">{toEnglishDigits(sup.rating)} / 5</strong>
                      </p>
                    </div>

                    {/* KPI 3: Price Stability */}
                    <div className="bg-white/5 border border-white/20 p-4 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/80 flex items-center gap-1.5 font-bold">
                          <Scale className="w-4 h-4 text-amber-300" />
                          <span>{lang === 'en' ? 'Price Stability' : 'استقرار السعر'}</span>
                        </span>
                        <span className="font-extrabold text-white text-base font-mono">{toEnglishDigits(metrics.priceStability)}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${metrics.priceStability}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-300 rounded-full"
                        />
                      </div>
                      <p className="text-[11px] text-white/60">
                        {lang === 'en' ? 'Pricing Tier:' : 'فئة التسعير:'} <strong className="text-white">{sup.pricingTier || 'أسعار جملة معتمدة'}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end pt-2 border-t border-white/20">
                <button
                  type="button"
                  onClick={handleCloseSupplierProfile}
                  className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all cursor-pointer"
                >
                  {lang === 'en' ? 'Close Profile' : 'إغلاق ملف المورد'}
                </button>
              </div>
            </div>

            {/* Modal / Popup: Add New Certified Item to Supplier */}
            {isAddItemModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in">
                <div className="font-sans bg-zinc-950/90 rounded-[24px] w-full max-w-md p-6 space-y-4 text-white border border-white/20 shadow-2xl relative">
                  <div className="flex justify-between items-center border-b border-white/20 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-300/30 flex items-center justify-center text-teal-200">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">
                          {lang === 'en' ? 'Add Item to Supplier' : 'إضافة صنف جديد للمورد'}
                        </h4>
                        <p className="text-[11px] text-white/60">
                          {lang === 'en' ? 'Link inventory item to supplier_items' : 'ربط صنف من المستودع بجدول supplier_items'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAddItemModalOpen(false)}
                      className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 p-1.5 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleAddCertifiedItem} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-bold text-white mb-1.5">
                        {lang === 'en' ? 'Select Inventory Item:' : 'اختر صنف المخزون المطلوب ربطه:'}
                      </label>
                      <select
                        value={selectedItemToAdd}
                        onChange={(e) => {
                          setSelectedItemToAdd(e.target.value);
                          const matched = availableItems.find(i => i.item_code === e.target.value);
                          if (matched?.cost_per_unit && Number(matched.cost_per_unit) > 0) {
                            setAgreedUnitPrice(String(matched.cost_per_unit));
                          }
                        }}
                        required
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-xs outline-none focus:border-teal-300 cursor-pointer"
                      >
                        <option value="" disabled className="bg-slate-800 text-white">
                          {lang === 'en' ? '-- Select Item --' : '-- اختر الصنف --'}
                        </option>
                        {availableItems.map(item => (
                          <option key={item.item_code} value={item.item_code} className="bg-slate-800 text-white">
                            {item.item_name_ar} ({item.item_code}) - {toEnglishDigits(item.cost_per_unit || 0)} ر.س
                          </option>
                        ))}
                      </select>
                    </div>

                    {(() => {
                      const matchedItemForModal = availableItems.find(
                        (i) => i.item_code.toUpperCase() === selectedItemToAdd.toUpperCase()
                      );
                      const codeUpper = (selectedItemToAdd || '').toUpperCase();
                      const modalUnitsPerCarton =
                        matchedItemForModal?.units_per_carton != null &&
                        Number(matchedItemForModal.units_per_carton) > 0
                          ? Number(matchedItemForModal.units_per_carton)
                          : (CARTON_SIZES[codeUpper] || 1);
                      const normalizedStr = String(agreedUnitPrice)
                        .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
                        .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                        .trim();
                      const parsedUnitPrice = parseFloat(normalizedStr);
                      const validUnitPrice =
                        !isNaN(parsedUnitPrice) && parsedUnitPrice >= 0 ? parsedUnitPrice : 0;
                      const calculatedCartonPrice = Number(
                        (validUnitPrice * modalUnitsPerCarton).toFixed(4)
                      );

                      return (
                        <div className="space-y-2.5">
                          <label className="block font-bold text-white mb-1.5">
                            {lang === 'en'
                              ? 'Agreed Unit Supply Price (SAR):'
                              : 'سعر التوريد المتفق عليه للحبة (ر.س):'}
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            inputMode="decimal"
                            dir="ltr"
                            lang="en"
                            required
                            placeholder="0.10"
                            value={agreedUnitPrice}
                            onChange={(e) => {
                              const raw = String(e.target.value)
                                .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
                                .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                              setAgreedUnitPrice(raw);
                            }}
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-300 font-mono"
                          />

                          {/* Live Unit vs. Carton Price Helper Calculation */}
                          <div className="rounded-xl bg-teal-950/60 border border-teal-500/30 p-3 space-y-1.5 text-[11px]">
                            <div className="flex items-center justify-between text-slate-200">
                              <span>{lang === 'en' ? 'Price per Single Unit:' : 'سعر الحبة الواحدة:'}</span>
                              <span className="font-mono font-extrabold text-white" dir="ltr">
                                {toEnglishDigits(validUnitPrice)} {lang === 'en' ? 'SAR' : 'ر.س'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-teal-200 pt-1 border-t border-teal-500/20">
                              <span>
                                {lang === 'en'
                                  ? `Auto Carton Price (${toEnglishDigits(modalUnitsPerCarton)} units/carton):`
                                  : `سعر الكرتون التلقائي (سعر الحبة × ${toEnglishDigits(modalUnitsPerCarton)} حبة):`}
                              </span>
                              <span className="font-mono font-extrabold text-teal-300 text-xs" dir="ltr">
                                {toEnglishDigits(calculatedCartonPrice)} {lang === 'en' ? 'SAR' : 'ر.س'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="pt-2 flex gap-2">
                      <button
                        type="submit"
                        disabled={isSavingNewItem || !selectedItemToAdd}
                        className="flex-1 py-2.5 rounded-xl bg-teal-500/25 hover:bg-teal-500/35 active:scale-95 text-white font-bold text-xs border border-teal-300/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingNewItem ? (
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        <span>
                          {isSavingNewItem
                            ? (lang === 'en' ? 'Saving to supplier_items...' : 'جاري الحفظ في supplier_items...')
                            : (lang === 'en' ? 'Certify & Add Item' : 'اعتماد وإضافة الصنف')}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsAddItemModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all cursor-pointer"
                      >
                        {lang === 'en' ? 'Cancel' : 'إلغاء'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Modal: View & Edit Purchase Order Details (PO Modal) */}
      {selectedPO && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="font-sans bg-black/85 backdrop-blur-2xl rounded-3xl w-full max-w-4xl lg:max-w-5xl max-h-[94vh] overflow-y-auto p-5 sm:p-6 space-y-4 text-white border border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.85)] relative flex flex-col">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-white/15 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/25 flex items-center justify-center text-teal-300 shrink-0 shadow-inner">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                    <span>{lang === 'en' ? 'Purchase Order Details' : 'تفاصيل أمر الشراء'}</span>
                    <span className="font-mono text-xs text-teal-200 bg-teal-500/20 border border-teal-400/30 px-2 py-0.5 rounded-lg" dir="ltr" lang="en">
                      {toEnglishDigits(selectedPO.id)}
                    </span>
                  </h3>
                  <p className="text-[11px] text-white/65 font-medium mt-0.5">
                    {lang === 'en' ? 'Official Procurement Record with Suppliers Network' : 'سجل التوريد الرسمي لدى شبكة الموردين'}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Edit Toggle, Delete & Close (X) Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={isEditingPO ? () => setIsEditingPO(false) : () => void handleOpenEditPO()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all cursor-pointer"
                  title={lang === 'en' ? 'Edit purchase order details' : 'تعديل تفاصيل أمر الشراء'}
                >
                  <Edit2 size={14} className="text-white/80" />
                  <span>{isEditingPO ? (lang === 'en' ? 'Cancel' : 'إلغاء') : (lang === 'en' ? 'Edit' : 'تعديل')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPoToDelete(selectedPO)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-200 border border-rose-400/35 text-xs font-bold transition-all cursor-pointer"
                  title={lang === 'en' ? 'Delete purchase order' : 'حذف أمر الشراء'}
                >
                  <Trash2 size={14} />
                  <span>{lang === 'en' ? 'Delete' : 'حذف'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPO(null);
                    setIsEditingPO(false);
                  }}
                  className="text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/20 p-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center w-9 h-9"
                  aria-label={lang === 'en' ? 'Close' : 'إلغاء'}
                  title={lang === 'en' ? 'Close' : 'إغلاق'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Edit Mode Form */}
            {isEditingPO ? (() => {
              const matchedItem = availableItems.find(
                (i) => i.item_name_ar === selectedPO.itemName || i.item_code === selectedPO.itemId
              );
              const codeUpper = (selectedPO.itemId || matchedItem?.item_code || 'P1').toUpperCase();
              const unitsPerCarton =
                matchedItem?.units_per_carton != null && Number(matchedItem.units_per_carton) > 0
                  ? Number(matchedItem.units_per_carton)
                  : (CARTON_SIZES[codeUpper] || 1);
              const currentCartons = Math.max(1, Math.round((editPOQuantity || 0) / unitsPerCarton));

              return (
                <div className="bg-white/[0.04] rounded-2xl p-4 sm:p-5 border border-white/20 space-y-4 text-sm">
                  <div className="font-bold text-white border-b border-white/15 pb-2 flex items-center justify-between">
                    <span>{lang === 'en' ? 'Edit Purchase Order Details' : 'تعديل بيانات أمر الشراء'}</span>
                    <span className="font-mono text-xs text-white/60" dir="ltr" lang="en">{toEnglishDigits(selectedPO.id)}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1. Assigned Supplier */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white">
                        {lang === 'en' ? 'Assigned Supplier:' : 'المورد المعتمد:'}
                      </label>
                      <GlassSelect
                        value={editPOSupplier}
                        onChange={(e) => setEditPOSupplier(e.target.value)}
                        disabled={isLoadingPOSuppliers || poAvailableSuppliers.length === 0}
                        className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none"
                      >
                        {poAvailableSuppliers.map(s => (
                          <option key={s.id} value={s.name} className="bg-slate-900 text-white">
                            {s.name}
                          </option>
                        ))}
                      </GlassSelect>
                    </div>

                    {/* 2. Order Status */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white">
                        {lang === 'en' ? 'Order Status:' : 'حالة أمر الشراء:'}
                      </label>
                      <select
                        value={editPOStatus}
                        onChange={(e) => setEditPOStatus(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-xs sm:text-sm text-white focus:outline-none cursor-pointer"
                      >
                        <option value="PENDING_APPROVAL" className="bg-slate-900 text-white">بانتظار الموافقة</option>
                        <option value="SENT" className="bg-slate-900 text-white">تم إرسال الإيميل</option>
                        <option value="IN_TRANSIT" className="bg-slate-900 text-white">جاري التوصيل</option>
                        <option value="تم الاستلام" className="bg-slate-900 text-white">تم الاستلام</option>
                      </select>
                    </div>

                    {/* 3. Expected Delivery Date */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white">
                        {lang === 'en' ? 'Expected Delivery Date:' : 'تاريخ التوريد المتوقع:'}
                      </label>
                      <CleanRtlDateInput
                        value={editPOExpectedDate}
                        onChange={setEditPOExpectedDate}
                        className="w-full bg-white/10 border border-white/20 rounded-xl pl-8 pr-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none font-mono cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
                      />
                    </div>

                    {/* 4. Quantity in Cartons */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white flex justify-between items-center">
                        <span>{lang === 'en' ? 'Quantity (Cartons):' : 'الكمية (بالكرتون):'}</span>
                        <span className="text-[10px] text-teal-300 font-mono">
                          {toEnglishDigits(unitsPerCarton)} حبة/كرتون
                        </span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        dir="ltr"
                        lang="en"
                        value={currentCartons}
                        onChange={(e) => {
                          const cVal = Math.max(1, parseInt(e.target.value || '1', 10) || 1);
                          const nextUnits = cVal * unitsPerCarton;
                          setEditPOQuantity(nextUnits);
                          const uPrice = parseFloat(editPOUnitPrice);
                          if (!isNaN(uPrice) && uPrice >= 0) {
                            setEditPOTotalCost(String(Number((nextUnits * uPrice).toFixed(4))));
                          }
                        }}
                        className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-sm text-white focus:outline-none font-mono text-center font-bold"
                      />
                    </div>

                    {/* 5. Quantity in Units */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white">
                        {lang === 'en' ? 'Requested Quantity (Units):' : 'الكمية الإجمالية (بالوحدة):'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        dir="ltr"
                        lang="en"
                        value={editPOQuantity}
                        onChange={(e) => {
                          const clean = String(e.target.value)
                            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
                            .replace(/[^0-9]/g, '');
                          const nextUnits = clean === '' ? 0 : Number(clean);
                          setEditPOQuantity(nextUnits);
                          const uPrice = parseFloat(editPOUnitPrice);
                          if (!isNaN(uPrice) && uPrice >= 0) {
                            setEditPOTotalCost(String(Number((nextUnits * uPrice).toFixed(4))));
                          }
                        }}
                        className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-sm text-white focus:outline-none font-mono text-center font-bold"
                      />
                    </div>

                    {/* 6. Agreed Unit Price & Total Cost */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-white">
                          {lang === 'en' ? 'Unit Price (SAR):' : 'سعر الحبة (ر.س):'}
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          inputMode="decimal"
                          dir="ltr"
                          lang="en"
                          value={editPOUnitPrice}
                          onChange={(e) => {
                            const raw = String(e.target.value).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
                            setEditPOUnitPrice(raw);
                            const parsed = parseFloat(raw);
                            if (!isNaN(parsed) && parsed >= 0) {
                              setEditPOTotalCost(String(Number((editPOQuantity * parsed).toFixed(4))));
                            }
                          }}
                          className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-sm text-white focus:outline-none font-mono text-center font-bold"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-white">
                          {lang === 'en' ? 'Total Cost (SAR):' : 'الإجمالي (ر.س):'}
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          inputMode="decimal"
                          dir="ltr"
                          lang="en"
                          value={editPOTotalCost}
                          onChange={(e) => {
                            const raw = String(e.target.value).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
                            setEditPOTotalCost(raw);
                          }}
                          className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-sm text-teal-300 focus:outline-none font-mono text-center font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      disabled={isSavingPOEdit}
                      onClick={() => void handleSavePOEdit()}
                      className="flex-1 bg-emerald-600/40 hover:bg-emerald-600/60 text-white font-bold py-2.5 rounded-xl transition-all text-xs sm:text-sm cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-400/40 disabled:opacity-50"
                    >
                      {isSavingPOEdit ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>{lang === 'en' ? 'Save Changes' : 'حفظ التعديل'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPO(false)}
                      className="px-5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold py-2.5 rounded-xl transition-all text-xs sm:text-sm cursor-pointer"
                    >
                      {lang === 'en' ? 'Cancel' : 'إلغاء'}
                    </button>
                  </div>
                </div>
              );
            })() : (
              /* Landscape Multi-Column Grid Details View */
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-sm">
                  {/* 1. PO Number */}
                  <div className="bg-white/[0.04] border border-white/15 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-white/60 text-[11px] font-medium">{lang === 'en' ? 'PO Number' : 'رقم أمر الشراء'}</span>
                    <span className="font-extrabold text-white font-mono text-sm sm:text-base bg-white/15 px-2.5 py-0.5 rounded-lg border border-white/20 mt-1" dir="ltr" lang="en">
                      {toEnglishDigits(selectedPO.id)}
                    </span>
                  </div>

                  {/* 2. Item Name */}
                  <div className="bg-white/[0.04] border border-white/15 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-white/60 text-[11px] font-medium">{lang === 'en' ? 'Item' : 'الصنف المطلوب'}</span>
                    <span className="font-bold text-white text-xs sm:text-sm mt-1 line-clamp-1" title={selectedPO.itemName}>
                      {selectedPO.itemName}
                    </span>
                  </div>

                  {/* 3. Supplier Name */}
                  <div className="bg-white/[0.04] border border-white/15 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-white/60 text-[11px] font-medium">{lang === 'en' ? 'Assigned Supplier' : 'المورد المعتمد'}</span>
                    <span className="font-semibold text-white text-xs sm:text-sm flex items-center justify-center gap-1.5 mt-1 truncate max-w-full">
                      <Building2 className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                      <span className="truncate">{selectedPO.supplierName}</span>
                    </span>
                  </div>

                  {/* 4. Quantity */}
                  <div className="bg-white/[0.04] border border-white/15 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-white/60 text-[11px] font-medium">{lang === 'en' ? 'Quantity' : 'الكمية المطلوبة'}</span>
                    <span className="font-extrabold text-emerald-300 text-sm sm:text-base font-mono mt-1" dir="ltr" lang="en">
                      {toEnglishDigits(selectedPO.quantity)} <span className="text-[10px] font-sans text-white/70">{lang === 'en' ? 'units' : 'وحدة'}</span>
                    </span>
                  </div>

                  {/* 5. Total Cost */}
                  <div className="bg-white/[0.04] border border-white/15 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-white/60 text-[11px] font-medium">{lang === 'en' ? 'Estimated Total Cost' : 'التكلفة التقديرية'}</span>
                    <span className="font-extrabold text-white text-sm sm:text-base font-mono mt-1" dir="ltr" lang="en">
                      {toEnglishDigits(selectedPO.totalCost)} <span className="text-[10px] font-sans text-white/70">{lang === 'en' ? 'SAR' : 'ر.س'}</span>
                    </span>
                  </div>

                  {/* 6. Status */}
                  <div className="bg-white/[0.04] border border-white/15 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-white/60 text-[11px] font-medium">{lang === 'en' ? 'Current Status' : 'الحالة الحالية'}</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border border-white/20 bg-white/15 text-white mt-1">
                      {selectedPO.status === 'PENDING_APPROVAL' && (lang === 'en' ? 'Pending Approval' : 'بانتظار الموافقة')}
                      {selectedPO.status === 'SENT' && (lang === 'en' ? 'Dispatched' : 'تم إرسال الإيميل')}
                      {selectedPO.status === 'IN_TRANSIT' && (lang === 'en' ? 'In Transit' : 'جاري التوصيل')}
                      {(selectedPO.status === 'DELIVERED' || selectedPO.status === 'تم الاستلام' || (selectedPO.status as string) === 'مكتمل' || (selectedPO.status as string) === 'completed') && (lang === 'en' ? 'Completed' : 'مكتمل')}
                      {selectedPO.status === 'APPROVED' && (lang === 'en' ? 'Approved' : 'معتمد')}
                    </span>
                  </div>

                  {/* 7. Creator */}
                  <div className="bg-white/[0.04] border border-white/15 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-white/60 text-[11px] font-medium">{lang === 'en' ? 'Created By' : 'المُنشئ'}</span>
                    <span className="text-[11px] font-bold text-white bg-white/10 px-2.5 py-0.5 rounded-md border border-white/20 flex items-center justify-center gap-1.5 mt-1 max-w-full">
                      <User className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      <span className="truncate">{formatPOCreatorDisplay(selectedPO.createdBy, authenticatedUser)}</span>
                    </span>
                  </div>

                  {/* 8. Creation Time */}
                  <div className="bg-white/[0.04] border border-white/15 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                    <span className="text-white/60 text-[11px] font-medium">{lang === 'en' ? 'Creation Timestamp' : 'توقيت الإنشاء'}</span>
                    <span className="text-white/85 text-[11px] font-medium font-mono mt-1 truncate max-w-full" dir="ltr" lang="en">
                      {toEnglishDigits(selectedPO.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Per-PO Agreement Summary if recorded on this order */}
                {selectedPO.notes && (
                  <div className="bg-teal-950/35 border border-teal-400/30 rounded-xl px-4 py-2.5 text-xs flex items-start gap-2.5">
                    <ClipboardCheck className="w-4 h-4 text-teal-300 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-teal-200">ملخص الاتفاق الخاص بهذا الأمر: </span>
                      <span className="text-white/90">{selectedPO.notes}</span>
                    </div>
                  </div>
                )}

                {/* 9. Attached Invoice Copy if available */}
                {selectedPO.invoiceUrl && (
                  <div className="flex items-center justify-between gap-3 bg-white/[0.04] border border-white/15 rounded-xl px-4 py-2.5 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 bg-teal-500/20 border border-teal-400/30 rounded-lg text-teal-300 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-white truncate">
                        {lang === 'en' ? 'Attached Invoice Document' : 'مستند الفاتورة المرفق مع أمر الشراء'}
                      </span>
                    </div>
                    <a
                      href={selectedPO.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-300/40 text-xs font-bold transition-all shadow-sm shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5 text-teal-300" />
                      <span>{lang === 'en' ? 'View / Download Invoice' : 'عرض / تنزيل الفاتورة'}</span>
                      <ExternalLink className="w-3 h-3 text-teal-300/70" />
                    </a>
                  </div>
                )}

                {/* Section A: Quantity & Partial Delivery Tracking (تتبع الاستلام والكميات) */}
                {(() => {
                  const agreedQty = Number(selectedPO.quantity) || 0;
                  const parsedRec = Math.max(
                    0,
                    Math.round(Number(sanitizeEnglishNumericInput(partialReceivedQty, false)) || 0)
                  );
                  const parsedRem = Math.max(
                    0,
                    Math.round(Number(sanitizeEnglishNumericInput(partialRemainingQty, false)) || 0)
                  );

                  return (
                    <div className="bg-white/[0.04] border border-teal-400/30 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-teal-300 shrink-0" />
                          <h4 className="text-xs sm:text-sm font-extrabold text-white">
                            تتبع الاستلام والكميات (استلام جزئي / كامل)
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="hidden sm:inline text-[11px] text-amber-200/90">
                            حفظ الكميات هنا يوثق توريد المورد ولا يعدل رصيد المخزون الآلي
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditingPOQuantities) {
                                const origRec =
                                  selectedPO.received_quantity !== undefined
                                    ? Number(selectedPO.received_quantity)
                                    : selectedPO.receivedQuantity !== undefined
                                    ? Number(selectedPO.receivedQuantity)
                                    : 0;
                                setPartialReceivedQty(String(origRec));
                                setPartialRemainingQty(String(Math.max(0, agreedQty - origRec)));
                              }
                              setIsEditingPOQuantities((prev) => !prev);
                            }}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer inline-flex items-center justify-center shrink-0 ${
                              isEditingPOQuantities
                                ? 'bg-teal-500/35 border-teal-300/60 text-white'
                                : 'bg-teal-500/15 hover:bg-teal-500/30 border-teal-400/35 text-teal-200'
                            }`}
                            title="تعديل الكميات"
                            aria-label="تعديل الكميات"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        {/* 1. الكمية المتفق عليها */}
                        <div className="bg-black/30 border border-white/15 rounded-xl p-3 flex flex-col justify-between text-start">
                          <span className="text-white/65 font-bold">الكمية المتفق عليها</span>
                          <div className="flex items-baseline justify-start gap-1.5 mt-1.5 text-start">
                            <span className="text-base font-extrabold text-white font-mono" lang="en">
                              {agreedQty.toLocaleString('en-US')}
                            </span>
                            <span className="text-[11px] font-sans font-normal text-white/60">
                              {lang === 'en' ? 'units' : 'وحدة'}
                            </span>
                          </div>
                        </div>

                        {/* 2. الكمية المستلمة */}
                        <div className="bg-black/30 border border-emerald-400/30 rounded-xl p-3 flex flex-col justify-between text-start space-y-1.5">
                          <label className="text-emerald-200 font-bold block text-start">
                            الكمية المستلمة
                          </label>
                          {isEditingPOQuantities ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              lang="en"
                              value={partialReceivedQty}
                              onChange={(e) => {
                                const clean = sanitizeEnglishNumericInput(e.target.value, false);
                                setPartialReceivedQty(clean);
                                const recVal = parseInt(clean || '0', 10) || 0;
                                setPartialRemainingQty(String(Math.max(0, agreedQty - recVal)));
                              }}
                              className="w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-sm font-mono font-extrabold text-emerald-300 text-start outline-none focus:border-emerald-400"
                            />
                          ) : (
                            <div className="flex items-baseline justify-start gap-1.5 text-start">
                              <span className="text-base font-extrabold text-emerald-300 font-mono" lang="en">
                                {parsedRec.toLocaleString('en-US')}
                              </span>
                              <span className="text-[11px] font-sans font-normal text-emerald-200/70">
                                {lang === 'en' ? 'units' : 'وحدة'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 3. المتبقي لنا عند المورد */}
                        <div className="bg-black/30 border border-amber-400/30 rounded-xl p-3 flex flex-col justify-between text-start space-y-1.5">
                          <label className="text-amber-200 font-bold block text-start">
                            المتبقي لنا عند المورد
                          </label>
                          {isEditingPOQuantities ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              lang="en"
                              value={partialRemainingQty}
                              onChange={(e) => {
                                const clean = sanitizeEnglishNumericInput(e.target.value, false);
                                setPartialRemainingQty(clean);
                                const remVal = parseInt(clean || '0', 10) || 0;
                                setPartialReceivedQty(String(Math.max(0, agreedQty - remVal)));
                              }}
                              className="w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-sm font-mono font-extrabold text-amber-300 text-start outline-none focus:border-amber-400"
                            />
                          ) : (
                            <div className="flex items-baseline justify-start gap-1.5 text-start">
                              <span className="text-base font-extrabold text-amber-300 font-mono" lang="en">
                                {parsedRem.toLocaleString('en-US')}
                              </span>
                              <span className="text-[11px] font-sans font-normal text-amber-200/70">
                                {lang === 'en' ? 'units' : 'وحدة'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {isEditingPOQuantities && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              const origRec =
                                selectedPO.received_quantity !== undefined
                                  ? Number(selectedPO.received_quantity)
                                  : selectedPO.receivedQuantity !== undefined
                                  ? Number(selectedPO.receivedQuantity)
                                  : 0;
                              setPartialReceivedQty(String(origRec));
                              setPartialRemainingQty(String(Math.max(0, agreedQty - origRec)));
                              setIsEditingPOQuantities(false);
                            }}
                            disabled={isSavingPartialQty}
                            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSavePOPartialQuantities()}
                            disabled={isSavingPartialQty}
                            className="px-4 py-2 rounded-xl bg-teal-500/25 hover:bg-teal-500/40 border border-teal-300/40 text-white text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isSavingPartialQty ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-teal-300" />
                            )}
                            <span>حفظ تحديث الكميات</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Section B: Scheduled Payments Section (جدولة المدفوعات) */}
                {(() => {
                  const thisPOPayments = poPayments.filter((p) => p.po_number === selectedPO.id);
                  const totalPaidForPO = thisPOPayments
                    .filter((p) => p.status === 'paid')
                    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                  const totalScheduledForPO = thisPOPayments
                    .filter((p) => p.status === 'scheduled')
                    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

                  return (
                    <div className="bg-white/[0.04] border border-white/20 rounded-2xl p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/15 pb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-emerald-300" />
                            <h4 className="text-xs sm:text-sm font-extrabold text-white">
                              جدولة المدفوعات وإيصالات السداد
                            </h4>
                          </div>
                          <p className="text-[11px] text-white/65 mt-0.5">
                            المدفوع:{' '}
                            <strong className="font-mono text-emerald-300">
                              {toEnglishDigits(totalPaidForPO.toLocaleString('en-US'))} ر.س
                            </strong>{' '}
                            • المجدول المتبقي:{' '}
                            <strong className="font-mono text-amber-200">
                              {toEnglishDigits(totalScheduledForPO.toLocaleString('en-US'))} ر.س
                            </strong>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingPaymentId(null);
                            setNewPaymentTitle('دفعة توريد');
                            setNewPaymentAmount(
                              String(
                                Math.max(
                                  0,
                                  Number(
                                    (
                                      (Number(selectedPO.totalCost) || 0) -
                                      totalPaidForPO -
                                      totalScheduledForPO
                                    ).toFixed(2)
                                  )
                                ) || selectedPO.totalCost || ''
                              )
                            );
                            setNewPaymentDueDate('');
                            setIsAddingPayment(!isAddingPayment);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-300/40 text-emerald-100 text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isAddingPayment ? 'إغلاق النموذج' : 'إضافة دفعة مجدولة +'}</span>
                        </button>
                      </div>

                      {isAddingPayment && (
                        <form
                          onSubmit={handleSaveScheduledPayment}
                          className="bg-black/40 border border-emerald-400/30 rounded-xl p-3.5 space-y-3 text-xs"
                        >
                          <div className="font-bold text-emerald-200">
                            {editingPaymentId ? 'تعديل الدفعة المجدولة' : 'إضافة دفعة جديدة (عربون / عند الاستلام / آجل)'}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-white/80 font-bold block">بيان الدفعة:</label>
                              <input
                                type="text"
                                required
                                value={newPaymentTitle}
                                onChange={(e) => setNewPaymentTitle(e.target.value)}
                                placeholder="مثال: دفعة مقدمة 30% / دفعة آجل"
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-emerald-400"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-white/80 font-bold block">المبلغ (ر.س):</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                lang="en"
                                required
                                value={newPaymentAmount}
                                onChange={(e) =>
                                  setNewPaymentAmount(
                                    sanitizeEnglishNumericInput(e.target.value, true)
                                  )
                                }
                                placeholder="0.00"
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white font-mono text-xs text-start outline-none focus:border-emerald-400"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-white/80 font-bold block">تاريخ الاستحقاق:</label>
                              <CleanRtlDateInput
                                value={newPaymentDueDate}
                                onChange={setNewPaymentDueDate}
                                required
                                className="w-full bg-white/10 border border-white/20 rounded-lg pl-8 pr-3 py-2 text-white font-mono text-xs outline-none focus:border-emerald-400 cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingPayment(false);
                                setEditingPaymentId(null);
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold border border-white/20 cursor-pointer"
                            >
                              إلغاء
                            </button>
                            <button
                              type="submit"
                              disabled={isSavingPayment}
                              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold border border-emerald-400/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isSavingPayment ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>{editingPaymentId ? 'حفظ التعديل' : 'إضافة للجدول'}</span>
                            </button>
                          </div>
                        </form>
                      )}

                      {thisPOPayments.length === 0 ? (
                        <div className="text-center py-5 text-xs text-white/55 bg-black/20 rounded-xl border border-white/10">
                          لا توجد دفعات مجدولة مسجلة لأمر الشراء هذا بعد. اضغط على &quot;إضافة دفعة مجدولة +&quot; لتقسيم الدفعات أو توثيق السداد.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {thisPOPayments.map((pay) => (
                            <div
                              key={pay.id}
                              className="bg-black/30 border border-white/15 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-extrabold text-white text-xs sm:text-sm">
                                    {pay.title}
                                  </span>
                                  {pay.status === 'paid' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-300/30">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                                      <span>تم السداد</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-200 border border-amber-300/30">
                                      <Clock className="w-3 h-3 text-amber-300" />
                                      <span>مجدولة</span>
                                    </span>
                                  )}
                                </div>
                                <div className="text-white/70 flex items-center gap-3 flex-wrap">
                                  <span>
                                    المبلغ:{' '}
                                    <strong className="font-mono text-white">
                                      {toEnglishDigits(pay.amount.toLocaleString('en-US'))} ر.س
                                    </strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    تاريخ الاستحقاق:{' '}
                                    <strong className="font-mono text-white/90" dir="ltr">
                                      {toEnglishDigits(pay.due_date)}
                                    </strong>
                                  </span>
                                  {pay.paid_at && (
                                    <>
                                      <span>•</span>
                                      <span>
                                        تاريخ السداد:{' '}
                                        <strong className="font-mono text-emerald-300" dir="ltr">
                                          {toEnglishDigits(new Date(pay.paid_at).toLocaleDateString('en-US'))}
                                        </strong>
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                {pay.receipt_url && (
                                  <a
                                    href={pay.receipt_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                    className="px-2.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/35 border border-teal-300/40 text-teal-100 font-bold inline-flex items-center gap-1"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>عرض الإيصال</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}

                                {pay.status === 'scheduled' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPaymentToSettle(pay);
                                      setReceiptFileToUpload(null);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold border border-emerald-400/50 inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>تسجيل السداد وإرفاق الإيصال</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPaymentId(pay.id);
                                    setNewPaymentTitle(pay.title);
                                    setNewPaymentAmount(String(pay.amount));
                                    setNewPaymentDueDate(pay.due_date);
                                    setIsAddingPayment(true);
                                  }}
                                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white cursor-pointer"
                                  title="تعديل الدفعة"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void handleDeleteScheduledPayment(pay.id)}
                                  className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/35 text-rose-200 cursor-pointer"
                                  title="حذف الدفعة"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Status Flow Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-white/10">
              {selectedPO.status === 'PENDING_APPROVAL' && (
                <button
                  type="button"
                  onClick={() => handleUpdatePOStatus(selectedPO.id, 'SENT')}
                  className="flex-1 py-2.5 px-5 rounded-xl font-bold bg-teal-600/35 hover:bg-teal-600/50 border border-teal-400/40 text-white transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>{lang === 'en' ? 'Confirm & Dispatch Email to Supplier' : 'تأكيد وإرسال الإيميل للمورد'}</span>
                </button>
              )}

              {selectedPO.status === 'SENT' && (
                <button
                  type="button"
                  onClick={() => handleUpdatePOStatus(selectedPO.id, 'IN_TRANSIT')}
                  className="flex-1 py-2.5 px-5 rounded-xl font-bold bg-amber-500/30 hover:bg-amber-500/45 border border-amber-400/40 text-white transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>{lang === 'en' ? 'Update to: In Transit' : 'تحديث إلى: جاري التوصيل (In Transit)'}</span>
                </button>
              )}

              {!['DELIVERED', 'تم الاستلام', 'تم الاستلام بنجاح', 'مكتمل', 'completed', 'received', 'delivered'].includes(
                String(selectedPO.status || '').trim()
              ) && (
                <button
                  type="button"
                  onClick={() => setPoToComplete(selectedPO)}
                  className="flex-1 py-2.5 px-5 rounded-xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 border border-emerald-300/50 text-white shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{lang === 'en' ? 'Order Received & Close PO' : 'تم الاستلام وإغلاق الأمر'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedPO(null);
                  setIsEditingPO(false);
                }}
                className="px-6 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold py-2.5 rounded-xl transition-all text-xs sm:text-sm cursor-pointer"
              >
                {lang === 'en' ? 'Close' : 'إغلاق'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Supplier (Supplier Form Modal) */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in">
          <div className="font-sans bg-zinc-950/90 rounded-2xl w-full max-w-md p-6 space-y-4 text-white border border-white/20 shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-white/14 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/65">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {editingSupplier
                    ? (lang === 'en' ? 'Edit Supplier Details' : 'تعديل بيانات المورد')
                    : (lang === 'en' ? 'Add New Supplier' : 'إضافة مورد جديد')}
                </h3>
              </div>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-white/65 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 p-1.5 rounded-full w-7 h-7 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-white mb-1">
                    {lang === 'en' ? 'Name (Arabic):' : 'اسم المورد (عربي):'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: الصندوق المناسب"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-white mb-1">
                    {lang === 'en' ? 'Name (English):' : 'اسم المورد (إنجليزي):'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Al Sandouq Al Monaseb"
                    value={supplierForm.name_en}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name_en: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-white mb-1">
                    {lang === 'en' ? 'Location / City:' : 'الموقع (المدينة):'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: جدة"
                    value={supplierForm.city}
                    onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-white mb-1">
                    {lang === 'en' ? 'Rating (out of 5):' : 'التقييم المبدئي (من 5):'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    dir="ltr"
                    lang="en"
                    required
                    value={supplierForm.rating}
                    onChange={(e) => {
                      const clean = String(e.target.value).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
                      setSupplierForm({ ...supplierForm, rating: clean === '' ? ('' as any) : parseFloat(clean) });
                    }}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-white mb-1">
                    {lang === 'en' ? 'Delivery Time (Hours):' : 'زمن التوصيل (بالساعات):'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    dir="ltr"
                    lang="en"
                    required
                    placeholder="24"
                    value={supplierForm.delivery_time_hours}
                    onChange={(e) => {
                      const clean = String(e.target.value).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^0-9]/g, '');
                      setSupplierForm({ ...supplierForm, delivery_time_hours: clean === '' ? 0 : Number(clean) });
                    }}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-white mb-1">
                    {lang === 'en' ? 'Phone Number:' : 'رقم الهاتف:'}
                  </label>
                  <input
                    type="text"
                    placeholder="+966 12 000 0000"
                    value={supplierForm.phone_number || supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value, phone_number: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-white mb-1">
                    {lang === 'en' ? 'Commercial Registry:' : 'رقم السجل التجاري:'}
                  </label>
                  <input
                    type="text"
                    placeholder="4030123456"
                    value={supplierForm.cr_number}
                    onChange={(e) => setSupplierForm({ ...supplierForm, cr_number: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-white mb-1">
                    {lang === 'en' ? 'Tax Number:' : 'الرقم الضريبي:'}
                  </label>
                  <input
                    type="text"
                    placeholder="300123456700003"
                    value={supplierForm.tax_number}
                    onChange={(e) => setSupplierForm({ ...supplierForm, tax_number: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/65 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSavingSupplier}
                  className="flex-1 bg-white/15 hover:bg-white/25 active:scale-95 text-white border border-white/20 font-bold py-2.5 rounded-xl transition-all text-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingSupplier ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>
                    {isSavingSupplier
                      ? (lang === 'en' ? 'Saving to Database...' : 'جاري الحفظ في قاعدة البيانات...')
                      : editingSupplier
                      ? (lang === 'en' ? 'Save Changes' : 'حفظ التعديلات')
                      : (lang === 'en' ? 'Add Supplier' : 'إضافة المورد')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold py-2.5 rounded-xl transition-all text-xs cursor-pointer"
                >
                  {lang === 'en' ? 'Cancel' : 'إلغاء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Purchase Order Permanent Delete Confirmation */}
      {poToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="font-sans bg-zinc-950/95 rounded-3xl w-full max-w-md p-6 space-y-4 text-white border border-rose-500/35 shadow-[0_24px_70px_rgba(0,0,0,0.85)]">
            <div className="flex items-center gap-3 border-b border-white/15 pb-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white">تأكيد حذف أمر الشراء</h4>
                <p className="text-xs font-mono text-rose-200" dir="ltr">{toEnglishDigits(poToDelete.id)}</p>
              </div>
            </div>

            <p className="text-sm font-bold text-slate-200 leading-relaxed bg-rose-500/10 border border-rose-400/30 rounded-2xl p-4">
              هل أنت متأكد من حذف أمر الشراء هذا نهائياً؟ لا يمكن التراجع عن هذه العملية.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPoToDelete(null)}
                disabled={isDeletingPO}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeletePO()}
                disabled={isDeletingPO}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/50 shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingPO ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد الحذف النهائي</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Certified Supplier Item Price */}
      {editingSupplierItem && (() => {
        const matched = availableItems.find(
          (i) => i.item_code.toUpperCase() === editingSupplierItem.item_code.toUpperCase()
        );
        const cSize =
          matched?.units_per_carton != null && Number(matched.units_per_carton) > 0
            ? Number(matched.units_per_carton)
            : (CARTON_SIZES[editingSupplierItem.item_code.toUpperCase()] || 1);
        const normalizedStr = String(editingSupplierItem.priceStr)
          .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
          .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
          .trim();
        const parsedUnit = parseFloat(normalizedStr);
        const validUnit = !isNaN(parsedUnit) && parsedUnit >= 0 ? parsedUnit : 0;
        const cartonPrice = Number((validUnit * cSize).toFixed(4));

        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
            <div className="font-sans bg-zinc-950/95 rounded-3xl w-full max-w-md p-6 space-y-4 text-white border border-teal-500/35 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-teal-500/20 border border-teal-400/30 text-teal-300">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-white">تعديل سعر التوريد المعتمد</h4>
                    <p className="text-xs text-teal-200">{editingSupplierItem.name_ar} ({editingSupplierItem.item_code})</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSupplierItem(null)}
                  className="text-white/60 hover:text-white bg-white/10 p-1.5 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveSupplierItemPrice} className="space-y-4 text-xs">
                <div className="space-y-2">
                  <label className="block font-bold text-white">
                    سعر التوريد المتفق عليه للحبة (ر.س):
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    dir="ltr"
                    lang="en"
                    required
                    value={editingSupplierItem.priceStr}
                    onChange={(e) => {
                      const raw = String(e.target.value)
                        .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
                        .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
                      setEditingSupplierItem({ ...editingSupplierItem, priceStr: raw });
                    }}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-teal-300 font-mono"
                  />

                  <div className="rounded-xl bg-teal-950/60 border border-teal-500/30 p-3 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-200">
                      <span>سعر الحبة الواحدة:</span>
                      <span className="font-mono font-extrabold text-white" dir="ltr">
                        {toEnglishDigits(validUnit)} ر.س
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-teal-200 pt-1 border-t border-teal-500/20">
                      <span>سعر الكرتون التلقائي (× {toEnglishDigits(cSize)} حبة):</span>
                      <span className="font-mono font-extrabold text-teal-300 text-xs" dir="ltr">
                        {toEnglishDigits(cartonPrice)} ر.س
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSavingSupplierItemPrice}
                    className="flex-1 py-2.5 rounded-xl bg-teal-500/25 hover:bg-teal-500/40 text-white font-bold border border-teal-300/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingSupplierItemPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>حفظ السعر الجديد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSupplierItem(null)}
                    className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold border border-white/20 cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal: Delete / Unlink Certified Supplier Item Confirmation */}
      {supplierItemToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="font-sans bg-zinc-950/95 rounded-3xl w-full max-w-md p-6 space-y-4 text-white border border-rose-500/35 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-white/15 pb-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white">حذف الصنف من قائمة المورد</h4>
                <p className="text-xs text-rose-200">{supplierItemToDelete.name_ar} ({supplierItemToDelete.item_code})</p>
              </div>
            </div>

            <p className="text-sm font-bold text-slate-200 leading-relaxed bg-rose-500/10 border border-rose-400/30 rounded-2xl p-4">
              هل أنت متأكد من حذف وفك ارتباط الصنف ({supplierItemToDelete.name_ar}) من قائمة المنتجات المعتمدة لهذا المورد؟
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSupplierItemToDelete(null)}
                disabled={isDeletingSupplierItem}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/20 text-white cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteSupplierItem()}
                disabled={isDeletingSupplierItem}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/50 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingSupplierItem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>تأكيد الحذف</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Complete & Receive Purchase Order Confirmation */}
      {poToComplete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="font-sans bg-zinc-950/95 rounded-3xl w-full max-w-md p-6 space-y-4 text-white border border-emerald-500/40 shadow-[0_24px_70px_rgba(0,0,0,0.85)]">
            <div className="flex items-center gap-3 border-b border-white/15 pb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white">تأكيد استلام وإغلاق أمر الشراء</h4>
                <p className="text-xs font-mono text-emerald-200" dir="ltr">
                  {toEnglishDigits(poToComplete.id)} • {poToComplete.supplierName}
                </p>
              </div>
            </div>

            <div className="text-xs sm:text-sm font-bold text-slate-200 leading-relaxed bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4 space-y-2">
              <p>
                هل تؤكد استلام شحنة الصنف ({poToComplete.itemName}) بكمية{' '}
                <span className="font-mono text-emerald-300" dir="ltr">
                  {toEnglishDigits(poToComplete.quantity.toLocaleString('en-US'))}
                </span>{' '}
                وحدة؟
              </p>
              <p className="text-xs text-emerald-200/90 font-normal">
                • سيتم تأكيد استلام الشحنة وإغلاق أمر الشراء ونقله إلى أرشيف المورد.
                <br />• ملاحظة: يتم إضافة الكميات السليمة إلى رصيد المخزون يدوياً من شاشة المخزون بعد الفحص والتأكد من عدم وجود تالف.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPoToComplete(null)}
                disabled={isCompletingPO}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCompleteAndReceivePO()}
                disabled={isCompletingPO}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCompletingPO ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الاستلام والأرشفة...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد الاستلام وإغلاق الأمر</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Settle Scheduled Payment & Upload Compressed Receipt */}
      {paymentToSettle && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="font-sans bg-zinc-950/95 rounded-3xl w-full max-w-md p-6 space-y-4 text-white border border-emerald-500/40 shadow-[0_24px_70px_rgba(0,0,0,0.85)]">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-white">
                    تسجيل السداد وإرفاق الإيصال
                  </h4>
                  <p className="text-xs font-mono text-emerald-200" dir="ltr">
                    {toEnglishDigits(paymentToSettle.po_number)} • {paymentToSettle.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPaymentToSettle(null);
                  setReceiptFileToUpload(null);
                }}
                disabled={isSettlingPayment}
                className="text-white/60 hover:text-white bg-white/10 p-1.5 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSettlePayment} className="space-y-4 text-xs">
              <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-white/75">قيمة الدفعة المسددة:</span>
                  <span className="font-mono text-sm font-extrabold text-emerald-300" dir="ltr">
                    {toEnglishDigits(paymentToSettle.amount.toLocaleString('en-US'))} ر.س
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/75">تاريخ الاستحقاق:</span>
                  <span className="font-mono text-white" dir="ltr">
                    {toEnglishDigits(paymentToSettle.due_date)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-white">
                  إرفاق صورة إيصال التحويل أو ملف PDF (اختياري):
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setReceiptFileToUpload(f);
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-white text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-teal-500/30 file:text-teal-100 hover:file:bg-teal-500/45 cursor-pointer"
                />
                <p className="text-[11px] text-teal-200/80">
                  • يتم ضغط صور الإيصالات تلقائياً في المتصفح (بحد أقصى 1200px وجودة 0.7 ~ 120KB) قبل الرفع لتوفير مساحة التخزين.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentToSettle(null);
                    setReceiptFileToUpload(null);
                  }}
                  disabled={isSettlingPayment}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/20 text-white cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSettlingPayment}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white border border-emerald-300/50 shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSettlingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ ورفع الإيصال...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد السداد وحفظ الإيصال</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Purchase Order (طلب توريد مع ملخص الاتفاق و 3 طرق دفع بتواريخ صريحة) */}
      {isCreatePOModalOpen && (() => {
        const matchedCatalogItem = availableItems.find(
          (i) => (i.item_code || '').toUpperCase() === createPOItemCode.toUpperCase()
        );
        const uPerCarton =
          matchedCatalogItem?.units_per_carton != null &&
          Number(matchedCatalogItem.units_per_carton) > 0
            ? Number(matchedCatalogItem.units_per_carton)
            : CARTON_SIZES[createPOItemCode.toUpperCase()] || 1;
        const cartonsCount = Math.max(1, Math.round((createPOQuantityUnits || 0) / uPerCarton));
        const parsedUnitPrice = parseFloat(
          String(createPOUnitPriceStr)
            .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
            .trim()
        );
        const validUnitPrice = !isNaN(parsedUnitPrice) && parsedUnitPrice >= 0 ? parsedUnitPrice : 0;
        const calculatedTotalCost = Number(((createPOQuantityUnits || 0) * validUnitPrice).toFixed(2));

        const parsedDeposit = parseFloat(
          String(createPODepositAmountStr)
            .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
            .trim()
        );
        const validDeposit = !isNaN(parsedDeposit) && parsedDeposit >= 0 ? parsedDeposit : 0;
        const calculatedRemainingBalance = Math.max(
          0,
          Number((calculatedTotalCost - validDeposit).toFixed(2))
        );

        return (
          <div className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in">
            <div className="font-sans bg-zinc-950/95 rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-5 text-white border border-teal-500/35 shadow-[0_24px_70px_rgba(0,0,0,0.85)]">
              <div className="flex items-center justify-between border-b border-white/15 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-teal-500/20 border border-teal-400/40 text-teal-300">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-white">
                      طلب توريد جديد
                    </h3>
                    <p className="text-xs text-teal-200/85">
                      المورد: <strong>{createPOSupplierName}</strong> • الصنف:{' '}
                      <strong>
                        {createPOItemName} ({createPOItemCode})
                      </strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatePOModalOpen(false)}
                  disabled={isSubmittingQuickOrder}
                  className="text-white/60 hover:text-white bg-white/10 p-1.5 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitCreatePOModal} className="space-y-4 text-xs">
                {/* 1. Quantity (Cartons & Units) & Agreed Price */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/[0.03] border border-white/15 rounded-2xl p-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-white flex items-center justify-between">
                      <span>الكمية (بالكرتون):</span>
                      <span className="text-[10px] font-mono text-teal-300" lang="en">
                        {uPerCarton.toLocaleString('en-US')} حبة/كرتون
                      </span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      lang="en"
                      dir="ltr"
                      value={createPOQuantityUnits > 0 ? String(cartonsCount) : ''}
                      onChange={(e) => {
                        const clean = sanitizeEnglishNumericInput(e.target.value, false);
                        const c = clean === '' ? 0 : parseInt(clean, 10) || 0;
                        const nextUnits = c * uPerCarton;
                        setCreatePOQuantityUnits(nextUnits);
                        const nextTot = Number((nextUnits * validUnitPrice).toFixed(2));
                        if (createPOCreditInstallments.length === 1) {
                          setCreatePOCreditInstallments([
                            { ...createPOCreditInstallments[0], amount: String(nextTot) },
                          ]);
                        }
                        if (createPOBalanceInstallments.length === 1) {
                          const rem = Math.max(0, Number((nextTot - validDeposit).toFixed(2)));
                          setCreatePOBalanceInstallments([
                            { ...createPOBalanceInstallments[0], amount: String(rem) },
                          ]);
                        }
                      }}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold text-center outline-none focus:border-teal-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-white block">إجمالي الوحدات (حبة):</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      lang="en"
                      dir="ltr"
                      value={createPOQuantityUnits > 0 ? String(createPOQuantityUnits) : ''}
                      onChange={(e) => {
                        const clean = sanitizeEnglishNumericInput(e.target.value, false);
                        const nextUnits = clean === '' ? 0 : parseInt(clean, 10) || 0;
                        setCreatePOQuantityUnits(nextUnits);
                        const nextTot = Number((nextUnits * validUnitPrice).toFixed(2));
                        if (createPOCreditInstallments.length === 1) {
                          setCreatePOCreditInstallments([
                            { ...createPOCreditInstallments[0], amount: String(nextTot) },
                          ]);
                        }
                        if (createPOBalanceInstallments.length === 1) {
                          const rem = Math.max(0, Number((nextTot - validDeposit).toFixed(2)));
                          setCreatePOBalanceInstallments([
                            { ...createPOBalanceInstallments[0], amount: String(rem) },
                          ]);
                        }
                      }}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold text-center outline-none focus:border-teal-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-white flex items-center justify-between">
                      <span>سعر الحبة (ر.س):</span>
                      <span className="text-[11px] font-mono text-emerald-300" lang="en">
                        الإجمالي: {calculatedTotalCost.toLocaleString('en-US')} ر.س
                      </span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      lang="en"
                      dir="ltr"
                      value={createPOUnitPriceStr}
                      onChange={(e) => {
                        const raw = sanitizeEnglishNumericInput(e.target.value, true);
                        setCreatePOUnitPriceStr(raw);
                        const p = parseFloat(raw);
                        if (!isNaN(p) && p >= 0) {
                          const nextTot = Number(((createPOQuantityUnits || 0) * p).toFixed(2));
                          if (createPOCreditInstallments.length === 1) {
                            setCreatePOCreditInstallments([
                              { ...createPOCreditInstallments[0], amount: String(nextTot) },
                            ]);
                          }
                          if (createPOBalanceInstallments.length === 1) {
                            const rem = Math.max(0, Number((nextTot - validDeposit).toFixed(2)));
                            setCreatePOBalanceInstallments([
                              { ...createPOBalanceInstallments[0], amount: String(rem) },
                            ]);
                          }
                        }
                      }}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-emerald-300 font-mono text-sm font-bold text-center outline-none focus:border-teal-400"
                    />
                  </div>
                </div>

                {/* 2. Per-PO Agreement Summary Input (ملخص الاتفاق الخاص بهذا الأمر) */}
                <div className="space-y-1.5">
                  <label className="font-bold text-teal-200 block">
                    ملخص الاتفاق الخاص بهذا الأمر (اختياري):
                  </label>
                  <input
                    type="text"
                    value={createPONotes}
                    onChange={(e) => setCreatePONotes(e.target.value)}
                    placeholder="مثال: التوريد على دفعتين خلال 48 ساعة..."
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-teal-400"
                  />
                </div>

                {/* 3. Payment Method Selector (3 Options with Explicit Dates) */}
                <div className="space-y-3 bg-white/[0.03] border border-white/15 rounded-2xl p-4">
                  <label className="font-extrabold text-white block text-xs sm:text-sm">
                    طريقة الدفع وجدولة الاستحقاق (بتواريخ صريحة YYYY-MM-DD):
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setCreatePOPaymentType('full_payment')}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                        createPOPaymentType === 'full_payment'
                          ? 'bg-teal-500/25 border-teal-300/60 text-white shadow-md'
                          : 'bg-white/5 border-white/15 text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="font-extrabold text-xs">1. دفع كامل</div>
                      <div className="text-[11px] text-white/60 mt-0.5">
                        كاش أو تحويل مباشر لكامل القيمة
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCreatePOPaymentType('deposit_and_balance');
                        const dep = validDeposit > 0 ? validDeposit : Number((calculatedTotalCost * 0.3).toFixed(2));
                        setCreatePODepositAmountStr(String(dep));
                        const rem = Math.max(0, Number((calculatedTotalCost - dep).toFixed(2)));
                        setCreatePOBalanceInstallments([
                          {
                            title: 'دفعة المتبقي #1',
                            amount: String(rem),
                            dueDate: createPOBalanceInstallments[0]?.dueDate || '',
                          },
                        ]);
                      }}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                        createPOPaymentType === 'deposit_and_balance'
                          ? 'bg-teal-500/25 border-teal-300/60 text-white shadow-md'
                          : 'bg-white/5 border-white/15 text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="font-extrabold text-xs">2. عربون + متبقي مجدول</div>
                      <div className="text-[11px] text-white/60 mt-0.5">
                        دفعة مقدمة وتقسيم الباقي بتواريخ محددة
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCreatePOPaymentType('full_credit');
                        setCreatePOCreditInstallments([
                          {
                            title: 'دفعة آجل #1',
                            amount: String(calculatedTotalCost),
                            dueDate: createPOCreditInstallments[0]?.dueDate || '',
                          },
                        ]);
                      }}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                        createPOPaymentType === 'full_credit'
                          ? 'bg-teal-500/25 border-teal-300/60 text-white shadow-md'
                          : 'bg-white/5 border-white/15 text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="font-extrabold text-xs">3. آجل بالكامل</div>
                      <div className="text-[11px] text-white/60 mt-0.5">
                        جدولة كامل المبلغ لدفعة أو عدة دفعات
                      </div>
                    </button>
                  </div>

                  {/* Option 1 Body: Full Payment */}
                  {createPOPaymentType === 'full_payment' && (
                    <div className="bg-black/35 border border-white/15 rounded-xl p-4 space-y-3 mt-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createPOFullPaidNow}
                            onChange={(e) => setCreatePOFullPaidNow(e.target.checked)}
                            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                          />
                          <span className="font-extrabold text-emerald-200">
                            تم الدفع الآن ({toEnglishDigits(calculatedTotalCost.toLocaleString('en-US'))} ر.س)
                          </span>
                        </label>
                        <span className="text-[11px] text-white/60">
                          {createPOFullPaidNow
                            ? 'سيتم قيد الدفعة كمسددة (paid) مباشرة'
                            : 'سيتم قيد الدفعة كمجدولة (scheduled) بتاريخ الاستحقاق'}
                        </span>
                      </div>

                      {createPOFullPaidNow ? (
                        <div className="space-y-1.5">
                          <label className="block font-bold text-white/85">
                            إرفاق صورة إيصال التحويل أو PDF (اختياري - يُضغط تلقائياً):
                          </label>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => setCreatePOReceiptFile(e.target.files?.[0] || null)}
                            className="w-full bg-white/10 border border-white/20 rounded-xl p-2 text-white text-xs file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-teal-500/30 file:text-teal-100 cursor-pointer"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-w-xs">
                          <label className="block font-bold text-amber-200">
                            تاريخ الاستحقاق المحدد:
                          </label>
                          <CleanRtlDateInput
                            value={createPOFullDueDate}
                            onChange={setCreatePOFullDueDate}
                            required
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Option 2 Body: Deposit + Scheduled Balance */}
                  {createPOPaymentType === 'deposit_and_balance' && (
                    <div className="bg-black/35 border border-white/15 rounded-xl p-4 space-y-4 mt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="block font-bold text-white">قيمة العربون (ر.س):</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            lang="en"
                            dir="ltr"
                            required
                            value={createPODepositAmountStr}
                            onChange={(e) => {
                              const raw = sanitizeEnglishNumericInput(e.target.value, true);
                              setCreatePODepositAmountStr(raw);
                              const dep = parseFloat(raw);
                              if (!isNaN(dep) && dep >= 0 && createPOBalanceInstallments.length === 1) {
                                const rem = Math.max(
                                  0,
                                  Number((calculatedTotalCost - dep).toFixed(2))
                                );
                                setCreatePOBalanceInstallments([
                                  { ...createPOBalanceInstallments[0], amount: String(rem) },
                                ]);
                              }
                            }}
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white font-mono font-bold text-start outline-none focus:border-teal-400"
                          />
                        </div>

                        <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl p-3 flex flex-col justify-center">
                          <span className="text-[11px] text-amber-200/80">
                            المبلغ المتبقي التلقائي (الإجمالي - العربون):
                          </span>
                          <span className="text-base font-extrabold font-mono text-amber-300 mt-0.5" dir="ltr">
                            {toEnglishDigits(calculatedRemainingBalance.toLocaleString('en-US'))} ر.س
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-white/10 pt-3">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createPODepositPaidNow}
                            onChange={(e) => setCreatePODepositPaidNow(e.target.checked)}
                            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                          />
                          <span className="font-extrabold text-emerald-200">
                            تم دفع العربون الآن
                          </span>
                        </label>

                        {createPODepositPaidNow ? (
                          <div className="space-y-1">
                            <label className="block font-bold text-white/80">
                              إرفاق إيصال سداد العربون (اختياري):
                            </label>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={(e) => setCreatePOReceiptFile(e.target.files?.[0] || null)}
                              className="w-full bg-white/10 border border-white/20 rounded-xl p-2 text-white text-xs file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-teal-500/30 file:text-teal-100 cursor-pointer"
                            />
                          </div>
                        ) : (
                          <div className="space-y-1 max-w-xs">
                            <label className="block font-bold text-amber-200">
                              تاريخ استحقاق العربون:
                            </label>
                            <CleanRtlDateInput
                              value={createPODepositDueDate}
                              onChange={setCreatePODepositDueDate}
                              required
                            />
                          </div>
                        )}
                      </div>

                      {/* Scheduled Balance Installments */}
                      <div className="space-y-2.5 border-t border-white/10 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-teal-200">
                            جدولة دفعات المبلغ المتبقي ({toEnglishDigits(calculatedRemainingBalance.toLocaleString('en-US'))} ر.س):
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCreatePOBalanceInstallments((prev) => [
                                ...prev,
                                {
                                  title: `دفعة المتبقي #${prev.length + 1}`,
                                  amount: '0',
                                  dueDate: '',
                                },
                              ])
                            }
                            className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/35 border border-teal-300/40 text-teal-100 font-bold text-[11px] cursor-pointer"
                          >
                            + تقسيم المتبقي لدفعة إضافية
                          </button>
                        </div>

                        {createPOBalanceInstallments.map((inst, idx) => (
                          <div
                            key={`bal-inst-${idx}`}
                            className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-white/[0.03] border border-white/10 rounded-xl p-2.5"
                          >
                            <div className="sm:col-span-4 space-y-1">
                              <label className="text-[11px] text-white/70 block">بيان الدفعة:</label>
                              <input
                                type="text"
                                required
                                value={inst.title}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCreatePOBalanceInstallments((prev) =>
                                    prev.map((row, i) => (i === idx ? { ...row, title: val } : row))
                                  );
                                }}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none"
                              />
                            </div>

                            <div className="sm:col-span-3 space-y-1">
                              <label className="text-[11px] text-white/70 block">المبلغ (ر.س):</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                lang="en"
                                required
                                dir="ltr"
                                value={inst.amount}
                                onChange={(e) => {
                                  const val = sanitizeEnglishNumericInput(e.target.value, true);
                                  setCreatePOBalanceInstallments((prev) =>
                                    prev.map((row, i) => (i === idx ? { ...row, amount: val } : row))
                                  );
                                }}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs text-start outline-none"
                              />
                            </div>

                            <div className="sm:col-span-4 space-y-1">
                              <label className="text-[11px] text-white/70 block">تاريخ الاستحقاق:</label>
                              <CleanRtlDateInput
                                value={inst.dueDate}
                                onChange={(val) =>
                                  setCreatePOBalanceInstallments((prev) =>
                                    prev.map((row, i) => (i === idx ? { ...row, dueDate: val } : row))
                                  )
                                }
                                required
                              />
                            </div>

                            <div className="sm:col-span-1 flex justify-end">
                              {createPOBalanceInstallments.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCreatePOBalanceInstallments((prev) =>
                                      prev.filter((_, i) => i !== idx)
                                    )
                                  }
                                  className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-400/30 cursor-pointer"
                                  title="حذف الدفعة"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Option 3 Body: Full Credit Installments */}
                  {createPOPaymentType === 'full_credit' && (
                    <div className="bg-black/35 border border-white/15 rounded-xl p-4 space-y-3 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-teal-200">
                          جدولة دفعات الآجل ({toEnglishDigits(calculatedTotalCost.toLocaleString('en-US'))} ر.س):
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCreatePOCreditInstallments((prev) => [
                              ...prev,
                              {
                                title: `دفعة آجل #${prev.length + 1}`,
                                amount: '0',
                                dueDate: '',
                              },
                            ])
                          }
                          className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/35 border border-teal-300/40 text-teal-100 font-bold text-[11px] cursor-pointer"
                        >
                          + إضافة دفعة أخرى
                        </button>
                      </div>

                      {createPOCreditInstallments.map((inst, idx) => (
                        <div
                          key={`cred-inst-${idx}`}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-white/[0.03] border border-white/10 rounded-xl p-2.5"
                        >
                          <div className="sm:col-span-4 space-y-1">
                            <label className="text-[11px] text-white/70 block">بيان الدفعة:</label>
                            <input
                              type="text"
                              required
                              value={inst.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCreatePOCreditInstallments((prev) =>
                                  prev.map((row, i) => (i === idx ? { ...row, title: val } : row))
                                );
                              }}
                              className="w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none"
                            />
                          </div>

                          <div className="sm:col-span-3 space-y-1">
                            <label className="text-[11px] text-white/70 block">المبلغ (ر.س):</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              lang="en"
                              required
                              dir="ltr"
                              value={inst.amount}
                              onChange={(e) => {
                                const val = sanitizeEnglishNumericInput(e.target.value, true);
                                setCreatePOCreditInstallments((prev) =>
                                  prev.map((row, i) => (i === idx ? { ...row, amount: val } : row))
                                );
                              }}
                              className="w-full bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs text-start outline-none"
                            />
                          </div>

                          <div className="sm:col-span-4 space-y-1">
                            <label className="text-[11px] text-white/70 block">تاريخ الاستحقاق:</label>
                            <CleanRtlDateInput
                              value={inst.dueDate}
                              onChange={(val) =>
                                setCreatePOCreditInstallments((prev) =>
                                  prev.map((row, i) => (i === idx ? { ...row, dueDate: val } : row))
                                )
                              }
                              required
                            />
                          </div>

                          <div className="sm:col-span-1 flex justify-end">
                            {createPOCreditInstallments.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setCreatePOCreditInstallments((prev) =>
                                    prev.filter((_, i) => i !== idx)
                                  )
                                }
                                className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-400/30 cursor-pointer"
                                title="حذف الدفعة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/15">
                  <button
                    type="button"
                    onClick={() => setIsCreatePOModalOpen(false)}
                    disabled={isSubmittingQuickOrder}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/20 text-white cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingQuickOrder}
                    className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white border border-teal-300/50 shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingQuickOrder ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري إصدار الأمر وجدولة الدفعات...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>اعتماد وإصدار أمر الشراء</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
