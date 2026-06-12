import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WhataCampaign",
  description: "WhatsApp Campaign & Journey Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${inter.className} min-h-full flex flex-col md:flex-row bg-background text-foreground`}>
        <Sidebar />
        <main className="flex-1 overflow-auto min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
