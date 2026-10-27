// Centralized KDS Batch Store & Reactive Synchronization

export type KDSColumnId = 'IN_PROGRESS' | 'PACKAGING' | 'DONE' | 'DELIVERED';

export interface BatchProductionItem {
  id: string;
  meal_code?: string;
  menuId?: string;
  name: string;
  name_en: string;
  category: 'فطور' | 'وجبات رئيسية' | 'سلطات' | 'حلى' | string;
  target_quantity: number;
  completed_quantity: number;
  station: string;
  chef: string;
  prep_time: string;
  priority: 'HIGH' | 'MEDIUM' | 'NORMAL';
  column: KDSColumnId;
  dietNotes: string;
  calories: number;
  packaging?: Array<{
    item_code: string;
    item_name_ar: string;
    quantity_used: number;
  }>;
}

export interface MasterPlanItem {
  id: string;
  meal_code?: string;
  short: string;
  category: string;
  required: number;
}

export const TOTAL_PRODUCTION_TARGET = 245;

export function normalizeCategory(cat?: string | null): string {
  if (!cat) return 'وجبات رئيسية';
  const c = cat.trim();
  if (c === 'الفطور' || c === 'فطور' || c.toLowerCase() === 'breakfast') return 'فطور';
  if (c === 'الوجبات الرئيسية' || c === 'وجبات رئيسية' || c.toLowerCase() === 'main course') return 'وجبات رئيسية';
  if (c === 'السلطات' || c === 'سلطات' || c.toLowerCase() === 'salads') return 'سلطات';
  if (c === 'الحلو' || c === 'حلى' || c.toLowerCase() === 'dessert') return 'حلى';
  return 'وجبات رئيسية';
}

export const initialMasterPlan: MasterPlanItem[] = [
  { id: '43022', meal_code: '43022', short: 'كباب لحم مع ارز الزعفران', category: 'وجبات رئيسية', required: 45 },
  { id: '43039', meal_code: '43039', short: 'سليق دجاج', category: 'وجبات رئيسية', required: 40 },
  { id: '43042', meal_code: '43042', short: 'كفتة سمك مشوية', category: 'وجبات رئيسية', required: 35 },
  { id: '42857', meal_code: '42857', short: 'سلطة الكينوا', category: 'سلطات', required: 30 },
  { id: '43070', meal_code: '43070', short: 'سلطة السيزر بالدجاج', category: 'سلطات', required: 25 },
  { id: '43015', meal_code: '43015', short: 'بان كيك جبنه قريش', category: 'فطور', required: 25 },
  { id: '43004', meal_code: '43004', short: 'فول مع الطحينة', category: 'فطور', required: 25 },
  { id: '43091', meal_code: '43091', short: 'بارفيه الفراولة والمكسرات', category: 'حلى', required: 20 },
];

export const initialKdsBatches: BatchProductionItem[] = [
  {
    id: 'BATCH-101',
    meal_code: '43022',
    menuId: '43022',
    name: 'كباب لحم مع ارز الزعفران',
    name_en: 'Lamb Kebab with Saffron Rice',
    category: 'وجبات رئيسية',
    target_quantity: 45,
    completed_quantity: 15,
    station: 'محطة الشوايات والأفران',
    chef: 'الشيف طارق',
    prep_time: '35 دقيقة',
    priority: 'HIGH',
    column: 'IN_PROGRESS',
    dietNotes: 'خالٍ من الغلوتين • بروتين عالي',
    calories: 480,
    packaging: [
      { item_code: 'P1', item_name_ar: 'صحن مقسم 32', quantity_used: 1 },
      { item_code: 'P6', item_name_ar: 'سليف مطبوع', quantity_used: 1 },
      { item_code: 'P7', item_name_ar: 'أدوات المائدة مطبوع', quantity_used: 1 },
      { item_code: 'P8', item_name_ar: 'كيس زاهي مطبوع', quantity_used: 1 },
    ],
  },
  {
    id: 'BATCH-102',
    meal_code: '42857',
    menuId: '42857',
    name: 'سلطة الكينوا',
    name_en: 'Quinoa Salad with Avocado',
    category: 'سلطات',
    target_quantity: 30,
    completed_quantity: 18,
    station: 'محطة التحضير البارد',
    chef: 'الشيف سارة',
    prep_time: '20 دقيقة',
    priority: 'MEDIUM',
    column: 'IN_PROGRESS',
    dietNotes: 'نباتي 100% • غني بالألياف',
    calories: 310,
    packaging: [
      { item_code: 'P4', item_name_ar: 'صحن السلطة', quantity_used: 1 },
      { item_code: 'P6', item_name_ar: 'سليف مطبوع', quantity_used: 1 },
      { item_code: 'P7', item_name_ar: 'أدوات المائدة مطبوع', quantity_used: 1 },
      { item_code: 'P8', item_name_ar: 'كيس زاهي مطبوع', quantity_used: 1 },
      { item_code: 'P3', item_name_ar: 'علب الصوص', quantity_used: 1 },
    ],
  },
  {
    id: 'BATCH-106',
    meal_code: '43039',
    menuId: '43039',
    name: 'سليق دجاج',
    name_en: 'Saleeg Chicken Traditional',
    category: 'وجبات رئيسية',
    target_quantity: 40,
    completed_quantity: 24,
    station: 'محطة الطبخ الساخن',
    chef: 'الشيف عادل',
    prep_time: '30 دقيقة',
    priority: 'MEDIUM',
    column: 'IN_PROGRESS',
    dietNotes: 'بروتين نقي • قليل الدهون',
    calories: 420,
    packaging: [
      { item_code: 'P1', item_name_ar: 'صحن مقسم 32', quantity_used: 1 },
      { item_code: 'P6', item_name_ar: 'سليف مطبوع', quantity_used: 1 },
      { item_code: 'P7', item_name_ar: 'أدوات المائدة مطبوع', quantity_used: 1 },
      { item_code: 'P8', item_name_ar: 'كيس زاهي مطبوع', quantity_used: 1 },
    ],
  },
  {
    id: 'BATCH-103',
    meal_code: '43015',
    menuId: '43015',
    name: 'بان كيك جبنه قريش',
    name_en: 'Cottage Cheese Pancake',
    category: 'فطور',
    target_quantity: 25,
    completed_quantity: 25,
    station: 'محطة الوجبات الخفيفة',
    chef: 'الشيف خالد',
    prep_time: '15 دقيقة',
    priority: 'NORMAL',
    column: 'PACKAGING',
    dietNotes: 'بروتين عالي • بدون سكر مضاف',
    calories: 290,
    packaging: [
      { item_code: 'P1', item_name_ar: 'صحن مقسم 32', quantity_used: 1 },
      { item_code: 'P6', item_name_ar: 'سليف مطبوع', quantity_used: 1 },
      { item_code: 'P7', item_name_ar: 'أدوات المائدة مطبوع', quantity_used: 1 },
      { item_code: 'P8', item_name_ar: 'كيس زاهي مطبوع', quantity_used: 1 },
    ],
  },
  {
    id: 'BATCH-105',
    meal_code: '43042',
    menuId: '43042',
    name: 'كفتة سمك مشوية',
    name_en: 'Grilled Fish Kofta with Vegetables',
    category: 'وجبات رئيسية',
    target_quantity: 35,
    completed_quantity: 20,
    station: 'محطة الأسماك والشواية',
    chef: 'الشيف طارق',
    prep_time: '25 دقيقة',
    priority: 'HIGH',
    column: 'PACKAGING',
    dietNotes: 'أوميغا 3 • دايت صحي',
    calories: 380,
    packaging: [
      { item_code: 'P1', item_name_ar: 'صحن مقسم 32', quantity_used: 1 },
      { item_code: 'P6', item_name_ar: 'سليف مطبوع', quantity_used: 1 },
      { item_code: 'P7', item_name_ar: 'أدوات المائدة مطبوع', quantity_used: 1 },
      { item_code: 'P8', item_name_ar: 'كيس زاهي مطبوع', quantity_used: 1 },
    ],
  },
  {
    id: 'BATCH-104',
    meal_code: '43091',
    menuId: '43091',
    name: 'بارفيه الفراولة والمكسرات',
    name_en: 'Strawberry & Nut Parfait',
    category: 'حلى',
    target_quantity: 20,
    completed_quantity: 20,
    station: 'محطة التحضير البارد',
    chef: 'الشيف سارة',
    prep_time: '15 دقيقة',
    priority: 'HIGH',
    column: 'DONE',
    dietNotes: 'طبيعي 100% • بدون سكر مضاف',
    calories: 180,
    packaging: [
      { item_code: 'P10', item_name_ar: 'صحن الحلا الشفاف', quantity_used: 1 },
      { item_code: 'P7', item_name_ar: 'أدوات المائدة مطبوع', quantity_used: 1 },
      { item_code: 'P8', item_name_ar: 'كيس زاهي مطبوع', quantity_used: 1 },
    ],
  },
  {
    id: 'BATCH-107',
    meal_code: '43004',
    menuId: '43004',
    name: 'فول مع الطحينة',
    name_en: 'Foul with Tahini & Olive Oil',
    category: 'فطور',
    target_quantity: 20,
    completed_quantity: 20,
    station: 'محطة الوجبات الخفيفة',
    chef: 'الشيف خالد',
    prep_time: '15 دقيقة',
    priority: 'NORMAL',
    column: 'DELIVERED',
    dietNotes: 'ألياف عالية • بروتين نباتي',
    calories: 340,
    packaging: [
      { item_code: 'P1', item_name_ar: 'صحن مقسم 32', quantity_used: 1 },
      { item_code: 'P6', item_name_ar: 'سليف مطبوع', quantity_used: 1 },
      { item_code: 'P7', item_name_ar: 'أدوات المائدة مطبوع', quantity_used: 1 },
      { item_code: 'P8', item_name_ar: 'كيس زاهي مطبوع', quantity_used: 1 },
    ],
  },
];

const STORAGE_KEY = 'zahi_kds_batches_state_v2';

let inMemoryBatches: BatchProductionItem[] = [...initialKdsBatches];

export function getKdsBatches(): BatchProductionItem[] {
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].meal_code) {
          inMemoryBatches = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to read KDS batches from storage:', e);
    }
  }
  return inMemoryBatches;
}

export function saveKdsBatches(batches: BatchProductionItem[]): void {
  inMemoryBatches = batches;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
    } catch (e) {
      console.warn('Failed to save KDS batches to storage:', e);
    }

    const stats = calculateKdsCompletion(batches);
    window.dispatchEvent(
      new CustomEvent('kds_batches_updated', {
        detail: {
          batches,
          ...stats,
        },
      })
    );
  }
}

export function calculateKdsCompletion(
  batches: BatchProductionItem[],
  totalTarget: number = TOTAL_PRODUCTION_TARGET
): {
  readyUnits: number;
  totalTarget: number;
  completionRate: number;
} {
  // Formula: ((Total Units in 'جاهز' + Total Units in 'تم التسليم') / Total Target) * 100
  const readyUnits = batches
    .filter((b) => b.column === 'DONE' || b.column === 'DELIVERED')
    .reduce((acc, b) => acc + (Number(b.target_quantity) || 0), 0);

  const completionRate = Math.round((readyUnits / totalTarget) * 100);

  return {
    readyUnits,
    totalTarget,
    completionRate,
  };
}

export function moveKdsBatch(batchId: string, targetCol: KDSColumnId): BatchProductionItem[] {
  const current = getKdsBatches();
  const updated = current.map((b) => {
    if (b.id !== batchId) return b;
    let newCompleted = b.completed_quantity;
    if (targetCol === 'DONE' || targetCol === 'DELIVERED') {
      newCompleted = b.target_quantity;
    } else if (targetCol === 'IN_PROGRESS' && b.completed_quantity === 0) {
      newCompleted = Math.round(b.target_quantity * 0.5);
    }
    return {
      ...b,
      column: targetCol,
      completed_quantity: newCompleted,
    };
  });
  saveKdsBatches(updated);
  return updated;
}

const PLAN_STORAGE_KEY = 'zahi_kds_master_plan_state_v2';

let inMemoryMasterPlan: MasterPlanItem[] = [...initialMasterPlan];

export function getMasterPlan(): MasterPlanItem[] {
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(PLAN_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].meal_code) {
          inMemoryMasterPlan = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to read Master Plan from storage:', e);
    }
  }
  return inMemoryMasterPlan;
}

export function saveMasterPlan(plan: MasterPlanItem[]): void {
  inMemoryMasterPlan = plan;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
    } catch (e) {
      console.warn('Failed to save Master Plan to storage:', e);
    }
    window.dispatchEvent(
      new CustomEvent('kds_master_plan_updated', {
        detail: { plan },
      })
    );
  }
}

export function importAIVisionProductionPlan(
  extractedPlan: MasterPlanItem[],
  newBatches: BatchProductionItem[]
): { plan: MasterPlanItem[]; batches: BatchProductionItem[] } {
  saveMasterPlan(extractedPlan);
  saveKdsBatches(newBatches);
  return { plan: extractedPlan, batches: newBatches };
}

export function addKdsBatch(newBatch: BatchProductionItem): BatchProductionItem[] {
  const current = getKdsBatches();
  const updated = [newBatch, ...current];
  saveKdsBatches(updated);
  return updated;
}

