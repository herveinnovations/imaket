import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { env } from "@/lib/env";
import "./globals.css";

const sans = localFont({ src: "./fonts/geist.woff2", variable: "--font-sans", weight: "100 900", display: "swap" });
const display = localFont({ src: "./fonts/bricolage.woff2", variable: "--font-display", weight: "200 800", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: { default: `${env.appName} — sell what you make, get paid on mobile money`, template: `%s · ${env.appName}` },
  description:
    "Sell e-books, courses, presets, coaching, event tickets and physical goods from one storefront. Customers pay with mobile money or card.",
  openGraph: { type: "website", siteName: env.appName },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F5F2" },
    { media: "(prefers-color-scheme: dark)", color: "#0D1220" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
