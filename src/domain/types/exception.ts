import { Brand } from './order';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type Department = 
  | 'ORDERS' 
  | 'KITCHEN' 
  | 'PACKING' 
  | 'DELIVERY' 
  | 'CUSTOMER_SERVICE' 
  | 'SYSTEMS';

export type ExceptionCategory = 
  | 'PACKING_MISMATCH'
  | 'DELIVERY_DELAY'
  | 'MISSING_ITEM'
  | 'PRODUCTION_BOTTLENECK'
  | 'CUSTOMER_COMPLAINT'
  | 'DATA_SYNC_ERROR';

export type ExceptionStatus = 
  | 'DETECTED' 
  | 'ALERTED' 
  | 'IN_PROGRESS' 
  | 'RESOLVED' 
  | 'ESCALATED';

export interface AIAction {
  actionType: 'AUTO_ALERT' | 'TICKET_CREATED' | 'NOTIFIED_MANAGER' | 'RECOMMENDATION_ONLY';
  executedAt: string;
  details: string;
  requiresHumanApproval: boolean;
  isApprovedByHuman?: boolean;
}

export interface OperationalException {
  id: string;
  orderId?: string;
  brand: Brand;
  title: string;
  riskLevel: RiskLevel;
  department: Department;
  category: ExceptionCategory;
  status: ExceptionStatus;
  rootCauseHypothesis: string;
  suggestedAction: string;
  aiActionsTaken: AIAction[];
  requiresHumanApproval: boolean;
  detectedAt: string;
  lastFollowUpAt: string;
  resolvedAt?: string;
}
