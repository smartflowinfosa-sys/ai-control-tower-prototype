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
    <div className="glass glass-card glass-hover rounded-[18px] p-6 flex flex-col justify-between transition-all duration-300 group cursor-default">
      <h3 className="text-white/65 text-sm font-bold">{title}</h3>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-white font-extrabold text-4xl tracking-wide font-mono">
          {toEnglishDigits(value)}
        </span>
        {subtitle && (
          <span className="text-xs text-white/65 font-semibold">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
