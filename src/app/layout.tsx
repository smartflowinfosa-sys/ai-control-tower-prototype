import type { Metadata } from "next";
import { Tajawal, Inter } from "next/font/google";
import Image from "next/image";
import "./globals.css";
import "./glass-theme.css";
import Sidebar from "@/components/layout/Sidebar";
import AIAssistantWidget from "@/components/chat/AIAssistantWidget";
import { NotificationProvider } from "@/components/common/NotificationContext";
import { LanguageProvider } from "@/components/common/LanguageContext";
import { Suspense } from "react";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Zahi Control System | برج مراقبة زاهي",
  description: "نظام إدارة العمليات وسلاسل الإمداد الذكية لمطاعم زاهي",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "زاهي",
    statusBarStyle: "black-translucent",
  },
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
      className={`${tajawal.variable} ${inter.variable} antialiased h-full`}
    >
      <body className="app-shell font-sans relative">
        {/* Preloaded & optimized background image layer for instant LCP */}
        <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none select-none">
          <Image
            src="/bg_plants.jpg"
            alt=""
            fill
            priority
            quality={75}
            sizes="100vw"
            className="object-cover object-[center_75%] blur-[10px] scale-105"
          />
        </div>
        <LanguageProvider>
          <NotificationProvider>
            <Suspense fallback={<aside className="desktop-sidebar is-collapsed glass hidden md:flex" />}>
              <Sidebar />
            </Suspense>
            <main className="app-main">
              {children}
            </main>
            <AIAssistantWidget />
          </NotificationProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
