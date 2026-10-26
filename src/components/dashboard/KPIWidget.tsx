export interface KPIWidgetProps {
  title: string;
  value: string | number;
  colorClass?: string;
  subtitle?: string;
}

// Ensure numbers are displayed with English digits (0-9)
const toEnglishDigits = (str: string | number): string => {
  if (str === null || str === undefined) return '';
  if (typeof str === 'number') {
    return str.toLocaleString('en-US');
  }
  return String(str).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

export default function KPIWidget({ title, value, subtitle }: KPIWidgetProps) {
  return (
    <div className="bg-white/[0.06] backdrop-blur-[2px] backdrop-saturate-[1.1] border border-white/[0.24] shadow-[0_6px_20px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.20)] rounded-2xl text-white p-6 flex flex-col justify-between transition-all duration-200 group cursor-default min-h-[140px] hover:bg-white/[0.09] hover:border-white/[0.32]">
      <h3 className="text-slate-100 font-bold text-sm drop-shadow-sm">{title}</h3>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl md:text-5xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
          {toEnglishDigits(value)}
        </span>
        {subtitle && (
          <span className="text-xs text-slate-100 font-semibold drop-shadow-sm">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
