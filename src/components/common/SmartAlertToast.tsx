"use client";

import { useState, useEffect } from 'react';
import { AlertData } from './NotificationContext';

const riskStyles = {
  CRITICAL: 'border-red-500 bg-red-50/90',
  HIGH: 'border-amber-600 bg-amber-50/90',
  MEDIUM: 'border-yellow-600 bg-yellow-50/90',
  LOW: 'border-teal-600 bg-teal-50/90',
};

const badgeStyles = {
  CRITICAL: 'bg-red-500 text-white',
  HIGH: 'bg-amber-600 text-white',
  MEDIUM: 'bg-yellow-600 text-white',
  LOW: 'bg-teal-600 text-white',
};

export default function SmartAlertToast({ 
  alert, 
  onTimeout,
  onDismiss,
  onExecute
}: { 
  alert: AlertData, 
  onTimeout: () => void,
  onDismiss: () => void,
  onExecute: () => void 
}) {
  const [isResolved, setIsResolved] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Auto hide floating toast after 5 seconds if not interacted with
  useEffect(() => {
    if (!isResolved) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onTimeout, 300);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isResolved, onTimeout]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 300);
  };

  const handleExecute = () => {
    setIsResolved(true);
    setTimeout(() => {
        setIsExiting(true);
        setTimeout(onExecute, 300);
    }, 1500); // 1.5 seconds to see the success message
  };

  return (
    <div className={`w-full shadow-2xl rounded-xl border-r-4 overflow-hidden transition-all duration-300 transform origin-bottom-right
      ${isExiting ? 'opacity-0 translate-y-12 scale-95' : 'opacity-100 translate-y-0 scale-100 animate-in slide-in-from-bottom-4 fade-in'}
      ${isResolved ? 'border-emerald-500 bg-emerald-50' : riskStyles[alert.riskLevel]}
    `}>
      {isResolved ? (
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-bounce">✅</span>
            <div>
              <h4 className="font-bold text-emerald-800 text-sm">تم تنفيذ الإجراء بنجاح</h4>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shadow-sm ${badgeStyles[alert.riskLevel]}`}>
                {alert.riskLevel}
              </span>
              <h4 className="font-bold text-gray-900 text-sm">{alert.title}</h4>
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 bg-white rounded-full hover:bg-gray-100">
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-700 mb-4 leading-relaxed font-medium">
            {alert.details}
          </p>
          <div className="flex gap-2 pt-3 border-t border-black/5">
            <button 
              onClick={handleExecute}
              className={`flex-1 text-white text-xs font-bold py-2.5 px-3 rounded-lg transition-colors shadow-sm flex justify-center items-center gap-1
                ${alert.riskLevel === 'CRITICAL' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-black'}
              `}
            >
              <span>⚡</span> تنفيذ
            </button>
            <button 
              onClick={handleClose}
              className="flex-1 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold py-2.5 px-3 rounded-lg border border-gray-200 transition-colors"
            >
              تجاهل
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
