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
    <aside className="w-64 bg-gray-900 text-white p-6 flex flex-col relative z-20">
      <div className="mb-8">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-emerald-400 to-blue-500">
          AI Control Tower
        </h1>
        <p className="text-xs text-gray-400 mt-1">زاهي & موزون</p>
      </div>
      
      <nav className="flex-1 space-y-2">
        <Link href="/" className={`block px-4 py-3 rounded-lg transition-colors ${pathname === '/' ? 'bg-gray-800 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'}`}>
          الرئيسية (Dashboard)
        </Link>
        <Link href="/exceptions" className={`block px-4 py-3 rounded-lg transition-colors ${pathname === '/exceptions' ? 'bg-gray-800 text-red-400 font-bold' : 'text-red-400/80 hover:text-red-300 hover:bg-gray-800 font-medium'}`}>
          مركز الاستثناءات (Exceptions)
        </Link>
        <Link href="/notifications" className={`px-4 py-3 rounded-lg transition-colors flex justify-between items-center ${pathname === '/notifications' ? 'bg-gray-800 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'}`}>
          <span>الإشعارات (Notifications)</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pendingCount > 0 ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-700 text-gray-400'}`}>
            {pendingCount}
          </span>
        </Link>
        <Link href="/orders" className={`block px-4 py-3 rounded-lg transition-colors ${pathname === '/orders' ? 'bg-gray-800 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'}`}>
          الطلبات (Orders)
        </Link>
        <Link href="/production" className={`block px-4 py-3 rounded-lg transition-colors ${pathname === '/production' ? 'bg-gray-800 text-white font-bold' : 'text-gray-300 hover:bg-gray-800'}`}>
          الإنتاج (Production)
        </Link>
      </nav>
      
      <div className="mt-auto pt-6 border-t border-gray-800 relative">
        {/* Drop-up Menu */}
        {profileOpen && (
          <div className="absolute bottom-full mb-3 left-0 w-full bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden transform transition-all z-30">
            <button className="w-full text-right px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-2 font-medium">
              <span>⚙️</span> إعدادات الوكيل الذكي
            </button>
            <button className="w-full text-right px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-2 font-medium">
              <span>👤</span> الملف الشخصي
            </button>
            <div className="border-t border-gray-700"></div>
            <button className="w-full text-right px-4 py-3 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors flex items-center gap-2 font-medium">
              <span>🚪</span> تسجيل الخروج
            </button>
          </div>
        )}

        <button 
          onClick={() => setProfileOpen(!profileOpen)}
          className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-lg transition-colors text-right border ${profileOpen ? 'bg-gray-800 border-gray-700' : 'bg-transparent hover:bg-gray-800 border-transparent'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-xs shadow-md">
              OP
            </div>
            <div>
              <div className="text-sm font-bold text-white">مدير العمليات</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50"></span> متصل (Online)
              </div>
            </div>
          </div>
          <span className="text-gray-500 text-xs transition-transform">{profileOpen ? '▼' : '▲'}</span>
        </button>
      </div>
    </aside>
  );
}
