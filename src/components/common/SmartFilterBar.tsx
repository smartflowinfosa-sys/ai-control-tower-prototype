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
    <div className="flex flex-wrap items-center gap-6 bg-white/60 backdrop-blur-md p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 mb-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-gray-700">العلامة التجارية:</span>
        <select 
          value={selectedBrand}
          onChange={(e) => onBrandChange(e.target.value)}
          className="bg-white/80 border border-white/80 text-sky-800 font-bold text-sm rounded-xl focus:ring-sky-500 focus:border-sky-500 block p-2 outline-none min-w-[140px] cursor-pointer shadow-sm"
        >
          <option value="ALL">زاهي (Zahi) - الكل</option>
          <option value="ZAHI">زاهي (الفرع الرئيسي)</option>
        </select>
      </div>

      {showDepartment && onDepartmentChange && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-700">القسم التشغيلي:</span>
          <select 
            value={selectedDepartment}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-700 font-medium text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none min-w-[140px] cursor-pointer"
          >
            <option value="ALL">الكل (All)</option>
            <option value="KITCHEN">المطبخ (Kitchen)</option>
            <option value="PACKING">التغليف (Packing)</option>
            <option value="DELIVERY">التوصيل (Delivery)</option>
            <option value="CUSTOMER_SERVICE">خدمة العملاء</option>
          </select>
        </div>
      )}

      {showRisk && onRiskChange && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-700">مستوى الخطورة:</span>
          <select 
            value={selectedRisk}
            onChange={(e) => onRiskChange(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-700 font-medium text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none min-w-[140px] cursor-pointer"
          >
            <option value="ALL">الكل (All)</option>
            <option value="CRITICAL">حرجة (Critical)</option>
            <option value="HIGH">عالية (High)</option>
            <option value="MEDIUM">متوسطة (Medium)</option>
            <option value="LOW">بسيطة (Low)</option>
          </select>
        </div>
      )}
    </div>
  );
}
