"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotification } from '@/components/common/NotificationContext';
import { 
  Menu, 
  X, 
  PanelLeft,
  LayoutDashboard, 
  AlertTriangle, 
  Bell, 
  ShoppingBag, 
  ChefHat, 
  Package, 
  Truck,
  PackageSearch
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { notifications } = useNotification();
  const [profileOpen, setProfileOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // Mobile drawer state
  const [isCollapsed, setIsCollapsed] = useState(false); // Desktop collapse state
  
  const pendingCount = notifications.filter(n => n.status === 'pending').length;

  const navItems = [
    { href: '/', label: 'الرئيسية (Dashboard)', icon: LayoutDashboard },
    { href: '/exceptions', label: 'مركز الاستثناءات (Exceptions)', icon: AlertTriangle },
    { href: '/notifications', label: 'الإشعارات (Notifications)', icon: Bell },
    { href: '/orders', label: 'الطلبات (Orders)', icon: ShoppingBag },
    { href: '/production', label: 'الإنتاج (Production)', icon: ChefHat },
    { href: '/inventory', label: 'إدارة المخزون (Inventory)', icon: Package },
    { href: '/suppliers', label: 'الموردين (Suppliers)', icon: Truck },
    { href: '/supplier-discovery', label: 'اكتشاف الموردين (Discovery)', icon: PackageSearch },
  ];

  return (
    <>
      {/* Mobile Floating Menu Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 right-4 z-50 p-2.5 glass rounded-[18px] text-white cursor-pointer"
        aria-label="فتح القائمة الجانبية"
      >
        <Menu size={22} className="text-white" />
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-white/[0.06] z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Floating Drawer */}
      <div 
        className={`md:hidden fixed inset-y-0 z-50 w-72 p-6 glass flex flex-col justify-between transition-[right] duration-300 ease-in-out ${
          isOpen ? "right-0" : "-right-72"
        }`}
      >
        <div>
          <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/14">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[18px] glass glass-card p-0.5 flex items-center justify-center">
                <div className="w-full h-full rounded-[18px] glass glass-card flex items-center justify-center text-white font-extrabold text-sm">
                  Z
                </div>
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">Zahi Control System</h3>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/65 hover:text-white p-1"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-[18px] transition-all text-sm ${
                    isActive
                      ? 'glass glass-active text-white font-extrabold'
                      : 'text-white/65 hover:text-white hover:bg-white/10 font-bold'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-white/65'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-white/14 text-xs text-white/65 flex items-center justify-between">
          <span className="font-bold">مدير العمليات</span>
          <span className="w-2.5 h-2.5 rounded-full bg-teal-700" />
        </div>
      </div>

      {/* Desktop Glass Sidebar (Collapsible) */}
      <aside 
        className={`hidden md:flex m-4 my-6 rounded-[24px] glass flex-col justify-between shrink-0 relative z-30 transition-all duration-300 select-none ${
          isCollapsed ? 'w-20 items-center py-6' : 'w-64 px-4 py-6'
        }`}
      >
        {/* Top Header: Brand + Collapse Toggle Button */}
        <div className="w-full flex flex-col items-center">
          <div className={`w-full flex items-center ${isCollapsed ? 'justify-center flex-col gap-3' : 'justify-between px-2 pb-5 border-b border-white/14'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[18px] glass glass-card p-0.5 flex items-center justify-center shrink-0">
                <div className="w-full h-full rounded-[18px] glass glass-card flex items-center justify-center text-white font-extrabold text-sm tracking-wider">
                  Z
                </div>
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <h3 className="font-extrabold text-sm text-white leading-tight">Zahi Control System</h3>
                </div>
              )}
            </div>

            {/* Toggle Button */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-xl text-white/65 hover:text-white hover:bg-white/10 border border-transparent transition-all cursor-pointer"
              title={isCollapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
            >
              {isCollapsed ? <Menu size={20} className="text-white/65" /> : <PanelLeft size={20} className="text-white/65" />}
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className={`w-full flex flex-col gap-1.5 my-auto ${isCollapsed ? 'items-center py-4' : 'py-3'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative group flex items-center transition-all duration-200 cursor-pointer ${
                  isCollapsed
                    ? `justify-center p-3 rounded-[18px] ${
                        isActive
                          ? 'glass glass-active text-white'
                          : 'text-white/65 hover:text-white hover:bg-white/10'
                      }`
                    : `gap-3 px-3.5 py-2.5 rounded-[18px] text-sm ${
                        isActive
                          ? 'glass glass-active text-white font-extrabold'
                          : 'text-white/65 hover:text-white hover:bg-white/10 font-bold'
                      }`
                }`}
              >
                <div className="relative shrink-0 flex items-center justify-center">
                  <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-white/65'}`} />
                  {/* Notification Badge Dot */}
                  {item.href === '/notifications' && pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-teal-700 ring-2 ring-white animate-pulse" />
                  )}
                </div>

                {!isCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}

                {/* Floating Tooltip (When Collapsed) */}
                {isCollapsed && (
                  <span className="absolute right-full mr-3 px-3 py-1.5 rounded-[18px] glass glass-active text-white text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border z-50">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Profile Avatar / User Info Card (Bottom) */}
        <div className={`relative w-full ${isCollapsed ? 'flex justify-center' : 'pt-3 border-t border-white/14'}`}>
          {profileOpen && (
            <div className="absolute bottom-full mb-3 right-0 w-48 glass rounded-[18px] p-1.5 text-white z-50 animate-in fade-in slide-in-from-bottom-2 border">
              <button className="w-full text-right px-3 py-2 text-xs text-white font-bold hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2">
                <span>⚙️</span> <span>إعدادات الوكيل الذكي</span>
              </button>
              <button className="w-full text-right px-3 py-2 text-xs text-white font-bold hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2">
                <span>👤</span> <span>الملف الشخصي</span>
              </button>
              <div className="border-t border-white/14 my-1"></div>
              <button className="w-full text-right px-3 py-2 text-xs text-rose-700 font-bold hover:bg-rose-500/15 rounded-xl transition-colors flex items-center gap-2">
                <span>🚪</span> <span>تسجيل الخروج</span>
              </button>
            </div>
          )}

          {isCollapsed ? (
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-10 h-10 rounded-full glass glass-card text-white flex items-center justify-center font-bold text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="مدير العمليات"
            >
              OP
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-full flex items-center justify-between p-2 rounded-[18px] glass glass-card glass-hover transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full glass glass-card text-white flex items-center justify-center font-bold text-xs">
                  OP
                </div>
                <div className="text-right">
                  <div className="text-xs font-extrabold text-white">مدير العمليات</div>
                  <div className="text-[10px] font-semibold text-white/65">متصل (Online)</div>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-teal-700 animate-pulse" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
