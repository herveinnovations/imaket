import Link from "next/link";
import { BadgeCheck, Star } from "lucide-react";
import { ProductCover } from "./product-cover";
import { WishlistButton } from "./wishlist-button";
import { cn, formatMoney, PRODUCT_TYPE_LABEL } from "@/lib/utils";
import type { Product } from "@/lib/types";

export function ProductCard({ product: p, className, showCreator = true }: { product: Product; className?: string; showCreator?: boolean }) {
  const soldOut = p.track_inventory && p.inventory_qty === 0;
  const lowStock = p.track_inventory && p.inventory_qty != null && p.inventory_qty > 0 && p.inventory_qty <= 5;
  return (
    <article className={cn("group relative flex flex-col", className)}>
      <Link href={`/p/${p.slug}`} className="block overflow-hidden rounded-2xl border border-fg/5 focus-visible:ring-offset-4" aria-label={p.title}>
        <ProductCover id={p.id} title={p.title} type={p.type} creator={p.creator?.store_name} coverUrl={p.cover_url}
          className="aspect-[4/5] transition-transform duration-500 group-hover:scale-[1.02]" />
      </Link>
      <WishlistButton productId={p.id} className="absolute right-2.5 top-2.5" />
      {(soldOut || lowStock || p.compare_at_price) && (
        <span className={cn("absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-xs font-medium",
          soldOut ? "bg-fg text-bg" : lowStock ? "bg-accent text-[#1d1500]" : "bg-surface text-fg")}>
          {soldOut ? "Sold out" : lowStock ? `${p.inventory_qty} left` : `Save ${Math.round(100 - (p.price / p.compare_at_price!) * 100)}%`}
        </span>
      )}
      <div className="mt-3 flex flex-1 flex-col gap-1 px-0.5">
        <span className="text-xs text-muted">{PRODUCT_TYPE_LABEL[p.type]}</span>
        <Link href={`/p/${p.slug}`} className="line-clamp-2 font-medium leading-snug hover:underline hover:underline-offset-4">{p.title}</Link>
        {showCreator && p.creator && (
          <Link href={`/${p.creator.handle}`} className="flex items-center gap-1 text-sm text-muted hover:text-fg">
            {p.creator.store_name}
            {p.creator.verified && <BadgeCheck className="h-3.5 w-3.5 text-brand" aria-label="Verified creator" />}
          </Link>
        )}
        <div className="mt-auto flex items-center justify-between pt-1.5">
          <span className="font-semibold">
            {p.pay_what_you_want ? `From ${formatMoney(p.min_price ?? 0, p.currency)}` : formatMoney(p.price, p.currency)}
            {p.compare_at_price && <s className="ml-1.5 text-sm font-normal text-muted">{formatMoney(p.compare_at_price, p.currency)}</s>}
          </span>
          {p.rating_count > 0 && (
            <span className="flex items-center gap-1 text-sm text-muted">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden />
              {p.rating_avg.toFixed(1)} <span className="sr-only">out of 5,</span>({p.rating_count})
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface-2">
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/5" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-20 rounded bg-surface-2" />
        <div className="h-4 w-4/5 rounded bg-surface-2" />
        <div className="h-4 w-1/3 rounded bg-surface-2" />
      </div>
    </div>
  );
}
