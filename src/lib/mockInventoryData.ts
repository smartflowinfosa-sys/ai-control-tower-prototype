export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minThreshold: number;
  maxCapacity: number;
  unit: string;
  unitCost: number; // in SAR
  lastRestocked: string;
  dailyConsumption: number;
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
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'IN_TRANSIT' | 'DELIVERED';
  createdAt: string;
  createdBy: 'AI_AGENT' | 'HUMAN';
}

export const initialPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'PO-9041',
    itemId: 'inv-5',
    itemName: 'أدوات المائدة',
    supplierName: 'مصنع البلاستيك الوطني',
    quantity: 2000,
    totalCost: 960,
    status: 'PENDING_APPROVAL',
    createdAt: '2026-10-15 11:30',
    createdBy: 'AI_AGENT',
  },
  {
    id: 'PO-9038',
    itemId: 'inv-3',
    itemName: 'سليف الوجبة',
    supplierName: 'مورد التغليف السريع',
    quantity: 1500,
    totalCost: 495,
    status: 'SENT',
    createdAt: '2026-10-15 09:45',
    createdBy: 'HUMAN',
  },
  {
    id: 'PO-9035',
    itemId: 'inv-4',
    itemName: 'علبة صوص 2 أونص',
    supplierName: 'مصنع البلاستيك الوطني',
    quantity: 5000,
    totalCost: 900,
    status: 'IN_TRANSIT',
    createdAt: '2026-10-14 16:20',
    createdBy: 'AI_AGENT',
  },
  {
    id: 'PO-9029',
    itemId: 'inv-1',
    itemName: 'بوكس وجبة زاهي',
    supplierName: 'مورد التغليف السريع',
    quantity: 2500,
    totalCost: 3125,
    status: 'DELIVERED',
    createdAt: '2026-10-14 10:00',
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

export const initialInventoryItems: InventoryItem[] = [
  {
    id: 'inv-1',
    name: 'بوكس وجبة زاهي',
    category: 'تغليف وعلب',
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
    category: 'أكياس Holder',
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
    category: 'تغليف وعلب',
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
    category: 'علب وبلاستيك',
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
    category: 'مستلزمات تقديم',
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
    category: 'صحون وأطباق',
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
    category: 'صحون وأطباق',
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
    id: 'sup-1',
    name: 'مصنع البلاستيك الوطني',
    category: 'بلاستيك ومستلزمات مائدة',
    city: 'الرياض',
    phone: '+966 11 456 7890',
    email: 'sales@nationalplastic.sa',
    rating: 4.9,
    leadTime: '24 ساعة',
    reliability: '99%',
    pricingTier: 'أسعار مصنع مباشرة',
    activeOrdersCount: 2,
    tags: ['أدوات مائدة', 'علب صوص', 'صحون حرارية'],
    metrics: {
      deliverySpeed: 95,
      qualityScore: 98,
      priceStability: 96,
    },
  },
  {
    id: 'sup-2',
    name: 'مورد التغليف السريع',
    category: 'ورقيات وتغليف كرتوني',
    city: 'جدة',
    phone: '+966 12 654 3210',
    email: 'orders@fastpack.sa',
    rating: 4.8,
    leadTime: '12 - 24 ساعة',
    reliability: '98%',
    pricingTier: 'توصيل فوري معتمد',
    activeOrdersCount: 1,
    tags: ['بوكسات زاهي', 'أكياس ورقية', 'سليف الوجبات'],
    metrics: {
      deliverySpeed: 99,
      qualityScore: 96,
      priceStability: 89,
    },
  },
  {
    id: 'sup-3',
    name: 'مورد الجملة المركزي',
    category: 'مواد استهلاكية عامة',
    city: 'الدمام',
    phone: '+966 13 890 1234',
    email: 'info@centralwholesale.sa',
    rating: 4.6,
    leadTime: '48 ساعة',
    reliability: '95%',
    pricingTier: 'خصم كميات كبيرة',
    activeOrdersCount: 0,
    tags: ['توريد شامل', 'تخزين احتياطي'],
    metrics: {
      deliverySpeed: 84,
      qualityScore: 92,
      priceStability: 98,
    },
  },
];

export const supplierQuotesMatrix: Record<string, SupplierQuote[]> = {
  'inv-5': [
    {
      supplierId: 'sup-1',
      supplierName: 'مصنع البلاستيك الوطني',
      unitPrice: 0.48,
      leadTimeHours: 24,
      minOrderQuantity: 1000,
      qualityRating: 4.9,
      aiRecommendationScore: 96,
      aiReasoning: 'أفضل توازن مثالي بين السعر الأقل وسرعة التوصيل خلال 24 ساعة مع جودة معتمدة لمطاعم زاهي.',
    },
    {
      supplierId: 'sup-2',
      supplierName: 'مورد التغليف السريع',
      unitPrice: 0.54,
      leadTimeHours: 12,
      minOrderQuantity: 500,
      qualityRating: 4.8,
      aiRecommendationScore: 88,
      aiReasoning: 'سرعة توصيل فائقة (12 ساعة) لكن بسعر أعلى بنسبة 12%.',
    },
    {
      supplierId: 'sup-3',
      supplierName: 'مورد الجملة المركزي',
      unitPrice: 0.45,
      leadTimeHours: 48,
      minOrderQuantity: 3000,
      qualityRating: 4.5,
      aiRecommendationScore: 78,
      aiReasoning: 'السعر الأرخص للكميات الكبيرة لكن مدة التوصيل أطول (48 ساعة) قد تسبب نقصاً حرجاً.',
    },
  ],
  'inv-3': [
    {
      supplierId: 'sup-2',
      supplierName: 'مورد التغليف السريع',
      unitPrice: 0.33,
      leadTimeHours: 18,
      minOrderQuantity: 500,
      qualityRating: 4.9,
      aiRecommendationScore: 98,
      aiReasoning: 'المورد المعتمد رسمياً لطباعة سليف زاهي الأصلي، جاهزية فورية للتسليم.',
    },
    {
      supplierId: 'sup-3',
      supplierName: 'مورد الجملة المركزي',
      unitPrice: 0.36,
      leadTimeHours: 48,
      minOrderQuantity: 2000,
      qualityRating: 4.4,
      aiRecommendationScore: 72,
      aiReasoning: 'يتطلب طلبية لا تقل عن 2000 حبة وتأخير 48 ساعة.',
    },
  ],
  'inv-6': [
    {
      supplierId: 'sup-1',
      supplierName: 'مصنع البلاستيك الوطني',
      unitPrice: 0.82,
      leadTimeHours: 24,
      minOrderQuantity: 800,
      qualityRating: 4.9,
      aiRecommendationScore: 95,
      aiReasoning: 'صحون مقاومة للحرارة مطابقة لمواصفات هيئة الغذاء والدواء وسعر جملة منافس.',
    },
    {
      supplierId: 'sup-3',
      supplierName: 'مورد الجملة المركزي',
      unitPrice: 0.89,
      leadTimeHours: 36,
      minOrderQuantity: 1000,
      qualityRating: 4.6,
      aiRecommendationScore: 80,
      aiReasoning: 'سعر متوسط وجودة جيدة مع مهلة توصيل 36 ساعة.',
    },
  ],
};
