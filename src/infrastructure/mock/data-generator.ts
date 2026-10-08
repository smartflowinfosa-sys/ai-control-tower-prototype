import { Order } from '@/domain/types/order';
import { KPIStats } from '@/domain/types/kpi';

export const dashboardKPIs: KPIStats = {
  totalOrders: 142,
  activeOrders: 38,
  delayedOrders: 4,
  openExceptions: 5,
  criticalCount: 1,
  highCount: 2,
  autoResolvedPercentage: 65,
  humanInterventionPercentage: 35,
};

const names = ['محمد علي', 'فاطمة سعد', 'عبدالرحمن خالد', 'نورة سعود', 'ياسر القحطاني', 'ريما فهد', 'عبدالله الدوسري'];

export const dummyOrders: Order[] = Array.from({ length: 15 }).map((_, index) => {
  const isZahi = index % 2 === 0;
  const statuses: ('PENDING' | 'KITCHEN_PREP' | 'DELIVERED')[] = ['PENDING', 'KITCHEN_PREP', 'DELIVERED'];
  return {
    id: `dummy-o-${index}`,
    orderNumber: `${isZahi ? 'ZH' : 'MZ'}-10${index + 20}`,
    brand: isZahi ? 'ZAHI' : 'MAWZOON',
    status: statuses[index % 3],
    customer: { 
      name: names[index % names.length], 
      phone: `050999${index.toString().padStart(4, '0')}` 
    },
    items: [
      {
        id: `dummy-item-${index}`,
        name: isZahi ? 'وجبة سلمون' : 'سلطة السيزر الصحية',
        quantity: 1,
        customizations: [],
        removedIngredients: [],
      }
    ],
    kitchenStatus: {
      updated: true,
      lastUpdatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    packingStatus: {
      updated: true,
      lastUpdatedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      mismatchDetected: false,
    },
    deliveryStatus: {
      estimatedDeliveryTime: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
      isDelayed: false,
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    updatedAt: new Date().toISOString(),
  };
});
