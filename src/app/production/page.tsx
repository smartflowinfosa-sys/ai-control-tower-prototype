import { mockOperationService } from '@/application/services/mockOperationService';

export default function ProductionPage() {
  const allOrders = mockOperationService.getAllOrders();
  
  // Filter for PENDING or KITCHEN_PREP orders
  const activeOrders = allOrders.filter(order => {
    const status = order.status || 'KITCHEN_PREP';
    return status === 'PENDING' || status === 'KITCHEN_PREP';
  });

  return (
    <div className="page-shell w-full mx-auto space-y-6">
      {/* Title Container with 28px radius */}
      <header className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl mb-8 flex justify-between items-end flex-wrap gap-4 p-6 sm:p-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">شاشة الإنتاج (KDS)</h1>
          <p className="text-slate-100 font-semibold text-sm mt-2 drop-shadow-sm">الطلبات الحالية في محطات التحضير والمطبخ</p>
        </div>
        <div className="text-sm font-bold bg-teal-500/15 text-teal-100 border border-teal-300/30 px-3.5 py-1.5 rounded-full font-mono ">
          إجمالي الطلبات النشطة: {activeOrders.length}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeOrders.map(order => {
          const isDelayed = order.deliveryStatus.isDelayed;
          
          return (
            <div 
              key={order.id} 
              className={`!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl flex flex-col relative transition-all overflow-hidden ${
                isDelayed ? 'border-rose-400 ' : ''
              }`}
            >
              {isDelayed && (
                <div className="bg-rose-600 text-white text-center text-xs font-bold py-1 animate-pulse border-b border-rose-400">
                  متأخر
                </div>
              )}
              
              <div className="p-4 border-b border-white/20 bg-white/8 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-extrabold text-white font-mono">{order.orderNumber}</h3>
                  <span className="text-xs font-bold text-white bg-white/8 border border-white/20 px-2 py-0.5 rounded-md mt-1 inline-block">
                    زاهي
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/65 font-bold">وقت الطلب</div>
                  <div className="text-sm font-bold text-white font-mono">
                    {new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              
              <div className="p-4 flex-1">
                <ul className="space-y-3">
                  {order.items.map(item => (
                    <li key={item.id} className="border-b border-white/20 pb-2.5 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start">
                        <span className="font-extrabold text-white text-base">
                          <span className="text-white font-mono ml-1.5 font-bold">{item.quantity}x</span> 
                          {item.name}
                        </span>
                      </div>
                      
                      {item.customizations.length > 0 && (
                        <div className="mt-1.5 text-xs text-white bg-white/8 border border-white/20 px-2.5 py-1 rounded-xl font-semibold">
                          <span className="font-bold text-white">تعديل:</span> {item.customizations.join('، ')}
                        </div>
                      )}
                      
                      {item.removedIngredients.length > 0 && (
                        <div className="mt-1.5 text-xs text-rose-200 bg-rose-500/15 border border-rose-300/30 px-2.5 py-1 rounded-xl line-through font-semibold">
                          <span className="font-bold no-underline">بدون:</span> {item.removedIngredients.join('، ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="p-4 border-t border-white/20 bg-white/8 flex justify-between items-center mt-auto">
                <span className="text-xs text-white/80 font-bold">
                  حالة المطبخ: {order.kitchenStatus.updated ? 'مُحدّث' : 'قيد الانتظار'}
                </span>
                <button className="bg-white/20 hover:bg-white/25 active:scale-95 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ">
                  تحديث الحالة
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
