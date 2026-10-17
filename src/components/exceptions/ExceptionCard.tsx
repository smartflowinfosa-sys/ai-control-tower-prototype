import { OperationalException } from '@/domain/types/exception';

interface Props {
  exception: OperationalException;
}

const riskColorMap = {
  CRITICAL: 'bg-rose-500/20 text-white',
  HIGH: 'bg-amber-600/20 text-white',
  MEDIUM: 'bg-teal-700/20 text-white',
  LOW: 'bg-teal-800/20 text-white',
};

export default function ExceptionCard({ exception }: Props) {
  const badgeClass = riskColorMap[exception.riskLevel];

  return (
    <div className="glass rounded-[18px] flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="p-5 border-b border-white/14 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-[18px] border glass glass-card text-white">
              زاهي {exception.orderId ? `- ${exception.orderId}` : ''}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg  ${badgeClass}`}>
              {exception.riskLevel}
            </span>
            <span className="text-xs text-white/65 glass glass-card border px-2 py-0.5 rounded-lg font-bold">
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
      <div className="p-5 glass glass-card flex-1 border-b">
        <h4 className="text-xs font-extrabold text-white mb-1.5 flex items-center gap-1.5">
          <span className="text-base">✨</span> تحليل الذكاء الاصطناعي (السبب الجذري)
        </h4>
        <p className="text-sm text-white leading-relaxed font-semibold">
          {exception.rootCauseHypothesis}
        </p>
      </div>

      {/* Suggested Action */}
      <div className="p-5">
        <h4 className="text-xs font-extrabold text-white/65 mb-1">الإجراء المقترح:</h4>
        <p className="text-sm text-white mb-4 font-semibold">{exception.suggestedAction}</p>
        
        {exception.requiresHumanApproval && (
          <div className="flex gap-2">
            <button className="glass glass-card hover:bg-white/10 text-white px-5 py-2.5 rounded-[18px] text-xs font-bold transition-all active:scale-95 cursor-pointer">
              موافقة وتنفيذ
            </button>
            <button className="glass glass-card border text-white hover:bg-white/10 px-5 py-2.5 rounded-[18px] text-xs font-bold transition-colors cursor-pointer">
              تجاهل
            </button>
          </div>
        )}
        {!exception.requiresHumanApproval && exception.aiActionsTaken.length > 0 && (
          <div className="text-xs text-white font-bold flex items-center gap-1.5 glass glass-card border p-2.5 rounded-[18px]">
            <span>✓</span> {exception.aiActionsTaken[0].details}
          </div>
        )}
      </div>
    </div>
  );
}
