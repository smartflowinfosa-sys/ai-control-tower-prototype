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
    <div className="relative w-full max-w-md mx-auto">
      {/* Ambient background glows */}
      <div className="absolute -top-16 -right-16 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Clear Glass Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 p-8 sm:p-10"
        style={{
          background: "rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(4px) saturate(120%)",
          WebkitBackdropFilter: "blur(4px) saturate(120%)",
          border: "1px solid rgba(255, 255, 255, 0.25)",
          boxShadow:
            "0 8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
          borderRadius: "24px",
          textShadow: "0 1px 8px rgba(0, 0, 0, 0.45)",
        }}
      >
        {/* Header & Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          {/* Logo container with green glow and cover fit */}
          <div className="relative mb-5 group">
            <div
              className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-white/30 flex items-center justify-center"
              style={{
                boxShadow: "0 0 32px rgba(16, 185, 129, 0.55)",
                background: "rgba(255, 255, 255, 0.12)",
              }}
            >
              <Image
                src="/zahi_logo.png"
                alt="Zahi Logo"
                width={120}
                height={120}
                className="w-full h-full object-cover rounded-2xl"
                priority
              />
              {/* Subtle green overlay on top of the logo */}
              <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none rounded-2xl" />
            </div>
          </div>

          {/* Badge: Zahi Project (Transparent background, white text and star, 700 weight) */}
          <div
            className="inline-flex items-center gap-1.5 px-3.5 py-1 mb-2.5 rounded-full text-xs tracking-wide shadow-sm"
            style={{
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.35)",
              color: "#ffffff",
              fontWeight: 700,
              textShadow: "0 1px 8px rgba(0, 0, 0, 0.45)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>Zahi Project</span>
          </div>

          {/* Title: 800 weight, pure white #fff */}
          <h1
            className="text-2xl sm:text-3xl tracking-tight"
            style={{
              fontWeight: 800,
              color: "#ffffff",
              textShadow: "0 1px 8px rgba(0, 0, 0, 0.45)",
            }}
          >
            بوابة تسجيل الدخول
          </h1>

          {/* Subtitle: 600 weight, rgba(255,255,255,0.92) */}
          <p
            className="text-sm mt-1.5"
            style={{
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.92)",
              textShadow: "0 1px 8px rgba(0, 0, 0, 0.45)",
            }}
          >
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
              <div
                className="p-3.5 rounded-2xl border border-red-400/40 text-red-100 flex items-start gap-3 text-sm shadow-lg"
                style={{
                  background: "rgba(239, 68, 68, 0.18)",
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                  textShadow: "0 1px 6px rgba(0, 0, 0, 0.5)",
                  fontWeight: 600,
                }}
              >
                <AlertCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
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
              className="block text-xs mb-2 text-right"
              style={{
                fontWeight: 700,
                color: "#ffffff",
                textShadow: "0 1px 8px rgba(0, 0, 0, 0.45)",
              }}
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
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  color: "#ffffff",
                  fontWeight: 600,
                  textShadow: "0 1px 8px rgba(0, 0, 0, 0.45)",
                }}
                className="w-full pr-11 pl-4 py-3.5 rounded-2xl placeholder:text-white/80 placeholder:font-medium text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 transition-all duration-200"
              />
              <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70 pointer-events-none" />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs mb-2 text-right"
              style={{
                fontWeight: 700,
                color: "#ffffff",
                textShadow: "0 1px 8px rgba(0, 0, 0, 0.45)",
              }}
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
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  color: "#ffffff",
                  fontWeight: 600,
                  textShadow: "0 1px 8px rgba(0, 0, 0, 0.45)",
                }}
                className="w-full pr-11 pl-11 py-3.5 rounded-2xl placeholder:text-white/80 placeholder:font-medium text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 transition-all duration-200"
              />
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors cursor-pointer"
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
            style={{
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              boxShadow:
                "0 4px 20px rgba(16, 185, 129, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.35)",
              textShadow: "0 1px 8px rgba(0, 0, 0, 0.45)",
            }}
            className="w-full mt-2 py-3.5 px-4 rounded-2xl text-white font-bold bg-[rgba(16,185,129,0.15)] hover:bg-[rgba(16,185,129,0.3)] border-[1.5px] border-[rgba(255,255,255,0.45)] hover:border-[rgba(255,255,255,0.7)] transition-all duration-200 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer text-sm sm:text-base"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" strokeWidth={2.5} />
                <span>جاري التحقق من الهوية...</span>
              </>
            ) : (
              <>
                <LogIn
                  className="w-5 h-5 shrink-0 text-white"
                  strokeWidth={2.5}
                />
                <span>تسجيل الدخول</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Pill: Powered by Zahi Project Section */}
        <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-center">
          <div
            style={{
              padding: "6px 16px",
              borderRadius: "999px",
              border: "1px solid rgba(255, 255, 255, 0.35)",
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.95)",
              textShadow: "0 1px 8px rgba(0, 0, 0, 0.45)",
            }}
            className="text-xs tracking-wide"
          >
            Powered by Zahi Project Section
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4 py-8">
      <Suspense
        fallback={
          <div
            className="p-8 rounded-3xl text-white/70 flex items-center gap-3 border border-white/20"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          >
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
