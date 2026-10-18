import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import "./glass-theme.css";
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
      <body className="app-shell font-sans relative">
        <NotificationProvider>
          <Suspense fallback={<aside className="desktop-sidebar is-collapsed glass hidden md:flex" />}>
            <Sidebar />
          </Suspense>
          <main className="app-main">
            {children}
          </main>
          <AIAssistantWidget />
        </NotificationProvider>
      </body>
    </html>
  );
}
