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
  const [selectedBrand, setSelectedBrand] = useState('zahi');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  
  // Use local state so we can mutate the statuses for the Demo
  const [exceptions, setExceptions] = useState<OperationalException[]>(() => mockOperationService.getActiveExceptions());
  
  const { showAlert } = useNotification();

  const filteredExceptions = exceptions.filter(exc => {
    const brandMatch = selectedBrand === 'ALL' || exc.brand.toLowerCase() === selectedBrand.toLowerCase();
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
    <div className="page-shell w-full mx-auto space-y-6">
      {/* Title Container with 28px radius */}
      <header className="glass page-header mb-6">
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3 tracking-tight">
          <span className="w-3 h-3 rounded-full bg-teal-600 animate-pulse" />
          مركز الاستثناءات (AI Exceptions)
        </h1>
        <p className="text-white/80 font-semibold text-sm mt-1.5">
          الحالات التشغيلية التي تتطلب الانتباه والتدخل في مطاعم زاهي (Zahi)
        </p>
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
        <div className="glass border border-white/25 rounded-2xl p-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✨</span>
            <div>
              <h3 className="font-extrabold text-white text-lg">إجراءات مجمعة ذكية (Smart Bulk Actions)</h3>
              <p className="text-sm text-white/80 font-semibold mt-1">
                يوجد <strong className="text-white font-extrabold">{eligibleForBulk.length}</strong> حالة بسيطة/متوسطة مقترحة للحل التلقائي بواسطة الذكاء الاصطناعي.
              </p>
            </div>
          </div>
          <button 
            onClick={handleBulkResolve}
            className="bg-white/20 hover:bg-white/25 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap active:scale-95 cursor-pointer text-sm "
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
          <div className="col-span-full glass text-center py-16 text-white/80 font-bold border">
            <div className="text-4xl mb-4">👍</div>
            لا توجد استثناءات نشطة تتطابق مع الفلتر المختار
          </div>
        )}
      </div>
    </div>
  );
}
