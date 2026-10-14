"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Zap, Bot } from 'lucide-react';

type AutonomyLevel = 'COPILOT' | 'SEMI_AUTO' | 'FULL_AUTO';

const autonomyConfig = {
  COPILOT: {
    label: 'مساعد (Copilot)',
    desc: 'يراقب ويقترح الإجراءات للموافقة',
    icon: Eye,
    textColor: 'text-sky-900',
  },
  SEMI_AUTO: {
    label: 'شبه مستقل (Semi-Auto)',
    desc: 'يحل المشاكل البسيطة تلقائياً ويصعد المعقدة',
    icon: Zap,
    textColor: 'text-teal-900',
  },
  FULL_AUTO: {
    label: 'مستقل بالكامل (Full-Auto)',
    desc: 'أتمتة كاملة للقرارات بدون تدخل بشري',
    icon: Bot,
    textColor: 'text-emerald-900',
  },
};

export default function AIAutonomyControl() {
  const [level, setLevel] = useState<AutonomyLevel>('SEMI_AUTO');
  const currentConfig = autonomyConfig[level];

  return (
    <div className="bg-white/50 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-4 transition-all duration-300 mb-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span className="text-xl animate-pulse">🧠</span> مستوى تحكم الـ Agent
          </h2>
          <p className={`text-xs mt-0.5 font-medium ${currentConfig.textColor}`}>
            الوضع الحالي: {currentConfig.desc}
          </p>
        </div>

        {/* Animated Segmented Control Capsule */}
        <div className="bg-white/40 backdrop-blur-md border border-white/60 p-1.5 rounded-full flex relative flex-wrap sm:flex-nowrap">
          {(Object.keys(autonomyConfig) as AutonomyLevel[]).map(key => {
            const isActive = level === key;
            const Icon = autonomyConfig[key].icon;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setLevel(key)}
                className={`relative z-10 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-colors duration-300 cursor-pointer ${
                  isActive ? 'text-teal-600 font-semibold' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeAutonomyTab"
                    className="absolute inset-0 bg-white rounded-full shadow-sm border border-slate-100 -z-10"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
                <div className="relative flex items-center gap-1.5">
                  <Icon className="w-4 h-4" />
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse shrink-0" />
                  )}
                </div>
                <span>{autonomyConfig[key].label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
