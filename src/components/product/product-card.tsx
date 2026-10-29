import Link from "next/link";
import { ProductCover } from "./product-cover";
import { QuickViewButton } from "./quick-view";
import { cn, formatMoney } from "@/lib/utils";
import type { Product } from "@/lib/types";

/**
 * Wix Harmony product tile: square image on a light panel, a translucent "Quick View"
 * bar on hover, then name and price. `align="center"` for the home grid, "left" for the shop.
 */
export function ProductCard({ product: p, className, showCreator = true, align = "left" }: {
  product: Product; className?: string; showCreator?: boolean; align?: "left" | "center";
}) {
  const soldOut = p.track_inventory && p.inventory_qty === 0;
  const onSale = !!p.compare_at_price && p.compare_at_price > p.price;
  return (
    <article className={cn("group relative flex flex-col", className)}>
      <div className="relative overflow-hidden bg-surface-2">
        <Link href={`/p/${p.slug}`} className="block" aria-label={p.title}>
          <ProductCover id={p.id} title={p.title} type={p.type} creator={p.creator?.store_name} coverUrl={p.cover_url}
            className="aspect-square transition-transform duration-500 group-hover:scale-[1.03]" />
        </Link>
        {(soldOut || onSale) && (
          <span className="pointer-events-none absolute left-0 top-0 bg-black px-2.5 py-1 text-xs text-white">
            {soldOut ? "Out of Stock" : "Sale"}
          </span>
        )}
        <QuickViewButton product={p} />
      </div>
      <Link href={`/p/${p.slug}`} className={cn("mt-4 block", align === "center" && "text-center")}>
        <p className="text-[15px] leading-[1.3] group-hover:underline group-hover:underline-offset-4">{p.title}</p>
        <p className="mt-1 text-base">
          <span className="sr-only">Price</span>
          {onSale && <s className="mr-2 text-muted">{formatMoney(p.compare_at_price!, p.currency)}</s>}
          {p.pay_what_you_want ? `From ${formatMoney(p.min_price ?? 0, p.currency)}` : formatMoney(p.price, p.currency)}
        </p>
      </Link>
      {showCreator && p.creator && (
        <Link href={`/${p.creator.handle}`} className={cn("mt-0.5 text-sm text-muted hover:text-fg hover:underline", align === "center" && "text-center")}>
          {p.creator.store_name}
        </Link>
      )}
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="relative aspect-square overflow-hidden bg-surface-2">
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-3/4 bg-surface-2" />
        <div className="h-4 w-1/3 bg-surface-2" />
      </div>
    </div>
  );
}
