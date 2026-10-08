export interface KPIWidgetProps {
  title: string;
  value: string | number;
  colorClass?: string;
  subtitle?: string;
}

export default function KPIWidget({ title, value, colorClass = "text-gray-900", subtitle }: KPIWidgetProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
      <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${colorClass}`}>{value}</span>
        {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
      </div>
    </div>
  );
}
