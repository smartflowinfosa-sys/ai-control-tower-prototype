import { mockOperationService } from '@/application/services/mockOperationService';

export default function ProductionPage() {
  const allOrders = mockOperationService.getAllOrders();
  
  // Filter for PENDING or KITCHEN_PREP orders
  const activeOrders = allOrders.filter(order => {
    const status = order.status || 'KITCHEN_PREP';
    return status === 'PENDING' || status === 'KITCHEN_PREP';
  });

  return (
    <div className="max-w-6xl w-full mx-auto">
      <header className="mb-8 border-b border-gray-200 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">شاشة الإنتاج (KDS)</h1>
          <p className="text-gray-500 text-sm mt-2">الطلبات الحالية في محطات التحضير والمطبخ</p>
        </div>
        <div className="text-sm font-bold bg-gray-100 text-gray-600 px-3 py-1 rounded">
          إجمالي الطلبات النشطة: {activeOrders.length}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeOrders.map(order => {
          const isDelayed = order.deliveryStatus.isDelayed;
          const isZahi = order.brand === 'ZAHI';
          
          return (
            <div 
              key={order.id} 
              className={`bg-white/50 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border overflow-hidden flex flex-col relative transition-all hover:bg-white/70 hover:shadow-xl
                ${isDelayed ? 'border-red-400/80 shadow-red-100' : 'border-white/60'}
              `}
            >
              {isDelayed && (
                <div className="absolute top-0 right-0 left-0 bg-red-500 text-white text-center text-xs font-bold py-1 animate-pulse">
                  متأخر
                </div>
              )}
              
              <div className={`p-4 border-b ${isDelayed ? 'mt-6' : ''} bg-sky-50/40 border-sky-100/50 flex justify-between items-center`}>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{order.orderNumber}</h3>
                  <span className="text-xs font-bold text-sky-700 bg-sky-100/60 border border-sky-200 px-2 py-0.5 rounded-md">
                    زاهي
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">وقت الطلب</div>
                  <div className="text-sm font-bold text-gray-700">
                    {new Date(order.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              
              <div className="p-4 flex-1">
                <ul className="space-y-3">
                  {order.items.map(item => (
                    <li key={item.id} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-gray-800 text-lg">
                          <span className="text-gray-400 ml-1">{item.quantity}x</span> 
                          {item.name}
                        </span>
                      </div>
                      
                      {item.customizations.length > 0 && (
                        <div className="mt-1 text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          <span className="font-bold">تعديل:</span> {item.customizations.join('، ')}
                        </div>
                      )}
                      
                      {item.removedIngredients.length > 0 && (
                        <div className="mt-1 text-sm text-red-600 bg-red-50 px-2 py-1 rounded line-through">
                          <span className="font-bold no-underline">بدون:</span> {item.removedIngredients.join('، ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center mt-auto">
                <span className="text-xs text-gray-500">
                  حالة المطبخ: {order.kitchenStatus.updated ? 'مُحدّث' : 'قيد الانتظار'}
                </span>
                <button className="bg-gray-800 text-white hover:bg-black px-4 py-2 rounded text-sm font-bold transition-colors">
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
