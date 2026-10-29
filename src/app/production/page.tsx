import { Suspense } from 'react';
import ProductionKDSClient from './ProductionKDSClient';
import ProductionLoading from './loading';

export const metadata = {
  title: 'لوحة الإنتاج | Zahi Control Tower',
  description: 'لوحة الإنتاج ومتابعة مسار دورة التشغيل (T-2) وخطوط التجميع في مطبخ زاهي المركزي',
};

export default function ProductionPage() {
  return (
    <Suspense fallback={<ProductionLoading />}>
      <ProductionKDSClient />
    </Suspense>
  );
}
