import KPIWidget from '@/components/dashboard/KPIWidget';
import { mockOperationService } from '@/application/services/mockOperationService';
import DemoAlertTrigger from '@/components/common/DemoAlertTrigger';
import AIAutonomyControl from '@/components/dashboard/AIAutonomyControl';

export default function DashboardPage() {
  const kpis = mockOperationService.getDashboardKPIs();

  return (
    <div className="page-shell dashboard-page">
      <DemoAlertTrigger />
      
      {/* Title Container with 24px radius */}
      <header className="glass page-header">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          لوحة القيادة التشغيلية (Control Tower)
        </h1>
        <p className="text-white/80 font-semibold text-sm mt-1.5">
          مراقبة الأداء اللحظي وسلاسل الإمداد لعمليات مطاعم زاهي (Zahi)
        </p>
      </header>

      <AIAutonomyControl />

      <div className="dashboard-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <KPIWidget 
          title="إجمالي الطلبات" 
          value={kpis.totalOrders} 
        />
        <KPIWidget 
          title="الطلبات النشطة" 
          value={kpis.activeOrders} 
        />
        <KPIWidget 
          title="استثناءات مفتوحة" 
          value={kpis.openExceptions} 
          subtitle="تتطلب التدخل" 
        />
        <KPIWidget 
          title="حالات حرجة" 
          value={kpis.criticalCount} 
        />
        
        <KPIWidget 
          title="طلبات متأخرة" 
          value={kpis.delayedOrders} 
        />
        <KPIWidget 
          title="نسبة الحل التلقائي (AI)" 
          value={`${kpis.autoResolvedPercentage}%`} 
        />
        <KPIWidget 
          title="التدخل البشري" 
          value={`${kpis.humanInterventionPercentage}%`} 
        />
      </div>
    </div>
  );
}
