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
  ZAHI: 'text-sky-700 bg-sky-50 border-sky-200',
};

export default function ExceptionCard({ exception }: Props) {
  const badgeClass = riskColorMap[exception.riskLevel];
  const brandClass = brandColorMap[exception.brand] || brandColorMap.ZAHI;

  return (
    <div className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden flex flex-col hover:bg-white/70 hover:shadow-xl transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-white/40 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${brandClass}`}>
              زاهي {exception.orderId ? `- ${exception.orderId}` : ''}
            </span>
            <span className={`text-xs font-bold px-2 py-1 rounded shadow-sm ${badgeClass}`}>
              {exception.riskLevel}
            </span>
            <span className="text-xs text-gray-500 bg-white/60 border border-white/80 px-2 py-1 rounded">
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
      <div className="p-4 bg-sky-50/40 flex-1 border-b border-sky-100/50">
        <h4 className="text-xs font-bold text-sky-800 mb-1 flex items-center gap-1">
          <span className="text-lg">✨</span> تحليل الذكاء الاصطناعي (السبب الجذري)
        </h4>
        <p className="text-sm text-gray-700 leading-relaxed">
          {exception.rootCauseHypothesis}
        </p>
      </div>

      {/* Suggested Action */}
      <div className="p-4 bg-teal-50/30">
        <h4 className="text-xs font-bold text-teal-900 mb-1">الإجراء المقترح:</h4>
        <p className="text-sm text-gray-700 mb-4">{exception.suggestedAction}</p>
        
        {exception.requiresHumanApproval && (
          <div className="flex gap-2">
            <button className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95">
              موافقة وتنفيذ
            </button>
            <button className="bg-white/80 border border-white/80 text-gray-700 hover:bg-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm">
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
