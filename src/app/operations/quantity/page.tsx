import QuantityClient from './QuantityClient';

export const metadata = {
  title: 'فاتورة الكمية وتتبع استهلاك المخزون | Zahi Control Tower',
  description: 'تحليل كميات الوجبات وتتبع استهلاك مواد التغليف والمخزون بناءً على جدول المواد (BOM) لمطابخ وفروع زاهي',
};

export default function QuantityPage() {
  return <QuantityClient />;
}
