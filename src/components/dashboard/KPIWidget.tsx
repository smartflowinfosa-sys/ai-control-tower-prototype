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
    <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.15)] rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 group cursor-default min-h-[140px]">
      <h3 className="text-slate-50 font-bold text-sm drop-shadow-sm">{title}</h3>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl md:text-5xl font-extrabold text-white font-mono tracking-tight drop-shadow-sm">
          {toEnglishDigits(value)}
        </span>
        {subtitle && (
          <span className="text-xs text-white/80 font-semibold drop-shadow-sm">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
