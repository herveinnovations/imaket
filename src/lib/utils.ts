import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ProductType } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_LOCALE: Record<string, string> = {
  ZMW: "en-ZM", NGN: "en-NG", KES: "en-KE", GHS: "en-GH", UGX: "en-UG",
  ZAR: "en-ZA", TZS: "en-TZ", RWF: "en-RW", USD: "en-US", EUR: "en-IE", GBP: "en-GB",
};

/** Zero-decimal currencies in everyday use */
const NO_DECIMALS = new Set(["UGX", "RWF", "TZS"]);

export function formatMoney(amount: number, currency = "ZMW") {
  const nd = NO_DECIMALS.has(currency);
  try {
    if (currency === "ZMW") {
      // Local convention is "K150", not "ZK 150"
      const n = new Intl.NumberFormat("en", {
        minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2,
      }).format(Math.abs(amount));
      return `${amount < 0 ? "-" : ""}K${n}`;
    }
    return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? "en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: nd || Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: nd ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(nd ? 0 : 2)}`;
  }
}

export function formatCompact(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatDate(d: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-GB", opts).format(new Date(d));
}

export function timeAgo(d: string | Date) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (s < 60) return rtf.format(-s, "second");
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  if (s < 2592000) return rtf.format(-Math.round(s / 86400), "day");
  return formatDate(d);
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), u.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueSlug(title: string) {
  return `${slugify(title)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  digital: "Digital download",
  course: "Online course",
  service: "Service",
  ticket: "Event ticket",
  physical: "Physical product",
  membership: "Membership",
};

export function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export function absoluteUrl(path = "") {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

export function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
