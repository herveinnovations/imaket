import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { MarketplaceFilters, MarketplaceToolbar } from "@/components/product/marketplace-filters";
import { EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { getCategories, getProducts } from "@/lib/data/catalog";
import type { ProductFilters, ProductType } from "@/lib/types";

export const metadata: Metadata = { title: "Marketplace", description: "Guides, courses, presets, coaching, tickets and handmade goods from African creators." };

type SP = Promise<Record<string, string | undefined>>;
const PAGE_SIZE = 24;

export default async function MarketplacePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters: ProductFilters = {
    q: sp.q?.slice(0, 80),
    category: sp.category,
    type: sp.type as ProductType | undefined,
    minPrice: sp.min ? Number(sp.min) : undefined,
    maxPrice: sp.max ? Number(sp.max) : undefined,
    sort: sp.sort as ProductFilters["sort"],
    page: Number(sp.page ?? 1),
    pageSize: PAGE_SIZE,
  };
  const [categories, { items, total }] = await Promise.all([getCategories(), getProducts(filters)]);
  const pages = Math.ceil(total / PAGE_SIZE);
  const current = filters.page ?? 1;
  const catName = categories.find((c) => c.slug === sp.category)?.name;

  const pageHref = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    q.set("page", String(p));
    return `/marketplace?${q}`;
  };

  return (
    <div className="container py-10">
      <h1 className="text-4xl font-bold sm:text-5xl">{catName ?? "Marketplace"}</h1>
      <p className="mt-2 text-muted">Things made by creators across Zambia, Nigeria, Kenya, Ghana and beyond.</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[230px_1fr]">
        <Suspense><MarketplaceFilters categories={categories} /></Suspense>
        <div>
          <Suspense><MarketplaceToolbar categories={categories} total={total} /></Suspense>
          {items.length === 0 ? (
            <EmptyState icon={SearchX} title="Nothing matches those filters"
              body="Try a broader search, or clear the price range and product type."
              action={<ButtonLink href="/marketplace" variant="secondary">Clear all filters</ButtonLink>} />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
              {items.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
          {pages > 1 && (
            <nav className="mt-12 flex justify-center gap-1" aria-label="Pagination">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={pageHref(p)} aria-current={p === current ? "page" : undefined}
                  className={`grid h-10 min-w-10 place-items-center rounded-xl px-3 text-sm ${p === current ? "bg-brand text-brand-fg" : "hover:bg-surface-2"}`}>{p}</Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
