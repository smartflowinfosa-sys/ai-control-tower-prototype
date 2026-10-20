"use client";

import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface GlassSelectOption {
  value: string | number;
  label: string | React.ReactNode;
}

export interface GlassSelectProps {
  value?: string | number;
  onChange?: (e: { target: { value: string; name?: string } } | any) => void;
  options?: GlassSelectOption[];
  children?: React.ReactNode;
  placeholder?: string;
  className?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
}

export default function GlassSelect({
  value,
  onChange,
  options,
  children,
  placeholder = 'اختر...',
  className = '',
  name,
  id,
  disabled = false,
  required = false,
  ariaLabel,
}: GlassSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({
    left: 0,
    width: 0,
    maxHeight: 280,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;
  const listboxId = `${selectId}-listbox`;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Parse options from either `options` prop or `children` (<option> tags)
  const parsedOptions: GlassSelectOption[] = useMemo(() => {
    if (options && options.length > 0) {
      return options.map((opt) => ({
        value: opt.value,
        label: opt.label !== undefined && opt.label !== null ? opt.label : String(opt.value),
      }));
    }

    const extracted: GlassSelectOption[] = [];
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === 'option') {
        const childProps = child.props as { value?: string | number; children?: React.ReactNode };
        extracted.push({
          value: childProps.value ?? '',
          label: childProps.children ?? childProps.value ?? '',
        });
      } else if (child.props && (child.props as { children?: React.ReactNode }).children) {
        React.Children.forEach((child.props as { children?: React.ReactNode }).children, (nestedChild) => {
          if (React.isValidElement(nestedChild) && nestedChild.type === 'option') {
            const nestedProps = nestedChild.props as { value?: string | number; children?: React.ReactNode };
            extracted.push({
              value: nestedProps.value ?? '',
              label: nestedProps.children ?? nestedProps.value ?? '',
            });
          }
        });
      }
    });

    return extracted;
  }, [options, children]);

  // Find selected option
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null) return undefined;
    return parsedOptions.find((opt) => String(opt.value) === String(value));
  }, [parsedOptions, value]);

  const selectedLabel = selectedOption
    ? selectedOption.label
    : value !== undefined && value !== null && value !== ''
    ? String(value)
    : placeholder;

  // Calculate coordinates for fixed portal positioning (always opens downwards as Drop-down)
  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const maxHeight = Math.min(320, Math.max(140, spaceBelow - 16));

    setCoords({
      top: rect.bottom + 6,
      bottom: undefined,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
      maxHeight,
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    // Listen to resize and any scroll event (capture mode handles nested overflow containers)
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  // Handle outside clicks
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (buttonRef.current && buttonRef.current.contains(target)) return;
      if (menuRef.current && menuRef.current.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen]);

  // Set initial highlighted index on open
  useEffect(() => {
    if (isOpen) {
      const currentIndex = parsedOptions.findIndex((opt) => String(opt.value) === String(value));
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  }, [isOpen, parsedOptions, value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && menuRef.current && highlightedIndex >= 0) {
      const items = menuRef.current.querySelectorAll<HTMLElement>('[role="option"]');
      const item = items[highlightedIndex];
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (optionValue: string | number) => {
    if (onChange) {
      const syntheticEvent = {
        target: {
          value: String(optionValue),
          name: name || '',
        },
      };
      onChange(syntheticEvent);
    }
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % parsedOptions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + parsedOptions.length) % parsedOptions.length);
        break;
      case 'Home':
        e.preventDefault();
        setHighlightedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlightedIndex(parsedOptions.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < parsedOptions.length) {
          handleSelect(parsedOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="relative inline-block w-full">
      {/* Hidden input for forms */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value !== undefined && value !== null ? String(value) : ''}
          required={required}
        />
      )}

      {/* Closed Button Trigger */}
      <button
        ref={buttonRef}
        type="button"
        id={selectId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`flex items-center justify-between gap-2 text-right transition-all select-none ${className} ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span className="truncate flex-1 text-right">{selectedLabel}</span>
        <ChevronDown
          className={`w-4 h-4 text-white/65 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Open Dropdown Menu Portal */}
      {mounted &&
        isOpen &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            dir="rtl"
            aria-label={ariaLabel}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            style={{
              position: 'fixed',
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              left: `${coords.left}px`,
              minWidth: `${coords.width}px`,
              maxHeight: `${coords.maxHeight}px`,
              zIndex: 99999,
            }}
            className="bg-zinc-950/95 border border-white/20 shadow-2xl rounded-2xl p-1.5 overflow-y-auto overflow-x-hidden space-y-1 animate-in fade-in slide-in-from-top-2 zoom-in-95 duration-150"
          >
            {parsedOptions.length === 0 ? (
              <div className="py-2.5 px-3.5 text-center text-xs text-white/60">لا توجد خيارات</div>
            ) : (
              parsedOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={`${opt.value}-${idx}`}
                    role="option"
                    id={`${listboxId}-option-${idx}`}
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`flex items-center justify-between gap-2 rounded-xl py-2.5 px-3.5 text-sm text-right cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-white/20 border border-white/30 font-bold text-white'
                        : isHighlighted
                        ? 'bg-white/10 text-white'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="truncate flex-1">{opt.label}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-white shrink-0 ml-1.5" aria-hidden="true" />
                    )}
                  </div>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
