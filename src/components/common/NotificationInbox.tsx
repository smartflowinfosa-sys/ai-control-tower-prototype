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
        className="relative p-2.5 text-gray-700 hover:text-sky-600 bg-white/70 backdrop-blur-md rounded-2xl shadow-sm border border-white/60 transition-all hover:bg-white/90 hover:shadow-md"
      >
        <span className="text-xl">🔔</span>
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-teal-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full animate-bounce shadow-sm">
            {pendingCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-14 left-0 md:left-auto md:-right-4 w-80 md:w-96 bg-white/50 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden flex flex-col max-h-[500px]">
          <div className="bg-white/50 backdrop-blur-sm border-b border-white/60 p-4 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">سجل إشعارات زاهي</h3>
            <span className="text-xs bg-sky-100 text-sky-800 border border-sky-200 px-2 py-1 rounded-lg font-bold">
              {notifications.length} إشعار
            </span>
          </div>

          <div className="overflow-y-auto flex-1 p-3 bg-teal-50/20">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm font-medium">
                <div className="text-3xl mb-2 opacity-50">📭</div>
                لا توجد إشعارات حالياً
              </div>
            ) : (
              <ul className="space-y-3">
                {notifications.map((alert: AlertData) => (
                  <li key={alert.id} className={`p-4 rounded-xl border text-sm transition-all ${
                    alert.status === 'pending' ? 'bg-white/80 border-white/80 shadow-sm' : 
                    alert.status === 'resolved' ? 'bg-teal-50/50 border-teal-100' : 
                    'bg-white/40 border-white/50 opacity-70'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white shadow-sm ${
                        alert.riskLevel === 'CRITICAL' ? 'bg-red-500' : 
                        alert.riskLevel === 'HIGH' ? 'bg-amber-600' : 
                        alert.riskLevel === 'MEDIUM' ? 'bg-yellow-600' : 'bg-teal-600'
                      }`}>
                        {alert.riskLevel}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">
                        {alert.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h4 className="font-bold text-gray-800 mb-1">{alert.title}</h4>
                    <p className="text-gray-600 text-xs mb-3 leading-relaxed">{alert.details}</p>
                    
                    {alert.status === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => resolveNotification(alert.id)}
                          className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold py-2 px-2 rounded-lg transition-colors shadow-sm"
                        >
                          تنفيذ: {alert.suggestedAction}
                        </button>
                        <button 
                          onClick={() => ignoreNotification(alert.id)}
                          className="bg-white/80 border border-white/80 text-gray-600 text-[10px] font-bold py-2 px-3 rounded-lg hover:bg-white transition-colors"
                        >
                          تجاهل
                        </button>
                      </div>
                    )}
                    
                    {alert.status === 'resolved' && (
                      <div className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>✅</span> تم اتخاذ الإجراء
                        {alert.resolvedBy === 'ai' ? (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold border border-purple-200">
                            🤖 AI
                          </span>
                        ) : (
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold border border-gray-200">
                            👤 بشري
                          </span>
                        )}
                      </div>
                    )}
                    
                    {alert.status === 'ignored' && (
                      <div className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-1">
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
