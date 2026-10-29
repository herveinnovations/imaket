import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/types";

/** Curated cover palette: [background, ink] */
const PALETTE: [string, string][] = [
  ["#D6FF38", "#000000"], ["#000000", "#D6FF38"], ["#E6E6E6", "#000000"], ["#E6E7DA", "#008528"],
  ["#008528", "#D6FF38"], ["#E6E6E6", "#008528"], ["#FFFFFF", "#000000"], ["#E6E7DA", "#000000"],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Type-specific motif drawn behind the title */
function Motif({ type, ink }: { type: ProductType; ink: string }) {
  const common = { stroke: ink, fill: "none", strokeOpacity: 0.35, strokeWidth: 2 };
  switch (type) {
    case "course":
      return (
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => <rect key={i} x={110 + i * 6} y={20 + i * 6} width={70} height={46} rx={6} {...common} />)}
        </svg>
      );
    case "ticket":
      return (
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d="M120 20h60v40a12 12 0 0 0 0 24v40h-60v-40a12 12 0 0 0 0-24z" {...common} strokeDasharray="4 5" />
        </svg>
      );
    case "physical":
      return (
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
          {Array.from({ length: 7 }, (_, r) => Array.from({ length: 7 }, (_, c) =>
            <path key={`${r}-${c}`} d={`M${100 + c * 14} ${10 + r * 14} l7 7 -7 7 -7 -7z`} {...common} />))}
        </svg>
      );
    case "service":
      return (
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={160} cy={46} r={14 + i * 14} {...common} />)}
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
          {Array.from({ length: 9 }, (_, i) => <line key={i} x1={100 + i * 12} y1={0} x2={200} y2={100 - i * 12} {...common} />)}
        </svg>
      );
  }
}

export function ProductCover({
  id, title, type, creator, coverUrl, className, size = "md",
}: {
  id: string; title: string; type: ProductType; creator?: string; coverUrl?: string | null;
  className?: string; size?: "sm" | "md" | "lg";
}) {
  if (coverUrl) {
    return (
      <div className={cn("relative overflow-hidden bg-surface-2", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }
  const [bg, ink] = PALETTE[hash(id) % PALETTE.length];
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: bg, color: ink }} aria-hidden>
      <Motif type={type} ink={ink} />
      <div className={cn("absolute inset-x-0 bottom-0 flex flex-col", size === "sm" ? "p-3" : size === "lg" ? "p-8" : "p-5")}>
        <span className={cn("font-display leading-[1] tracking-[-0.05em] [text-wrap:balance]",
          size === "sm" ? "text-base" : size === "lg" ? "text-4xl sm:text-5xl" : "text-[1.6rem]")}>
          {title}
        </span>
        {creator && size !== "sm" && <span className="mt-2 text-xs opacity-75">{creator}</span>}
      </div>
    </div>
  );
}
