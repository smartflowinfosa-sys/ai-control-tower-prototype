"use client";

import GlassSelect from './GlassSelect';

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
    <div className="flex flex-wrap items-center gap-6 !bg-white/5 !backdrop-blur-[8px] !border !border-white/20 shadow-lg rounded-2xl p-5 mb-6">
      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap text-sm font-bold text-white">العلامة التجارية:</span>
        <GlassSelect 
          value={selectedBrand}
          onChange={(e) => onBrandChange(e.target.value)}
          className="bg-white/5 border border-white/20 text-white font-bold text-sm rounded-xl focus:ring-1 focus:ring-white/20 p-2.5 outline-none min-w-[140px] cursor-pointer hover:bg-white/10 transition-colors"
        >
          <option value="zahi">زاهي (Zahi)</option>
        </GlassSelect>
      </div>

      {showDepartment && onDepartmentChange && (
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-sm font-bold text-white">القسم التشغيلي:</span>
          <GlassSelect 
            value={selectedDepartment}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className="bg-white/5 border border-white/20 text-white font-bold text-sm rounded-xl focus:ring-1 focus:ring-white/20 p-2.5 outline-none min-w-[140px] cursor-pointer hover:bg-white/10 transition-colors"
          >
            <option value="ALL">الكل (All)</option>
            <option value="KITCHEN">المطبخ (Kitchen)</option>
            <option value="PACKING">التغليف (Packing)</option>
            <option value="DELIVERY">التوصيل (Delivery)</option>
            <option value="CUSTOMER_SERVICE">خدمة العملاء</option>
          </GlassSelect>
        </div>
      )}

      {showRisk && onRiskChange && (
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-sm font-bold text-white">مستوى الخطورة:</span>
          <GlassSelect 
            value={selectedRisk}
            onChange={(e) => onRiskChange(e.target.value)}
            className="bg-white/5 border border-white/20 text-white font-bold text-sm rounded-xl focus:ring-1 focus:ring-white/20 p-2.5 outline-none min-w-[140px] cursor-pointer hover:bg-white/10 transition-colors"
          >
            <option value="ALL">الكل (All Risks)</option>
            <option value="CRITICAL">حرج (Critical)</option>
            <option value="HIGH">مرتفع (High)</option>
            <option value="MEDIUM">متوسط (Medium)</option>
            <option value="LOW">منخفض (Low)</option>
          </GlassSelect>
        </div>
      )}
    </div>
  );
}
