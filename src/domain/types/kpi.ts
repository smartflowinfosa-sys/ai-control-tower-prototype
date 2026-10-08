export interface KPIStats {
  totalOrders: number;
  activeOrders: number;
  delayedOrders: number;
  openExceptions: number;
  criticalCount: number;
  highCount: number;
  autoResolvedPercentage: number;
  humanInterventionPercentage: number;
}
