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

  getOrderById(orderId: string): Order | undefined {
    return this.getAllOrders().find(order => order.id === orderId);
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

  addTimelineEvent(event: TimelineEvent) {
    scenarioTimelines.push(event);
  }

  resolveException(idOrOrderId: string) {
    const target = idOrOrderId.trim().toLowerCase();
    const exc = scenarioExceptions.find(e => 
      e.id.toLowerCase() === target || 
      e.orderId?.toLowerCase() === target || 
      (e.orderId && e.orderId.toLowerCase().includes(target)) ||
      (e.orderId && target.includes(e.orderId.toLowerCase()))
    );
    if (exc) {
      exc.status = 'RESOLVED';
    }
  }
}

export const mockOperationService = new MockOperationService();
