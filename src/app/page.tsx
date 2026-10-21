"use client";

import KPIWidget from '@/components/dashboard/KPIWidget';
import { mockOperationService } from '@/application/services/mockOperationService';
import DemoAlertTrigger from '@/components/common/DemoAlertTrigger';
import AIAutonomyControl from '@/components/dashboard/AIAutonomyControl';
import { useLanguage } from '@/components/common/LanguageContext';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

export default function DashboardPage() {
  const { t } = useLanguage();
  const kpis = mockOperationService.getDashboardKPIs();

  return (
    <div className="max-w-[1560px] mx-auto space-y-6">
      <DemoAlertTrigger />
      
      {/* Title Container */}
      <header className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
            {t('dashboard.title')}
          </h1>
          <p className="text-slate-100 font-semibold text-sm mt-1.5 drop-shadow-sm">
            {t('dashboard.subtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="self-start sm:self-center flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-md active:scale-95"
          title={t('sidebar.logout') || "تسجيل الخروج"}
        >
          <LogOut size={16} />
          <span>{t('sidebar.logout') || "تسجيل الخروج"}</span>
        </button>
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
