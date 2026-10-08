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
        className="relative p-2.5 text-gray-600 hover:text-gray-900 bg-white rounded-full shadow-sm border border-gray-200 transition-colors hover:shadow-md"
      >
        <span className="text-xl">🔔</span>
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full animate-bounce shadow-sm">
            {pendingCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-14 left-0 md:left-auto md:-right-4 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[500px]">
          <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">سجل الإشعارات</h3>
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded font-bold">
              {notifications.length} إشعار
            </span>
          </div>

          <div className="overflow-y-auto flex-1 p-3 bg-gray-50/50">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm font-medium">
                <div className="text-3xl mb-2 opacity-50">📭</div>
                لا توجد إشعارات حالياً
              </div>
            ) : (
              <ul className="space-y-3">
                {notifications.map((alert: AlertData) => (
                  <li key={alert.id} className={`p-4 rounded-xl border text-sm transition-all ${
                    alert.status === 'pending' ? 'bg-white border-gray-200 shadow-sm' : 
                    alert.status === 'resolved' ? 'bg-emerald-50/50 border-emerald-100' : 
                    'bg-gray-50 border-gray-100 opacity-70'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white shadow-sm ${
                        alert.riskLevel === 'CRITICAL' ? 'bg-red-500' : 
                        alert.riskLevel === 'HIGH' ? 'bg-orange-500' : 
                        alert.riskLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'
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
                          className="flex-1 bg-gray-900 text-white text-[10px] font-bold py-2 px-2 rounded-lg hover:bg-black transition-colors shadow-sm"
                        >
                          تنفيذ: {alert.suggestedAction}
                        </button>
                        <button 
                          onClick={() => ignoreNotification(alert.id)}
                          className="bg-white border border-gray-200 text-gray-600 text-[10px] font-bold py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          تجاهل
                        </button>
                      </div>
                    )}
                    
                    {alert.status === 'resolved' && (
                      <div className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
                        <span>✅</span> تم اتخاذ الإجراء
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
