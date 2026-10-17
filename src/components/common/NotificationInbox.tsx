"use client";

import { useState } from 'react';
import { useNotification, AlertData } from './NotificationContext';

export default function NotificationInbox() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, resolveNotification, ignoreNotification } = useNotification();

  const pendingCount = notifications.filter((a: AlertData) => a.status === 'pending').length;

  return (
    <div className="relative z-[55]">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-white hover:text-white glass glass-card rounded-[18px] border transition-all hover:bg-white/10"
      >
        <span className="text-xl">🔔</span>
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-teal-600/20 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
            {pendingCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-14 left-0 md:left-auto md:-right-4 w-80 md:w-96 glass glass-card border rounded-[18px] flex flex-col max-h-[500px]">
          <div className="glass glass-card border-b p-4 flex justify-between items-center">
            <h3 className="font-bold text-white">سجل إشعارات زاهي</h3>
            <span className="text-xs bg-sky-100 text-white border border-sky-200 px-2 py-1 rounded-lg font-bold">
              {notifications.length} إشعار
            </span>
          </div>

          <div className="overflow-y-auto flex-1 p-3 glass glass-card">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-white/65 text-sm font-medium">
                <div className="text-3xl mb-2 opacity-50">📭</div>
                لا توجد إشعارات حالياً
              </div>
            ) : (
              <ul className="space-y-3">
                {notifications.map((alert: AlertData) => (
                  <li key={alert.id} className={`p-4 rounded-xl border text-sm transition-all ${
                    alert.status === 'pending' ? 'glass glass-card' : 
                    alert.status === 'resolved' ? 'glass glass-card' : 
                    'glass glass-card'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white  ${
                        alert.riskLevel === 'CRITICAL' ? 'bg-red-500/20' : 
                        alert.riskLevel === 'HIGH' ? 'bg-amber-600/20' : 
                        alert.riskLevel === 'MEDIUM' ? 'bg-yellow-600/20' : 'bg-teal-600/20'
                      }`}>
                        {alert.riskLevel}
                      </span>
                      <span className="text-xs text-white/65 font-medium">
                        {alert.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h4 className="font-bold text-white mb-1">{alert.title}</h4>
                    <p className="text-white/65 text-xs mb-3 leading-relaxed">{alert.details}</p>
                    
                    {alert.status === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => resolveNotification(alert.id)}
                          className="flex-1 glass glass-card hover:bg-white/10 text-white text-[10px] font-bold py-2 px-2 rounded-lg transition-colors"
                        >
                          تنفيذ: {alert.suggestedAction}
                        </button>
                        <button 
                          onClick={() => ignoreNotification(alert.id)}
                          className="glass glass-card border text-white/65 text-[10px] font-bold py-2 px-3 rounded-lg hover:bg-white/10 transition-colors"
                        >
                          تجاهل
                        </button>
                      </div>
                    )}
                    
                    {alert.status === 'resolved' && (
                      <div className="text-xs font-bold text-white mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>✅</span> تم اتخاذ الإجراء
                        {alert.resolvedBy === 'ai' ? (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold border border-purple-200">
                            🤖 AI
                          </span>
                        ) : (
                          <span className="text-[10px] glass glass-card text-white/65 px-1.5 py-0.5 rounded font-bold border">
                            👤 بشري
                          </span>
                        )}
                      </div>
                    )}
                    
                    {alert.status === 'ignored' && (
                      <div className="text-xs font-bold text-white/65 mt-1 flex items-center gap-1">
                        <span>👁️</span> تم التجاهل
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
