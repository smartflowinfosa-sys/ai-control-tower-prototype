"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage, Language } from "@/components/common/LanguageContext";
import {
  X,
  Globe,
  User,
  ShieldCheck,
  Check,
  Sparkles,
  KeyRound,
  LogOut,
  Lock,
  Eye,
  EyeOff,
  Save,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { data: session, update: updateSession } = useSession();
  const { lang, toggleLanguage, currentUser, updateUserProfile, t, isRtl } = useLanguage();

  // Form State
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [selectedLang, setSelectedLang] = useState<Language>(lang);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status & feedback
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live DB user data state
  const [userData, setUserData] = useState<{
    id?: string;
    username?: string;
    role?: string;
    name_ar?: string;
    name_en?: string;
    email?: string;
    job_title?: string;
    preferred_language?: string;
  } | null>(null);

  // Load user data whenever modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setErrorMessage(null);
    setToastMessage(null);
    setNewPassword("");
    setConfirmPassword("");

    // Initialize with session data immediately for snappy UX
    const sessionUser = session?.user as any;
    if (sessionUser) {
      setNameAr(sessionUser.name_ar || currentUser.name_ar || "");
      setNameEn(sessionUser.name_en || currentUser.name_en || "");
      const prefLang = (sessionUser.preferred_language || lang) as Language;
      setSelectedLang(prefLang);
      setUserData({
        id: sessionUser.id || currentUser.id,
        username: sessionUser.username || sessionUser.name,
        role: sessionUser.role,
        name_ar: sessionUser.name_ar || currentUser.name_ar,
        name_en: sessionUser.name_en || currentUser.name_en,
        email: sessionUser.email || currentUser.email,
        job_title: sessionUser.job_title,
        preferred_language: prefLang,
      });
    }

    // Fetch latest persisted data directly from /api/user/profile
    setIsLoading(true);
    fetch("/api/user/profile")
      .then((res) => {
        if (!res.ok) throw new Error("فشل استرجاع بيانات الملف الشخصي");
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.user) {
          const u = data.user;
          setUserData(u);
          setNameAr(u.name_ar || "");
          setNameEn(u.name_en || "");
          if (u.preferred_language === "ar" || u.preferred_language === "en") {
            setSelectedLang(u.preferred_language);
          }
        }
      })
      .catch((err) => {
        console.warn("[UserProfileModal] Could not fetch fresh profile:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, session, currentUser, lang]);

  if (!isOpen) return null;

  const rawRole = (userData?.role || (session?.user as any)?.role || "STAFF").toUpperCase();
  const isRoleAdmin = rawRole === "SUPERADMIN" || rawRole === "ADMIN";
  const simplifiedRoleBadge = isRoleAdmin ? "Admin" : "Staff";
  const currentUsername =
    userData?.username ||
    (session?.user as any)?.username ||
    session?.user?.name ||
    "user";

  // Avatar Initials
  const displayInitials =
    (nameAr ? nameAr.slice(0, 2) : "") ||
    (nameEn ? nameEn.slice(0, 2).toUpperCase() : "") ||
    currentUsername.slice(0, 2).toUpperCase();

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate password if provided
    if (newPassword.trim().length > 0) {
      if (newPassword.trim().length < 4) {
        setErrorMessage(
          lang === "ar"
            ? "كلمة المرور الجديدة يجب أن لا تقل عن 4 خانات"
            : "New password must be at least 4 characters long"
        );
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage(
          lang === "ar"
            ? "كلمة المرور وتأكيدها غير متطابقين"
            : "Password and confirmation do not match"
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name_ar: nameAr,
          name_en: nameEn,
          preferred_language: selectedLang,
          new_password: newPassword.trim().length > 0 ? newPassword.trim() : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "فشل حفظ التعديلات");
      }

      // Sync LanguageContext
      updateUserProfile({
        name_ar: nameAr,
        name_en: nameEn,
        preferredLang: selectedLang,
      });

      // If language changed, apply it globally
      if (selectedLang !== lang) {
        toggleLanguage(selectedLang);
      }

      // Sync NextAuth session client state
      if (updateSession) {
        await updateSession({
          name_ar: nameAr,
          name_en: nameEn,
          preferred_language: selectedLang,
        });
      }

      // Reset password inputs
      setNewPassword("");
      setConfirmPassword("");

      // Update local state
      if (result.user) {
        setUserData(result.user);
      }

      // Show success notification
      setToastMessage(
        lang === "ar"
          ? "تم حفظ وتحديث بيانات الملف الشخصي بنجاح ✨"
          : "User profile updated successfully ✨"
      );
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error("[UserProfileModal] Save error:", err);
      setErrorMessage(
        err.message ||
          (lang === "ar"
            ? "حدث خطأ أثناء حفظ التعديلات"
            : "An error occurred while saving profile")
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.12 }}
          className="bg-zinc-950/85 backdrop-blur-2xl border border-white/20 shadow-[0_24px_70px_rgba(0,0,0,0.65)] rounded-3xl w-full max-w-4xl lg:max-w-5xl text-white relative overflow-hidden flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle Ambient Glow Effect inside dialog */}
          <div className="absolute top-0 right-1/4 w-96 h-36 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
          <div className="absolute bottom-0 left-1/4 w-96 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

          {/* Toast Notification Banner */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-teal-500/25 border border-teal-300/50 text-teal-100 text-xs sm:text-sm font-bold px-5 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-2xl backdrop-blur-xl"
              >
                <Sparkles className="w-4 h-4 text-teal-300 shrink-0 animate-spin" />
                <span>{toastMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dialog Header with User Avatar, Identity & Role Badge */}
          <div className="px-6 pt-5 pb-5 border-b border-white/15 bg-white/[0.03] shrink-0 space-y-4">
            {/* Top Row: Modal Title & Close Button */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-300/30 flex items-center justify-center text-teal-200 shadow-inner">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h2 id="user-profile-title" className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                    <span>{lang === "ar" ? "الملف الشخصي للمستخدم" : "User Profile Settings"}</span>
                    {isLoading && <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin" />}
                  </h2>
                  <p className="text-[11px] text-white/60 font-medium">
                    {lang === "ar"
                      ? "عرض التفاصيل الإدارية وتحديث البيانات وتفضيلات النظام"
                      : "Review administrative details, personal information and system preferences"}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer border border-transparent hover:border-white/20"
                aria-label={t("common.close")}
              >
                <X size={20} />
              </button>
            </div>

            {/* Header Profile Identity & Simplified Role Badge (Read-Only) */}
            <div className="rounded-2xl p-4 border border-white/15 bg-white/5 relative overflow-hidden shadow-md backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* User Avatar & Identification */}
                <div className="flex items-center gap-3.5">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600/50 to-emerald-400/20 border-2 border-white/25 flex items-center justify-center font-black text-lg text-white shadow-xl shadow-teal-950/40">
                      {displayInitials}
                    </div>
                    <span className="absolute -bottom-1 -end-1 w-3.5 h-3.5 rounded-full bg-teal-400 border-2 border-zinc-950 ring-2 ring-teal-400/40" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-base text-white">
                        {lang === "ar" ? (nameAr || currentUsername) : (nameEn || currentUsername)}
                      </h3>
                      <span className="text-[11px] font-mono font-bold bg-white/10 text-white/80 px-2 py-0.5 rounded-lg border border-white/15">
                        @{currentUsername}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Simplified Role Badge: strictly Admin or Staff */}
                <div className="pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 w-full sm:w-auto flex justify-end">
                  <div
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm ${
                      isRoleAdmin
                        ? "bg-amber-500/15 border border-amber-400/30 text-amber-200"
                        : "bg-teal-500/15 border border-teal-400/30 text-teal-200"
                    }`}
                    title={isRoleAdmin ? "Admin (Protected Role)" : "Staff (Protected Role)"}
                  >
                    <ShieldCheck className={`w-3.5 h-3.5 ${isRoleAdmin ? "text-amber-300" : "text-teal-300"}`} />
                    <span>{simplifiedRoleBadge}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono flex items-center gap-1 ${
                      isRoleAdmin
                        ? "bg-amber-400/20 text-amber-100 border border-amber-300/40"
                        : "bg-teal-400/20 text-teal-100 border border-teal-300/40"
                    }`}>
                      <Lock className="w-2.5 h-2.5" />
                      <span>{lang === "ar" ? "محمي" : "Protected"}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Container */}
          <div className="p-6 overflow-y-auto space-y-6">

            {/* Error Message Box */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-500/20 border border-rose-400/40 text-rose-100 text-xs sm:text-sm font-semibold px-4 py-3 rounded-2xl flex items-center gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
                <span>{errorMessage}</span>
              </motion.div>
            )}

            {/* Form with Two-Column Responsive Grid */}
            <form id="user-profile-form" onSubmit={handleSaveProfile}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1: Personal Information (Arabic Name & English Name) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                    <User className="w-4 h-4 text-teal-300" />
                    <h4 className="text-sm font-bold text-white">
                      {lang === "ar" ? "المعلومات الشخصية" : "Personal Information"}
                    </h4>
                  </div>

                  {/* الاسم بالعربية (Full Name in Arabic) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white/85 flex items-center justify-between">
                      <span>{lang === "ar" ? "الاسم بالعربية" : "Full Name in Arabic"}</span>
                      <span className="text-[10px] text-teal-300 font-normal">AR</span>
                    </label>
                    <input
                      type="text"
                      dir="rtl"
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      placeholder="مثال: محمد العمري"
                      className="w-full bg-white/8 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-all shadow-inner"
                    />
                  </div>

                  {/* Name in English */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white/85 flex items-center justify-between">
                      <span>{lang === "ar" ? "الاسم بالإنجليزية" : "Name in English"}</span>
                      <span className="text-[10px] text-teal-300 font-mono font-normal">EN</span>
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      placeholder="e.g. Mohammed Al-Amri"
                      className="w-full bg-white/8 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-all font-mono shadow-inner"
                    />
                  </div>
                </div>

                {/* Column 2: System Language & Password Update */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                    <Globe className="w-4 h-4 text-teal-300" />
                    <h4 className="text-sm font-bold text-white">
                      {lang === "ar" ? "تفضيلات الواجهة والأمان" : "Interface & Security"}
                    </h4>
                  </div>

                  {/* لغة واجهة النظام (Language Toggle) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white/85 flex items-center justify-between">
                      <span>{lang === "ar" ? "لغة واجهة النظام" : "System Interface Language"}</span>
                      <span className="text-[10px] font-mono text-teal-200 bg-teal-500/15 border border-teal-300/30 px-2 py-0.5 rounded-full font-bold">
                        {selectedLang === "ar" ? "العربية (RTL)" : "English (LTR)"}
                      </span>
                    </label>

                    {/* Segmented Switch */}
                    <div className="p-1 rounded-2xl bg-white/5 border border-white/20 flex relative gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedLang("ar")}
                        className={`relative flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer z-10 ${
                          selectedLang === "ar"
                            ? "text-white"
                            : "text-white/70 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        {selectedLang === "ar" && (
                          <motion.div
                            layoutId="activeModalLangIndicator"
                            className="absolute inset-0 bg-teal-500/30 border border-teal-300/50 rounded-xl shadow-lg -z-10"
                            transition={{ type: "spring", stiffness: 350, damping: 28 }}
                          />
                        )}
                        <span>🇸🇦</span>
                        <span>العربية (AR)</span>
                        {selectedLang === "ar" && <Check className="w-3.5 h-3.5 text-teal-300" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedLang("en")}
                        className={`relative flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer z-10 ${
                          selectedLang === "en"
                            ? "text-white"
                            : "text-white/70 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        {selectedLang === "en" && (
                          <motion.div
                            layoutId="activeModalLangIndicator"
                            className="absolute inset-0 bg-teal-500/30 border border-teal-300/50 rounded-xl shadow-lg -z-10"
                            transition={{ type: "spring", stiffness: 350, damping: 28 }}
                          />
                        )}
                        <span>🇺🇸</span>
                        <span>English (EN)</span>
                        {selectedLang === "en" && <Check className="w-3.5 h-3.5 text-teal-300" />}
                      </button>
                    </div>
                  </div>

                  {/* تغيير كلمة المرور (Change Password) */}
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-white/85 flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-teal-300" />
                          <span>{lang === "ar" ? "كلمة المرور الجديدة (اختياري)" : "New Password (Optional)"}</span>
                        </label>
                        <span className="text-[10px] text-white/50">
                          {lang === "ar" ? "اتركه فارغاً للإبقاء عليها" : "Leave blank to keep current"}
                        </span>
                      </div>

                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          dir="ltr"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="w-full bg-white/8 border border-white/20 rounded-xl ps-3.5 pe-10 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-all font-mono shadow-inner"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute end-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white cursor-pointer p-1"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password if new password typed */}
                    {newPassword.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-1.5"
                      >
                        <label className="text-xs font-bold text-white/85 flex items-center justify-between">
                          <span>{lang === "ar" ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}</span>
                          {confirmPassword && (
                            <span className={`text-[10px] font-bold ${newPassword === confirmPassword ? "text-teal-300" : "text-rose-300"}`}>
                              {newPassword === confirmPassword
                                ? (lang === "ar" ? "متطابقتان ✓" : "Matching ✓")
                                : (lang === "ar" ? "غير متطابقتين ✗" : "Mismatch ✗")}
                            </span>
                          )}
                        </label>
                        <input
                          type={showPassword ? "text" : "password"}
                          dir="ltr"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className={`w-full bg-white/8 border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 transition-all font-mono shadow-inner ${
                            confirmPassword && newPassword !== confirmPassword
                              ? "border-rose-400/60 focus:ring-rose-400"
                              : "border-white/20 focus:ring-teal-400"
                          }`}
                        />
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Modal Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/15 bg-white/5 shrink-0">
            {/* Logout button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                signOut({ callbackUrl: "/login" });
              }}
              className="w-full sm:w-auto text-rose-300 hover:text-rose-100 hover:bg-rose-500/15 border border-rose-400/20 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer order-2 sm:order-1"
            >
              <LogOut size={14} />
              <span>{lang === "ar" ? "تسجيل الخروج" : "Sign Out"}</span>
            </button>

            {/* Actions: Cancel & Save */}
            <div className="flex items-center gap-3 w-full sm:w-auto order-1 sm:order-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/15 text-white/80 hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>

              <button
                type="submit"
                form="user-profile-form"
                disabled={isSaving}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-zinc-950 text-xs font-extrabold transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>{lang === "ar" ? "جاري الحفظ..." : "Saving..."}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-zinc-950" />
                    <span>{t("common.save")}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
