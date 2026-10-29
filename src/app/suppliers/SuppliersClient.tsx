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
  SupplierItemRecord,
  fetchPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  fetchAllSupplierItems,
  fetchSuppliersForItem,
  SupabasePurchaseOrder,
  SupabaseSupplierItem
} from '@/lib/supabaseService';
import { getAuthenticatedPOUser, formatPOCreatorDisplay } from '@/lib/poAuth';
import { useSession } from 'next-auth/react';
import { compareItemCodes } from '@/constants/inventoryCodes';
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
  Check,
  AlertTriangle,
  Calendar,
  Filter,
  RotateCcw
} from 'lucide-react';

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
  const rawAvailableItems: SupabaseInventoryItem[] = (initialInventoryItems && initialInventoryItems.length > 0)
    ? initialInventoryItems
    : [];

  const availableItems = [...rawAvailableItems].sort((a, b) =>
    compareItemCodes(a.item_code, b.item_code)
  );
  
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

  // Ensure single true state of the database with unique IDs on mount
  useEffect(() => {
    fetchPurchaseOrders()
      .then(pos => {
        if (pos && pos.length > 0) {
          setPurchaseOrders(pos as unknown as PurchaseOrder[]);
        }
      })
      .catch(console.warn);

    fetchAllSupplierItems()
      .then(items => {
        if (items && items.length > 0) {
          setAllSupplierItems(items);
        }
      })
      .catch(console.warn);
  }, []);

  useEffect(() => {
    if (availableItems && availableItems.length > 0 && !analyzingItemId) {
      setAnalyzingItemId(availableItems[0].item_code);
    }
  }, [availableItems, analyzingItemId]);

  // PO Edit State
  const [isEditingPO, setIsEditingPO] = useState<boolean>(false);
  const [editPOQuantity, setEditPOQuantity] = useState<number>(0);
  const [editPOSupplier, setEditPOSupplier] = useState<string>('');
  const [poAvailableSuppliers, setPoAvailableSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingPOSuppliers, setIsLoadingPOSuppliers] = useState<boolean>(false);

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
  const [agreedUnitPrice, setAgreedUnitPrice] = useState<number>(0.5);
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
    loadSupplierItems(sup.id);
    fetchPurchaseOrders()
      .then(pos => {
        if (pos && pos.length > 0) {
          setPurchaseOrders(pos as unknown as PurchaseOrder[]);
        }
      })
      .catch(console.warn);
  };

  const handleCloseSupplierProfile = () => {
    setSelectedProfileSupplier(null);
    setIsAddItemModalOpen(false);
  };

  const handleAddCertifiedItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProfileSupplier || !selectedItemToAdd) return;
    setIsSavingNewItem(true);
    try {
      const record = await addSupplierItem(selectedProfileSupplier.id, selectedItemToAdd, agreedUnitPrice);
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

  // AI auto-link suggestion based on supplier category and inventory items
  const handleAutoLinkAiItems = async () => {
    if (!selectedProfileSupplier) return;
    const sCat = selectedProfileSupplier.category || '';
    let candidates = availableItems.filter(i => i.category_ar === sCat);
    if (candidates.length === 0) {
      candidates = availableItems.slice(0, 2);
    }

    for (const item of candidates) {
      await addSupplierItem(selectedProfileSupplier.id, item.item_code, item.cost_per_unit || 0.45);
    }
    loadSupplierItems(selectedProfileSupplier.id);
    fetchAllSupplierItems().then(items => { if (items?.length) setAllSupplierItems(items); }).catch(console.warn);
    showToast(
      lang === 'en'
        ? 'AI Agent linked relevant products to supplier catalog successfully'
        : 'قام الوكيل الذكي بربط وتحديث الأصناف المتوافقة مع المورد تلقائياً'
    );
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

  const handleQuickOrder = async (supplierName: string, itemName: string, unitPrice?: number) => {
    const authUser = getAuthenticatedPOUser(session, lang);
    if (!authUser) {
      showError(
        lang === 'en'
          ? 'Unauthorized: Cannot create a Purchase Order without an authenticated user session.'
          : 'عذراً، لا يمكن إنشاء أمر شراء بدون جلسة مستخدم موثقة. يرجى تسجيل الدخول أولاً.'
      );
      return;
    }

    if (isSubmittingQuickOrder) return;
    setIsSubmittingQuickOrder(true);

    try {
      const matchedItem = availableItems.find(i => i.item_name_ar === itemName || i.item_name_en === itemName || i.item_code === analyzingItemId);
      const matchedSupplier = suppliers.find(s =>
        s.name_ar === supplierName ||
        s.name === supplierName ||
        s.name_en === supplierName
      );
      const supplierId = matchedSupplier?.id;
      const unitCost = unitPrice ?? matchedItem?.cost_per_unit ?? 0.45;
      const quantity = 2500;
      const totalCost = Number((quantity * unitCost).toFixed(2));
      const itemCode = matchedItem?.item_code || analyzingItemId || 'P1';
      const resolvedItemName = matchedItem?.item_name_ar || itemName || itemCode;

      // 1. Generate unique PO Number
      const poNum = `PO-${Math.floor(1000 + Math.random() * 9000)}`;

      // 2. Insert into Supabase purchase_orders table linking created_by strictly to authenticated user.id
      const createdFromDB = await createPurchaseOrder({
        po_number: poNum,
        supplier_id: supplierId,
        inventory_item_code: itemCode,
        quantity,
        total_cost: totalCost,
        status: 'PENDING_APPROVAL',
        created_by: authUser.id,
      });

      const createdPO: PurchaseOrder = {
        ...createdFromDB,
        createdBy: createdFromDB.createdBy || authUser.displayName,
        createdById: authUser.id,
        items: [{ itemId: itemCode, itemName: resolvedItemName, quantity }],
      };
      addPurchaseOrderToSession(createdPO);

      // 3. RE-FETCH the entire PO list from Supabase (strictly ensuring tracking table reflects single true state)
      const freshPOs = await fetchPurchaseOrders();
      if (freshPOs && freshPOs.length > 0) {
        const merged = (freshPOs as unknown as PurchaseOrder[]).map(p =>
          p.id === poNum ? { ...p, createdBy: p.createdBy || authUser.displayName, createdById: p.createdById || authUser.id } : p
        );
        setPurchaseOrders(merged);
      } else {
        setPurchaseOrders(prev => [createdPO, ...prev.filter(p => p.id !== poNum)]);
      }

      showToast(
        lang === 'en'
          ? `New purchase order (${poNum}) issued by (${authUser.displayName}) for supplier (${supplierName})!`
          : `تم إصدار أمر شراء جديد (${poNum}) بواسطة (${authUser.displayName}) للمورد (${supplierName}) بنجاح!`
      );
    } catch (err: any) {
      console.error('Failed to create purchase order in Supabase:', err);
      showError(
        lang === 'en'
          ? `Failed to issue purchase order: ${err?.message || 'Database error'}`
          : `تعذر إصدار أمر الشراء: ${err?.message || 'خطأ في قاعدة البيانات'}`
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

  const handleOpenEditPO = async () => {
    const authUser = getAuthenticatedPOUser(session, lang);
    if (!authUser) {
      showError(
        lang === 'en'
          ? 'Unauthorized: Sign in required to modify Purchase Orders.'
          : 'عذراً، يجب تسجيل الدخول أولاً لتعديل أوامر الشراء.'
      );
      return;
    }
    if (!selectedPO) return;
    setEditPOQuantity(selectedPO.quantity);
    setEditPOSupplier(selectedPO.supplierName);
    setIsEditingPO(true);

    // Resolve the itemCode for the specific item being edited
    const itemCode = (
      selectedPO.itemId ||
      availableItems.find(i =>
        i.item_name_ar === selectedPO.itemName ||
        i.item_name_en === selectedPO.itemName ||
        i.item_code === selectedPO.itemId
      )?.item_code ||
      mockInventoryItems.find(i =>
        i.item_name_ar === selectedPO.itemName ||
        i.item_name_en === selectedPO.itemName ||
        i.item_code === selectedPO.itemId
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

    if (initialList.length > 0) {
      setPoAvailableSuppliers(initialList);
      if (!initialList.some(s => s.name === selectedPO.supplierName)) {
        setEditPOSupplier(initialList[0].name);
      }
    } else if (selectedPO.supplierName) {
      setPoAvailableSuppliers([{ id: selectedPO.supplier_id || selectedPO.supplierId || 'curr', name: selectedPO.supplierName }]);
    }

    // 2. Dynamic fetch directly from Supabase supplier_items junction table
    if (itemCode) {
      setIsLoadingPOSuppliers(initialList.length === 0);
      try {
        const dbSuppliers = await fetchSuppliersForItem(itemCode);
        if (dbSuppliers && dbSuppliers.length > 0) {
          setPoAvailableSuppliers(dbSuppliers);
          if (!dbSuppliers.some(s => s.name === selectedPO.supplierName)) {
            setEditPOSupplier(dbSuppliers[0].name);
          }
        }
      } catch (err) {
        console.error('Failed to fetch suppliers for PO item:', err);
      } finally {
        setIsLoadingPOSuppliers(false);
      }
    }
  };

  const handleSavePOEdit = () => {
    const authUser = getAuthenticatedPOUser(session, lang);
    if (!authUser) {
      showError(
        lang === 'en'
          ? 'Unauthorized: Sign in required to save Purchase Order changes.'
          : 'عذراً، يجب تسجيل الدخول أولاً لحفظ تعديلات أمر الشراء.'
      );
      return;
    }
    if (!selectedPO) return;

    const matchedItem = availableItems.find(i => i.item_name_ar === selectedPO.itemName || i.item_code === selectedPO.itemId);
    const unitCost = matchedItem?.cost_per_unit || 0.5;
    const newTotalCost = Number((editPOQuantity * unitCost).toFixed(2));
    const matchedSupplier = poAvailableSuppliers.find(s => s.name === editPOSupplier) ||
      suppliers.find(s => s.name_ar === editPOSupplier || s.name_en === editPOSupplier || s.name === editPOSupplier);

    const updatedPO: PurchaseOrder = {
      ...selectedPO,
      quantity: editPOQuantity,
      supplierName: editPOSupplier,
      supplier_id: matchedSupplier?.id || selectedPO.supplier_id,
      supplierId: matchedSupplier?.id || selectedPO.supplierId,
      totalCost: newTotalCost,
    };

    setPurchaseOrders(prev => prev.map(p => p.id === selectedPO.id ? updatedPO : p));
    setSelectedPO(updatedPO);
    setIsEditingPO(false);
    showToast(
      lang === 'en'
        ? `Purchase order (${updatedPO.id}) modifications saved successfully`
        : `تم حفظ تعديلات أمر الشراء (${updatedPO.id}) بنجاح`
    );
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

                          {/* Action Quick Button */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPO(po);
                                  setIsEditingPO(false);
                                }}
                                className="text-xs font-bold text-white bg-white/8 hover:bg-white/15 border border-white/20 px-3 py-1.5 rounded-[18px] transition-all cursor-pointer"
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
                        onClick={() => handleQuickOrder(quote.supplierName, selectedItem.item_name_ar, quote.unitPrice)}
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

        // 2. Fetch and display ONLY completed POs where po.supplier_id === currentSupplier.id AND po.status === 'تم الاستلام'
        const archivedPOs = purchaseOrders.filter(po => {
          // Status must be received / delivered
          const status = (po.status || '').trim().toLowerCase();
          const orig = (po.status || '').trim();
          const isReceived = orig === 'تم الاستلام' || orig === 'تم الاستلام بنجاح' || status === 'received' || status === 'delivered';
          if (!isReceived) return false;

          // Supplier ID match strictly
          const poSupId = po.supplier_id || po.supplierId;
          return poSupId === currentSupplierId;
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
                        onClick={handleAutoLinkAiItems}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
                        title={lang === 'en' ? 'Auto-link items via AI Agent' : 'ربط واقتراح الأصناف المتوافقة تلقائياً عبر الـ AI'}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                        <span>{lang === 'en' ? 'AI Auto-Link' : 'اقتراح ذكي (AI)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemToAdd(availableItems[0]?.item_code || '');
                          setAgreedUnitPrice(availableItems[0]?.cost_per_unit || 0.5);
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
                                    {lang === 'en' ? 'Click "Add Item to Supplier" or use "AI Auto-Link" to map catalog items' : 'اضغط على "إضافة صنف جديد للمورد" أو استخدم الاقتراح الذكي لربط المواد التموينية'}
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
                                  <button
                                    type="button"
                                    disabled={isSubmittingQuickOrder}
                                    onClick={() => handleQuickOrder(sup.name_ar || sup.name || '', item.name_ar || item.item_code, item.cost_per_unit)}
                                    className={`text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto ${
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

              {/* Section 2: Invoices & PO Archive (Strictly Completed POs with po.status === 'تم الاستلام') */}
              {(profileActiveTab === 'archive' || profileActiveTab === 'all') && (
                <div className="space-y-4">
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
                      <input
                        type="date"
                        value={profileDateStart}
                        onChange={(e) => setProfileDateStart(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-teal-300 font-mono"
                      />
                    </div>

                    {/* Date End */}
                    <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                      <span className="text-white/60 shrink-0">{lang === 'en' ? 'To:' : 'إلى تاريخ:'}</span>
                      <input
                        type="date"
                        value={profileDateEnd}
                        onChange={(e) => setProfileDateEnd(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-teal-300 font-mono"
                      />
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
                                    <span>{lang === 'en' ? 'Received' : 'تم الاستلام'}</span>
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
                          if (matched?.cost_per_unit) {
                            setAgreedUnitPrice(matched.cost_per_unit);
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

                    <div>
                      <label className="block font-bold text-white mb-1.5">
                        {lang === 'en' ? 'Agreed Unit Supply Price (SAR):' : 'سعر التوريد المتفق عليه (ر.س):'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        dir="ltr"
                        lang="en"
                        required
                        value={agreedUnitPrice}
                        onChange={(e) => {
                          const clean = String(e.target.value).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
                          setAgreedUnitPrice(clean === '' ? 0 : Number(clean));
                        }}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-300 font-mono"
                      />
                    </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-md animate-in fade-in duration-200">
          <div className="font-sans bg-black/75 backdrop-blur-2xl rounded-3xl w-full max-w-4xl lg:max-w-5xl max-h-[94vh] overflow-y-auto p-5 sm:p-6 space-y-4 text-white border border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.7)] relative flex flex-col">
            
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

              {/* Action Buttons: Edit Toggle & Close (X) Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={isEditingPO ? () => setIsEditingPO(false) : handleOpenEditPO}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition-all cursor-pointer"
                  title={lang === 'en' ? 'Edit purchase order details' : 'تعديل تفاصيل أمر الشراء'}
                >
                  <Edit2 size={14} className="text-white/80" />
                  <span>{isEditingPO ? (lang === 'en' ? 'Cancel' : 'إلغاء') : (lang === 'en' ? 'Edit' : 'تعديل')}</span>
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
            {isEditingPO ? (
              <div className="bg-white/[0.04] rounded-2xl p-4 sm:p-5 border border-white/20 space-y-4 text-sm">
                <div className="font-bold text-white border-b border-white/15 pb-2 flex items-center justify-between">
                  <span>{lang === 'en' ? 'Edit Purchase Order Details' : 'تعديل بيانات أمر الشراء'}</span>
                  <span className="font-mono text-xs text-white/60" dir="ltr" lang="en">{toEnglishDigits(selectedPO.id)}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      {isLoadingPOSuppliers ? (
                        <option value="" className="bg-slate-900 text-white">
                          {lang === 'en' ? 'Loading approved suppliers...' : 'جاري جلب الموردين المعتمدين لهذا الصنف...'}
                        </option>
                      ) : poAvailableSuppliers.length === 0 ? (
                        <option value={editPOSupplier || selectedPO.supplierName} className="bg-slate-900 text-white">
                          {editPOSupplier || selectedPO.supplierName || (lang === 'en' ? 'No approved supplier registered' : 'لا يوجد مورد معتمد مسجل لهذا الصنف')}
                        </option>
                      ) : (
                        poAvailableSuppliers.map(s => (
                          <option key={s.id} value={s.name} className="bg-slate-900 text-white">
                            {s.name}
                          </option>
                        ))
                      )}
                    </GlassSelect>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white flex justify-between items-center">
                      <span>{lang === 'en' ? 'Requested Quantity (Units):' : 'الكمية المطلوبة (وحدة):'}</span>
                      <span className="text-[10px] text-white/50 font-mono">0-9</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="100"
                      dir="ltr"
                      lang="en"
                      value={editPOQuantity}
                      onChange={(e) => {
                        const clean = String(e.target.value)
                          .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
                          .replace(/[^0-9]/g, '');
                        setEditPOQuantity(clean === '' ? 0 : Number(clean));
                      }}
                      className="w-full bg-white/10 border border-white/20 rounded-xl p-2.5 text-sm text-white focus:outline-none font-mono text-center font-bold"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={handleSavePOEdit}
                    className="flex-1 bg-emerald-600/40 hover:bg-emerald-600/60 text-white font-bold py-2.5 rounded-xl transition-all text-xs sm:text-sm cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-400/40"
                  >
                    <Check className="w-4 h-4" />
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
            ) : (
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
                      {(selectedPO.status === 'DELIVERED' || selectedPO.status === 'تم الاستلام') && (lang === 'en' ? 'Delivered' : 'تم الاستلام')}
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
              </div>
            )}

            {/* Status Flow Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-white/10">
              {selectedPO.status === 'PENDING_APPROVAL' && (
                <button
                  onClick={() => handleUpdatePOStatus(selectedPO.id, 'SENT')}
                  className="flex-1 py-2.5 px-5 rounded-xl font-bold bg-emerald-600/35 hover:bg-emerald-600/50 border border-emerald-400/40 text-white transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>{lang === 'en' ? 'Confirm & Dispatch Email to Supplier' : 'تأكيد وإرسال الإيميل للمورد'}</span>
                </button>
              )}

              {selectedPO.status === 'SENT' && (
                <button
                  onClick={() => handleUpdatePOStatus(selectedPO.id, 'IN_TRANSIT')}
                  className="flex-1 py-2.5 px-5 rounded-xl font-bold bg-amber-500/30 hover:bg-amber-500/45 border border-amber-400/40 text-white transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>{lang === 'en' ? 'Update to: In Transit' : 'تحديث إلى: جاري التوصيل (In Transit)'}</span>
                </button>
              )}

              {selectedPO.status === 'IN_TRANSIT' && (
                <button
                  onClick={() => handleUpdatePOStatus(selectedPO.id, 'DELIVERED')}
                  className="flex-1 py-2.5 px-5 rounded-xl font-bold bg-emerald-600/35 hover:bg-emerald-600/50 border border-emerald-400/40 text-white transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{lang === 'en' ? 'Confirm Delivery & Add to Inventory' : 'تأكيد استلام الشحنة وإضافتها للمخزون'}</span>
                </button>
              )}

              <button
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
    </div>
  );
}
