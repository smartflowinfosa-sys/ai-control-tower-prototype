"use client";

import KPIWidget from '@/components/dashboard/KPIWidget';
import { mockOperationService } from '@/application/services/mockOperationService';
import DemoAlertTrigger from '@/components/common/DemoAlertTrigger';
import AIAutonomyControl from '@/components/dashboard/AIAutonomyControl';
import { useLanguage } from '@/components/common/LanguageContext';

export default function DashboardPage() {
  const { t } = useLanguage();
  const kpis = mockOperationService.getDashboardKPIs();

  return (
    <div className="page-shell dashboard-page">
      <DemoAlertTrigger />
      
      {/* Title Container with 28px radius */}
      <header className="glass page-header">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          {t('dashboard.title')}
        </h1>
        <p className="text-white/80 font-semibold text-sm mt-1.5">
          {t('dashboard.subtitle')}
        </p>
      </header>

      <AIAutonomyControl />

      <div className="dashboard-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <KPIWidget 
          title={t('dashboard.totalOrders')} 
          value={kpis.totalOrders} 
        />
        <KPIWidget 
          title={t('dashboard.activeOrders')} 
          value={kpis.activeOrders} 
        />
        <KPIWidget 
          title={t('dashboard.openExceptions')} 
          value={kpis.openExceptions} 
          subtitle={t('dashboard.requiresIntervention')} 
        />
        <KPIWidget 
          title={t('dashboard.criticalCount')} 
          value={kpis.criticalCount} 
        />
        
        <KPIWidget 
          title={t('dashboard.delayedOrders')} 
          value={kpis.delayedOrders} 
        />
        <KPIWidget 
          title={t('dashboard.autoResolved')} 
          value={`${kpis.autoResolvedPercentage}%`} 
        />
        <KPIWidget 
          title={t('dashboard.humanIntervention')} 
          value={`${kpis.humanInterventionPercentage}%`} 
        />
      </div>
    </div>
  );
}
