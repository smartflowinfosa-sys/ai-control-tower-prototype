import { TimelineEvent } from '@/domain/types/timeline';

export default function OrderTimeline({ events }: { events: TimelineEvent[] }) {
  const actorColorMap: Record<string, string> = {
    CUSTOMER: 'bg-blue-100 text-blue-800 border-blue-200',
    SYSTEM: 'bg-gray-100 text-gray-800 border-gray-200',
    KITCHEN: 'bg-orange-100 text-orange-800 border-orange-200',
    PACKING: 'bg-purple-100 text-purple-800 border-purple-200',
    DELIVERY: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    AI_AGENT: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  };

  return (
    <div className="relative border-r-2 border-gray-200 pr-6 ml-4 my-8">
      {events.map((event) => {
        const isAnomaly = event.isAnomaly;
        const isAi = event.actor === 'AI_AGENT';
        
        return (
          <div key={event.id} className="mb-8 relative">
            {/* Timeline Dot */}
            <div className={`absolute -right-[31px] top-1 w-4 h-4 rounded-full border-4 border-white shadow-sm z-10
              ${isAnomaly ? 'bg-red-500 animate-pulse' : isAi ? 'bg-indigo-500' : 'bg-gray-400'}`} 
            />
            
            <div className={`bg-white rounded-lg p-5 shadow-sm border transition-shadow hover:shadow-md
              ${isAnomaly ? 'border-red-200 bg-red-50/30' : isAi ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-100'}
            `}>
              <div className="flex flex-col sm:flex-row justify-between items-start mb-3 gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={`text-lg font-bold ${isAnomaly ? 'text-red-700' : isAi ? 'text-indigo-800' : 'text-gray-800'}`}>
                    {isAi && <span className="ml-1 inline-block animate-pulse">✨</span>}
                    {event.title}
                  </h4>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${actorColorMap[event.actor] || actorColorMap.SYSTEM}`}>
                    {event.actor}
                  </span>
                </div>
                <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100 shadow-sm whitespace-nowrap">
                  {new Date(event.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              <p className="text-sm text-gray-700 leading-relaxed bg-white/50 rounded">
                {event.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
