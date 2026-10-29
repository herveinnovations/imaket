import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { env } from "@/lib/env";
import "./globals.css";

// Wix look: Arial Black headlines over Arial text. Archivo Black / Arimo are the
// metric-friendly fallbacks for devices without the Microsoft fonts (Android, Linux).
const sans = localFont({
  src: [{ path: "./fonts/arimo-400.woff2", weight: "400" }, { path: "./fonts/arimo-700.woff2", weight: "700" }],
  variable: "--font-arimo", display: "swap",
});
const display = localFont({ src: "./fonts/archivo-black.woff2", variable: "--font-archivo", weight: "400", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: { default: `Home | ${env.appName}`, template: `%s | ${env.appName}` },
  description:
    "Sell e-books, courses, presets, coaching, event tickets and physical goods from one storefront. Customers pay with mobile money or card.",
  openGraph: { type: "website", siteName: env.appName },
};

export const viewport: Viewport = {
  themeColor: [
    { color: "#D6FF38" },
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
