"use client";

import { useNotification } from '@/components/common/NotificationContext';
import { useLanguage } from '@/components/common/LanguageContext';
import { Bell, Bot, Check, RotateCcw, User } from 'lucide-react';

export default function NotificationsPage() {
  const { notifications, resolveNotification, ignoreNotification, undoNotification } = useNotification();
  const { lang, t } = useLanguage();

  const pendingList = notifications.filter(n => n.status === 'pending');
  const resolvedList = notifications.filter(n => n.status !== 'pending');

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6">
      <header className="glass page-header mb-6">
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3 tracking-tight">
          <Bell className="w-8 h-8 text-white" />
          <span>{t('notifications.title')}</span>
        </h1>
        <p className="text-white/80 font-semibold text-sm mt-2">{t('notifications.subtitle')}</p>
      </header>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>{t('notifications.pendingTitle')}</span>
          <span className="bg-rose-500/15 text-rose-200 border border-rose-300/30 text-xs px-2.5 py-0.5 rounded-full font-bold font-mono">
            {pendingList.length}
          </span>
        </h2>
        
        {pendingList.length === 0 ? (
          <div className="glass text-white/80 text-center py-12 font-medium">
            <div className="text-4xl mb-3 opacity-60">✨</div>
            {t('notifications.allClear')}
          </div>
        ) : (
          <div className="space-y-4">
            {pendingList.map(alert => (
              <div 
                key={alert.id} 
                className="glass border border-white/40 border-r-4 border-r-rose-500 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-rose-500/15 text-rose-200 border border-rose-300/30 px-2 py-0.5 rounded-md font-bold">
                      {alert.riskLevel}
                    </span>
                    <h3 className="font-bold text-white text-base">{alert.title}</h3>
                    <span className="text-xs text-white/65 mr-auto font-mono">
                      {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed font-medium">{alert.details}</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                  <button 
                    onClick={() => resolveNotification(alert.id)}
                    className="flex-1 md:flex-none bg-white/20 hover:bg-white/25 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all whitespace-nowrap cursor-pointer"
                  >
                    {t('notifications.executeAction')}
                  </button>
                  <button 
                    onClick={() => ignoreNotification(alert.id)}
                    className="flex-1 md:flex-none bg-white/8 border border-white/25 hover:bg-white/15 text-white/80 text-xs font-bold py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
                  >
                    {lang === 'ar' ? 'تجاهل' : 'Ignore'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-white mb-4">{lang === 'ar' ? 'أرشيف الإجراءات (History)' : 'Action History'}</h2>
        
        {resolvedList.length === 0 ? (
          <div className="glass text-white/65 text-sm text-center py-6">{lang === 'ar' ? 'لا يوجد سجل سابق' : 'No history records'}</div>
        ) : (
          <div className="space-y-3">
            {resolvedList.map(alert => (
              <div 
                key={alert.id} 
                className="glass p-4 rounded-xl border border-white/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all"
              >
                <div>
                  <h3 className="font-bold text-white/65 line-through">{alert.title}</h3>
                  <p className="text-xs text-white/65 mt-1">{alert.details}</p>
                </div>
                <div className="flex items-center gap-2 mt-2 md:mt-0 flex-wrap">
                  {alert.status === 'resolved' && (
                    alert.resolvedBy === 'ai' ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-500/15 text-teal-100 border border-teal-300/30 flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-white" />
                        <span>تم الحل بواسطة AI</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/8 text-white/80 border border-white/25 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-white/65" />
                        <span>تم الحل بواسطة الموظف</span>
                      </span>
                    )
                  )}
                  <div className="text-xs font-bold px-3 py-1 rounded-lg bg-white/8 text-white/80 border border-white/25">
                    {alert.status === 'resolved' ? 'تم تنفيذ الإجراء' : 'تم التجاهل'}
                  </div>
                  <button 
                    onClick={() => undoNotification(alert.id)}
                    className="text-xs font-bold text-white/80 bg-white/8 hover:bg-white/15 border border-white/25 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-white/80" />
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
