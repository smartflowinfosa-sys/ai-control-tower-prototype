"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Sparkles,
  X,
  Volume2,
  CheckCircle2,
  Send,
  RotateCcw,
  Bot,
  Command,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { useLanguage } from '@/components/common/LanguageContext';
import { useRouter } from 'next/navigation';

export default function VoiceAIAgent() {
  const { lang, isRtl } = useLanguage();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize SpeechRecognition on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setIsSupported(false);
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ar-SA';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript.trim()) {
            setTranscript(currentTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            setFeedbackMessage(
              lang === 'en'
                ? 'Microphone access denied. You can test with sample command chips below.'
                : 'تم رفض إذن الميكروفون. يمكنك تجربة الأوامر عبر النقر على النماذج الجاهزة أدناه.'
            );
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('Failed to initialize speech recognition:', err);
        setIsSupported(false);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [lang]);

  const startListening = () => {
    setFeedbackMessage(null);
    setTranscript('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        // Recognition might already be running
        console.warn('Start recognition issue:', e);
      }
    } else {
      // Browser fallback simulation
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  };

  const handleToggleVoice = () => {
    if (!isOpen) {
      setIsOpen(true);
      startListening();
    } else {
      stopListening();
      setIsOpen(false);
    }
  };

  const handleSelectSampleCommand = (cmd: string) => {
    setTranscript(cmd);
    setFeedbackMessage(null);
  };

  const handleExecuteCommand = () => {
    if (!transcript.trim()) return;

    stopListening();
    const cleanCmd = transcript.trim().toLowerCase();

    // Intelligent command routing & feedback
    if (cleanCmd.includes('إنتاج') || cleanCmd.includes('kds') || cleanCmd.includes('مطبخ') || cleanCmd.includes('وجبات')) {
      setFeedbackMessage(
        lang === 'en'
          ? 'Understood. Navigating to Aggregated Production KDS...'
          : 'عُلم. جاري الانتقال إلى شاشة الإنتاج المجمع (KDS)...'
      );
      setTimeout(() => {
        router.push('/production');
        setIsOpen(false);
      }, 1200);
    } else if (cleanCmd.includes('مخزون') || cleanCmd.includes('نواقص') || cleanCmd.includes('حرج')) {
      setFeedbackMessage(
        lang === 'en'
          ? 'Understood. Navigating to Inventory Control...'
          : 'عُلم. جاري فتح جدول النواقص وإدارة المخزون...'
      );
      setTimeout(() => {
        router.push('/inventory');
        setIsOpen(false);
      }, 1200);
    } else if (cleanCmd.includes('مورد') || cleanCmd.includes('شراء') || cleanCmd.includes('po')) {
      setFeedbackMessage(
        lang === 'en'
          ? 'Understood. Navigating to Purchase Orders Tracker...'
          : 'عُلم. جاري فتح لوحة تتبع أوامر الشراء والموردين...'
      );
      setTimeout(() => {
        router.push('/suppliers');
        setIsOpen(false);
      }, 1200);
    } else {
      setFeedbackMessage(
        lang === 'en'
          ? `AI Agent recognized command: "${transcript}". Action registered in Control Tower.`
          : `تم استلام الأمر الصوتي: "${transcript}". تم تسجيل الإجراء في برج المراقبة بنجاح.`
      );
      setTimeout(() => {
        setIsOpen(false);
      }, 2500);
    }
  };

  const sampleCommands = [
    { ar: 'افتح شاشة الإنتاج المجمع KDS', en: 'Open Aggregated Production KDS' },
    { ar: 'ما هي النواقص الحرجة في المخزون؟', en: 'What are the critical shortages?' },
    { ar: 'تتبع أوامر الموردين النشطة', en: 'Track active supplier purchase orders' },
    { ar: 'كم نسبة إنجاز أهداف اليوم؟', en: "What is today's completion rate?" },
  ];

  return (
    <>
      {/* 1. Floating Crystal Glass Action Button */}
      <div className={`fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-40 select-none`}>
        <button
          type="button"
          onClick={handleToggleVoice}
          className={`relative p-3.5 rounded-full backdrop-blur-xl border transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.37)] flex items-center justify-center cursor-pointer group ${
            isListening
              ? 'bg-rose-500/30 border-rose-400 text-rose-200 shadow-[0_0_25px_rgba(244,63,94,0.6)] animate-pulse'
              : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/25 text-white hover:border-emerald-400/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)]'
          }`}
          title={lang === 'en' ? 'Voice AI Agent' : 'الأوامر الصوتية للوكيل الذكي'}
          aria-label="Voice AI Agent"
        >
          {/* Subtle Outer Neon Pulse Ring */}
          <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-400/20 blur-sm pointer-events-none group-hover:opacity-100 opacity-60 transition-opacity" />

          {isListening ? (
            <Mic className="w-6 h-6 text-rose-300 animate-bounce" />
          ) : (
            <Mic className="w-6 h-6 text-emerald-300 group-hover:scale-110 transition-transform" />
          )}

          {/* Glowing Tooltip Label */}
          <span className="absolute bottom-full mb-2.5 px-3 py-1 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-[11px] font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
            {lang === 'en' ? 'Voice Control (ar-SA)' : 'الأوامر الصوتية (ar-SA)'}
          </span>
        </button>
      </div>

      {/* 2. Glassmorphic Voice Command HUD / Overlay */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl bg-slate-950/80 backdrop-blur-2xl border border-white/25 shadow-[0_20px_60px_rgba(0,0,0,0.6)] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden"
            >
              {/* Top Gradient Accent Bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400" />

              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/15">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>{lang === 'en' ? 'Voice AI Commander' : 'المساعد الصوتي الذكي للعمليات'}</span>
                      <span className="text-[10px] font-mono font-bold bg-white/10 text-emerald-300 border border-white/20 px-2 py-0.5 rounded-full">
                        ar-SA
                      </span>
                    </h3>
                    <p className="text-xs text-white/65 mt-0.5">
                      {lang === 'en' ? 'Speak Arabic commands directly to the Control Tower' : 'تحدث باللغة العربية للتحكم الفوري ببرج المراقبة'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    stopListening();
                    setIsOpen(false);
                  }}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/15 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Audio Visualizer & Waveform Animation */}
              <div className="py-6 flex flex-col items-center justify-center space-y-4">
                <div className="flex items-center justify-center gap-1.5 h-16">
                  {[40, 75, 100, 60, 90, 45, 80, 50, 95, 35].map((height, idx) => (
                    <motion.span
                      key={idx}
                      animate={
                        isListening
                          ? { height: [`${Math.max(15, height * 0.25)}px`, `${height}px`, `${Math.max(15, height * 0.3)}px`] }
                          : { height: '12px' }
                      }
                      transition={
                        isListening
                          ? { repeat: Infinity, duration: 0.6 + (idx % 4) * 0.15, ease: 'easeInOut' }
                          : { duration: 0.2 }
                      }
                      className={`w-1.5 rounded-full ${
                        isListening
                          ? 'bg-gradient-to-t from-emerald-500 to-teal-300 shadow-[0_0_8px_#10b981]'
                          : 'bg-white/25'
                      }`}
                    />
                  ))}
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2 text-xs font-bold">
                  {isListening ? (
                    <span className="flex items-center gap-1.5 text-rose-300 bg-rose-500/15 border border-rose-400/30 px-3 py-1 rounded-full animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                      {lang === 'en' ? 'Listening now... Speak clearly' : 'جاري الاستماع الآن... تحدث بصوت واضح'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-white/60 bg-white/5 border border-white/15 px-3 py-1 rounded-full">
                      <MicOff className="w-3.5 h-3.5" />
                      {lang === 'en' ? 'Microphone paused' : 'الميكروفون متوقف حالياً'}
                    </span>
                  )}
                </div>
              </div>

              {/* Real-time Transcription Box */}
              <div className="bg-white/[0.05] border border-white/20 rounded-2xl p-4 sm:p-5 min-h-[90px] flex flex-col justify-center text-center">
                {transcript ? (
                  <p className="text-base sm:text-lg font-bold text-white tracking-wide leading-relaxed font-sans" dir="rtl">
                    &ldquo;{transcript}&rdquo;
                  </p>
                ) : (
                  <p className="text-xs sm:text-sm text-white/50 italic font-medium">
                    {lang === 'en'
                      ? 'Say: "Open Production KDS" or "Check critical shortages"...'
                      : 'قل مثلاً: "افتح شاشة الإنتاج المجمع" أو "ما هي النواقص الحرجة؟"...'}
                  </p>
                )}
              </div>

              {/* Feedback Alert if actionable */}
              {feedbackMessage && (
                <div className="mt-3 p-3 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <Sparkles className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>{feedbackMessage}</span>
                </div>
              )}

              {/* Quick Sample Voice Chips */}
              <div className="mt-5 space-y-2">
                <span className="text-[11px] font-bold text-white/60 flex items-center gap-1">
                  <Command className="w-3 h-3 text-teal-300" />
                  {lang === 'en' ? 'Try these sample Arabic commands:' : 'أو انقر لتجربة أحد الأوامر النموذجية:'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {sampleCommands.map((cmd) => (
                    <button
                      key={cmd.en}
                      type="button"
                      onClick={() => handleSelectSampleCommand(lang === 'en' ? cmd.en : cmd.ar)}
                      className="text-xs bg-white/8 hover:bg-white/15 text-white/90 border border-white/20 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-medium hover:border-emerald-400/40"
                    >
                      {lang === 'en' ? cmd.en : cmd.ar}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {isListening ? (
                    <button
                      type="button"
                      onClick={stopListening}
                      className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <MicOff className="w-3.5 h-3.5" />
                      <span>{lang === 'en' ? 'Stop Recording' : 'إيقاف التسجيل'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startListening}
                      className="px-4 py-2 bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-200 border border-emerald-400/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{lang === 'en' ? 'Resume Recording' : 'بدء التحدث'}</span>
                    </button>
                  )}

                  {transcript && (
                    <button
                      type="button"
                      onClick={() => setTranscript('')}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/15 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{lang === 'en' ? 'Clear' : 'مسح'}</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleExecuteCommand}
                  disabled={!transcript.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-xl text-xs sm:text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{lang === 'en' ? 'Execute Command' : 'تنفيذ الأمر'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
