import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["200", "300", "400", "500", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "AI Operations Control Tower - Zahi & Mawzoon",
  description: "Proactive AI Control Tower for Zahi and Mawzoon",
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
      <body className="min-h-screen flex bg-gray-50 text-gray-900">
        <Sidebar />
        <main className="flex-1 flex flex-col p-8 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
