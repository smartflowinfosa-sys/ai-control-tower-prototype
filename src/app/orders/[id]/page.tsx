import { mockOperationService } from '@/application/services/mockOperationService';
import OrderTimeline from '@/components/orders/OrderTimeline';
import { notFound } from 'next/navigation';

export const instant = false;

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = mockOperationService.getOrderById(id);
  
  if (!order) {
    notFound();
  }

  const timelineEvents = mockOperationService.getOrderTimeline(id);

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6">
      {/* Title Container */}
      <header className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl mb-6 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white mb-3 flex items-center gap-3 drop-shadow-sm">
              <span>تفاصيل الطلب:</span>
              <span className="font-mono text-white">{order.orderNumber}</span>
              <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                order.status === 'CANCELLED' 
                  ? 'bg-rose-500/15 text-rose-200 border-rose-300/30'
                  : 'bg-teal-500/15 text-teal-100 border-teal-300/30'
              }`}>
                {order.status || 'KITCHEN_PREP'}
              </span>
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20 text-white bg-white/8">
                زاهي
              </span>
              <span className="text-sm text-slate-100 font-bold drop-shadow-sm">
                العميل: <strong className="text-white font-extrabold">{order.customer.name}</strong> ({order.customer.phone})
              </span>
            </div>
          </div>
          <div className="text-right sm:text-left bg-white/8 p-3.5 rounded-xl border border-white/20">
            <div className="text-xs text-white/65 font-bold mb-1">تاريخ الإنشاء</div>
            <div className="font-extrabold text-white font-mono text-sm">
              {new Date(order.createdAt).toLocaleString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="mb-12 !bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-6">
        <h2 className="text-xl font-extrabold text-white mb-4 border-b border-white/20 pb-3 drop-shadow-sm">
          التسلسل الزمني التشغيلي (Operational Timeline)
        </h2>
        {timelineEvents.length > 0 ? (
          <OrderTimeline events={timelineEvents} />
        ) : (
          <div className="bg-white/8 text-white/80 font-bold p-8 rounded-xl text-center mt-6 border border-white/20">
            لا توجد أحداث مسجلة لهذا الطلب
          </div>
        )}
      </div>
    </div>
  );
}
