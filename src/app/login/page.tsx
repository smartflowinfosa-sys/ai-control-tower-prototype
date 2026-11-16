"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Loader2,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams?.get("error");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (urlError) {
      if (urlError === "CredentialsSignin") {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.");
      } else {
        setError("تعذر تسجيل الدخول، يرجى التحقق من صحة البيانات والمحاولة مجدداً.");
      }
    }
  }, [urlError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("بيانات الاعتماد غير صحيحة، يرجى التحقق وإعادة المحاولة.");
      } else if (res?.ok) {
        const session = await getSession();
        const userRole = (session?.user as { role?: string } | undefined)?.role?.toLowerCase();
        if (userRole === "inventory") {
          router.push("/inventory");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err) {
      setError("تعذر الاتصال بالخادم حالياً، يرجى المحاولة لاحقاً.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div dir="rtl" className="relative z-10 w-full max-w-3xl mx-auto my-auto flex flex-col items-center justify-center px-4">
      {/* Interactive Glow Identity Header Above the Unlock Bar */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="flex flex-col items-center justify-center text-center"
      >
        {/* Top "Zahi Operations Hub" Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-950/40 border border-teal-500/20 text-teal-300 text-xs font-medium backdrop-blur-sm mb-4">
          <span>✨</span>
          <span>Zahi Operations Hub</span>
        </div>

        {/* Large Floating Zahi Logo (No background box or border) */}
        <Image
          src="/zahi-logo_2.png"
          alt="Zahi Logo"
          width={340}
          height={227}
          priority
          className="w-64 sm:w-72 md:w-[340px] max-w-[85vw] h-auto mx-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] mb-5"
        />

        {/* Simplified Subtitle */}
        <p className="text-slate-300 text-sm md:text-base font-medium mb-8 text-center">
          أدخل بياناتك للبدء
        </p>
      </motion.div>

      {/* Error Alert Banner */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-xl mb-5 overflow-hidden"
          >
            <div className="px-5 py-3 rounded-full border border-rose-400/40 bg-rose-500/20 text-rose-100 flex items-center justify-center gap-3 text-sm font-semibold shadow-lg backdrop-blur-md">
              <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
              <div className="text-center leading-relaxed">
                {error}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Horizontal Glass Unlock Bar */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
        className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[#0d1f1c]/40 backdrop-blur-xl border border-teal-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-3xl md:rounded-full p-6 md:p-2 mx-auto max-w-3xl w-full"
      >
        {/* Username Input (Right in RTL) */}
        <div className="w-full md:w-auto">
          <label htmlFor="username" className="sr-only">
            اسم المستخدم
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="off"
            required
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (error) setError("");
            }}
            placeholder="اسم المستخدم"
            className="bg-black/20 border border-teal-500/20 text-white rounded-full px-6 py-3 w-full md:w-64 focus:border-teal-400 focus:ring-1 focus:ring-teal-400/50 transition-all outline-none placeholder-slate-400 text-sm"
          />
        </div>

        {/* Password Input (Middle in RTL) */}
        <div className="relative w-full md:w-auto">
          <label htmlFor="password" className="sr-only">
            كلمة المرور
          </label>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            placeholder="كلمة المرور"
            className="bg-black/20 border border-teal-500/20 text-white rounded-full px-6 py-3 pl-11 w-full md:w-64 focus:border-teal-400 focus:ring-1 focus:ring-teal-400/50 transition-all outline-none placeholder-slate-400 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
            aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Login Button (Left in RTL) */}
        <button
          type="submit"
          disabled={isLoading}
          className="bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white font-bold rounded-full px-8 py-3 w-full md:w-auto shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex-shrink-0 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" strokeWidth={2.5} />
              <span>جاري التحقق...</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4 shrink-0 text-white" strokeWidth={2.5} />
              <span>تسجيل الدخول</span>
            </>
          )}
        </button>
      </motion.form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      dir="rtl"
      className="fixed inset-0 min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-y-auto bg-[url('/bg-dashboard.jpg')] bg-cover bg-center bg-fixed bg-no-repeat z-50"
    >
      {/* Frosted glass lock-screen overlay over the live dashboard background */}
      <div className="fixed inset-0 bg-[#040e0c]/60 backdrop-blur-lg pointer-events-none" />

      <Suspense
        fallback={
          <div className="px-6 py-4 rounded-full text-white/80 flex items-center gap-3 border border-teal-500/20 bg-[#0d1f1c]/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative z-10">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            <span>جاري تحميل شاشة القفل...</span>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
