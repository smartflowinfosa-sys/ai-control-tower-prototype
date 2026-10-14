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
    <div className="max-w-4xl w-full mx-auto">
      <header className="mb-8 pb-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              تفاصيل الطلب: {order.orderNumber}
              <span className={`text-sm px-3 py-1 rounded-full ${
                order.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {order.status || 'KITCHEN_PREP'}
              </span>
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg border shadow-sm text-sky-800 bg-sky-50 border-sky-200">
                زاهي
              </span>
              <span className="text-sm text-gray-600 font-medium">العميل: {order.customer.name} ({order.customer.phone})</span>
            </div>
          </div>
          <div className="text-right sm:text-left bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-white/60 shadow-sm">
            <div className="text-xs text-gray-500 mb-1">تاريخ الإنشاء</div>
            <div className="font-bold text-gray-700">
              {new Date(order.createdAt).toLocaleString('ar-SA', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="mb-12 bg-white/50 backdrop-blur-xl p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60">
        <h2 className="text-xl font-bold text-gray-800 mb-2 border-b border-white/60 pb-3">
          التسلسل الزمني التشغيلي (Operational Timeline)
        </h2>
        {timelineEvents.length > 0 ? (
          <OrderTimeline events={timelineEvents} />
        ) : (
          <div className="bg-gray-50 text-gray-500 p-8 rounded-lg text-center mt-6 border border-gray-100">
            لا توجد أحداث مسجلة لهذا الطلب
          </div>
        )}
      </div>
    </div>
  );
}
