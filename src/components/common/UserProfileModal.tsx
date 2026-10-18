"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage, Language } from '@/components/common/LanguageContext';
import { X, Globe, User, ShieldCheck, Mail, Check, Sparkles, KeyRound } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { lang, toggleLanguage, currentUser, updateUserProfile, t, isRtl } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [editNameAr, setEditNameAr] = useState(currentUser.name_ar);
  const [editNameEn, setEditNameEn] = useState(currentUser.name_en);
  const [editEmail, setEditEmail] = useState(currentUser.email);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      name_ar: editNameAr,
      name_en: editNameEn,
      email: editEmail,
    });
    setIsEditing(false);
    setToastMessage(t('profile.saveSuccess'));
    setTimeout(() => setToastMessage(null), 3000);
  };

  const currentDisplayName = lang === 'ar' ? currentUser.name_ar : currentUser.name_en;
  const currentDisplayRole = lang === 'ar' ? currentUser.role_ar : currentUser.role_en;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
          className="glass-popover bg-slate-900/85 backdrop-blur-2xl border border-white/30 shadow-2xl rounded-3xl w-full max-w-lg p-6 sm:p-7 text-white space-y-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Toast Notification */}
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-teal-500/20 border border-teal-300/40 text-teal-100 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg backdrop-blur-md"
            >
              <Sparkles className="w-4 h-4 text-teal-200" />
              <span>{toastMessage}</span>
            </motion.div>
          )}

          {/* Modal Header */}
          <div className="flex justify-between items-start border-b border-white/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-300/30 flex items-center justify-center text-teal-100">
                <User className="w-5 h-5 text-teal-200" />
              </div>
              <div>
                <h2 id="user-profile-title" className="text-xl font-extrabold text-white tracking-tight">
                  {t('profile.modalTitle')}
                </h2>
                <p className="text-xs text-white/70 font-medium mt-0.5">
                  {t('profile.modalSubtitle')}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer border border-transparent hover:border-white/20"
              aria-label={t('common.close')}
            >
              <X size={20} />
            </button>
          </div>

          {/* User Identity Card */}
          <div className="glass-inset rounded-2xl p-5 border border-white/20 bg-white/[0.04] space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-teal-600/40 to-white/20 border-2 border-white/40 flex items-center justify-center font-extrabold text-lg text-white shadow-xl shadow-teal-950/40">
                  {currentUser.avatar}
                </div>
                <span className="absolute bottom-0 end-0 w-4 h-4 rounded-full bg-teal-400 border-2 border-slate-900 ring-2 ring-teal-400/30" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-base text-white truncate">
                    {currentDisplayName}
                  </h3>
                  <span className="text-[10px] font-mono font-bold bg-white/10 text-white/80 px-2 py-0.5 rounded-md border border-white/20">
                    {currentUser.id}
                  </span>
                </div>
                <p className="text-xs text-teal-200 font-semibold mt-1">
                  {currentDisplayRole}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-white/60 font-mono mt-1">
                  <Mail className="w-3.5 h-3.5 text-white/50" />
                  <span className="truncate">{currentUser.email}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
              <span className="text-white/60 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-300" />
                {t('profile.accountSecurity')}
              </span>
              <span className="text-teal-200 font-bold font-mono">Level 4 - Operations Ops</span>
            </div>
          </div>

          {/* Language Switcher Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-teal-300" />
                <h4 className="text-sm font-bold text-white">
                  {t('profile.languageSection')}
                </h4>
              </div>
              <span className="text-[11px] font-mono text-teal-200 bg-teal-500/15 border border-teal-300/30 px-2.5 py-0.5 rounded-full font-bold">
                {lang === 'ar' ? 'العربية (RTL)' : 'English (LTR)'}
              </span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              {t('profile.languageDesc')}
            </p>

            {/* Segmented Switch */}
            <div className="glass-inset p-1.5 rounded-2xl bg-white/[0.06] border border-white/25 flex relative gap-1.5">
              <button
                type="button"
                onClick={() => toggleLanguage('ar')}
                className={`relative flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer z-10 ${
                  lang === 'ar'
                    ? 'text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                {lang === 'ar' && (
                  <motion.div
                    layoutId="activeLangIndicator"
                    className="absolute inset-0 bg-teal-500/30 border border-teal-300/50 rounded-xl shadow-lg -z-10"
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  />
                )}
                <span>🇸🇦</span>
                <span>العربية (AR)</span>
                {lang === 'ar' && <Check className="w-3.5 h-3.5 text-teal-300" />}
              </button>

              <button
                type="button"
                onClick={() => toggleLanguage('en')}
                className={`relative flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer z-10 ${
                  lang === 'en'
                    ? 'text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                {lang === 'en' && (
                  <motion.div
                    layoutId="activeLangIndicator"
                    className="absolute inset-0 bg-teal-500/30 border border-teal-300/50 rounded-xl shadow-lg -z-10"
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  />
                )}
                <span>🇺🇸</span>
                <span>English (EN)</span>
                {lang === 'en' && <Check className="w-3.5 h-3.5 text-teal-300" />}
              </button>
            </div>
          </div>

          {/* Quick Profile Edit (Optional Expansion) */}
          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-3 pt-2 border-t border-white/10">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/80">الاسم بالعربية:</label>
                <input
                  type="text"
                  value={editNameAr}
                  onChange={(e) => setEditNameAr(e.target.value)}
                  className="w-full bg-white/8 border border-white/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white/80">Name in English:</label>
                <input
                  type="text"
                  value={editNameEn}
                  onChange={(e) => setEditNameEn(e.target.value)}
                  className="w-full bg-white/8 border border-white/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white/80">{t('profile.email')}:</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-white/8 border border-white/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-400 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 bg-teal-500/30 hover:bg-teal-500/40 text-teal-100 font-bold py-2 rounded-xl border border-teal-300/40 text-xs transition-all cursor-pointer"
                >
                  {t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 bg-white/8 hover:bg-white/15 text-white/70 py-2 rounded-xl border border-white/20 text-xs transition-all cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-between items-center pt-2 border-t border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-white/70 hover:text-white transition-colors underline decoration-white/30 cursor-pointer flex items-center gap-1.5"
              >
                <span>✏️</span>
                <span>{t('common.edit')} ({t('profile.name')})</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="bg-white/15 hover:bg-white/25 text-white font-bold px-5 py-2.5 rounded-xl border border-white/30 transition-all text-xs cursor-pointer active:scale-95 shadow-md"
              >
                {t('common.close')}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
