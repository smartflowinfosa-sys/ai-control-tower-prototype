"use client";

import { useState } from 'react';

type AutonomyLevel = 'COPILOT' | 'SEMI_AUTO' | 'FULL_AUTO';

const autonomyConfig = {
  COPILOT: {
    label: 'مساعد (Copilot)',
    desc: 'يراقب ويقترح الإجراءات للموافقة',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    activeBtn: 'bg-blue-600 text-white shadow-md',
    textColor: 'text-blue-800'
  },
  SEMI_AUTO: {
    label: 'شبه مستقل (Semi-Auto)',
    desc: 'يحل المشاكل البسيطة تلقائياً ويصعد المعقدة',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    activeBtn: 'bg-amber-600 text-white shadow-md',
    textColor: 'text-amber-800'
  },
  FULL_AUTO: {
    label: 'مستقل بالكامل (Full-Auto)',
    desc: 'أتمتة كاملة للقرارات بدون تدخل بشري',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    activeBtn: 'bg-emerald-600 text-white shadow-md',
    textColor: 'text-emerald-800'
  }
};

export default function AIAutonomyControl() {
  const [level, setLevel] = useState<AutonomyLevel>('SEMI_AUTO');
  const currentConfig = autonomyConfig[level];

  return (
    <div className={`rounded-lg p-3 border-2 transition-all duration-300 ${currentConfig.bgColor} ${currentConfig.borderColor} mb-6`}>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span className="text-xl animate-pulse">🧠</span> مستوى استقلالية الذكاء الاصطناعي
          </h2>
          <p className={`text-xs mt-0.5 font-medium ${currentConfig.textColor}`}>
            الوضع الحالي: {currentConfig.desc}
          </p>
        </div>
        
        <div className="flex bg-white rounded-md p-1 shadow-sm border border-gray-200 flex-wrap">
          {(Object.keys(autonomyConfig) as AutonomyLevel[]).map(key => (
            <button
              key={key}
              onClick={() => setLevel(key)}
              className={`flex-1 min-w-[100px] px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                level === key ? autonomyConfig[key].activeBtn : 'text-gray-500 hover:bg-gray-50'
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
