"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import SmartAlertToast from './SmartAlertToast';

export type AlertRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Notification {
  id: string;
  title: string;
  details: string;
  riskLevel: AlertRiskLevel;
  suggestedAction: string;
  status: 'pending' | 'resolved' | 'ignored';
  timestamp: Date;
  resolvedBy?: 'human' | 'ai';
}

export type AlertData = Notification;

interface NotificationContextType {
  showAlert: (alert: Omit<Notification, 'id' | 'status' | 'timestamp'>) => void;
  removeAlert: (id: string) => void;
  resolveNotification: (id: string, resolvedBy?: 'human' | 'ai') => void;
  ignoreNotification: (id: string) => void;
  undoNotification: (id: string) => void;
  notifications: Notification[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<string[]>([]);

  useEffect(() => {
    setNotifications([
      {
        id: 'alert-zh-2481',
        title: 'تعارض بيانات التغليف: طلب ZH-2481',
        details: 'الطلب ZH-2481 في زاهي: تم استبعاد الأرز من قبل العميل ولكن ظهر في قائمة التغليف.',
        riskLevel: 'CRITICAL',
        suggestedAction: 'إيقاف التغليف فوراً وتعديل الطلب',
        status: 'pending',
        timestamp: new Date('2024-10-14T10:00:00Z'),
      },
      {
        id: 'alert-mz-1092',
        title: 'تأخير في التوصيل: طلب MZ-1092',
        details: 'تأخر السائق 15 دقيقة في الوصول للعميل بحي النرجس.',
        riskLevel: 'MEDIUM',
        suggestedAction: 'إعادة جدولة مسار السائق',
        status: 'resolved',
        timestamp: new Date('2024-10-14T09:00:00Z'),
        resolvedBy: 'human',
      }
    ]);
  }, []);

  const showAlert = useCallback((alertData: Omit<Notification, 'id' | 'status' | 'timestamp'>) => {
    const id = Date.now().toString();
    const newAlert: Notification = { ...alertData, id, status: 'pending', timestamp: new Date() };
    setNotifications(prev => [newAlert, ...prev]);
    setActiveAlerts(prev => [id, ...prev]);
  }, []);

  const removeAlert = useCallback((id: string) => {
    setActiveAlerts(prev => prev.filter(alertId => alertId !== id));
  }, []);

  const resolveNotification = useCallback((id: string, resolvedBy: 'human' | 'ai' = 'human') => {
    const target = id.trim().toLowerCase();
    setNotifications(prev => prev.map(a => {
      const match = a.id.toLowerCase() === target || 
                    a.id.toLowerCase().includes(target) ||
                    target.includes(a.id.toLowerCase()) ||
                    a.details.toLowerCase().includes(target) || 
                    a.title.toLowerCase().includes(target);
      return match ? { ...a, status: 'resolved', resolvedBy } : a;
    }));
    setActiveAlerts(prev => prev.filter(alertId => {
      const match = alertId.toLowerCase() === target || alertId.toLowerCase().includes(target);
      return !match;
    }));
  }, []);

  const ignoreNotification = useCallback((id: string) => {
    setNotifications(prev => prev.map(a => a.id === id ? { ...a, status: 'ignored' } : a));
    removeAlert(id);
  }, [removeAlert]);

  const undoNotification = useCallback((id: string) => {
    setNotifications(prev => prev.map(a => a.id === id ? { ...a, status: 'pending' } : a));
  }, []);

  return (
    <NotificationContext.Provider value={{ showAlert, removeAlert, resolveNotification, ignoreNotification, undoNotification, notifications }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col-reverse gap-3 max-w-sm w-full pointer-events-none items-end">
        {activeAlerts.map(id => {
          const alert = notifications.find(a => a.id === id);
          if (!alert) return null;
          return (
            <div key={alert.id} className="pointer-events-auto w-full">
              <SmartAlertToast 
                alert={alert} 
                onTimeout={() => removeAlert(alert.id)}
                onDismiss={() => ignoreNotification(alert.id)} 
                onExecute={() => resolveNotification(alert.id)} 
              />
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
