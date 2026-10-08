"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import SmartAlertToast from './SmartAlertToast';

export type AlertRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AlertData {
  id: string;
  title: string;
  details: string;
  riskLevel: AlertRiskLevel;
  suggestedAction: string;
  status: 'pending' | 'resolved' | 'ignored';
  timestamp: Date;
}

interface NotificationContextType {
  showAlert: (alert: Omit<AlertData, 'id' | 'status' | 'timestamp'>) => void;
  removeAlert: (id: string) => void;
  resolveNotification: (id: string) => void;
  ignoreNotification: (id: string) => void;
  undoNotification: (id: string) => void;
  notifications: AlertData[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AlertData[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<string[]>([]);

  const showAlert = useCallback((alertData: Omit<AlertData, 'id' | 'status' | 'timestamp'>) => {
    const id = Date.now().toString();
    const newAlert: AlertData = { ...alertData, id, status: 'pending', timestamp: new Date() };
    setNotifications(prev => [newAlert, ...prev]);
    setActiveAlerts(prev => [id, ...prev]);
  }, []);

  const removeAlert = useCallback((id: string) => {
    setActiveAlerts(prev => prev.filter(alertId => alertId !== id));
  }, []);

  const resolveNotification = useCallback((id: string) => {
    setNotifications(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' } : a));
    removeAlert(id);
  }, [removeAlert]);

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
