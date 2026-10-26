"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Sparkles,
  Loader2,
} from "lucide-react";

function LoginForm() {
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

    if (!username.trim() || !password) {
      setError("يرجى إدخال اسم المستخدم وكلمة المرور للمتابعة");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        username: username.trim(),
        password,
        redirect: true,
        callbackUrl: "/",
      });

      if (res?.error) {
        if (res.error === "CredentialsSignin") {
          setError("اسم المستخدم أو كلمة المرور غير صحيحة");
        } else {
          setError(res.error);
        }
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || "حدث خطأ غير متوقع أثناء تسجيل الدخول");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto my-auto z-10">
      {/* Ambient decorative glowing orbs */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Dark Glassmorphism Login Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 p-8 sm:p-10 rounded-3xl bg-zinc-950/80 backdrop-blur-2xl border border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.7)] text-white overflow-hidden"
      >
        {/* Header & Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          {/* Logo container with emerald glow and glass border */}
          <div className="relative mb-5 group">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-white/30 bg-white/10 backdrop-blur-md shadow-[0_0_35px_rgba(16,185,129,0.45)] flex items-center justify-center">
              <Image
                src="/zahi_logo.png"
                alt="Zahi Logo"
                width={120}
                height={120}
                className="w-full h-full object-cover rounded-2xl"
                priority
              />
              <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none rounded-2xl" />
            </div>
          </div>

          {/* Badge: Zahi Project */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 mb-2.5 rounded-full text-xs font-bold tracking-wide bg-white/10 border border-white/20 text-teal-200 shadow-sm backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-teal-300" />
            <span>Zahi Project</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
            بوابة تسجيل الدخول
          </h1>

          {/* Subtitle */}
          <p className="text-sm font-medium text-white/80 mt-1.5 drop-shadow-sm">
            أدخل بيانات الاعتماد للوصول إلى لوحة العمليات
          </p>
        </div>

        {/* Error Alert Banner */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="mb-6 overflow-hidden"
            >
              <div className="p-3.5 rounded-2xl border border-rose-400/40 bg-rose-500/20 text-rose-100 flex items-start gap-3 text-sm font-semibold shadow-lg backdrop-blur-md">
                <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                <div className="flex-1 text-right leading-relaxed">
                  {error}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username Input */}
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-bold text-white/90 mb-2 text-right"
            >
              اسم المستخدم
            </label>
            <div className="relative">
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
                placeholder="أدخل اسم المستخدم"
                className="w-full pr-11 pl-4 py-3.5 rounded-2xl bg-white/10 border border-white/20 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30 text-white placeholder:text-white/45 text-sm font-medium backdrop-blur-md transition-all duration-200 outline-none"
              />
              <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 pointer-events-none" />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-bold text-white/90 mb-2 text-right"
            >
              كلمة المرور
            </label>
            <div className="relative">
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
                placeholder="أدخل كلمة المرور"
                className="w-full pr-11 pl-11 py-3.5 rounded-2xl bg-white/10 border border-white/20 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/30 text-white placeholder:text-white/45 text-sm font-medium backdrop-blur-md transition-all duration-200 outline-none"
              />
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors cursor-pointer p-1"
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3.5 px-4 rounded-2xl text-zinc-950 font-extrabold bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-300 hover:from-teal-300 hover:to-emerald-200 border border-teal-300/60 shadow-[0_4px_25px_rgba(20,184,166,0.35)] transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer text-sm sm:text-base"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-zinc-950" strokeWidth={2.5} />
                <span>جاري التحقق من الهوية...</span>
              </>
            ) : (
              <>
                <LogIn
                  className="w-5 h-5 shrink-0 text-zinc-950"
                  strokeWidth={2.5}
                />
                <span>تسجيل الدخول</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Pill */}
        <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-center">
          <div className="px-4 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md font-medium text-white/70 text-xs tracking-wide">
            Powered by Zahi Project Section
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="fixed inset-0 min-h-screen w-full flex items-center justify-center p-4 overflow-y-auto bg-[url('/bg-dashboard.jpg')] bg-cover bg-center bg-fixed bg-no-repeat z-50">
      {/* Dark vignette backdrop for optimal contrast */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px] pointer-events-none" />

      <Suspense
        fallback={
          <div className="p-8 rounded-3xl text-white/80 flex items-center gap-3 border border-white/20 bg-zinc-950/80 backdrop-blur-2xl shadow-2xl relative z-10">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            <span>جاري تحميل صفحة الدخول...</span>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
