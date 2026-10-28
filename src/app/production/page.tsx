import { Suspense } from 'react';
import ProductionKDSClient from './ProductionKDSClient';
import ProductionLoading from './loading';

export const metadata = {
  title: 'لوحة التحكم للإنتاج | Zahi Control Tower',
  description: 'لوحة التحكم للإنتاج ومتابعة مسار دورة التشغيل (T-2) وخطوط التجميع في مطبخ زاهي المركزي',
};

export default function ProductionPage() {
  return (
    <Suspense fallback={<ProductionLoading />}>
      <ProductionKDSClient />
    </Suspense>
  );
}
