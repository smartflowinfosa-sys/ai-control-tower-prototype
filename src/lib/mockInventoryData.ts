export interface InventoryItem {
  id: string;
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

export interface PurchaseOrder {
  id: string;
  itemId: string;
  itemName: string;
  supplierName: string;
  quantity: number;
  totalCost: number;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'IN_TRANSIT' | 'DELIVERED' | 'تم الاستلام' | 'RECEIVED' | string;
  createdAt: string;
  createdBy: 'AI_AGENT' | 'HUMAN';
  invoiceUrl?: string;
  receivedQuantity?: number;
  receiverSignature?: string;
  receivedAt?: string;
}

export const initialPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'PO-9041',
    itemId: 'P7',
    itemName: 'أدوات المائدة',
    supplierName: 'الصندوق المناسب',
    quantity: 2500,
    totalCost: 1050,
    status: 'IN_TRANSIT',
    createdAt: '10:30 ص',
    createdBy: 'AI_AGENT',
  },
  {
    id: 'PO-8820',
    itemId: 'P3',
    itemName: 'علبة الصوص',
    supplierName: 'أمجد كميت',
    quantity: 5000,
    totalCost: 900,
    status: 'SENT',
    createdAt: '09:15 ص',
    createdBy: 'HUMAN',
  },
  {
    id: 'PO-7640',
    itemId: 'P1',
    itemName: 'صحن مقسم',
    supplierName: 'مزايا',
    quantity: 3000,
    totalCost: 1440,
    status: 'APPROVED',
    createdAt: 'أمس',
    createdBy: 'HUMAN',
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

export const initialInventoryItems: InventoryItem[] = [
  {
    id: 'inv-1',
    name: 'بوكس وجبة زاهي',
    item_name_ar: 'بوكس وجبة زاهي',
    item_name_en: 'Zahi Meal Box',
    category: 'تغليف وعلب',
    category_ar: 'تغليف وعلب',
    category_en: 'Packaging & Boxes',
    currentStock: 850,
    minThreshold: 500,
    maxCapacity: 2000,
    unit: 'بوكس',
    unitCost: 1.25,
    lastRestocked: '2026-10-10',
    dailyConsumption: 120,
  },
  {
    id: 'inv-2',
    name: 'كيس ورقي',
    item_name_ar: 'كيس ورقي',
    item_name_en: 'Paper Bag Holder',
    category: 'أكياس Holder',
    category_ar: 'أكياس Holder',
    category_en: 'Bags & Holders',
    currentStock: 1400,
    minThreshold: 1000,
    maxCapacity: 3500,
    unit: 'كيس',
    unitCost: 0.45,
    lastRestocked: '2026-10-08',
    dailyConsumption: 180,
  },
  {
    id: 'inv-3',
    name: 'سليف الوجبة',
    item_name_ar: 'سليف الوجبة',
    item_name_en: 'Meal Sleeve',
    category: 'تغليف وعلب',
    category_ar: 'تغليف وعلب',
    category_en: 'Packaging & Boxes',
    currentStock: 420,
    minThreshold: 500,
    maxCapacity: 1500,
    unit: 'سليف',
    unitCost: 0.35,
    lastRestocked: '2026-10-05',
    dailyConsumption: 95,
  },
  {
    id: 'inv-4',
    name: 'علبة صوص 2 أونص',
    item_name_ar: 'علبة صوص 2 أونص',
    item_name_en: '2oz Sauce Container',
    category: 'علب وبلاستيك',
    category_ar: 'علب وبلاستيك',
    category_en: 'Containers & Plastics',
    currentStock: 3200,
    minThreshold: 2000,
    maxCapacity: 6000,
    unit: 'علبة',
    unitCost: 0.18,
    lastRestocked: '2026-10-11',
    dailyConsumption: 310,
  },
  {
    id: 'inv-5',
    name: 'أدوات المائدة',
    item_name_ar: 'أدوات المائدة',
    item_name_en: 'Cutlery Set',
    category: 'مستلزمات تقديم',
    category_ar: 'مستلزمات تقديم',
    category_en: 'Serving Cutlery',
    currentStock: 1350,
    minThreshold: 1500,
    maxCapacity: 4000,
    unit: 'طقم',
    unitCost: 0.50,
    lastRestocked: '2026-10-06',
    dailyConsumption: 240,
  },
  {
    id: 'inv-6',
    name: 'صحن مقاس 24',
    item_name_ar: 'صحن مقاس 24',
    item_name_en: 'Plate Size 24',
    category: 'صحون وأطباق',
    category_ar: 'صحون وأطباق',
    category_en: 'Plates & Dishes',
    currentStock: 740,
    minThreshold: 800,
    maxCapacity: 2000,
    unit: 'صحن',
    unitCost: 0.85,
    lastRestocked: '2026-10-07',
    dailyConsumption: 110,
  },
  {
    id: 'inv-7',
    name: 'صحن مقاس 32',
    item_name_ar: 'صحن مقاس 32',
    item_name_en: 'Plate Size 32',
    category: 'صحون وأطباق',
    category_ar: 'صحون وأطباق',
    category_en: 'Plates & Dishes',
    currentStock: 1100,
    minThreshold: 800,
    maxCapacity: 2000,
    unit: 'صحن',
    unitCost: 1.10,
    lastRestocked: '2026-10-09',
    dailyConsumption: 130,
  },
];

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

