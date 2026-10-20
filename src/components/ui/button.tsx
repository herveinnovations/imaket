import Link from "next/link";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-brand text-brand-fg hover:bg-brand/90 shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]",
  secondary: "bg-surface text-fg border hover:bg-surface-2",
  ghost: "text-fg hover:bg-surface-2",
  accent: "bg-accent text-[#1d1500] hover:brightness-95",
  danger: "bg-danger text-white hover:bg-danger/90",
  outline: "border border-fg/15 text-fg hover:border-fg/40",
} as const;

const sizes = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-[15px] gap-2 rounded-xl",
  lg: "h-[52px] px-6 text-base gap-2 rounded-xl",
  icon: "h-10 w-10 rounded-xl",
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
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background,color,box-shadow,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55",
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
      className={cn("inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-colors active:scale-[0.98]", variants[variant], sizes[size], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
