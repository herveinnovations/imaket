"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ExternalLink, MoreHorizontal, Package, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProductUploadModal } from "./product-upload-modal";
import { ProductCover } from "@/components/product/product-cover";
import { EmptyState, StatusBadge, Table, THead } from "@/components/ui/primitives";
import { cn, formatMoney, PRODUCT_TYPE_LABEL } from "@/lib/utils";
import type { Category, Product, ProductStatus } from "@/lib/types";

const FILTERS: (ProductStatus | "all")[] = ["all", "published", "pending_review", "draft", "rejected", "archived"];

export function ProductsTable({ products, categories, currency }: { products: Product[]; categories: Category[]; currency: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const shown = filter === "all" ? products : products.filter((p) => p.status === filter);

  async function act(p: Product, action: "archive" | "delete") {
    setMenu(null);
    if (action === "delete" && !confirm(`Delete “${p.title}”? Buyers keep access to what they already bought.`)) return;
    const res = await fetch(`/api/products/${p.id}`, action === "delete"
      ? { method: "DELETE" }
      : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "archived" }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(json.error ?? "That didn't work.");
    toast.success(action === "delete" ? "Product deleted" : "Product archived");
    router.refresh();
  }

  if (!products.length) {
    return <EmptyState icon={Package} title="Add your first product" body="It takes about five minutes. Upload a file, set a price, and share the link." />;
  }

  return (
    <>
      <div className="mb-4 flex gap-1 overflow-x-auto scrollbar-none" role="tablist">
        {FILTERS.map((f) => {
          const n = f === "all" ? products.length : products.filter((p) => p.status === f).length;
          return (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm", filter === f ? "bg-fg text-bg" : "text-muted hover:bg-surface-2 hover:text-fg")}>
              {f === "all" ? "All" : f.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
      </div>
      <Table>
        <THead cols={["Product", "Status", { label: "Price", className: "text-right" }, { label: "Sales", className: "text-right" }, { label: "Stock", className: "text-right" }, ""]} />
        <tbody className="divide-y">
          {shown.map((p) => (
            <tr key={p.id} className="hover:bg-surface-2/40">
              <td data-label="">
                <div className="flex items-center gap-3">
                  <ProductCover id={p.id} title={p.title} type={p.type} coverUrl={p.cover_url} size="sm" className="h-14 w-11 shrink-0 rounded-lg" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="text-xs text-muted">{PRODUCT_TYPE_LABEL[p.type]}</p>
                    {p.status === "rejected" && p.rejection_reason && <p className="mt-1 text-xs text-danger">{p.rejection_reason}</p>}
                  </div>
                </div>
              </td>
              <td data-label="Status"><StatusBadge status={p.status} /></td>
              <td data-label="Price" className="text-right tabular-nums">{formatMoney(p.price, p.currency)}</td>
              <td data-label="Sales" className="text-right tabular-nums">{p.sales_count.toLocaleString()}</td>
              <td data-label="Stock" className="text-right tabular-nums">{p.track_inventory ? p.inventory_qty ?? 0 : "∞"}</td>
              <td className="relative text-right">
                <button onClick={() => setMenu(menu === p.id ? null : p.id)} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label={`Actions for ${p.title}`} aria-expanded={menu === p.id}>
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menu === p.id && (
                  <div className="absolute right-4 top-12 z-20 w-44 overflow-hidden rounded-xl border bg-surface py-1 text-left text-sm shadow-lift">
                    <button onClick={() => { setEditing(p); setMenu(null); }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-2"><Pencil className="h-4 w-4" /> Edit</button>
                    {p.status === "published" && <Link href={`/p/${p.slug}`} target="_blank" className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2"><ExternalLink className="h-4 w-4" /> View live</Link>}
                    {p.status !== "archived" && <button onClick={() => act(p, "archive")} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-surface-2"><Archive className="h-4 w-4" /> Archive</button>}
                    <button onClick={() => act(p, "delete")} className="flex w-full items-center gap-2 px-3 py-2 text-danger hover:bg-surface-2"><Trash2 className="h-4 w-4" /> Delete</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editing && <ProductUploadModal key={editing.id} open onClose={() => setEditing(null)} categories={categories} currency={currency} product={editing} />}
    </>
  );
}
