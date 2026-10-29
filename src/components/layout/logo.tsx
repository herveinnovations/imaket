import Link from "next/link";
import { cn } from "@/lib/utils";

/** Oval outlined wordmark in the style of the Wix Harmony streetwear template. */
export function LogoMark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[50%] border-[3px] border-black bg-transparent font-display leading-none text-black",
        size === "sm" && "h-8 px-3 text-[15px] border-2",
        size === "md" && "h-[42px] px-4 text-[21px]",
        size === "lg" && "h-14 px-6 text-[28px]",
        className,
      )}
      style={{ letterSpacing: "-0.06em" }}
      aria-hidden
    >
      iMaket
    </span>
  );
}

export function Logo({ className, href = "/", size = "md" }: { className?: string; href?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <Link href={href} className={cn("inline-flex items-center", className)} aria-label="iMaket home">
      <LogoMark size={size} />
    </Link>
  );
}
