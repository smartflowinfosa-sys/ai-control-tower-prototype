import type { Metadata } from "next";
import { Tajawal, Inter } from "next/font/google";
import "./globals.css";
import "./glass-theme.css";
import Sidebar from "@/components/layout/Sidebar";
import AIAssistantWidget from "@/components/chat/AIAssistantWidget";
import { NotificationProvider } from "@/components/common/NotificationContext";
import { LanguageProvider } from "@/components/common/LanguageContext";
import AuthProvider from "@/components/common/AuthProvider";
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
      <body className="min-h-screen flex bg-[url('/bg_plants.jpg')] bg-cover bg-center bg-fixed bg-no-repeat text-white relative">
        <AuthProvider>
          <LanguageProvider>
            <NotificationProvider>
              <Suspense fallback={<aside className="w-20 hidden md:flex" />}>
                <Sidebar />
              </Suspense>
              <main className="flex-1 min-w-0 p-6 md:p-8 lg:p-10 overflow-y-auto">
                {children}
              </main>
              <AIAssistantWidget />
            </NotificationProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
