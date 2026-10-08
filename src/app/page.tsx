import KPIWidget from '@/components/dashboard/KPIWidget';
import { mockOperationService } from '@/application/services/mockOperationService';
import DemoAlertTrigger from '@/components/common/DemoAlertTrigger';
import AIAutonomyControl from '@/components/dashboard/AIAutonomyControl';

export default function DashboardPage() {
  const kpis = mockOperationService.getDashboardKPIs();

  return (
    <div className="max-w-6xl w-full mx-auto">
      <DemoAlertTrigger />
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">لوحة القيادة التشغيلية (Control Tower)</h1>
        <p className="text-gray-500 text-sm mt-2">نظرة عامة على أداء زاهي وموزون</p>
      </header>

      <AIAutonomyControl />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPIWidget 
          title="إجمالي الطلبات" 
          value={kpis.totalOrders} 
          colorClass="text-blue-600" 
        />
        <KPIWidget 
          title="الطلبات النشطة" 
          value={kpis.activeOrders} 
          colorClass="text-emerald-600" 
        />
        <KPIWidget 
          title="استثناءات مفتوحة" 
          value={kpis.openExceptions} 
          colorClass="text-amber-600"
          subtitle="تتطلب التدخل" 
        />
        <KPIWidget 
          title="حالات حرجة" 
          value={kpis.criticalCount} 
          colorClass="text-[var(--color-risk-critical)]" 
        />
        
        <KPIWidget 
          title="طلبات متأخرة" 
          value={kpis.delayedOrders} 
          colorClass="text-rose-600" 
        />
        <KPIWidget 
          title="نسبة الحل التلقائي (AI)" 
          value={`${kpis.autoResolvedPercentage}%`} 
          colorClass="text-indigo-600" 
        />
        <KPIWidget 
          title="التدخل البشري" 
          value={`${kpis.humanInterventionPercentage}%`} 
          colorClass="text-gray-600" 
        />
      </div>
    </div>
  );
}
