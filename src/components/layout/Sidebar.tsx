import Link from 'next/link';

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col shadow-lg">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-l from-emerald-400 to-teal-200">
          AI Control Tower
        </h1>
        <p className="text-xs text-gray-400 mt-1">زاهي | موزون</p>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/" className="block px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors">
          لوحة القيادة (Dashboard)
        </Link>
        <Link href="/exceptions" className="block px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors text-red-400 hover:text-red-300 font-medium">
          مركز الاستثناءات (AI Exceptions)
        </Link>
        <Link href="/orders" className="block px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors text-gray-300">
          الطلبات (Orders)
        </Link>
        <Link href="/production" className="block px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors text-gray-300">
          الإنتاج (Production)
        </Link>
      </nav>
      <div className="p-4 border-t border-gray-800 text-xs text-gray-500 text-center">
        Powered by AI Agent
      </div>
    </aside>
  );
}
