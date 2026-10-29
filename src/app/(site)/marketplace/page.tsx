import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/product/product-card";
import { BrowseSidebar, MarketplaceToolbar } from "@/components/product/marketplace-filters";
import { ButtonLink } from "@/components/ui/button";
import { getCategories, getProducts } from "@/lib/data/catalog";
import type { ProductFilters, ProductType } from "@/lib/types";

type SP = Promise<Record<string, string | undefined>>;
const PAGE_SIZE = 24;

function collectionTitle(sp: Record<string, string | undefined>, catName?: string) {
  if (sp.q) return `Search: “${sp.q}”`;
  if (catName) return catName;
  if (sp.audience === "men") return "Men";
  if (sp.audience === "women") return "Women";
  if (sp.new) return "New";
  return "All Products";
}

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  return { title: collectionTitle(sp), description: "Clothing, prints, downloads, courses and tickets from iMaket creators." };
}

export default async function MarketplacePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters: ProductFilters = {
    q: sp.q?.slice(0, 80),
    category: sp.category,
    type: sp.type as ProductType | undefined,
    audience: sp.audience === "men" || sp.audience === "women" ? sp.audience : undefined,
    isNew: !!sp.new,
    minPrice: sp.min ? Number(sp.min) : undefined,
    maxPrice: sp.max ? Number(sp.max) : undefined,
    sort: (sp.sort as ProductFilters["sort"]) ?? (sp.new ? "newest" : undefined),
    page: Number(sp.page ?? 1),
    pageSize: PAGE_SIZE,
  };
  const [categories, { items, total }] = await Promise.all([getCategories(), getProducts(filters)]);
  const pages = Math.ceil(total / PAGE_SIZE);
  const current = filters.page ?? 1;
  const title = collectionTitle(sp, categories.find((c) => c.slug === sp.category)?.name);

  const pageHref = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    q.set("page", String(p));
    return `/marketplace?${q}`;
  };

  return (
    <div className="bg-white px-5 pb-16 pt-1">
      <nav aria-label="Breadcrumb" className="text-base">
        <Link href="/" className="hover:underline">Home</Link>
        <span className="mx-3" aria-hidden>›</span>
        <span>{title}</span>
      </nav>
      <h1 className="mt-5 text-[2.05rem]">{title}</h1>

      <div className="mt-16 grid gap-10 lg:grid-cols-[200px_1fr] lg:gap-10">
        <Suspense><BrowseSidebar categories={categories} /></Suspense>
        <div>
          <Suspense><MarketplaceToolbar categories={categories} total={total} /></Suspense>
          {items.length === 0 ? (
            <div className="py-20 text-center">
              <p className="font-display text-2xl tracking-[-0.04em]">We couldn&apos;t find any matches</p>
              <p className="mt-2 text-[15px]">Try a different collection or clear your filters.</p>
              <ButtonLink href="/marketplace" className="mt-6">Shop All</ButtonLink>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
              {items.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
          {pages > 1 && (
            <nav className="mt-14 flex justify-center gap-1" aria-label="Pagination">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={pageHref(p)} aria-current={p === current ? "page" : undefined}
                  className={`grid h-9 min-w-9 place-items-center px-2 text-[15px] ${p === current ? "bg-black text-white" : "hover:underline"}`}>{p}</Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
