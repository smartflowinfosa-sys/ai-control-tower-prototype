"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Zap, Bot } from 'lucide-react';
import { useLanguage } from '@/components/common/LanguageContext';

type AutonomyLevel = 'COPILOT' | 'SEMI_AUTO' | 'FULL_AUTO';

export default function AIAutonomyControl() {
  const { t } = useLanguage();
  const [level, setLevel] = useState<AutonomyLevel>('SEMI_AUTO');

  const autonomyConfig = {
    COPILOT: {
      label: t('dashboard.copilotLabel'),
      desc: t('dashboard.copilotDesc'),
      icon: Eye,
    },
    SEMI_AUTO: {
      label: t('dashboard.semiAutoLabel'),
      desc: t('dashboard.semiAutoDesc'),
      icon: Zap,
    },
    FULL_AUTO: {
      label: t('dashboard.fullAutoLabel'),
      desc: t('dashboard.fullAutoDesc'),
      icon: Bot,
    },
  };

  const currentConfig = autonomyConfig[level];

  return (
    <div className="!bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-6 md:p-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2 drop-shadow-sm">
            <span className="text-xl">🧠</span> {t('dashboard.autonomyHeading')}
          </h2>
          <p className="mt-1 font-semibold text-slate-100 text-sm drop-shadow-sm">
            {t('dashboard.currentMode')} {currentConfig.desc}
          </p>
        </div>

        {/* Animated Segmented Control Capsule */}
        <div className="bg-white/5 border border-white/20 rounded-full p-1.5 flex relative flex-wrap sm:flex-nowrap gap-1">
          {(Object.keys(autonomyConfig) as AutonomyLevel[]).map(key => {
            const isActive = level === key;
            const Icon = autonomyConfig[key].icon;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setLevel(key)}
                aria-pressed={isActive}
                className={`relative z-10 flex items-center justify-center gap-2 px-4 py-2 text-xs md:text-sm font-bold rounded-full transition-colors duration-200 cursor-pointer ${
                  isActive ? 'text-white font-extrabold' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeAutonomyTab"
                    className="absolute inset-0 bg-white/20 border border-white/30 rounded-full -z-10 shadow-sm"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
                <div className="relative flex items-center gap-1.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/65'}`} />
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white/80 shrink-0" />
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
