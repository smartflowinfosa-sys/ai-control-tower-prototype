"use client";

import KPIWidget from '@/components/dashboard/KPIWidget';
import { mockOperationService } from '@/application/services/mockOperationService';
import AIAutonomyControl from '@/components/dashboard/AIAutonomyControl';
import { useLanguage } from '@/components/common/LanguageContext';

export default function DashboardClientView() {
  const { t } = useLanguage();
  const kpis = mockOperationService.getDashboardKPIs();

  return (
    <div className="max-w-[1560px] mx-auto space-y-6">
      {/* Title Container */}
      <header className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl text-white p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
          {t('dashboard.title')}
        </h1>
        <p className="text-slate-100 font-semibold text-sm mt-1.5 drop-shadow-sm">
          {t('dashboard.subtitle')}
        </p>
      </header>

      <AIAutonomyControl />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
