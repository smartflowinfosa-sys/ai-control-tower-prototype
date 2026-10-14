"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotification } from '@/components/common/NotificationContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { notifications } = useNotification();
  const [profileOpen, setProfileOpen] = useState(false);
  
  const pendingCount = notifications.filter(n => n.status === 'pending').length;

  return (
    <aside className="w-64 bg-white/40 backdrop-blur-2xl border-l border-white/60 shadow-[4px_0_24px_rgb(0,0,0,0.02)] flex flex-col p-6 relative z-20">
      <div className="mb-8">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-sky-600 to-teal-600">
          AI Control Tower
        </h1>
        <p className="text-xs text-teal-700 mt-1.5 font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse shadow-sm shadow-teal-500/50"></span>
          برج مراقبة زاهي (Zahi)
        </p>
      </div>
      
      <nav className="flex-1 space-y-2">
        <Link 
          href="/" 
          className={`block px-4 py-3 rounded-xl transition-all ${
            pathname === '/' 
              ? 'bg-white/60 text-sky-600 font-bold shadow-sm border border-white/60' 
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/40 font-medium'
          }`}
        >
          الرئيسية (Dashboard)
        </Link>
        <Link 
          href="/exceptions" 
          className={`block px-4 py-3 rounded-xl transition-all ${
            pathname === '/exceptions' 
              ? 'bg-rose-500/10 text-rose-600 border border-rose-300/40 font-bold shadow-sm' 
              : 'text-rose-600/80 hover:text-rose-700 hover:bg-white/40 font-medium'
          }`}
        >
          مركز الاستثناءات (Exceptions)
        </Link>
        <Link 
          href="/notifications" 
          className={`px-4 py-3 rounded-xl transition-all flex justify-between items-center ${
            pathname === '/notifications' 
              ? 'bg-white/60 text-sky-600 font-bold shadow-sm border border-white/60' 
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/40 font-medium'
          }`}
        >
          <span>الإشعارات (Notifications)</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pendingCount > 0 ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-200/80 text-slate-600'}`}>
            {pendingCount}
          </span>
        </Link>
        <Link 
          href="/orders" 
          className={`block px-4 py-3 rounded-xl transition-all ${
            pathname === '/orders' 
              ? 'bg-white/60 text-sky-600 font-bold shadow-sm border border-white/60' 
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/40 font-medium'
          }`}
        >
          الطلبات (Orders)
        </Link>
        <Link 
          href="/production" 
          className={`block px-4 py-3 rounded-xl transition-all ${
            pathname === '/production' 
              ? 'bg-white/60 text-sky-600 font-bold shadow-sm border border-white/60' 
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/40 font-medium'
          }`}
        >
          الإنتاج (Production)
        </Link>
        <Link 
          href="/inventory" 
          className={`block px-4 py-3 rounded-xl transition-all ${
            pathname === '/inventory' 
              ? 'bg-white/60 text-sky-600 font-bold shadow-sm border border-white/60' 
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/40 font-medium'
          }`}
        >
          إدارة المخزون (Inventory)
        </Link>
        <Link 
          href="/suppliers" 
          className={`block px-4 py-3 rounded-xl transition-all ${
            pathname === '/suppliers' 
              ? 'bg-white/60 text-sky-600 font-bold shadow-sm border border-white/60' 
              : 'text-slate-700 hover:text-slate-900 hover:bg-white/40 font-medium'
          }`}
        >
          الموردين (Suppliers)
        </Link>
      </nav>
      
      <div className="mt-auto pt-6 border-t border-slate-200/60 relative">
        {/* Drop-up Menu */}
        {profileOpen && (
          <div className="absolute bottom-full mb-3 left-0 w-full bg-white/95 backdrop-blur-2xl rounded-2xl shadow-xl border border-white/80 overflow-hidden transform transition-all z-30">
            <button className="w-full text-right px-4 py-3 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center gap-2 font-medium">
              <span>⚙️</span> إعدادات الوكيل الذكي
            </button>
            <button className="w-full text-right px-4 py-3 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center gap-2 font-medium">
              <span>👤</span> الملف الشخصي
            </button>
            <div className="border-t border-slate-100"></div>
            <button className="w-full text-right px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2 font-medium">
              <span>🚪</span> تسجيل الخروج
            </button>
          </div>
        )}

        <button 
          onClick={() => setProfileOpen(!profileOpen)}
          className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl transition-all text-right border ${profileOpen ? 'bg-white/70 border-white/80 shadow-sm' : 'bg-white/30 hover:bg-white/60 border-white/50'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-teal-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              OP
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800">مدير العمليات</div>
              <div className="text-[10px] text-teal-600 font-semibold flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse shadow-sm shadow-teal-500/50"></span> متصل (Online)
              </div>
            </div>
          </div>
          <span className="text-slate-400 text-xs transition-transform">{profileOpen ? '▼' : '▲'}</span>
        </button>
      </div>
    </aside>
  );
}
