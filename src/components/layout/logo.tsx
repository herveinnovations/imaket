import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  // A lowercase "i" under a market-stall awning; the dot is the gold accent
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="rgb(var(--brand))" />
      <path d="M7 12.5 9.5 8h13L25 12.5" fill="none" stroke="rgb(var(--brand-fg))" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 16v8" fill="none" stroke="rgb(var(--brand-fg))" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="16" cy="11.6" r="2.3" fill="#F2B21B" />
    </svg>
  );
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 rounded-lg", className)} aria-label="iMaket home">
      <LogoMark />
      <span className="font-display text-[1.35rem] font-bold tracking-tight">iMaket</span>
    </Link>
  );
}
