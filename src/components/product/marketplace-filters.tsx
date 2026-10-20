"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn, PRODUCT_TYPE_LABEL } from "@/lib/utils";
import type { Category, ProductType } from "@/lib/types";

const SORTS = [
  ["popular", "Most popular"], ["newest", "Newest"], ["rating", "Top rated"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"],
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

function FilterBody({ categories }: { categories: Category[] }) {
  const { params, set } = useFilterNav();
  const cat = params.get("category");
  const type = params.get("type");
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Category</legend>
        <ul className="space-y-0.5">
          <li>
            <button onClick={() => set({ category: null })} className={cn("w-full rounded-lg px-3 py-2 text-left text-sm", !cat ? "bg-brand-soft font-medium text-brand" : "text-fg/80 hover:bg-surface-2")}>
              All categories
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <button onClick={() => set({ category: c.slug })} aria-pressed={cat === c.slug}
                className={cn("w-full rounded-lg px-3 py-2 text-left text-sm", cat === c.slug ? "bg-brand-soft font-medium text-brand" : "text-fg/80 hover:bg-surface-2")}>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Product type</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRODUCT_TYPE_LABEL) as ProductType[]).map((t) => (
            <button key={t} onClick={() => set({ type: type === t ? null : t })} aria-pressed={type === t}
              className={cn("rounded-full border px-3 py-1.5 text-sm", type === t ? "border-brand bg-brand text-brand-fg" : "hover:border-fg/30")}>
              {PRODUCT_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Price</legend>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); set({ min: min || null, max: max || null }); }}>
          <input className="input h-10" inputMode="decimal" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Minimum price" />
          <span className="text-muted">–</span>
          <input className="input h-10" inputMode="decimal" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Maximum price" />
          <Button type="submit" size="sm" variant="secondary" className="h-10">Apply</Button>
        </form>
      </fieldset>
    </div>
  );
}

export function MarketplaceFilters({ categories }: { categories: Category[] }) {
  return <aside className="hidden lg:block"><FilterBody categories={categories} /></aside>;
}

export function MarketplaceToolbar({ categories, total }: { categories: Category[]; total: number }) {
  const { params, set, pending } = useFilterNav();
  const [open, setOpen] = useState(false);
  const active = ["category", "type", "min", "max", "q"].filter((k) => params.get(k));
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <p className={cn("mr-auto text-sm text-muted", pending && "opacity-50")} aria-live="polite">
        {total} {total === 1 ? "product" : "products"}{params.get("q") && <> for “{params.get("q")}”</>}
      </p>
      {active.length > 0 && (
        <button onClick={() => set(Object.fromEntries(active.map((k) => [k, null])))} className="flex items-center gap-1 text-sm text-muted hover:text-fg">
          <X className="h-3.5 w-3.5" /> Clear filters
        </button>
      )}
      <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="h-4 w-4" /> Filters{active.length ? ` (${active.length})` : ""}
      </Button>
      <select value={params.get("sort") ?? "popular"} onChange={(e) => set({ sort: e.target.value === "popular" ? null : e.target.value })}
        className="input h-9 w-auto rounded-lg pr-8 text-sm" aria-label="Sort by">
        {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Modal open={open} onClose={() => setOpen(false)} title="Filters" footer={<Button onClick={() => setOpen(false)}>Show {total} results</Button>}>
        <FilterBody categories={categories} />
      </Modal>
    </div>
  );
}
