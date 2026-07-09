import type { Metadata } from "next";
// Next 14 的 next/font/google 里没有 Geist（那是 Next 15 才加的）。
// 官方 `geist` 包基于 next/font/local，且其 .variable 就是 --font-geist-sans，
// 正好对应 globals.css 里的 @theme inline { --font-sans: var(--font-geist-sans) }
import { GeistSans } from "geist/font/sans";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deephome — 意图找房",
  description: "不只匹配关键词，而是理解你真正想要什么，再据此推荐并解释原因。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className={cn(GeistSans.variable)} suppressHydrationWarning>
      <body className="font-sans antialiased">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
