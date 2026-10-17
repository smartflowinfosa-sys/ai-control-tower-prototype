"use client";

import { useNotification } from '@/components/common/NotificationContext';
import { Bell, Bot, Check, RotateCcw, User } from 'lucide-react';

export default function NotificationsPage() {
  const { notifications, resolveNotification, ignoreNotification, undoNotification } = useNotification();

  const pendingList = notifications.filter(n => n.status === 'pending');
  const resolvedList = notifications.filter(n => n.status !== 'pending');

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6">
      <header className="glass rounded-[24px] p-6 mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Bell className="w-8 h-8 text-white/65" />
          <span>مركز الإشعارات (Notification Center)</span>
        </h1>
        <p className="text-white/65 text-sm mt-2">سجل التنبيهات التشغيلية التي تتطلب تدخلك</p>
      </header>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>إشعارات بانتظار الإجراء</span>
          <span className="bg-rose-500/20 text-rose-800 border border-rose-400/30 text-xs px-2.5 py-0.5 rounded-full font-bold font-mono">
            {pendingList.length}
          </span>
        </h2>
        
        {pendingList.length === 0 ? (
          <div className="glass text-white/65 text-center py-12 rounded-[18px] font-medium">
            <div className="text-4xl mb-3 opacity-60">✨</div>
            العمليات مستقرة، لا توجد تنبيهات معلقة حالياً
          </div>
        ) : (
          <div className="space-y-4">
            {pendingList.map(alert => (
              <div 
                key={alert.id} 
                className="glass p-5 rounded-[18px] border-r-4 border-r-rose-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-rose-500/80 text-white px-2 py-0.5 rounded-md font-bold">
                      {alert.riskLevel}
                    </span>
                    <h3 className="font-bold text-white text-base">{alert.title}</h3>
                    <span className="text-xs text-white/65 mr-auto font-mono">
                      {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-white leading-relaxed font-medium">{alert.details}</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                  <button 
                    onClick={() => resolveNotification(alert.id)}
                    className="flex-1 md:flex-none glass glass-card hover:bg-white/10 text-white text-xs font-bold py-2.5 px-5 rounded-[18px] transition-all whitespace-nowrap cursor-pointer"
                  >
                    تنفيذ الإجراء
                  </button>
                  <button 
                    onClick={() => ignoreNotification(alert.id)}
                    className="flex-1 md:flex-none glass glass-card hover:bg-white/10 text-white text-xs font-bold py-2.5 px-4 rounded-[18px] transition-colors border cursor-pointer"
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
        <h2 className="text-xl font-bold text-white mb-4">أرشيف الإجراءات (History)</h2>
        
        {resolvedList.length === 0 ? (
          <div className="glass text-white/65 text-sm text-center py-6 rounded-[18px]">لا يوجد سجل سابق</div>
        ) : (
          <div className="space-y-3">
            {resolvedList.map(alert => (
              <div 
                key={alert.id} 
                className="glass p-4 rounded-[18px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all"
              >
                <div>
                  <h3 className="font-bold text-white/65 line-through">{alert.title}</h3>
                  <p className="text-xs text-white/65 mt-1">{alert.details}</p>
                </div>
                <div className="flex items-center gap-2 mt-2 md:mt-0 flex-wrap">
                  {alert.status === 'resolved' && (
                    alert.resolvedBy === 'ai' ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full glass glass-active text-white flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-white/65" />
                        <span>تم الحل بواسطة AI</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full glass text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-white/65" />
                        <span>تم الحل بواسطة الموظف</span>
                      </span>
                    )
                  )}
                  <div className="text-xs font-bold px-3 py-1 rounded-lg glass text-white/65">
                    {alert.status === 'resolved' ? 'تم تنفيذ الإجراء' : 'تم التجاهل'}
                  </div>
                  <button 
                    onClick={() => undoNotification(alert.id)}
                    className="text-xs font-bold text-white glass glass-card hover:bg-white/10 border px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-white/65" />
                    <span>تراجع</span>
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
