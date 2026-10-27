import { Suspense } from 'react';
import ProductionKDSClient from './ProductionKDSClient';

export default function ProductionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[60vh] items-center justify-center text-white font-bold">
          جاري تحميل شاشة الإنتاج المجمع (KDS)...
        </div>
      }
    >
      <ProductionKDSClient />
    </Suspense>
  );
}
