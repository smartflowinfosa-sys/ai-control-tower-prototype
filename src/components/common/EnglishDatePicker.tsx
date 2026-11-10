"use client";

import React, { type CSSProperties } from 'react';
import { Calendar, X } from 'lucide-react';

export interface EnglishDatePickerProps {
  value: string; // ISO date string: YYYY-MM-DD or empty
  onChange: (isoDate: string) => void;
  placeholder?: string; // Default: 'dd/mm/yyyy'
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  iconColor?: string;
  focusRingClass?: string;
  allowClear?: boolean;
  id?: string;
  name?: string;
}

const toEnglishDigits = (val: string): string => {
  return String(val || '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .trim();
};

const formatToDdMmYyyy = (iso: string): string => {
  if (!iso) return '';
  const clean = toEnglishDigits(iso).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return clean;
};

export default function EnglishDatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  min,
  max,
  disabled = false,
  className = '',
  iconColor = 'text-emerald-300',
  focusRingClass = 'focus-within:ring-2 focus-within:ring-emerald-400/50',
  allowClear = true,
  id,
  name,
}: EnglishDatePickerProps) {
  const displayDate = formatToDdMmYyyy(value);

  const englishNumericStyle: CSSProperties = {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    fontFeatureSettings: '"locl" 0, "lnum" 1, "tnum" 1',
    fontVariantNumeric: 'lining-nums tabular-nums',
    direction: 'ltr',
  };

  return (
    <div
      className={`relative flex items-center justify-between border rounded-xl px-3 py-2 transition-all select-none ${
        disabled
          ? 'bg-black/20 border-white/10 opacity-50 cursor-not-allowed'
          : `bg-black/40 hover:bg-black/50 border-white/20 ${focusRingClass} cursor-pointer`
      } ${className}`}
      style={englishNumericStyle}
      dir="ltr"
    >
      <div className="flex items-center gap-2 overflow-hidden pointer-events-none">
        <Calendar className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />
        <span
          className={`font-mono text-xs sm:text-sm font-bold tracking-wider tabular-nums ${
            displayDate ? 'text-white' : 'text-white/40'
          }`}
          style={englishNumericStyle}
          dir="ltr"
        >
          {displayDate || placeholder}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {allowClear && !!value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange('');
            }}
            className="z-10 p-1 rounded-md text-white/40 hover:text-rose-300 hover:bg-white/10 transition-colors cursor-pointer"
            title="مسح التاريخ"
            aria-label="مسح التاريخ"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* The invisible native date input overlayed across the entire container */}
      <input
        type="date"
        id={id}
        name={name}
        dir="ltr"
        lang="en-US"
        value={value || ''}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const raw = toEnglishDigits(e.target.value);
          onChange(raw);
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed [color-scheme:dark]"
        tabIndex={disabled ? -1 : 0}
        aria-label={placeholder}
      />
    </div>
  );
}

