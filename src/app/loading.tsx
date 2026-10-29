export default function RootLoading() {
  return (
    <div className="page-shell w-full min-h-[75vh] mx-auto flex flex-col justify-between gap-6 font-sans">
      {/* Top Minimalist Header Skeleton */}
      <div className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 flex items-center justify-between gap-4 animate-pulse">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-white/10 border border-white/10" />
          <div className="space-y-2">
            <div className="h-5 w-44 rounded-lg bg-white/10" />
            <div className="h-3 w-28 rounded-md bg-white/5" />
          </div>
        </div>
        <div className="h-9 w-36 rounded-xl bg-white/10 border border-white/10 hidden sm:block" />
      </div>

      {/* Centered Sleek Dark-Theme Spinner */}
      <div className="flex-1 flex flex-col items-center justify-center py-12">
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 rounded-full border-2 border-white/10" />
          <div className="absolute w-14 h-14 rounded-full border-2 border-transparent border-t-emerald-400 border-r-teal-400/60 animate-spin" />
          <div className="absolute w-7 h-7 rounded-full bg-emerald-400/15 backdrop-blur-md border border-emerald-400/30 animate-pulse" />
        </div>
        <p className="mt-4 text-xs font-bold text-white/70 tracking-wide animate-pulse">
          جاري التحميل...
        </p>
      </div>

      {/* Subtle Bottom Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-2xl p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 rounded bg-white/10" />
              <div className="w-8 h-8 rounded-lg bg-white/5" />
            </div>
            <div className="h-7 w-20 rounded-lg bg-white/10" />
            <div className="h-2.5 w-full rounded-full bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

