import { getStockPolicy } from '@/constants/inventoryCodes';

export interface InventoryItem {
  id: string;
  item_code?: string;
  min_stock_level?: number;
  lead_time_days?: number;
  name: string;
  item_name_ar?: string;
  item_name_en?: string;
  category: string;
  category_ar?: string;
  category_en?: string;
  currentStock: number;
  minThreshold: number;
  maxCapacity: number;
  unit: string;
  unitCost: number; // in SAR
  lastRestocked: string;
  dailyConsumption: number;
}

export interface MenuItem {
  id?: string;
  meal_name_ar: string;
  meal_name_en?: string;
  category_ar?: string;
  category_en?: string;
  price?: number;
  is_active?: boolean;
}

export interface SupplierQuote {
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  leadTimeHours: number;
  minOrderQuantity: number;
  qualityRating: number; // 1-5
  aiRecommendationScore: number; // 1-100
  aiReasoning: string;
}

export interface Supplier {
  id: string;
  name: string;
  name_ar?: string;
  name_en?: string;
  delivery_time_hours?: number;
  location_ar?: string;
  location_en?: string;
  category: string;
  city: string;
  phone: string;
  email: string;
  rating: number;
  leadTime: string;
  reliability: string;
  pricingTier: string;
  activeOrdersCount: number;
  tags: string[];
  metrics?: {
    deliverySpeed: number;
    qualityScore: number;
    priceStability: number;
  };
}

export interface PurchaseOrderLineItem {
  itemId: string;
  itemName: string;
  quantity: number;
}

export interface PurchaseOrder {
  id: string;
  itemId: string;
  itemName: string;
  items?: PurchaseOrderLineItem[];
  supplierName: string;
  quantity: number;
  totalCost: number;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'IN_TRANSIT' | 'DELIVERED' | 'تم الاستلام' | 'RECEIVED' | string;
  createdAt: string;
  createdBy: string;
  createdById?: string;
  supplier_id?: string;
  supplierId?: string;
  invoiceUrl?: string;
  receivedQuantity?: number;
  receiverSignature?: string;
  receivedAt?: string;
}

export const initialPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'PO-9041',
    itemId: 'P7',
    itemName: 'أدوات المائدة مطبوع',
    items: [
      { itemId: 'P7', itemName: 'أدوات المائدة مطبوع', quantity: 2500 },
    ],
    supplierName: 'مزايا',
    supplier_id: '22222222-2222-2222-2222-222222222222',
    supplierId: '22222222-2222-2222-2222-222222222222',
    quantity: 2500,
    totalCost: 625,
    status: 'IN_TRANSIT',
    createdAt: '10:30 AM',
    createdBy: '',
  },
  {
    id: 'PO-8820',
    itemId: 'P3',
    itemName: 'علب الصوص',
    items: [
      { itemId: 'P3', itemName: 'علب الصوص', quantity: 4000 },
      { itemId: 'P4', itemName: 'صحن السلطة', quantity: 960 },
    ],
    supplierName: 'الصندوق المناسب',
    supplier_id: '11111111-1111-1111-1111-111111111111',
    supplierId: '11111111-1111-1111-1111-111111111111',
    quantity: 4960,
    totalCost: 400,
    status: 'SENT',
    createdAt: '09:15 AM',
    createdBy: '',
  },
  {
    id: 'PO-7640',
    itemId: 'P1',
    itemName: 'صحن مقسم 32 (+2)',
    items: [
      { itemId: 'P1', itemName: 'صحن مقسم 32', quantity: 3000 },
      { itemId: 'P2', itemName: 'صحن غير مقسم 28', quantity: 1500 },
      { itemId: 'P5', itemName: 'علب الشوربة', quantity: 1000 },
    ],
    supplierName: 'أمجاد كميت',
    supplier_id: '33333333-3333-3333-3333-333333333333',
    supplierId: '33333333-3333-3333-3333-333333333333',
    quantity: 5500,
    totalCost: 2450,
    status: 'PENDING_APPROVAL',
    createdAt: '2026-10-28',
    createdBy: '',
  },
  {
    id: 'PO-7110',
    itemId: 'P4',
    itemName: 'صحن السلطة',
    items: [
      { itemId: 'P4', itemName: 'صحن السلطة', quantity: 3840 },
    ],
    supplierName: 'الصندوق المناسب',
    supplier_id: '11111111-1111-1111-1111-111111111111',
    supplierId: '11111111-1111-1111-1111-111111111111',
    quantity: 3840,
    totalCost: 1600,
    status: 'تم الاستلام',
    createdAt: '2026-10-14 02:30 PM',
    createdBy: '',
    receivedQuantity: 3840,
    receivedAt: '2026-10-15 11:20 AM',
    invoiceUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'PO-6520',
    itemId: 'P7',
    itemName: 'أدوات المائدة مطبوع',
    items: [
      { itemId: 'P7', itemName: 'أدوات المائدة مطبوع', quantity: 3500 },
    ],
    supplierName: 'مزايا',
    supplier_id: '22222222-2222-2222-2222-222222222222',
    supplierId: '22222222-2222-2222-2222-222222222222',
    quantity: 3500,
    totalCost: 875,
    status: 'تم الاستلام',
    createdAt: '2026-10-12 09:00 AM',
    createdBy: '',
    receivedQuantity: 3500,
    receivedAt: '2026-10-13 04:15 PM',
    invoiceUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80',
  },
];

let sessionPurchaseOrders: PurchaseOrder[] = [...initialPurchaseOrders];

export function getSessionPurchaseOrders(): PurchaseOrder[] {
  return sessionPurchaseOrders;
}

export function addPurchaseOrderToSession(po: PurchaseOrder): void {
  sessionPurchaseOrders = [po, ...sessionPurchaseOrders.filter(p => p.id !== po.id)];
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ai_purchase_order_created', { detail: po }));
  }
}

export function updateSessionPurchaseOrder(poId: string, updates: Partial<PurchaseOrder>): void {
  sessionPurchaseOrders = sessionPurchaseOrders.map(po => {
    if (po.id === poId) {
      return { ...po, ...updates };
    }
    return po;
  });
  if (typeof window !== 'undefined') {
    const updated = sessionPurchaseOrders.find(p => p.id === poId);
    window.dispatchEvent(new CustomEvent('ai_purchase_order_updated', { detail: updated }));
  }
}

const rawInventoryItems: InventoryItem[] = [
  {
    id: 'P1',
    item_code: 'P1',
    name: 'صحن مقسم 32',
    item_name_ar: 'صحن مقسم 32',
    item_name_en: 'Main Tray - Divided 32',
    category: 'صحون وأطباق',
    category_ar: 'صحون وأطباق',
    category_en: 'Plates & Dishes',
    currentStock: 33300,
    minThreshold: 5000,
    maxCapacity: 50000,
    unit: 'صحن',
    unitCost: 1.10,
    lastRestocked: '2026-10-20',
    dailyConsumption: 1200,
  },
  {
    id: 'P2',
    item_code: 'P2',
    name: 'صحن غير مقسم 28',
    item_name_ar: 'صحن غير مقسم 28',
    item_name_en: 'Main Tray - Undivided 28',
    category: 'صحون وأطباق',
    category_ar: 'صحون وأطباق',
    category_en: 'Plates & Dishes',
    currentStock: 12450,
    minThreshold: 3000,
    maxCapacity: 30000,
    unit: 'صحن',
    unitCost: 0.95,
    lastRestocked: '2026-10-18',
    dailyConsumption: 850,
  },
  {
    id: 'P3',
    item_code: 'P3',
    name: 'علب الصوص',
    item_name_ar: 'علب الصوص',
    item_name_en: 'Sauce Cup',
    category: 'علب وبلاستيك',
    category_ar: 'علب وبلاستيك',
    category_en: 'Containers & Plastics',
    currentStock: 2000,
    minThreshold: 4000,
    maxCapacity: 40000,
    unit: 'علبة',
    unitCost: 0.15,
    lastRestocked: '2026-10-15',
    dailyConsumption: 900,
  },
  {
    id: 'P4',
    item_code: 'P4',
    name: 'صحن السلطة',
    item_name_ar: 'صحن السلطة',
    item_name_en: 'Salad Tray',
    category: 'صحون وأطباق',
    category_ar: 'صحون وأطباق',
    category_en: 'Plates & Dishes',
    currentStock: 3000,
    minThreshold: 1500,
    maxCapacity: 15000,
    unit: 'صحن',
    unitCost: 0.70,
    lastRestocked: '2026-10-19',
    dailyConsumption: 350,
  },
  {
    id: 'P5',
    item_code: 'P5',
    name: 'كرافت ابيض',
    item_name_ar: 'كرافت ابيض',
    item_name_en: 'White Kraft',
    category: 'تغليف وعلب',
    category_ar: 'تغليف وعلب',
    category_en: 'Packaging & Boxes',
    currentStock: 0,
    minThreshold: 2000,
    maxCapacity: 20000,
    unit: 'صحن',
    unitCost: 0.85,
    lastRestocked: '2026-10-01',
    dailyConsumption: 400,
  },
  {
    id: 'P6',
    item_code: 'P6',
    name: 'سليف مطبوع',
    item_name_ar: 'سليف مطبوع',
    item_name_en: 'Printed Sleeve',
    category: 'تغليف وعلب',
    category_ar: 'تغليف وعلب',
    category_en: 'Packaging & Boxes',
    currentStock: 7000,
    minThreshold: 5000,
    maxCapacity: 30000,
    unit: 'سليف',
    unitCost: 0.35,
    lastRestocked: '2026-10-12',
    dailyConsumption: 1100,
  },
  {
    id: 'P7',
    item_code: 'P7',
    name: 'أدوات المائدة مطبوع',
    item_name_ar: 'أدوات المائدة مطبوع',
    item_name_en: 'Printed Cutlery',
    category: 'مستلزمات تقديم',
    category_ar: 'مستلزمات تقديم',
    category_en: 'Serving Cutlery',
    currentStock: 20000,
    minThreshold: 10000,
    maxCapacity: 50000,
    unit: 'طقم',
    unitCost: 0.45,
    lastRestocked: '2026-10-14',
    dailyConsumption: 1500,
  },
  {
    id: 'P8',
    item_code: 'P8',
    name: 'كيس زاهي مطبوع',
    item_name_ar: 'كيس زاهي مطبوع',
    item_name_en: 'Zahi Printed Bag',
    category: 'أكياس Holder',
    category_ar: 'أكياس Holder',
    category_en: 'Bags & Holders',
    currentStock: 10400,
    minThreshold: 5000,
    maxCapacity: 30000,
    unit: 'كيس',
    unitCost: 0.40,
    lastRestocked: '2026-10-16',
    dailyConsumption: 800,
  },
  {
    id: 'P9',
    item_code: 'P9',
    name: 'أكياس بلاستيك صغيرة',
    item_name_ar: 'أكياس بلاستيك صغيرة',
    item_name_en: 'Plastic Mini Bag',
    category: 'أكياس Holder',
    category_ar: 'أكياس Holder',
    category_en: 'Bags & Holders',
    currentStock: 8000,
    minThreshold: 3000,
    maxCapacity: 25000,
    unit: 'كيس',
    unitCost: 0.12,
    lastRestocked: '2026-10-17',
    dailyConsumption: 450,
  },
  {
    id: 'P10',
    item_code: 'P10',
    name: 'صحن الحلا الشفاف',
    item_name_ar: 'صحن الحلا الشفاف',
    item_name_en: 'Clear Dessert Tray',
    category: 'صحون وأطباق',
    category_ar: 'صحون وأطباق',
    category_en: 'Plates & Dishes',
    currentStock: 2000,
    minThreshold: 1500,
    maxCapacity: 15000,
    unit: 'صحن',
    unitCost: 0.65,
    lastRestocked: '2026-10-11',
    dailyConsumption: 280,
  },
  {
    id: 'P11',
    item_code: 'P11',
    name: 'صحن غير مقسم 24',
    item_name_ar: 'صحن غير مقسم 24',
    item_name_en: 'Main Tray - Undivided 24',
    category: 'صحون وأطباق',
    category_ar: 'صحون وأطباق',
    category_en: 'Plates & Dishes',
    currentStock: 6000,
    minThreshold: 2000,
    maxCapacity: 20000,
    unit: 'صحن',
    unitCost: 0.85,
    lastRestocked: '2026-10-13',
    dailyConsumption: 420,
  },
];

// Inject real min_stock_level / lead_time_days (also used as minThreshold).
export const initialInventoryItems: InventoryItem[] = rawInventoryItems.map(item => {
  const policy = getStockPolicy(item.item_code || item.id);
  return {
    ...item,
    min_stock_level: policy.min_stock_level,
    lead_time_days: policy.lead_time_days,
    minThreshold: policy.min_stock_level ?? item.minThreshold,
  };
});

export const initialSuppliers: Supplier[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'الصندوق المناسب',
    name_ar: 'الصندوق المناسب',
    name_en: 'Al Sandouq Al Monaseb',
    category: 'تغليف وكرتون ومستلزمات شحن',
    city: 'جدة',
    location_ar: 'جدة',
    location_en: 'Jeddah',
    phone: '+966 12 654 3210',
    email: 'sales@almonaseb.sa',
    rating: 4.8,
    delivery_time_hours: 24,
    leadTime: '24 ساعة',
    reliability: '98%',
    pricingTier: 'أسعار جملة معتمدة',
    activeOrdersCount: 2,
    tags: ['بوكسات زاهي', 'كرتون مقوى', 'مورد معتمد'],
    metrics: {
      deliverySpeed: 96,
      qualityScore: 98,
      priceStability: 95,
    },
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'مزايا',
    name_ar: 'مزايا',
    name_en: 'Mazaya',
    category: 'بلاستيك ومستلزمات مائدة',
    city: 'جدة',
    location_ar: 'جدة',
    location_en: 'Jeddah',
    phone: '+966 12 456 7890',
    email: 'orders@mazaya.sa',
    rating: 4.5,
    delivery_time_hours: 24,
    leadTime: '24 ساعة',
    reliability: '97%',
    pricingTier: 'أسعار مصنع مباشرة',
    activeOrdersCount: 1,
    tags: ['أدوات مائدة', 'صحون حرارية', 'علب صوص'],
    metrics: {
      deliverySpeed: 94,
      qualityScore: 95,
      priceStability: 96,
    },
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'أمجد كميت',
    name_ar: 'أمجد كميت',
    name_en: 'Amjad Kumait',
    category: 'مواد تغليف واستهلاك عامة',
    city: 'جدة',
    location_ar: 'جدة',
    location_en: 'Jeddah',
    phone: '+966 12 890 1234',
    email: 'info@amjadkumait.sa',
    rating: 4.7,
    delivery_time_hours: 48,
    leadTime: '48 ساعة',
    reliability: '96%',
    pricingTier: 'خصم كميات كبيرة',
    activeOrdersCount: 1,
    tags: ['أكياس ورقية', 'سليف الوجبات', 'تخزين احتياطي'],
    metrics: {
      deliverySpeed: 88,
      qualityScore: 94,
      priceStability: 98,
    },
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'عالم الوسام',
    name_ar: 'عالم الوسام',
    name_en: 'Alam Al Wissam',
    category: 'مستلزمات تقديم وتغليف متنوعة',
    city: 'جدة',
    location_ar: 'جدة',
    location_en: 'Jeddah',
    phone: '+966 12 321 9876',
    email: 'support@alamalwissam.sa',
    rating: 4.6,
    delivery_time_hours: 24,
    leadTime: '24 ساعة',
    reliability: '95%',
    pricingTier: 'توصيل فوري معتمد',
    activeOrdersCount: 0,
    tags: ['علب صوص', 'أكواب ورقية', 'توريد شامل'],
    metrics: {
      deliverySpeed: 93,
      qualityScore: 92,
      priceStability: 94,
    },
  },
];

export const supplierQuotesMatrix: Record<string, SupplierQuote[]> = {
  // P1: صحن مقسم
  'P1': [
    {
      supplierId: '22222222-2222-2222-2222-222222222222',
      supplierName: 'مزايا',
      unitPrice: 0.78,
      leadTimeHours: 24,
      minOrderQuantity: 1000,
      qualityRating: 4.8,
      aiRecommendationScore: 95,
      aiReasoning: 'أسعار مصنع مباشرة وتوصيل فوري معتمد لمطاعم زاهي.',
    },
    {
      supplierId: '11111111-1111-1111-1111-111111111111',
      supplierName: 'الصندوق المناسب',
      unitPrice: 0.82,
      leadTimeHours: 24,
      minOrderQuantity: 500,
      qualityRating: 4.8,
      aiRecommendationScore: 91,
      aiReasoning: 'جودة كرتون حراري ممتازة وتوريد مستمر في جدة.',
    },
    {
      supplierId: '44444444-4444-4444-4444-444444444444',
      supplierName: 'عالم الوسام',
      unitPrice: 0.85,
      leadTimeHours: 24,
      minOrderQuantity: 1200,
      qualityRating: 4.6,
      aiRecommendationScore: 84,
      aiReasoning: 'سعر منافس للكميات الكبيرة وتوريد مستقر.',
    },
  ],
  // P2: صحن غير مقسم
  'P2': [
    {
      supplierId: '22222222-2222-2222-2222-222222222222',
      supplierName: 'مزايا',
      unitPrice: 0.74,
      leadTimeHours: 24,
      minOrderQuantity: 1000,
      qualityRating: 4.8,
      aiRecommendationScore: 96,
      aiReasoning: 'أفضل عرض سعر مباشر من المصنع بجودة مطابقة.',
    },
    {
      supplierId: '11111111-1111-1111-1111-111111111111',
      supplierName: 'الصندوق المناسب',
      unitPrice: 0.79,
      leadTimeHours: 24,
      minOrderQuantity: 500,
      qualityRating: 4.8,
      aiRecommendationScore: 89,
      aiReasoning: 'جاهزية توريد ممتازة وحد أدنى مرن للطلب.',
    },
  ],
  // P3: علبة الصوص
  'P3': [
    {
      supplierId: '22222222-2222-2222-2222-222222222222',
      supplierName: 'مزايا',
      unitPrice: 0.16,
      leadTimeHours: 24,
      minOrderQuantity: 2000,
      qualityRating: 4.9,
      aiRecommendationScore: 97,
      aiReasoning: 'أعلى مطابقة وجودة محكمة الإغلاق معتمدة لمطاعم زاهي.',
    },
    {
      supplierId: '44444444-4444-4444-4444-444444444444',
      supplierName: 'عالم الوسام',
      unitPrice: 0.18,
      leadTimeHours: 24,
      minOrderQuantity: 1500,
      qualityRating: 4.6,
      aiRecommendationScore: 88,
      aiReasoning: 'سعر منافس مع جاهزية تسليم سريعة في جدة.',
    },
    {
      supplierId: '33333333-3333-3333-3333-333333333333',
      supplierName: 'أمجد كميت',
      unitPrice: 0.15,
      leadTimeHours: 48,
      minOrderQuantity: 5000,
      qualityRating: 4.5,
      aiRecommendationScore: 82,
      aiReasoning: 'السعر الأرخص لطلبيات الجملة الضخمة مع مهلة 48 ساعة.',
    },
  ],
  // P4: صحن السلطة
  'P4': [
    {
      supplierId: '22222222-2222-2222-2222-222222222222',
      supplierName: 'مزايا',
      unitPrice: 0.65,
      leadTimeHours: 24,
      minOrderQuantity: 800,
      qualityRating: 4.8,
      aiRecommendationScore: 94,
      aiReasoning: 'بلاستيك شفاف عالي الجودة متوافق مع معايير الغذاء والدواء.',
    },
    {
      supplierId: '44444444-4444-4444-4444-444444444444',
      supplierName: 'عالم الوسام',
      unitPrice: 0.69,
      leadTimeHours: 24,
      minOrderQuantity: 1000,
      qualityRating: 4.6,
      aiRecommendationScore: 87,
      aiReasoning: 'توريد معتمد وسرعة تسليم خلال 24 ساعة.',
    },
  ],
  // P5: صحن الحلو
  'P5': [
    {
      supplierId: '44444444-4444-4444-4444-444444444444',
      supplierName: 'عالم الوسام',
      unitPrice: 0.58,
      leadTimeHours: 24,
      minOrderQuantity: 1000,
      qualityRating: 4.7,
      aiRecommendationScore: 94,
      aiReasoning: 'أفضل سعر وجودة لصحون الحلا الفردية.',
    },
    {
      supplierId: '22222222-2222-2222-2222-222222222222',
      supplierName: 'مزايا',
      unitPrice: 0.62,
      leadTimeHours: 24,
      minOrderQuantity: 1000,
      qualityRating: 4.8,
      aiRecommendationScore: 91,
      aiReasoning: 'جودة تصنيع ممتازة وتوصيل منتظم.',
    },
  ],
  // P6: أغطية الصحون
  'P6': [
    {
      supplierId: '11111111-1111-1111-1111-111111111111',
      supplierName: 'الصندوق المناسب',
      unitPrice: 0.32,
      leadTimeHours: 24,
      minOrderQuantity: 1000,
      qualityRating: 4.9,
      aiRecommendationScore: 98,
      aiReasoning: 'إحكام غلق ممتاز ومطابقة 100% لمقاسات صحون زاهي.',
    },
    {
      supplierId: '33333333-3333-3333-3333-333333333333',
      supplierName: 'أمجد كميت',
      unitPrice: 0.35,
      leadTimeHours: 48,
      minOrderQuantity: 2500,
      qualityRating: 4.7,
      aiRecommendationScore: 80,
      aiReasoning: 'خصم كميات إضافي مع مهلة توريد 48 ساعة.',
    },
  ],
  // P7: أدوات المائدة
  'P7': [
    {
      supplierId: '22222222-2222-2222-2222-222222222222',
      supplierName: 'مزايا',
      unitPrice: 0.48,
      leadTimeHours: 24,
      minOrderQuantity: 1000,
      qualityRating: 4.9,
      aiRecommendationScore: 96,
      aiReasoning: 'أفضل توازن مثالي بين السعر الأقل وسرعة التوصيل خلال 24 ساعة مع جودة معتمدة لمطاعم زاهي.',
    },
    {
      supplierId: '11111111-1111-1111-1111-111111111111',
      supplierName: 'الصندوق المناسب',
      unitPrice: 0.52,
      leadTimeHours: 24,
      minOrderQuantity: 500,
      qualityRating: 4.8,
      aiRecommendationScore: 90,
      aiReasoning: 'جودة توريد ممتازة وتوصيل منتظم في منطقة جدة.',
    },
    {
      supplierId: '33333333-3333-3333-3333-333333333333',
      supplierName: 'أمجد كميت',
      unitPrice: 0.45,
      leadTimeHours: 48,
      minOrderQuantity: 3000,
      qualityRating: 4.7,
      aiRecommendationScore: 82,
      aiReasoning: 'السعر الأرخص للكميات الكبيرة مع مهلة توريد 48 ساعة.',
    },
  ],
  // P8: الكيس
  'P8': [
    {
      supplierId: '11111111-1111-1111-1111-111111111111',
      supplierName: 'الصندوق المناسب',
      unitPrice: 0.42,
      leadTimeHours: 24,
      minOrderQuantity: 1000,
      qualityRating: 4.9,
      aiRecommendationScore: 98,
      aiReasoning: 'المورد المعتمد رسمياً لطباعة أكياس وتغليف زاهي الأصلي، جاهزية تسليم فورية.',
    },
    {
      supplierId: '33333333-3333-3333-3333-333333333333',
      supplierName: 'أمجد كميت',
      unitPrice: 0.40,
      leadTimeHours: 48,
      minOrderQuantity: 4000,
      qualityRating: 4.7,
      aiRecommendationScore: 85,
      aiReasoning: 'وفر مالي إضافي للطلبيات الشهرية الكبيرة.',
    },
  ],
  // P9: أكياس بلاستيك صغيرة
  'P9': [
    {
      supplierId: '33333333-3333-3333-3333-333333333333',
      supplierName: 'أمجد كميت',
      unitPrice: 0.12,
      leadTimeHours: 48,
      minOrderQuantity: 5000,
      qualityRating: 4.7,
      aiRecommendationScore: 94,
      aiReasoning: 'أقل تكلفة توريد للمستهلكات اليومية الخفيفة.',
    },
    {
      supplierId: '11111111-1111-1111-1111-111111111111',
      supplierName: 'الصندوق المناسب',
      unitPrice: 0.15,
      leadTimeHours: 24,
      minOrderQuantity: 1500,
      qualityRating: 4.8,
      aiRecommendationScore: 89,
      aiReasoning: 'جاهزية تسليم فوري خلال 24 ساعة.',
    },
  ],
  // P10: صحن الحلو شفاف
  'P10': [
    {
      supplierId: '44444444-4444-4444-4444-444444444444',
      supplierName: 'عالم الوسام',
      unitPrice: 0.60,
      leadTimeHours: 24,
      minOrderQuantity: 1000,
      qualityRating: 4.8,
      aiRecommendationScore: 95,
      aiReasoning: 'شفافية عالية وجودة تقديم فاخرة لحلا زاهي.',
    },
    {
      supplierId: '22222222-2222-2222-2222-222222222222',
      supplierName: 'مزايا',
      unitPrice: 0.64,
      leadTimeHours: 24,
      minOrderQuantity: 800,
      qualityRating: 4.7,
      aiRecommendationScore: 89,
      aiReasoning: 'توريد مباشر من خطوط الإنتاج المحلية.',
    },
  ],
  // Legacy / fallback mapping
  'inv-1': [
    {
      supplierId: '11111111-1111-1111-1111-111111111111',
      supplierName: 'الصندوق المناسب',
      unitPrice: 1.20,
      leadTimeHours: 24,
      minOrderQuantity: 1000,
      qualityRating: 4.9,
      aiRecommendationScore: 98,
      aiReasoning: 'المورد المعتمد رسمياً لطباعة وتصنيع بوكس وجبة زاهي الأصلي.',
    },
    {
      supplierId: '33333333-3333-3333-3333-333333333333',
      supplierName: 'أمجد كميت',
      unitPrice: 1.15,
      leadTimeHours: 48,
      minOrderQuantity: 3000,
      qualityRating: 4.7,
      aiRecommendationScore: 85,
      aiReasoning: 'سعر جملة منافس للطلبيات الكبيرة مع مهلة توريد 48 ساعة.',
    },
  ],
  'inv-3': [
    {
      supplierId: '11111111-1111-1111-1111-111111111111',
      supplierName: 'الصندوق المناسب',
      unitPrice: 0.33,
      leadTimeHours: 24,
      minOrderQuantity: 500,
      qualityRating: 4.9,
      aiRecommendationScore: 98,
      aiReasoning: 'المورد المعتمد رسمياً لطباعة سليف وتغليف زاهي الأصلي، جاهزية تسليم فورية.',
    },
    {
      supplierId: '33333333-3333-3333-3333-333333333333',
      supplierName: 'أمجد كميت',
      unitPrice: 0.36,
      leadTimeHours: 48,
      minOrderQuantity: 2000,
      qualityRating: 4.7,
      aiRecommendationScore: 78,
      aiReasoning: 'يتطلب طلبية لا تقل عن 2000 حبة وتوريد خلال 48 ساعة.',
    },
  ],
  'inv-5': [
    {
      supplierId: '22222222-2222-2222-2222-222222222222',
      supplierName: 'مزايا',
      unitPrice: 0.48,
      leadTimeHours: 24,
      minOrderQuantity: 1000,
      qualityRating: 4.9,
      aiRecommendationScore: 96,
      aiReasoning: 'أفضل توازن مثالي بين السعر الأقل وسرعة التوصيل خلال 24 ساعة مع جودة معتمدة لمطاعم زاهي.',
    },
    {
      supplierId: '11111111-1111-1111-1111-111111111111',
      supplierName: 'الصندوق المناسب',
      unitPrice: 0.52,
      leadTimeHours: 24,
      minOrderQuantity: 500,
      qualityRating: 4.8,
      aiRecommendationScore: 90,
      aiReasoning: 'جودة توريد ممتازة وتوصيل منتظم في منطقة جدة.',
    },
    {
      supplierId: '33333333-3333-3333-3333-333333333333',
      supplierName: 'أمجد كميت',
      unitPrice: 0.45,
      leadTimeHours: 48,
      minOrderQuantity: 3000,
      qualityRating: 4.7,
      aiRecommendationScore: 82,
      aiReasoning: 'السعر الأرخص للكميات الكبيرة مع مهلة توريد 48 ساعة.',
    },
  ],
  'inv-6': [
    {
      supplierId: '22222222-2222-2222-2222-222222222222',
      supplierName: 'مزايا',
      unitPrice: 0.82,
      leadTimeHours: 24,
      minOrderQuantity: 800,
      qualityRating: 4.9,
      aiRecommendationScore: 95,
      aiReasoning: 'صحون مقاومة للحرارة مطابقة لمواصفات هيئة الغذاء والدواء وسعر جملة منافس.',
    },
    {
      supplierId: '44444444-4444-4444-4444-444444444444',
      supplierName: 'عالم الوسام',
      unitPrice: 0.86,
      leadTimeHours: 24,
      minOrderQuantity: 1000,
      qualityRating: 4.6,
      aiRecommendationScore: 88,
      aiReasoning: 'سعر مناسب وجودة جيدة مع جاهزية تسليم سريعة.',
    },
  ],
};

