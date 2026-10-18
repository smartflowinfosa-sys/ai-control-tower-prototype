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
    <div className="glass kpi-card flex flex-col justify-between transition-all duration-200 group cursor-default hover:bg-white/15">
      <h3 className="kpi-title font-bold">{title}</h3>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="kpi-value font-extrabold">
          {toEnglishDigits(value)}
        </span>
        {subtitle && (
          <span className="kpi-subtitle font-semibold">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
