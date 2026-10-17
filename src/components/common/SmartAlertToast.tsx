"use client";

import { useState, useEffect } from 'react';
import { AlertData } from './NotificationContext';

const riskStyles = {
  CRITICAL: 'border-r-4 border-r-rose-500',
  HIGH: 'border-r-4 border-r-amber-500',
  MEDIUM: 'border-r-4 border-r-white/25',
  LOW: 'border-r-4 border-r-white/25',
};

const badgeStyles = {
  CRITICAL: 'bg-rose-500/20 text-white',
  HIGH: 'bg-amber-600/20 text-white',
  MEDIUM: 'bg-teal-700/20 text-white',
  LOW: 'bg-teal-800/20 text-white',
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
    <div className={`w-full rounded-[18px] glass transition-all duration-300 origin-bottom-right
      ${isExiting ? 'opacity-0 translate-y-12 scale-95' : 'opacity-100'}
      ${isResolved ? 'border-r-4 border-r-white/25' : riskStyles[alert.riskLevel]}
    `}>
      {isResolved ? (
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-bounce">✅</span>
            <div>
              <h4 className="font-extrabold text-white text-sm">تم تنفيذ الإجراء بنجاح</h4>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase  ${badgeStyles[alert.riskLevel]}`}>
                {alert.riskLevel}
              </span>
              <h4 className="font-extrabold text-white text-sm">{alert.title}</h4>
            </div>
            <button 
              onClick={handleClose} 
              className="text-white/65 hover:text-white transition-colors p-1 glass glass-card rounded-full cursor-pointer"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-white mb-4 leading-relaxed font-semibold">
            {alert.details}
          </p>
          <div className="flex gap-2 pt-3 border-t border-white/14">
            <button 
              onClick={handleExecute}
              className="flex-1 glass glass-card text-white text-xs font-bold py-2.5 px-3 rounded-[18px] transition-all flex justify-center items-center gap-1 active:scale-95 cursor-pointer hover:bg-white/10"
            >
              <span>⚡</span> تنفيذ
            </button>
            <button 
              onClick={handleClose}
              className="flex-1 glass glass-card hover:bg-white/10 text-white text-xs font-bold py-2.5 px-3 rounded-[18px] border transition-colors cursor-pointer"
            >
              تجاهل
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
