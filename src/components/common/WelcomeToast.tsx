"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/components/common/LanguageContext";

const TOAST_DURATION_MS = 3000;
const SESSION_KEY = "welcome_toast_shown";

/**
 * Auto-dismissing welcome toast (bottom-right), shown once per browser session
 * after the user is authenticated. Greets the user by their Arabic name.
 */
export default function WelcomeToast() {
  const { data: session, status } = useSession();
  const { currentUser } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Signed out: clear the flag so the next login shows the toast again.
    if (status === "unauthenticated") {
      sessionStorage.removeItem(SESSION_KEY);
      setVisible(false);
      return;
    }

    if (status !== "authenticated") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const u = session?.user as any;
    const name: string =
      u?.name_ar ||
      currentUser?.name_ar ||
      u?.name ||
      u?.username ||
      "";

    sessionStorage.setItem(SESSION_KEY, "1");
    setDisplayName(name);
    setVisible(true);

    const timer = setTimeout(() => setVisible(false), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
    // Intentionally run only when authentication status resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 bg-black/60 backdrop-blur-xl border border-white/20 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <span className="text-sm font-bold">
        {displayName ? `مرحباً بك، ${displayName} 👋` : "مرحباً بك 👋"}
      </span>
    </div>
  );
}
