"use client";

import { useEffect, useRef } from 'react';
import { useNotification } from './NotificationContext';

export default function DemoAlertTrigger() {
  const { showAlert } = useNotification();
  const hasFired = useRef(false);

  useEffect(() => {
    // Only fire once per session
    if (hasFired.current) return;
    hasFired.current = true;

    // Fire the mock alert after 10 seconds for the Demo
    const timer = setTimeout(() => {
      showAlert({
        title: 'تعارض بيانات خطير!',
        details: 'اكتشف الذكاء الاصطناعي أن طلب زاهي ZH-2481 يتم تغليفه بالأرز رغم طلب العميل حذفه.',
        riskLevel: 'CRITICAL',
        suggestedAction: 'إيقاف التغليف وتنبيه المشرف',
      });
    }, 10000);

    return () => clearTimeout(timer);
  }, [showAlert]);

  return null;
}
