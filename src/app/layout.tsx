import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { PwaSetup } from "@/components/pwa/install-app";
import { env } from "@/lib/env";
import "./globals.css";

// Outfit (variable, 100–900) for headings and text — the EO Robotics Lab type system.
// Self-hosted so it loads with the page; the system stack covers the swap.
const outfit = localFont({ src: "./fonts/outfit-variable.woff2", variable: "--font-outfit", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: { default: `Home | ${env.appName}`, template: `%s | ${env.appName}` },
  description:
    "Sell e-books, courses, presets, coaching, event tickets and physical goods from one storefront. Customers pay with mobile money or card.",
  openGraph: { type: "website", siteName: env.appName },
  applicationName: "iMaket",
  appleWebApp: { capable: true, title: "iMaket", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { color: "#2DD4BF" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={outfit.variable}>
      <body>
        <Providers>{children}</Providers>
        <PwaSetup />
      </body>
    </html>
  );
}
