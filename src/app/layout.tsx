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
  description: "برج المراقبة والتحكم بـ AI Agent لعمليات مطاعم زاهي",
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
      <body className="h-screen min-h-screen flex font-sans selection:bg-white/20 selection:text-white relative">
        {/* 3 Animated teal blobs using extracted green shades behind content */}
        <div className="bg-blob bg-blob-1" aria-hidden="true" />
        <div className="bg-blob bg-blob-2" aria-hidden="true" />
        <div className="bg-blob bg-blob-3" aria-hidden="true" />

        <NotificationProvider>
          <Suspense fallback={<aside className="w-20 m-4 my-6 rounded-[24px] glass hidden md:flex shrink-0"></aside>}>
            <Sidebar />
          </Suspense>
          <main className="flex-1 min-w-0 m-4 my-6 mr-6 overflow-y-auto relative z-10">
            {children}
          </main>
          <AIAssistantWidget />
        </NotificationProvider>
      </body>
    </html>
  );
}
