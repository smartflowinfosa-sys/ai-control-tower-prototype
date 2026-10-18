import { TimelineEvent } from '@/domain/types/timeline';

export default function OrderTimeline({ events }: { events: TimelineEvent[] }) {
  const actorColorMap: Record<string, string> = {
    CUSTOMER: 'bg-white/8 text-white/80 border-white/25',
    SYSTEM: 'bg-white/8 text-white/65 border-white/25',
    KITCHEN: 'bg-amber-500/15 text-amber-200 border-amber-300/30',
    PACKING: 'bg-blue-500/15 text-blue-200 border-blue-300/30',
    DELIVERY: 'bg-purple-500/15 text-purple-200 border-purple-300/30',
    AI_AGENT: 'bg-teal-500/15 text-teal-100 border-teal-300/30 font-extrabold ',
  };

  return (
    <div className="relative border-r-2 border-white/25 pr-6 ml-4 my-8">
      {events.map((event) => {
        const isAnomaly = event.isAnomaly;
        const isAi = event.actor === 'AI_AGENT';
        
        return (
          <div key={event.id} className="mb-8 relative">
            {/* Timeline Dot */}
            <div className={`absolute -right-[31px] top-1 w-4 h-4 rounded-full border-2 border-white z-10
 ${isAnomaly ? 'bg-rose-500 animate-pulse ' : isAi ? 'bg-teal-500 ' : 'bg-white/8'}`}
            />
            
            <div className={`glass p-5 border transition-all
 ${isAnomaly ? 'border-rose-300/30' : isAi ? 'border-white/25' : 'border-white/40'}
            `}>
              <div className="flex flex-col sm:flex-row justify-between items-start mb-3 gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={`text-lg font-extrabold ${isAnomaly ? 'text-rose-200' : isAi ? 'text-white' : 'text-white'}`}>
                    {isAi && <span className="ml-1 inline-block animate-pulse">✨</span>}
                    {event.title}
                  </h4>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${actorColorMap[event.actor] || actorColorMap.SYSTEM}`}>
                    {event.actor}
                  </span>
                </div>
                <span className="text-xs text-white/65 font-bold bg-white/8 px-2.5 py-1 rounded-lg border border-white/40 whitespace-nowrap font-mono">
                  {new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              <p className="text-sm text-white/80 font-semibold leading-relaxed bg-white/8 p-3 rounded-xl border border-white/40">
                {event.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
