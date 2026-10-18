"use client";

import { useState, useRef, type FocusEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotification } from '@/components/common/NotificationContext';
import { Menu, X, PanelLeft, LayoutDashboard, AlertTriangle, Bell, ShoppingBag, ChefHat, Package, Truck, PackageSearch } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { notifications } = useNotification();
  const [profileOpen, setProfileOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [tooltip, setTooltip] = useState<{ label: string; top: number; right: number } | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
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

  const showTooltip = (event: MouseEvent<HTMLAnchorElement> | FocusEvent<HTMLAnchorElement>, label: string) => {
    if (!isCollapsed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2, right: window.innerWidth - rect.left + 16 });
  };
  const closeDrawer = () => { setIsOpen(false); menuButton.current?.focus(); };

  return (
    <>
      <button ref={menuButton} onClick={() => setIsOpen(true)} aria-expanded={isOpen} aria-controls="mobile-navigation"
        className="md:hidden fixed top-4 right-4 z-40 p-3 glass text-white cursor-pointer" aria-label="فتح القائمة الجانبية">
        <Menu size={22} />
      </button>
      {isOpen && <div className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={closeDrawer} />}
      <div id="mobile-navigation" inert={!isOpen} aria-hidden={!isOpen}
        onTransitionEnd={event => { if (isOpen && event.target === event.currentTarget && event.propertyName === "right") closeButton.current?.focus(); }}
        onKeyDown={event => {
          if (event.key === 'Escape') closeDrawer();
          if (event.key === 'Tab') {
            const controls = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button');
            const first = controls[0]; const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}
        className={`mobile-drawer glass-popover md:hidden fixed inset-y-4 z-50 w-80 p-6 flex flex-col justify-between transition-[right] duration-200 ${isOpen ? 'right-4' : '-right-96'}`}>
        <div>
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/20 gap-2">
            <div className="flex items-center gap-3">
              <div className="sidebar-brand shrink-0 flex items-center justify-center font-extrabold">Z</div>
              <div><h3 className="font-extrabold text-sm">Zahi Control System</h3><p className="text-[10px] text-white/65 font-semibold">نظام إدارة العمليات</p></div>
            </div>
            <button ref={closeButton} onClick={closeDrawer} aria-label="إغلاق القائمة الجانبية" className="p-2 rounded-xl hover:bg-white/10 cursor-pointer"><X size={20} /></button>
          </div>
          <nav className="flex flex-col gap-2" aria-label="القائمة الرئيسية">
            {navItems.map(item => {
              const Icon = item.icon; const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
              return <Link key={item.href} href={item.href} onClick={closeDrawer} aria-current={isActive ? 'page' : undefined}
                className="sidebar-link flex items-center gap-3 px-3 py-3 text-sm font-bold">
                <Icon className="w-5 h-5 shrink-0" /><span className="flex-1">{item.label}</span>
                {item.href === '/notifications' && pendingCount > 0 && <span className="text-xs bg-teal-600 text-white font-bold px-2 py-0.5 rounded-full">{pendingCount}</span>}
              </Link>;
            })}
          </nav>
        </div>
        <div className="pt-4 mt-4 border-t border-white/20 text-xs flex items-center justify-between"><span className="font-bold">مدير العمليات</span><span className="w-2.5 h-2.5 rounded-full bg-teal-500" /></div>
      </div>

      <aside className={`desktop-sidebar glass hidden md:flex flex-col select-none ${isCollapsed ? 'is-collapsed' : ''}`} onKeyDown={event => { if (event.key === 'Escape') { setTooltip(null); setProfileOpen(false); } }}>
        <div className="sidebar-header">
          <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-4' : 'justify-between gap-2'}`}>
            <div className="flex items-center gap-3">
              <div className="sidebar-brand flex items-center justify-center shrink-0 font-extrabold text-lg">Z</div>
              {!isCollapsed && <div><h3 className="font-extrabold text-sm leading-tight">Zahi Control System</h3><p className="text-[10px] text-white/65 font-semibold mt-1 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />نظام إدارة العمليات</p></div>}
            </div>
            <button type="button" onClick={() => { setIsCollapsed(!isCollapsed); setTooltip(null); }}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-expanded={!isCollapsed} aria-controls="desktop-navigation"
              title={isCollapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'} aria-label={isCollapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}>
              {isCollapsed ? <Menu size={24} /> : <PanelLeft size={20} />}
            </button>
          </div>
        </div>
        <nav id="desktop-navigation" className="sidebar-nav flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden" aria-label="القائمة الرئيسية" onScroll={() => setTooltip(null)}>
          {navItems.map(item => {
            const Icon = item.icon; const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
            return <Link key={item.href} href={item.href} aria-label={item.label} aria-current={isActive ? 'page' : undefined}
              onMouseEnter={event => showTooltip(event, item.label)} onMouseLeave={() => setTooltip(null)}
              onFocus={event => showTooltip(event, item.label)} onBlur={() => setTooltip(null)} onClick={() => setTooltip(null)}
              className={`sidebar-link relative flex items-center w-full transition-colors cursor-pointer ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-3 text-sm font-semibold'}`}>
              <div className="relative shrink-0 flex items-center justify-center">
                <Icon />
                {item.href === '/notifications' && pendingCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-teal-500 ring-2 ring-white/80" />}
              </div>
              {!isCollapsed && <span className="flex-1 leading-relaxed">{item.label}</span>}
            </Link>;
          })}
        </nav>
        <div className="sidebar-profile">
          {profileOpen && <div className={`glass-popover glass-dropdown absolute bottom-full mb-3 p-1.5 z-50 ${isCollapsed ? 'w-56 right-full mr-3' : 'w-full right-0'}`}>
            <button className="w-full text-right px-3 py-2 text-xs font-bold hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2"><span>⚙️</span><span>إعدادات الوكيل الذكي</span></button>
            <button className="w-full text-right px-3 py-2 text-xs font-bold hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2"><span>👤</span><span>الملف الشخصي</span></button>
            <div className="border-t border-white/20 my-1" />
            <button className="w-full text-right px-3 py-2 text-xs text-rose-200 font-bold hover:bg-rose-500/15 rounded-xl transition-colors flex items-center gap-2"><span>🚪</span><span>تسجيل الخروج</span></button>
          </div>}
          <button type="button" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}
            className={`profile-button glass-inset w-full flex items-center rounded-[20px] hover:bg-white/15 transition-colors cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-between p-2'}`} title="مدير العمليات" aria-label="مدير العمليات">
            <div className="flex items-center gap-2.5">
              <div className="profile-avatar rounded-full flex items-center justify-center font-bold text-sm shrink-0">OP</div>
              {!isCollapsed && <div className="text-right"><div className="text-xs font-extrabold">مدير العمليات</div><div className="text-[10px] font-semibold text-white/65">متصل (Online)</div></div>}
            </div>
            {!isCollapsed && <span className="w-2 h-2 rounded-full bg-teal-500" />}
          </button>
        </div>
      </aside>
      {tooltip && createPortal(<div role="tooltip" className="sidebar-tooltip glass-popover" style={{top: tooltip.top, right: tooltip.right}}>{tooltip.label}</div>, document.body)}
    </>
  );
}
