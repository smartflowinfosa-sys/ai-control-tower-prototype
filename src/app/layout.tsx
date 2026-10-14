import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import AIAssistantWidget from "@/components/chat/AIAssistantWidget";
import { NotificationProvider } from "@/components/common/NotificationContext";
import { Suspense } from "react";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
  title: "برج مراقبة زاهي | Zahi AI Control Tower",
  description: "برج المراقبة والتحكم بالذكاء الاصطناعي لعمليات مطاعم زاهي",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${tajawal.variable} antialiased h-full`}
    >
      <body className="min-h-screen flex bg-gradient-to-br from-sky-50 via-slate-50 to-orange-50 bg-fixed text-slate-900 selection:bg-sky-500 selection:text-white relative">
        <NotificationProvider>
          <Suspense fallback={<aside className="w-64 bg-gray-900 text-white p-6"></aside>}>
            <Sidebar />
          </Suspense>
          <main className="flex-1 flex flex-col p-8 overflow-y-auto relative">
            {children}
          </main>
          <AIAssistantWidget />
        </NotificationProvider>
      </body>
    </html>
  );
}
