import { OperationalException } from '@/domain/types/exception';
import { Order } from '@/domain/types/order';
import { TimelineEvent } from '@/domain/types/timeline';

export const scenarioOrders: Order[] = [
  // Scenario 1: Packing Mismatch
  {
    id: 'o-zh-2481',
    orderNumber: 'ZH-2481',
    brand: 'ZAHI',
    customer: { name: 'أحمد سعيد', phone: '0501112222' },
    items: [
      {
        id: 'item-1',
        name: 'وجبة دجاج صحية',
        quantity: 1,
        customizations: ['بدون أرز', 'إضافة سلطة'],
        removedIngredients: ['أرز'],
      }
    ],
    kitchenStatus: {
      updated: true,
      lastUpdatedAt: '2026-10-08T18:15:00Z',
      notes: 'تم استبعاد الأرز بناءً على التعديل',
    },
    packingStatus: {
      updated: false,
      lastUpdatedAt: '2026-10-08T18:05:00Z',
      mismatchDetected: true,
      verifiedItems: ['وجبة دجاج صحية', 'أرز'],
    },
    deliveryStatus: {
      estimatedDeliveryTime: '2026-10-08T19:00:00Z',
      isDelayed: false,
    },
    createdAt: '2026-10-08T18:00:00Z',
    updatedAt: '2026-10-08T18:25:00Z',
  },
  // Scenario 2: Delivery Delay
  {
    id: 'o-mz-1092',
    orderNumber: 'ZH-1092',
    brand: 'ZAHI',
    customer: { name: 'سارة فهد', phone: '0553334444' },
    items: [
      {
        id: 'item-2',
        name: 'سلطة الكينوا',
        quantity: 2,
        customizations: [],
        removedIngredients: [],
      }
    ],
    kitchenStatus: {
      updated: true,
      lastUpdatedAt: '2026-10-08T17:20:00Z',
    },
    packingStatus: {
      updated: true,
      lastUpdatedAt: '2026-10-08T17:30:00Z',
      mismatchDetected: false,
    },
    deliveryStatus: {
      driverName: 'سائق زاهي 1',
      estimatedDeliveryTime: '2026-10-08T18:15:00Z',
      isDelayed: true,
    },
    createdAt: '2026-10-08T17:10:00Z',
    updatedAt: '2026-10-08T18:45:00Z',
  },
  // Scenario 3: Missing Item
  {
    id: 'o-zh-3001',
    orderNumber: 'ZH-3001',
    brand: 'ZAHI',
    customer: { name: 'خالد عبدالله', phone: '0569998888' },
    items: [
      {
        id: 'item-3',
        name: 'شريحة لحم مشوي',
        quantity: 1,
        customizations: [],
        removedIngredients: [],
      },
      {
        id: 'item-4',
        name: 'عصير برتقال',
        quantity: 1,
        customizations: [],
        removedIngredients: [],
      }
    ],
    kitchenStatus: {
      updated: true,
      lastUpdatedAt: '2026-10-08T18:20:00Z',
    },
    packingStatus: {
      updated: true,
      lastUpdatedAt: '2026-10-08T18:35:00Z',
      mismatchDetected: true,
      verifiedItems: ['شريحة لحم مشوي'],
    },
    deliveryStatus: {
      estimatedDeliveryTime: '2026-10-08T19:15:00Z',
      isDelayed: false,
    },
    createdAt: '2026-10-08T18:10:00Z',
    updatedAt: '2026-10-08T18:40:00Z',
  }
];

export const scenarioExceptions: OperationalException[] = [
  {
    id: 'exc-1',
    orderId: 'o-zh-2481',
    brand: 'ZAHI',
    title: 'تعارض في التغليف: تم إضافة الأرز بالخطأ',
    riskLevel: 'HIGH',
    department: 'PACKING',
    category: 'PACKING_MISMATCH',
    status: 'ALERTED',
    rootCauseHypothesis: 'لم يتم تحديث شاشة التغليف بعد تعديل العميل للطلب وإزالة الأرز.',
    suggestedAction: 'إعادة تغليف الطلب وإزالة الأرز فوراً قبل التسليم للسائق.',
    aiActionsTaken: [
      {
        actionType: 'AUTO_ALERT',
        executedAt: '2026-10-08T18:25:00Z',
        details: 'تم إرسال تنبيه لشاشة التغليف والمشرف.',
        requiresHumanApproval: false,
      }
    ],
    requiresHumanApproval: true,
    detectedAt: '2026-10-08T18:25:00Z',
    lastFollowUpAt: '2026-10-08T18:26:00Z',
  },
  {
    id: 'exc-2',
    orderId: 'o-mz-1092',
    brand: 'ZAHI',
    title: 'تأخير في التوصيل عن الوقت المتوقع',
    riskLevel: 'MEDIUM',
    department: 'DELIVERY',
    category: 'DELIVERY_DELAY',
    status: 'IN_PROGRESS',
    rootCauseHypothesis: 'ازدحام مروري في منطقة التوصيل حسب بيانات الخرائط.',
    suggestedAction: 'إرسال رسالة اعتذار للعميل مع تحديث وقت الوصول المتوقع.',
    aiActionsTaken: [
      {
        actionType: 'RECOMMENDATION_ONLY',
        executedAt: '2026-10-08T18:30:00Z',
        details: 'اقتراح إرسال رسالة اعتذار للعميل.',
        requiresHumanApproval: true,
      }
    ],
    requiresHumanApproval: true,
    detectedAt: '2026-10-08T18:20:00Z',
    lastFollowUpAt: '2026-10-08T18:35:00Z',
  },
  {
    id: 'exc-3',
    orderId: 'o-zh-3001',
    brand: 'ZAHI',
    title: 'عنصر ناقص أثناء التغليف',
    riskLevel: 'HIGH',
    department: 'PACKING',
    category: 'MISSING_ITEM',
    status: 'DETECTED',
    rootCauseHypothesis: 'نقص في العصير من الثلاجة الأمامية، لم يتم استكماله.',
    suggestedAction: 'إضافة "عصير برتقال" للطلب قبل إغلاق الكيس.',
    aiActionsTaken: [
      {
        actionType: 'AUTO_ALERT',
        executedAt: '2026-10-08T18:40:00Z',
        details: 'إيقاف عملية التغليف تلقائياً حتى استكمال العنصر.',
        requiresHumanApproval: true,
      }
    ],
    requiresHumanApproval: true,
    detectedAt: '2026-10-08T18:38:00Z',
    lastFollowUpAt: '2026-10-08T18:40:00Z',
  },
  {
    id: 'exc-4',
    brand: 'ZAHI',
    title: 'اختناق إنتاجي في المطبخ',
    riskLevel: 'CRITICAL',
    department: 'KITCHEN',
    category: 'PRODUCTION_BOTTLENECK',
    status: 'ESCALATED',
    rootCauseHypothesis: 'تراكم 5 طلبات في محطة الشواء مع نقص في الكوادر.',
    suggestedAction: 'توجيه طباخ إضافي لمحطة الشواء مؤقتاً.',
    aiActionsTaken: [
      {
        actionType: 'NOTIFIED_MANAGER',
        executedAt: '2026-10-08T18:45:00Z',
        details: 'تم تصعيد المشكلة لمدير الفرع وإرسال إشعار للمطبخ.',
        requiresHumanApproval: false,
      }
    ],
    requiresHumanApproval: false,
    detectedAt: '2026-10-08T18:40:00Z',
    lastFollowUpAt: '2026-10-08T18:45:00Z',
  },
  {
    id: 'exc-5',
    brand: 'ZAHI',
    title: 'شكوى متكررة: تأخير مستمر للعميل',
    riskLevel: 'MEDIUM',
    department: 'CUSTOMER_SERVICE',
    category: 'CUSTOMER_COMPLAINT',
    status: 'IN_PROGRESS',
    rootCauseHypothesis: 'عنوان العميل بعيد نسبياً وهناك نقص في السائقين المخصصين للمنطقة.',
    suggestedAction: 'إضافة رصيد تعويضي في المحفظة، وتخصيص سائق أولوية لطلباته القادمة.',
    aiActionsTaken: [
      {
        actionType: 'TICKET_CREATED',
        executedAt: '2026-10-08T18:50:00Z',
        details: 'إنشاء تذكرة خدمة عملاء وتخصيص وكيل لدراسة التعويض.',
        requiresHumanApproval: true,
      }
    ],
    requiresHumanApproval: true,
    detectedAt: '2026-10-08T18:48:00Z',
    lastFollowUpAt: '2026-10-08T18:50:00Z',
  }
];

export const scenarioTimelines: TimelineEvent[] = [
  {
    id: 'tl-1',
    orderId: 'o-zh-2481',
    timestamp: '2026-10-08T18:00:00Z',
    type: 'ORDER_CREATED',
    actor: 'SYSTEM',
    title: 'تم إنشاء الطلب',
    description: 'تم استلام طلب جديد (وجبة دجاج صحية مع أرز).',
    isAnomaly: false,
  },
  {
    id: 'tl-2',
    orderId: 'o-zh-2481',
    timestamp: '2026-10-08T18:05:00Z',
    type: 'CUSTOMER_MODIFIED',
    actor: 'CUSTOMER',
    title: 'العميل قام بتعديل الطلب',
    description: 'تم حذف الأرز وإضافة سلطة.',
    isAnomaly: false,
  },
  {
    id: 'tl-3',
    orderId: 'o-zh-2481',
    timestamp: '2026-10-08T18:15:00Z',
    type: 'KITCHEN_UPDATED',
    actor: 'KITCHEN',
    title: 'المطبخ استجاب للتعديل',
    description: 'تم تجهيز الوجبة بدون أرز حسب التعديل.',
    isAnomaly: false,
  },
  {
    id: 'tl-4',
    orderId: 'o-zh-2481',
    timestamp: '2026-10-08T18:24:00Z',
    type: 'PACKING_OUTDATED_DETECTED',
    actor: 'AI_AGENT',
    title: 'اكتشاف شاشة تغليف غير محدثة',
    description: 'تم ملاحظة أن شاشة التغليف تعرض الطلب القديم (بالأرز).',
    isAnomaly: true,
  },
  {
    id: 'tl-5',
    orderId: 'o-zh-2481',
    timestamp: '2026-10-08T18:25:00Z',
    type: 'AI_MISMATCH_DETECTED',
    actor: 'AI_AGENT',
    title: 'اكتشاف تعارض في محتويات التغليف',
    description: 'تم تغليف الأرز بالخطأ وتجهيز الطلب الخاطئ.',
    isAnomaly: true,
  },
  {
    id: 'tl-6',
    orderId: 'o-zh-2481',
    timestamp: '2026-10-08T18:25:30Z',
    type: 'ALERT_SENT',
    actor: 'AI_AGENT',
    title: 'إرسال تنبيه للمشرف والتغليف',
    description: 'تم إرسال إشعار فوري لمنع تسليم الطلب الخاطئ للسائق.',
    isAnomaly: false,
  }
];
