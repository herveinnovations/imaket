"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WishlistButton } from "./wishlist-button";
import { useCart } from "@/store/cart";
import { formatMoney } from "@/lib/utils";
import type { Product } from "@/lib/types";

export function PurchasePanel({ product: p }: { product: Product }) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const setOpen = useCart((s) => s.setOpen);
  const multi = p.type === "physical" || p.type === "ticket";
  const soldOut = p.track_inventory && p.inventory_qty === 0;
  const maxQty = p.track_inventory ? p.inventory_qty ?? 50 : 50;
  const [qty, setQty] = useState(1);
  const [custom, setCustom] = useState(String(p.price));
  const customNum = Number(custom);
  const pwywError = p.pay_what_you_want && (Number.isNaN(customNum) || customNum < (p.min_price ?? 0))
    ? `Enter at least ${formatMoney(p.min_price ?? 0, p.currency)}` : null;

  function addToCart(goToCheckout = false) {
    if (pwywError) return toast.error(pwywError);
    add(p, { quantity: qty, customPrice: p.pay_what_you_want ? customNum : undefined });
    fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "add_to_cart", productId: p.id, creatorId: p.creator_id }) }).catch(() => {});
    if (goToCheckout) {
      setOpen(false);
      router.push("/checkout");
    } else {
      toast.success("Added to cart");
    }
  }

  return (
    <div className="space-y-4">
      {p.pay_what_you_want ? (
        <div>
          <label htmlFor="pwyw" className="label">Name your price</label>
          <div className="relative">
            <input id="pwyw" inputMode="decimal" className="input h-14 pl-16 text-2xl font-semibold" value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ""))} aria-invalid={!!pwywError} aria-describedby="pwyw-hint" />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">{p.currency}</span>
          </div>
          <p id="pwyw-hint" className={`mt-1.5 text-sm ${pwywError ? "text-danger" : "text-muted"}`}>
            {pwywError ?? `Minimum ${formatMoney(p.min_price ?? 0, p.currency)}. Suggested ${formatMoney(p.price, p.currency)}.`}
          </p>
        </div>
      ) : (
        <p className="flex items-baseline gap-3">
          <span className="font-display text-4xl font-bold tracking-tight">{formatMoney(p.price, p.currency)}</span>
          {p.compare_at_price && <s className="text-lg text-muted">{formatMoney(p.compare_at_price, p.currency)}</s>}
        </p>
      )}

      {multi && !soldOut && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{p.type === "ticket" ? "Tickets" : "Quantity"}</span>
          <div className="flex items-center rounded-xl border bg-surface">
            <button className="p-2.5 text-muted hover:text-fg disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty(qty - 1)} aria-label="Decrease"><Minus className="h-4 w-4" /></button>
            <span className="w-8 text-center tabular-nums" aria-live="polite">{qty}</span>
            <button className="p-2.5 text-muted hover:text-fg disabled:opacity-40" disabled={qty >= maxQty} onClick={() => setQty(qty + 1)} aria-label="Increase"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <Button size="lg" disabled={soldOut} onClick={() => addToCart(true)}>{soldOut ? "Sold out" : p.type === "ticket" ? "Get tickets" : "Buy now"}</Button>
        <div className="grid grid-cols-[1fr_auto] gap-2.5">
          <Button size="lg" variant="secondary" disabled={soldOut} onClick={() => addToCart(false)}>Add to cart</Button>
          <WishlistButton productId={p.id} withLabel className="h-[52px]" />
        </div>
      </div>
    </div>
  );
}
