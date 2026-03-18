import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";

import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/app/providers";

import "./globals.css";

const bodyFont = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "700", "900"]
});

export const metadata: Metadata = {
  title: "마이루트",
  description: "저장한 장소로 AI 여행 일정을 만드는 서비스"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${bodyFont.variable} antialiased`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
