"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Zap, Bot } from 'lucide-react';

type AutonomyLevel = 'COPILOT' | 'SEMI_AUTO' | 'FULL_AUTO';

const autonomyConfig = {
  COPILOT: {
    label: 'مساعد (Copilot)',
    desc: 'يراقب العمليات ويقترح الإجراءات لاعتمادها',
    icon: Eye,
  },
  SEMI_AUTO: {
    label: 'شبه مستقل (Semi-Auto)',
    desc: 'يحل المشاكل البسيطة تلقائياً ويصعد المعقدة للإدارة',
    icon: Zap,
  },
  FULL_AUTO: {
    label: 'مستقل بالكامل (Full-Auto)',
    desc: 'أتمتة كاملة للقرارات التشغيلية الذكية لزاهي',
    icon: Bot,
  },
};

export default function AIAutonomyControl() {
  const [level, setLevel] = useState<AutonomyLevel>('SEMI_AUTO');
  const currentConfig = autonomyConfig[level];

  return (
    <div className="glass rounded-[24px] p-6 transition-all duration-300 mb-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <span className="text-xl">🧠</span> مستوى تحكم الـ Agent
          </h2>
          <p className="text-xs mt-1 font-semibold text-white/65">
            الوضع الحالي: {currentConfig.desc}
          </p>
        </div>

        {/* Animated Segmented Control Capsule */}
        <div className="glass glass-card p-1.5 rounded-full flex relative flex-wrap sm:flex-nowrap border">
          {(Object.keys(autonomyConfig) as AutonomyLevel[]).map(key => {
            const isActive = level === key;
            const Icon = autonomyConfig[key].icon;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setLevel(key)}
                className={`autonomy-option relative z-10 flex items-center justify-center gap-2 px-4 py-2 text-xs md:text-sm font-bold rounded-full transition-colors duration-300 cursor-pointer ${
                  isActive ? 'text-white font-extrabold' : 'text-white/65 hover:text-white hover:bg-white/10'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeAutonomyTab"
                    className="absolute inset-0 glass glass-active rounded-full -z-10"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
                <div className="relative flex items-center gap-1.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/65'}`} />
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white/85 animate-pulse shrink-0" />
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
