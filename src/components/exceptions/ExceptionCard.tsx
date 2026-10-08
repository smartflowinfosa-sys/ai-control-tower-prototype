import { OperationalException } from '@/domain/types/exception';

interface Props {
  exception: OperationalException;
}

const riskColorMap = {
  CRITICAL: 'bg-[var(--color-risk-critical)] text-white',
  HIGH: 'bg-[var(--color-risk-high)] text-white',
  MEDIUM: 'bg-[var(--color-risk-medium)] text-white',
  LOW: 'bg-[var(--color-risk-low)] text-white',
};

const brandColorMap = {
  ZAHI: 'text-[var(--color-zahi-dark)] bg-emerald-50 border-emerald-200',
  MAWZOON: 'text-[var(--color-mawzoon-primary)] bg-blue-50 border-blue-200',
};

export default function ExceptionCard({ exception }: Props) {
  const badgeClass = riskColorMap[exception.riskLevel];
  const brandClass = brandColorMap[exception.brand];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-bold px-2 py-1 rounded border ${brandClass}`}>
              {exception.brand} {exception.orderId ? `- ${exception.orderId}` : ''}
            </span>
            <span className={`text-xs font-bold px-2 py-1 rounded shadow-sm ${badgeClass}`}>
              {exception.riskLevel}
            </span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {exception.department}
            </span>
          </div>
          <h3 className="text-lg font-bold text-gray-800">{exception.title}</h3>
        </div>
        <div className="text-xs text-gray-400 whitespace-nowrap">
          {new Date(exception.detectedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* AI Analysis */}
      <div className="p-4 bg-indigo-50/50 flex-1 border-b border-indigo-50">
        <h4 className="text-xs font-bold text-indigo-800 mb-1 flex items-center gap-1">
          <span className="text-lg">✨</span> تحليل الذكاء الاصطناعي (السبب الجذري)
        </h4>
        <p className="text-sm text-gray-700 leading-relaxed">
          {exception.rootCauseHypothesis}
        </p>
      </div>

      {/* Suggested Action */}
      <div className="p-4 bg-emerald-50/30">
        <h4 className="text-xs font-bold text-emerald-800 mb-1">الإجراء المقترح:</h4>
        <p className="text-sm text-gray-700 mb-4">{exception.suggestedAction}</p>
        
        {exception.requiresHumanApproval && (
          <div className="flex gap-2">
            <button className="bg-[var(--color-zahi-primary)] hover:bg-[var(--color-zahi-dark)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
              موافقة وتنفيذ
            </button>
            <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              تجاهل
            </button>
          </div>
        )}
        {!exception.requiresHumanApproval && exception.aiActionsTaken.length > 0 && (
          <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 bg-emerald-100/50 p-2 rounded-md">
            <span>✓</span> {exception.aiActionsTaken[0].details}
          </div>
        )}
      </div>
    </div>
  );
}
