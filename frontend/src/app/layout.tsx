import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";

import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/app/providers";

import "./globals.css";

const APP_TITLE = "Routy";
const APP_DESCRIPTION = "저장한 장소로 AI 여행 일정을 만드는 서비스";
const DEFAULT_APP_ORIGIN = "http://localhost:3000";

const bodyFont = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "700", "900"]
});

function resolveSiteOrigin() {
  const authCallbackUrl = process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL?.trim();

  if (authCallbackUrl) {
    try {
      return new URL(authCallbackUrl).origin;
    } catch {
      // Invalid env values should not break metadata in local development.
    }
  }

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "")}`;
  }

  return DEFAULT_APP_ORIGIN;
}

const siteOrigin = resolveSiteOrigin();
const ogImageUrl = new URL("/og-image.png", siteOrigin).toString();

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_DESCRIPTION,
  openGraph: {
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    url: siteOrigin,
    siteName: APP_TITLE,
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "Routy 서비스 대표 미리보기 이미지"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: [ogImageUrl]
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg"
  }
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
