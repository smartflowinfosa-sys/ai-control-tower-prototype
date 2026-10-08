"use client";

import { useNotification } from '@/components/common/NotificationContext';

export default function NotificationsPage() {
  const { notifications, resolveNotification, ignoreNotification, undoNotification } = useNotification();

  const pendingList = notifications.filter(n => n.status === 'pending');
  const resolvedList = notifications.filter(n => n.status !== 'pending');

  return (
    <div className="max-w-4xl w-full mx-auto">
      <header className="mb-6 border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <span className="text-xl">🔔</span> مركز الإشعارات (Notification Center)
        </h1>
        <p className="text-gray-500 text-sm mt-2">سجل التنبيهات التشغيلية التي تتطلب تدخلك</p>
      </header>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          إشعارات بانتظار الإجراء
          <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-bold">{pendingList.length}</span>
        </h2>
        
        {pendingList.length === 0 ? (
          <div className="bg-gray-50 text-gray-500 text-center py-10 rounded-xl border border-gray-100 font-medium">
            <div className="text-4xl mb-3 opacity-50">👍</div>
            العمليات مستقرة، لا توجد تنبيهات معلقة
          </div>
        ) : (
          <div className="space-y-4">
            {pendingList.map(alert => (
              <div key={alert.id} className="bg-white p-5 rounded-xl border-r-4 border-r-red-500 border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded font-bold shadow-sm">{alert.riskLevel}</span>
                    <h3 className="font-bold text-gray-900">{alert.title}</h3>
                    <span className="text-xs text-gray-400 mr-auto">
                      {new Date(alert.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed font-medium">{alert.details}</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                  <button 
                    onClick={() => resolveNotification(alert.id)}
                    className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition-colors whitespace-nowrap shadow-sm"
                  >
                    تنفيذ الإجراء
                  </button>
                  <button 
                    onClick={() => ignoreNotification(alert.id)}
                    className="flex-1 md:flex-none bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2.5 px-4 rounded-lg transition-colors border border-gray-200"
                  >
                    تجاهل
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-400 mb-4">أرشيف الإجراءات (History)</h2>
        
        {resolvedList.length === 0 ? (
          <div className="text-gray-400 text-sm text-center py-6">لا يوجد سجل سابق</div>
        ) : (
          <div className="space-y-3 opacity-70">
            {resolvedList.map(alert => (
              <div key={alert.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-opacity hover:opacity-100">
                <div>
                  <h3 className="font-bold text-gray-600 line-through decoration-gray-300">{alert.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{alert.details}</p>
                </div>
                <div className="flex items-center gap-2 mt-2 md:mt-0">
                  <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-200 text-gray-600">
                    {alert.status === 'resolved' ? '✅ تم تنفيذ الإجراء' : '👁️ تم التجاهل'}
                  </div>
                  <button 
                    onClick={() => undoNotification(alert.id)}
                    className="text-xs font-bold text-gray-500 hover:text-gray-800 bg-white border border-gray-200 shadow-sm px-3 py-1.5 rounded-lg transition-colors"
                  >
                    تراجع ↩
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
