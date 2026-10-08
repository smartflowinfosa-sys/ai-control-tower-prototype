import { dashboardKPIs, dummyOrders } from '@/infrastructure/mock/data-generator';
import { scenarioExceptions, scenarioOrders, scenarioTimelines } from '@/infrastructure/mock/scenarios';
import { Order } from '@/domain/types/order';
import { OperationalException } from '@/domain/types/exception';
import { KPIStats } from '@/domain/types/kpi';
import { TimelineEvent } from '@/domain/types/timeline';

class MockOperationService {
  getAllOrders(): Order[] {
    return [...scenarioOrders, ...dummyOrders];
  }

  getDashboardKPIs(): KPIStats {
    return dashboardKPIs;
  }

  getActiveExceptions(): OperationalException[] {
    return scenarioExceptions;
  }

  getOrderTimeline(orderId: string): TimelineEvent[] {
    return scenarioTimelines.filter(event => event.orderId === orderId);
  }
}

export const mockOperationService = new MockOperationService();
