"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotification } from '@/components/common/NotificationContext';
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  AlertTriangle, 
  Bell, 
  ShoppingBag, 
  ChefHat, 
  Package, 
  Truck 
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
  ];

  return (
    <>
      {/* Mobile Hamburger Menu Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-white/70 backdrop-blur-md border border-white/60 rounded-xl shadow-sm text-teal-600"
        aria-label="فتح القائمة الجانبية"
      >
        <Menu size={24}/>
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* The Aside Container (Collapsible on Desktop, Off-canvas on Mobile) */}
      <aside 
        className={`fixed inset-y-0 right-0 z-50 ${
          isCollapsed ? 'md:w-20 md:p-3' : 'md:w-64 md:p-6'
        } w-64 p-6 bg-white/60 backdrop-blur-2xl border-l border-white/60 shadow-[4px_0_24px_rgb(0,0,0,0.05)] flex flex-col overflow-y-auto transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header: Logo & Collapse Buttons */}
        <div className={`flex items-center ${isCollapsed ? 'md:flex-col md:gap-3 md:justify-center' : 'justify-between'} mb-8`}>
          <div className={isCollapsed ? 'md:hidden' : 'block'}>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-sky-600 to-teal-600 truncate">
              AI Control Tower
            </h1>
            <p className="text-xs text-teal-700 mt-1.5 font-semibold flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse shadow-sm shadow-teal-500/50 shrink-0"></span>
              برج مراقبة زاهي (Zahi)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Desktop Hamburger Collapse Toggle */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex p-2 text-teal-600 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl shadow-sm hover:bg-teal-50 transition-colors cursor-pointer items-center justify-center"
              title={isCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
              aria-label={isCollapsed ? "توسيع القائمة" : "طي القائمة"}
            >
              <Menu size={20}/>
            </button>

            {/* Mobile Close Button */}
            <button 
              onClick={() => setIsOpen(false)} 
              className="md:hidden text-slate-500 hover:text-rose-500 transition-colors p-1"
              aria-label="إغلاق القائمة الجانبية"
            >
              <X size={24}/>
            </button>
          </div>
        </div>
        
        {/* Navigation Items */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const isExceptions = item.href === '/exceptions';

            let activeClass = '';
            if (isActive) {
              activeClass = isExceptions
                ? 'bg-rose-500/10 text-rose-600 border border-rose-300/40 font-bold shadow-sm'
                : 'bg-white/60 text-sky-600 font-bold shadow-sm border border-white/60';
            } else {
              activeClass = isExceptions
                ? 'text-rose-600/80 hover:text-rose-700 hover:bg-white/40 font-medium'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/40 font-medium';
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                title={item.label}
                className={`flex items-center ${
                  isCollapsed ? 'md:justify-center md:px-2 md:py-3 px-4 py-3' : 'justify-between px-4 py-3'
                } rounded-xl transition-all duration-200 group relative ${activeClass}`}
              >
                <div className={`flex items-center ${isCollapsed ? 'md:gap-0 gap-3' : 'gap-3'} min-w-0`}>
                  <Icon className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" />
                  <span className={`${isCollapsed ? 'md:hidden' : 'block'} text-sm truncate`}>
                    {item.label}
                  </span>
                </div>

                {item.href === '/notifications' && (
                  <span 
                    className={`${isCollapsed ? 'md:hidden' : 'inline-flex'} text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      pendingCount > 0 ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {pendingCount}
                  </span>
                )}

                {/* Collapsed notification indicator dot on desktop */}
                {isCollapsed && item.href === '/notifications' && pendingCount > 0 && (
                  <span className="hidden md:block absolute top-2 left-2 w-2 h-2 rounded-full bg-teal-500 ring-2 ring-white animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>
        
        {/* Profile Footer */}
        <div className="mt-auto pt-6 border-t border-slate-200/60 relative">
          {/* Drop-up Menu */}
          {profileOpen && (
            <div className={`absolute bottom-full mb-3 right-0 ${isCollapsed ? 'md:w-48 md:-right-2' : 'w-full'} bg-white/95 backdrop-blur-2xl rounded-2xl shadow-xl border border-white/80 overflow-hidden transform transition-all z-30`}>
              <button className="w-full text-right px-4 py-3 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center gap-2 font-medium">
                <span>⚙️</span> <span className="truncate">إعدادات الوكيل الذكي</span>
              </button>
              <button className="w-full text-right px-4 py-3 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center gap-2 font-medium">
                <span>👤</span> <span className="truncate">الملف الشخصي</span>
              </button>
              <div className="border-t border-slate-100"></div>
              <button className="w-full text-right px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2 font-medium">
                <span>🚪</span> <span className="truncate">تسجيل الخروج</span>
              </button>
            </div>
          )}

          <button 
            onClick={() => setProfileOpen(!profileOpen)}
            className={`w-full flex items-center ${isCollapsed ? 'md:justify-center md:p-2' : 'justify-between p-2.5'} rounded-xl transition-all text-right border ${profileOpen ? 'bg-white/70 border-white/80 shadow-sm' : 'bg-white/30 hover:bg-white/60 border-white/50'}`}
            title="مدير العمليات"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-teal-500 text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
                OP
              </div>
              <div className={isCollapsed ? 'md:hidden' : 'block'}>
                <div className="text-sm font-bold text-slate-800 truncate">مدير العمليات</div>
                <div className="text-[10px] text-teal-600 font-semibold flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse shadow-sm shadow-teal-500/50"></span> متصل (Online)
                </div>
              </div>
            </div>
            <span className={`${isCollapsed ? 'md:hidden' : 'block'} text-slate-400 text-xs transition-transform`}>
              {profileOpen ? '▼' : '▲'}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
