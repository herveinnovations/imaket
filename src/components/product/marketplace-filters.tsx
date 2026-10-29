"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, Minus, Plus, SlidersHorizontal, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn, PRODUCT_TYPE_LABEL } from "@/lib/utils";
import type { Category, ProductType } from "@/lib/types";

const SORTS = [
  ["popular", "Recommended"], ["newest", "Newest"], ["price_asc", "Price (low to high)"], ["price_desc", "Price (high to low)"], ["rating", "Top rated"],
] as const;

export function useFilterNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    next.delete("page");
    start(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  return { params, set, pending };
}

/** Collapsible "Filter by" group with the Wix plus/minus toggle. */
function Group({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-black/30 py-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-[15px]" aria-expanded={open}>
        {title} {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function SidebarBody({ categories }: { categories: Category[] }) {
  const { params, set } = useFilterNav();
  const cat = params.get("category");
  const type = params.get("type");
  const audience = params.get("audience");
  const isNew = !!params.get("new");
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");
  const [allCats, setAllCats] = useState(false);
  const linkCls = (on: boolean) => cn("block py-1.5 text-[15px] hover:underline hover:underline-offset-4", on && "font-bold underline underline-offset-4");

  return (
    <div>
      <p className="border-b border-black/30 pb-3 text-[15px]">Browse by</p>
      <ul className="py-3">
        <li><Link href="/marketplace" className={linkCls(!cat && !audience && !isNew && !params.get("q"))}>All Products</Link></li>
        <li><Link href="/marketplace?audience=men" className={linkCls(audience === "men")}>Men</Link></li>
        <li><Link href="/marketplace?audience=women" className={linkCls(audience === "women")}>Women</Link></li>
        <li><Link href="/marketplace?new=1" className={linkCls(isNew)}>New</Link></li>
        {(allCats ? categories : categories.slice(0, 6)).map((c) => (
          <li key={c.id}><Link href={`/marketplace?category=${c.slug}`} className={linkCls(cat === c.slug)}>{c.name}</Link></li>
        ))}
        {categories.length > 6 && (
          <li><button onClick={() => setAllCats(!allCats)} className="py-1.5 text-sm underline underline-offset-4">{allCats ? "Show less" : `+ ${categories.length - 6} more`}</button></li>
        )}
      </ul>

      <p className="mt-6 border-b border-black/30 pb-3 text-[15px]">Filter by</p>
      <Group title="Price">
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); set({ min: min || null, max: max || null }); }}>
          <input className="h-9 w-full border border-black/60 px-2 text-sm" inputMode="decimal" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Minimum price" />
          <span>–</span>
          <input className="h-9 w-full border border-black/60 px-2 text-sm" inputMode="decimal" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Maximum price" />
          <button type="submit" className="h-9 shrink-0 bg-black px-3 text-sm text-white">Go</button>
        </form>
      </Group>
      <Group title="Product type" defaultOpen={!!type}>
        <ul className="space-y-1.5">
          {(Object.keys(PRODUCT_TYPE_LABEL) as ProductType[]).map((t) => (
            <li key={t}>
              <label className="flex cursor-pointer items-center gap-2 text-[15px]">
                <input type="checkbox" className="h-4 w-4 accent-black" checked={type === t} onChange={() => set({ type: type === t ? null : t })} />
                {PRODUCT_TYPE_LABEL[t]}
              </label>
            </li>
          ))}
        </ul>
      </Group>
    </div>
  );
}

export function BrowseSidebar({ categories }: { categories: Category[] }) {
  return <aside className="hidden lg:block"><SidebarBody categories={categories} /></aside>;
}

export function MarketplaceToolbar({ categories, total }: { categories: Category[]; total: number }) {
  const { params, set, pending } = useFilterNav();
  const [open, setOpen] = useState(false);
  const active = ["category", "type", "min", "max", "q", "audience", "new"].filter((k) => params.get(k));
  const sort = params.get("sort") ?? (params.get("new") ? "newest" : "popular");
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <p className={cn("mr-auto text-sm", pending && "opacity-50")} aria-live="polite">
        {total} {total === 1 ? "product" : "products"}
      </p>
      {active.length > 0 && (
        <button onClick={() => set(Object.fromEntries(active.map((k) => [k, null])))} className="flex items-center gap-1 text-sm underline underline-offset-4">
          <X className="h-3.5 w-3.5" /> Clear filters
        </button>
      )}
      <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="h-4 w-4" /> Filter &amp; Browse{active.length ? ` (${active.length})` : ""}
      </Button>
      <label className="relative flex h-10 items-center gap-1 text-base">
        <span>Sort by:</span>
        <select value={sort} onChange={(e) => set({ sort: e.target.value === "popular" ? null : e.target.value })}
          className="h-10 cursor-pointer appearance-none bg-transparent pr-7 text-base focus:outline-none" aria-label="Sort by">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1 h-4 w-4" aria-hidden />
      </label>
      <Modal open={open} onClose={() => setOpen(false)} title="Filter & Browse" footer={<Button onClick={() => setOpen(false)}>Show {total} products</Button>}>
        <SidebarBody categories={categories} />
      </Modal>
    </div>
  );
}
