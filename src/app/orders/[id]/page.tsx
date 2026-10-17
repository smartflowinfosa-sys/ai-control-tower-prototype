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
      {/* Title Container with 28px radius */}
      <header className="glass rounded-[24px] p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white mb-3 flex items-center gap-3">
              <span>تفاصيل الطلب:</span>
              <span className="font-mono text-white">{order.orderNumber}</span>
              <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                order.status === 'CANCELLED' 
                  ? 'bg-rose-500/20 text-rose-800 border-rose-400/40' 
                  : 'bg-teal-700/20 text-white border-white/14'
              }`}>
                {order.status || 'KITCHEN_PREP'}
              </span>
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg border text-white glass glass-card">
                زاهي
              </span>
              <span className="text-sm text-white/65 font-bold">
                العميل: <strong className="text-white font-extrabold">{order.customer.name}</strong> ({order.customer.phone})
              </span>
            </div>
          </div>
          <div className="text-right sm:text-left glass p-3.5 rounded-[18px] border">
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

      <div className="mb-12 glass p-6 rounded-[24px] border">
        <h2 className="text-xl font-extrabold text-white mb-4 border-b border-white/14 pb-3">
          التسلسل الزمني التشغيلي (Operational Timeline)
        </h2>
        {timelineEvents.length > 0 ? (
          <OrderTimeline events={timelineEvents} />
        ) : (
          <div className="glass glass-card text-white/65 font-bold p-8 rounded-[18px] text-center mt-6 border">
            لا توجد أحداث مسجلة لهذا الطلب
          </div>
        )}
      </div>
    </div>
  );
}
