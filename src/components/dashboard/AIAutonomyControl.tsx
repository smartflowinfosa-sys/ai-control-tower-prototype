"use client";

import { useState } from 'react';

type AutonomyLevel = 'COPILOT' | 'SEMI_AUTO' | 'FULL_AUTO';

const autonomyConfig = {
  COPILOT: {
    label: 'مساعد (Copilot)',
    desc: 'يراقب ويقترح الإجراءات للموافقة',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-400/30',
    activeBtn: 'bg-sky-500 text-white shadow-md shadow-sky-500/30',
    textColor: 'text-sky-900'
  },
  SEMI_AUTO: {
    label: 'شبه مستقل (Semi-Auto)',
    desc: 'يحل المشاكل البسيطة تلقائياً ويصعد المعقدة',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-400/30',
    activeBtn: 'bg-orange-500 text-white shadow-md shadow-orange-500/30',
    textColor: 'text-orange-900'
  },
  FULL_AUTO: {
    label: 'مستقل بالكامل (Full-Auto)',
    desc: 'أتمتة كاملة للقرارات بدون تدخل بشري',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-400/30',
    activeBtn: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30',
    textColor: 'text-emerald-900'
  }
};

export default function AIAutonomyControl() {
  const [level, setLevel] = useState<AutonomyLevel>('SEMI_AUTO');
  const currentConfig = autonomyConfig[level];

  return (
    <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.05)] rounded-2xl p-4 transition-all duration-300 mb-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span className="text-xl animate-pulse">🧠</span> مستوى استقلالية الذكاء الاصطناعي
          </h2>
          <p className={`text-xs mt-0.5 font-medium ${currentConfig.textColor}`}>
            الوضع الحالي: {currentConfig.desc}
          </p>
        </div>
        
        <div className="flex bg-white/70 backdrop-blur-sm rounded-xl p-1 shadow-sm border border-white/60 flex-wrap">
          {(Object.keys(autonomyConfig) as AutonomyLevel[]).map(key => (
            <button
              key={key}
              onClick={() => setLevel(key)}
              className={`flex-1 min-w-[100px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                level === key ? autonomyConfig[key].activeBtn : 'text-gray-600 hover:bg-white/60'
              }`}
            >
              {autonomyConfig[key].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
