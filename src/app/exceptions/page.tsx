import ExceptionCard from '@/components/exceptions/ExceptionCard';
import { mockOperationService } from '@/application/services/mockOperationService';

const riskWeight = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export default function ExceptionsPage() {
  const exceptions = mockOperationService.getActiveExceptions();
  
  // Sort by risk (CRITICAL -> HIGH -> MEDIUM -> LOW)
  const sortedExceptions = [...exceptions].sort(
    (a, b) => riskWeight[b.riskLevel] - riskWeight[a.riskLevel]
  );

  return (
    <div className="max-w-6xl w-full mx-auto">
      <header className="mb-8 border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <span className="text-red-500 animate-pulse">🔴</span> مركز الاستثناءات (AI Exceptions)
        </h1>
        <p className="text-gray-500 text-sm mt-2">الحالات التشغيلية التي تتطلب الانتباه والتدخل من فريق المراقبة</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sortedExceptions.map((exc) => (
          <ExceptionCard key={exc.id} exception={exc} />
        ))}
      </div>
    </div>
  );
}
