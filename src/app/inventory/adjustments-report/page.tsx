import AdjustmentsReportClient from './AdjustmentsReportClient';

export const metadata = {
  title: 'تقرير التعديلات اليدوية للمخزون | Zahi Control Tower',
  description: 'سجل الرقابة والتدقيق لجميع عمليات تعديل أرصدة الأصناف وإدارة طلبات المشتركين في نظام المخزون',
};

export default function AdjustmentsReportPage() {
  return <AdjustmentsReportClient />;
}

