import React from 'react';

export default function ProductionLoading() {
  return (
    <div className="page-shell w-full mx-auto space-y-5 font-sans animate-pulse">
      {/* 1. Header Skeleton */}
      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-white/10" />
          <div className="h-7 w-48 rounded-lg bg-white/10" />
        </div>
        <div className="h-10 w-44 rounded-xl bg-white/10" />
      </div>

      {/* 2. Main Module Skeleton */}
      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 space-y-6">
        {/* Shift Tracker Header */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-white/10" />
          <div className="h-5 w-40 rounded bg-white/10" />
        </div>

        {/* 4 Shift Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10" />
                <div className="h-4 w-24 rounded bg-white/10" />
              </div>
              <div className="h-6 w-14 rounded-full bg-white/10" />
            </div>
          ))}
        </div>

        {/* Lower Telemetry Grid */}
        <div className="pt-5 border-t border-white/10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Circular Chart Area */}
          <div className="lg:col-span-7 bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-5">
            <div className="w-48 h-48 rounded-full border-4 border-white/10 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-white/5" />
            </div>
            <div className="flex-1 w-full space-y-3">
              <div className="h-5 w-48 rounded bg-white/10" />
              <div className="space-y-2.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-xl bg-white/5 border border-white/10" />
                ))}
              </div>
            </div>
          </div>

          {/* KPI Indicators */}
          <div className="lg:col-span-5 bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl p-5 space-y-3.5">
            <div className="h-5 w-36 rounded bg-white/10" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/5 border border-white/10" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

