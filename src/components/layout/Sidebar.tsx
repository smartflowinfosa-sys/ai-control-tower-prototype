"use client";

import { useState, useRef, type FocusEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotification } from '@/components/common/NotificationContext';
import { useLanguage } from '@/components/common/LanguageContext';
import UserProfileModal from '@/components/common/UserProfileModal';
import { Menu, X, PanelLeft, LayoutDashboard, AlertTriangle, Bell, ShoppingBag, ChefHat, Package, Truck, PackageSearch } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { notifications } = useNotification();
  const { lang, currentUser, t, isRtl } = useLanguage();
  const [profileOpen, setProfileOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [tooltip, setTooltip] = useState<{ label: string; top: number; right?: number; left?: number } | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const pendingCount = notifications.filter(n => n.status === 'pending').length;

  const navItems = [
    { href: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
    { href: '/exceptions', labelKey: 'nav.exceptions', icon: AlertTriangle },
    { href: '/notifications', labelKey: 'nav.notifications', icon: Bell },
    { href: '/orders', labelKey: 'nav.orders', icon: ShoppingBag },
    { href: '/production', labelKey: 'nav.production', icon: ChefHat },
    { href: '/inventory', labelKey: 'nav.inventory', icon: Package },
    { href: '/suppliers', labelKey: 'nav.suppliers', icon: Truck },
    { href: '/supplier-discovery', labelKey: 'nav.discovery', icon: PackageSearch },
  ];

  const showTooltip = (event: MouseEvent<HTMLAnchorElement> | FocusEvent<HTMLAnchorElement>, label: string) => {
    if (!isCollapsed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (lang === 'en') {
      setTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 16 });
    } else {
      setTooltip({ label, top: rect.top + rect.height / 2, right: window.innerWidth - rect.left + 16 });
    }
  };

  const closeDrawer = () => { setIsOpen(false); menuButton.current?.focus(); };
  const currentDisplayName = lang === 'ar' ? currentUser.name_ar : currentUser.name_en;

  return (
    <>
      {/* Mobile Hamburger Toggle Button */}
      <button
        ref={menuButton}
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls="mobile-navigation"
        className={`md:hidden fixed top-4 ${isRtl ? 'right-4' : 'left-4'} z-40 p-3 glass text-white cursor-pointer rounded-2xl shadow-lg`}
        aria-label={t('sidebar.openNav')}
      >
        <Menu size={22} />
      </button>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={closeDrawer}
        />
      )}

      {/* Mobile Navigation Drawer */}
      <div
        id="mobile-navigation"
        inert={!isOpen}
        aria-hidden={!isOpen}
        onTransitionEnd={(event) => {
          if (isOpen && event.target === event.currentTarget && (event.propertyName === "right" || event.propertyName === "left")) {
            closeButton.current?.focus();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') closeDrawer();
          if (event.key === 'Tab') {
            const controls = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button');
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
        className={`mobile-drawer glass-popover md:hidden fixed inset-y-4 z-50 w-80 p-6 flex flex-col justify-between transition-all duration-200 ${
          isRtl
            ? isOpen ? 'right-4' : '-right-96'
            : isOpen ? 'left-4' : '-left-96'
        }`}
      >
        <div>
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/20 gap-2">
            <div className="flex items-center gap-3">
              <div className="sidebar-brand shrink-0 flex items-center justify-center font-extrabold text-white">Z</div>
              <div>
                <h3 className="font-extrabold text-sm text-white">Zahi Control System</h3>
                <p className="text-[10px] text-white/65 font-semibold">{t('brand.subtitle')}</p>
              </div>
            </div>
            <button
              ref={closeButton}
              onClick={closeDrawer}
              aria-label={t('sidebar.closeNav')}
              className="p-2 rounded-xl hover:bg-white/10 text-white cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex flex-col gap-2" aria-label={t('sidebar.mainMenu')}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const label = t(item.labelKey);
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeDrawer}
                  aria-current={isActive ? 'page' : undefined}
                  className="sidebar-link flex items-center gap-3 px-3 py-3 text-sm font-bold text-white hover:bg-white/10 rounded-2xl"
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {item.href === '/notifications' && pendingCount > 0 && (
                    <span className="text-xs bg-teal-600 text-white font-bold px-2 py-0.5 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Mobile Profile Trigger */}
        <div className="pt-4 mt-4 border-t border-white/20 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              closeDrawer();
              setIsProfileModalOpen(true);
            }}
            className="flex items-center gap-2.5 text-xs text-white hover:text-teal-200 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/30 flex items-center justify-center font-bold text-xs">
              {currentUser.avatar}
            </div>
            <div className={isRtl ? 'text-right' : 'text-left'}>
              <div className="font-bold">{currentDisplayName}</div>
              <div className="text-[10px] text-white/60">{t('sidebar.userProfile')}</div>
            </div>
          </button>
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
        </div>
      </div>

      {/* Desktop Main Glass Sidebar */}
      <aside
        className={`desktop-sidebar glass hidden md:flex flex-col select-none ${isCollapsed ? 'is-collapsed' : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setTooltip(null);
            setProfileOpen(false);
          }
        }}
      >
        <div className="sidebar-header">
          <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-4' : 'justify-between gap-2'}`}>
            <div className="flex items-center gap-3">
              <div className="sidebar-brand flex items-center justify-center shrink-0 font-extrabold text-lg text-white">
                Z
              </div>
              {!isCollapsed && (
                <div>
                  <h3 className="font-extrabold text-sm leading-tight text-white">Zahi Control System</h3>
                  <p className="text-[10px] text-white/65 font-semibold mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                    {t('brand.subtitle')}
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsCollapsed(!isCollapsed);
                setTooltip(null);
              }}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0 text-white"
              aria-expanded={!isCollapsed}
              aria-controls="desktop-navigation"
              title={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
              aria-label={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            >
              {isCollapsed ? <Menu size={24} /> : <PanelLeft size={20} />}
            </button>
          </div>
        </div>

        <nav
          id="desktop-navigation"
          className="sidebar-nav flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden"
          aria-label={t('sidebar.mainMenu')}
          onScroll={() => setTooltip(null)}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const label = t(item.labelKey);
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                onMouseEnter={(event) => showTooltip(event, label)}
                onMouseLeave={() => setTooltip(null)}
                onFocus={(event) => showTooltip(event, label)}
                onBlur={() => setTooltip(null)}
                onClick={() => setTooltip(null)}
                className={`sidebar-link relative flex items-center w-full transition-colors cursor-pointer ${
                  isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-3 text-sm font-semibold'
                }`}
              >
                <div className="relative shrink-0 flex items-center justify-center">
                  <Icon />
                  {item.href === '/notifications' && pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-teal-500 ring-2 ring-white/80" />
                  )}
                </div>
                {!isCollapsed && <span className="flex-1 leading-relaxed">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Trigger Area with Drop-Up Menu */}
        <div className="sidebar-profile">
          {profileOpen && (
            <div
              className={`glass-popover bg-slate-900/80 backdrop-blur-2xl border border-white/30 shadow-2xl absolute bottom-full mb-3 p-1.5 z-[100] ${
                isCollapsed
                  ? isRtl ? 'w-60 right-full mr-3' : 'w-60 left-full ml-3'
                  : 'w-full right-0 left-0'
              }`}
            >
              {/* Profile Button: Opens User Profile Modal */}
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  setIsProfileModalOpen(true);
                }}
                className={`w-full ${isRtl ? 'text-right' : 'text-left'} px-3 py-2.5 text-xs font-bold hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer text-white`}
              >
                <span className="text-sm">👤</span>
                <span className="flex-1">{t('sidebar.userProfile')}</span>
                <span className="text-[10px] bg-teal-500/20 text-teal-200 border border-teal-300/30 px-2 py-0.5 rounded-full font-mono font-bold">
                  {lang.toUpperCase()}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className={`w-full ${isRtl ? 'text-right' : 'text-left'} px-3 py-2 text-xs font-bold hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2 cursor-pointer text-white/80`}
              >
                <span>⚙️</span>
                <span>{t('sidebar.agentSettings')}</span>
              </button>

              <div className="border-t border-white/20 my-1" />

              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className={`w-full ${isRtl ? 'text-right' : 'text-left'} px-3 py-2 text-xs text-rose-200 font-bold hover:bg-rose-500/15 rounded-xl transition-colors flex items-center gap-2 cursor-pointer`}
              >
                <span>🚪</span>
                <span>{t('sidebar.logout')}</span>
              </button>
            </div>
          )}

          {/* Profile Trigger Button */}
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-expanded={profileOpen}
            className={`profile-button glass-inset w-full flex items-center rounded-[20px] hover:bg-white/15 transition-colors cursor-pointer ${
              isCollapsed ? 'justify-center' : 'justify-between p-2'
            }`}
            title={currentDisplayName}
            aria-label={currentDisplayName}
          >
            <div className="flex items-center gap-2.5">
              <div className="profile-avatar rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white">
                {currentUser.avatar}
              </div>
              {!isCollapsed && (
                <div className={isRtl ? 'text-right' : 'text-left'}>
                  <div className="text-xs font-extrabold text-white">{currentDisplayName}</div>
                  <div className="text-[10px] font-semibold text-white/65">{t('status.online')}</div>
                </div>
              )}
            </div>
            {!isCollapsed && <span className="w-2 h-2 rounded-full bg-teal-500" />}
          </button>
        </div>
      </aside>

      {/* Tooltip Portal */}
      {tooltip &&
        createPortal(
          <div
            role="tooltip"
            className="sidebar-tooltip glass-popover"
            style={{
              top: tooltip.top,
              right: tooltip.right !== undefined ? `${tooltip.right}px` : undefined,
              left: tooltip.left !== undefined ? `${tooltip.left}px` : undefined,
            }}
          >
            {tooltip.label}
          </div>,
          document.body
        )}

      {/* Interactive User Profile & Language Switcher Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
}
