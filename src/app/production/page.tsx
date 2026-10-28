import { Suspense } from 'react';
import ProductionKDSClient from './ProductionKDSClient';

export const metadata = {
  title: 'لوحة التحكم للإنتاج | Zahi Control Tower',
  description: 'لوحة التحكم للإنتاج ومتابعة مسار دورة التشغيل (T-2) وخطوط التجميع في مطبخ زاهي المركزي',
};

export default function ProductionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[60vh] items-center justify-center text-white/80 font-bold">
          جاري تحميل لوحة التحكم للإنتاج...
        </div>
      }
    >
      <ProductionKDSClient />
    </Suspense>
  );
}
