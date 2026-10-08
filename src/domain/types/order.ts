export type Brand = 'ZAHI' | 'MAWZOON';

export type OrderStatus = 
  | 'PENDING' 
  | 'KITCHEN_PREP' 
  | 'PACKING' 
  | 'READY_FOR_DELIVERY' 
  | 'OUT_FOR_DELIVERY' 
  | 'DELIVERED' 
  | 'CANCELLED';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  customizations: string[];
  removedIngredients: string[];
}

export interface Order {
  id: string;
  orderNumber: string;
  brand: Brand;
  status?: OrderStatus;
  customer: {
    name: string;
    phone: string;
  };
  items: OrderItem[];
  kitchenStatus: {
    updated: boolean;
    lastUpdatedAt: string;
    notes?: string;
  };
  packingStatus: {
    updated: boolean;
    lastUpdatedAt: string;
    verifiedItems?: string[];
    mismatchDetected: boolean;
  };
  deliveryStatus: {
    driverName?: string;
    estimatedDeliveryTime: string;
    actualDeliveryTime?: string;
    isDelayed: boolean;
  };
  createdAt: string;
  updatedAt: string;
}
