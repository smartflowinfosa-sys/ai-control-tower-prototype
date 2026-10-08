export type TimelineActor = 
  | 'CUSTOMER' 
  | 'SYSTEM' 
  | 'KITCHEN' 
  | 'PACKING' 
  | 'DELIVERY' 
  | 'AI_AGENT';

export type TimelineEventType = 
  | 'ORDER_CREATED'
  | 'CUSTOMER_MODIFIED'
  | 'KITCHEN_UPDATED'
  | 'PACKING_OUTDATED_DETECTED'
  | 'AI_MISMATCH_DETECTED'
  | 'ALERT_SENT'
  | 'PACKING_CORRECTED'
  | 'AI_VERIFIED'
  | 'RESOLVED';

export interface TimelineEvent {
  id: string;
  orderId: string;
  timestamp: string;
  type: TimelineEventType;
  actor: TimelineActor;
  title: string;
  description: string;
  isAnomaly: boolean;
  metaData?: Record<string, any>;
}
