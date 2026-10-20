import { OperationalException } from '@/domain/types/exception';

interface Props {
  exception: OperationalException;
}

const riskColorMap = {
  CRITICAL: 'bg-rose-500/15 text-rose-200 border border-rose-300/30',
  HIGH: 'bg-amber-500/15 text-amber-200 border border-amber-300/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-200 border border-yellow-300/30',
  LOW: 'bg-teal-500/15 text-teal-100 border border-teal-300/30',
};

export default function ExceptionCard({ exception }: Props) {
  const badgeClass = riskColorMap[exception.riskLevel];

  return (
    <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.15)] rounded-2xl flex flex-col transition-all duration-200 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/20 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-xl border border-white/20 bg-white/8 text-white">
              زاهي {exception.orderId ? `- ${exception.orderId}` : ''}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${badgeClass}`}>
              {exception.riskLevel}
            </span>
            <span className="text-xs text-white/80 bg-white/8 border border-white/20 px-2 py-0.5 rounded-lg font-bold">
              {exception.department}
            </span>
          </div>
          <h3 className="text-lg font-extrabold text-white">{exception.title}</h3>
        </div>
        <div className="text-xs text-white/65 font-mono font-bold whitespace-nowrap">
          {new Date(exception.detectedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* AI Analysis */}
      <div className="p-5 bg-white/8 flex-1 border-b border-white/20">
        <h4 className="text-xs font-extrabold text-white mb-1.5 flex items-center gap-1.5">
          <span className="text-base">✨</span> تحليل الذكاء الاصطناعي (السبب الجذري)
        </h4>
        <p className="text-sm text-white/80 leading-relaxed font-medium">
          {exception.rootCauseHypothesis}
        </p>
      </div>

      {/* Suggested Action */}
      <div className="p-5">
        <h4 className="text-xs font-bold text-white/65 mb-1">الإجراء المقترح:</h4>
        <p className="text-sm text-white mb-4 font-semibold">{exception.suggestedAction}</p>
        
        {exception.requiresHumanApproval && (
          <div className="flex gap-2">
            <button className="bg-white/20 hover:bg-white/25 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all active:scale-95 cursor-pointer ">
              موافقة وتنفيذ
            </button>
            <button className="bg-white/8 border border-white/20 text-white/80 hover:bg-white/15 px-5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer">
              تجاهل
            </button>
          </div>
        )}
        {!exception.requiresHumanApproval && exception.aiActionsTaken.length > 0 && (
          <div className="text-xs text-teal-100 font-bold flex items-center gap-1.5 bg-teal-500/15 border border-teal-300/30 p-2.5 rounded-xl">
            <span className="text-white">✓</span> {exception.aiActionsTaken[0].details}
          </div>
        )}
      </div>
    </div>
  );
}
