import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/utils";

const HEIGHT = { sm: 32, md: 44, lg: 60 } as const;

/**
 * iMaket wordmark in the style of the Wix "TSHOP" badge: white oval with a thick
 * black ring, tall condensed heavy letters that run to the edge of the oval
 * (cropped by it), separated by thin white outlines.
 */
export function LogoMark({ className, size = "md" }: { className?: string; size?: keyof typeof HEIGHT }) {
  const clip = `logo-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const h = HEIGHT[size];
  return (
    <svg viewBox="0 0 200 90" height={h} width={(h * 200) / 90} className={cn("shrink-0", className)} aria-hidden>
      <defs>
        <clipPath id={clip}><ellipse cx="100" cy="45" rx="94" ry="41" /></clipPath>
      </defs>
      <ellipse cx="100" cy="45" rx="94" ry="41" fill="#fff" />
      <g clipPath={`url(#${clip})`}>
        <text
          x="100" y="68" textAnchor="middle" fontSize="64" textLength="170" lengthAdjust="spacingAndGlyphs"
          transform="translate(0 -11.25) scale(1 1.25)"
          fill="#000" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" paintOrder="stroke"
          style={{ fontFamily: "var(--font-archivo), 'Arial Black', Arial, sans-serif" }}
        >
          iMaket
        </text>
      </g>
      <ellipse cx="100" cy="45" rx="94" ry="41" fill="none" stroke="#000" strokeWidth="7" />
    </svg>
  );
}

export function Logo({ className, href = "/", size = "md" }: { className?: string; href?: string; size?: keyof typeof HEIGHT }) {
  return (
    <Link href={href} className={cn("inline-flex items-center", className)} aria-label="iMaket home">
      <LogoMark size={size} />
    </Link>
  );
}
