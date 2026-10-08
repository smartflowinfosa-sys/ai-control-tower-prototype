"use client";

import { useState, useMemo } from 'react';
import ExceptionCard from '@/components/exceptions/ExceptionCard';
import { mockOperationService } from '@/application/services/mockOperationService';
import SmartFilterBar from '@/components/common/SmartFilterBar';
import { useNotification } from '@/components/common/NotificationContext';
import { OperationalException } from '@/domain/types/exception';

const riskWeight: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export default function ExceptionsPage() {
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  
  // Use local state so we can mutate the statuses for the Demo
  const [exceptions, setExceptions] = useState<OperationalException[]>(() => mockOperationService.getActiveExceptions());
  
  const { showAlert } = useNotification();

  const filteredExceptions = exceptions.filter(exc => {
    const brandMatch = selectedBrand === 'ALL' || exc.brand === selectedBrand;
    const deptMatch = selectedDept === 'ALL' || exc.department === selectedDept;
    const riskMatch = selectedRisk === 'ALL' || exc.riskLevel === selectedRisk;
    const activeMatch = exc.status !== 'RESOLVED';
    return brandMatch && deptMatch && riskMatch && activeMatch;
  });

  const sortedExceptions = [...filteredExceptions].sort(
    (a, b) => riskWeight[b.riskLevel] - riskWeight[a.riskLevel]
  );

  const eligibleForBulk = useMemo(() => {
    return filteredExceptions.filter(exc => exc.riskLevel === 'LOW' || exc.riskLevel === 'MEDIUM');
  }, [filteredExceptions]);

  const handleBulkResolve = () => {
    if (eligibleForBulk.length === 0) return;

    // Update state to mark as resolved
    setExceptions(prev => prev.map(exc => {
      if ((exc.riskLevel === 'LOW' || exc.riskLevel === 'MEDIUM') && exc.status !== 'RESOLVED') {
        // Push timeline event for demo realism
        if (exc.orderId) {
          mockOperationService.addTimelineEvent({
            id: `tl-bulk-${Date.now()}-${exc.id}`,
            orderId: exc.orderId,
            timestamp: new Date().toISOString(),
            type: 'RESOLVED',
            actor: 'SYSTEM',
            title: 'إجراء مجمع بواسطة الذكاء الاصطناعي',
            description: 'تمت موافقة المدير التشغيلي على تنفيذ الإجراء المجمع لحل المشكلة البسيطة/المتوسطة.',
            isAnomaly: false,
          });
        }
        return { ...exc, status: 'RESOLVED' };
      }
      return exc;
    }));

    showAlert({
      title: 'تم تنفيذ الإجراءات بنجاح ⚡',
      details: `تم حل ${eligibleForBulk.length} مشكلة بسيطة/متوسطة بنجاح، وتم تحديث الأقسام المعنية وإضافة الحدث للتسلسل الزمني.`,
      riskLevel: 'LOW',
      suggestedAction: 'تحديث الشاشات...',
    });
  };

  return (
    <div className="max-w-6xl w-full mx-auto">
      <header className="mb-6 border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <span className="text-red-500 animate-pulse">🔴</span> مركز الاستثناءات (AI Exceptions)
        </h1>
        <p className="text-gray-500 text-sm mt-2">الحالات التشغيلية التي تتطلب الانتباه والتدخل من فريق المراقبة</p>
      </header>

      <SmartFilterBar 
        selectedBrand={selectedBrand}
        onBrandChange={setSelectedBrand}
        selectedDepartment={selectedDept}
        onDepartmentChange={setSelectedDept}
        selectedRisk={selectedRisk}
        onRiskChange={setSelectedRisk}
        showRisk={true}
      />

      {eligibleForBulk.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm gap-4 transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✨</span>
            <div>
              <h3 className="font-bold text-indigo-900 text-lg">إجراءات مجمعة ذكية (Smart Bulk Actions)</h3>
              <p className="text-sm text-indigo-700 mt-1">
                يوجد <strong>{eligibleForBulk.length}</strong> حالة بسيطة/متوسطة مقترحة للحل التلقائي بواسطة الذكاء الاصطناعي.
              </p>
            </div>
          </div>
          <button 
            onClick={handleBulkResolve}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-5 rounded-lg shadow-md transition-colors flex items-center gap-2 whitespace-nowrap active:scale-95"
          >
            تنفيذ الإجراءات المجمعة بنقرة واحدة ⚡
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sortedExceptions.length > 0 ? (
          sortedExceptions.map((exc) => (
            <ExceptionCard key={exc.id} exception={exc} />
          ))
        ) : (
          <div className="col-span-full bg-gray-50 text-center py-16 rounded-xl border border-gray-100 text-gray-500 font-bold">
            <div className="text-4xl mb-4">👍</div>
            لا توجد استثناءات نشطة تتطابق مع الفلتر المختار
          </div>
        )}
      </div>
    </div>
  );
}
