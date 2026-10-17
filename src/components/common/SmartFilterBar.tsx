"use client";

interface SmartFilterBarProps {
  onBrandChange: (brand: string) => void;
  onDepartmentChange?: (dept: string) => void;
  onRiskChange?: (risk: string) => void;
  selectedBrand: string;
  selectedDepartment?: string;
  selectedRisk?: string;
  showDepartment?: boolean;
  showRisk?: boolean;
}

export default function SmartFilterBar({ 
  onBrandChange, 
  onDepartmentChange,
  onRiskChange,
  selectedBrand,
  selectedDepartment,
  selectedRisk,
  showDepartment = true,
  showRisk = false
}: SmartFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-6 glass rounded-[24px] p-5 mb-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-white">العلامة التجارية:</span>
        <select 
          value={selectedBrand}
          onChange={(e) => onBrandChange(e.target.value)}
          className="glass glass-card border text-white font-bold text-sm rounded-[18px] focus:ring-1 focus:ring-white/25 focus:block p-2.5 outline-none min-w-[140px] cursor-pointer"
        >
          <option value="zahi" className="text-white">زاهي (Zahi)</option>
        </select>
      </div>

      {showDepartment && onDepartmentChange && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">القسم التشغيلي:</span>
          <select 
            value={selectedDepartment}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className="glass glass-card border text-white font-bold text-sm rounded-[18px] focus:ring-1 focus:ring-white/25 focus:block p-2.5 outline-none min-w-[140px] cursor-pointer"
          >
            <option value="ALL" className="text-white">الكل (All)</option>
            <option value="KITCHEN" className="text-white">المطبخ (Kitchen)</option>
            <option value="PACKING" className="text-white">التغليف (Packing)</option>
            <option value="DELIVERY" className="text-white">التوصيل (Delivery)</option>
            <option value="CUSTOMER_SERVICE" className="text-white">خدمة العملاء</option>
          </select>
        </div>
      )}

      {showRisk && onRiskChange && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">مستوى الخطورة:</span>
          <select 
            value={selectedRisk}
            onChange={(e) => onRiskChange(e.target.value)}
            className="glass glass-card border text-white font-bold text-sm rounded-[18px] focus:ring-1 focus:ring-white/25 focus:block p-2.5 outline-none min-w-[140px] cursor-pointer"
          >
            <option value="ALL" className="text-white">الكل (All Risks)</option>
            <option value="CRITICAL" className="text-white">حرج (Critical)</option>
            <option value="HIGH" className="text-white">مرتفع (High)</option>
            <option value="MEDIUM" className="text-white">متوسط (Medium)</option>
            <option value="LOW" className="text-white">منخفض (Low)</option>
          </select>
        </div>
      )}
    </div>
  );
}
