import Link from "next/link";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Wix Harmony buttons: green pill (primary), black-outline pill (secondary), black / lime solids.
const variants = {
  primary: "bg-brand text-brand-fg hover:bg-[#006b20]",
  secondary: "bg-surface text-fg border border-fg hover:bg-fg hover:text-bg",
  ghost: "text-fg hover:bg-surface-2",
  accent: "bg-lime text-black hover:bg-black hover:text-lime",
  black: "bg-black text-white hover:bg-black/85",
  danger: "bg-danger text-white hover:bg-danger/90",
  outline: "border border-fg text-fg hover:bg-fg hover:text-bg",
} as const;

const sizes = {
  sm: "h-9 px-4 text-sm gap-1.5 rounded-full",
  md: "h-10 px-5 text-base gap-2 rounded-full",
  lg: "h-12 px-7 text-base gap-2 rounded-full",
  icon: "h-10 w-10 rounded-full",
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-normal transition-colors active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variants[variant], sizes[size], className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({
  href, variant = "primary", size = "md", className, children, ...rest
}: { href: string; variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      href={href}
      className={cn("inline-flex select-none items-center justify-center whitespace-nowrap font-normal transition-colors active:scale-[0.98]", variants[variant], sizes[size], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
