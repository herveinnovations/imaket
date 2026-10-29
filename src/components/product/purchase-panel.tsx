"use client";

import { useRouter } from "next/navigation";
import { startNavigation } from "@/components/ui/page-loader";
import { useState } from "react";
import { toast } from "sonner";
import { QtyStepper } from "./quick-view";
import { WishlistButton } from "./wishlist-button";
import { useCart } from "@/store/cart";
import { formatMoney } from "@/lib/utils";
import type { Product } from "@/lib/types";

/** Price, quantity, green "Add to Cart" and outlined "Buy Now" (Wix product page). */
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
      startNavigation();
      router.push("/checkout");
    }
  }

  return (
    <div>
      {p.pay_what_you_want ? (
        <div className="mt-2">
          <label htmlFor="pwyw" className="mb-1.5 block text-[15px]">Name your price</label>
          <div className="relative">
            <input id="pwyw" inputMode="decimal" className="h-11 w-full border border-black/60 pl-14 pr-3 text-lg" value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ""))} aria-invalid={!!pwywError} aria-describedby="pwyw-hint" />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">{p.currency}</span>
          </div>
          <p id="pwyw-hint" className={`mt-1.5 text-sm ${pwywError ? "text-danger" : ""}`}>
            {pwywError ?? `Minimum ${formatMoney(p.min_price ?? 0, p.currency)}. Suggested ${formatMoney(p.price, p.currency)}.`}
          </p>
        </div>
      ) : (
        <p className="text-[15px]">
          <span className="sr-only">Price</span>
          {p.compare_at_price && p.compare_at_price > p.price && <s className="mr-2 text-muted">{formatMoney(p.compare_at_price, p.currency)}</s>}
          {formatMoney(p.price, p.currency)}
        </p>
      )}

      {multi && !soldOut && (
        <fieldset className="mt-6">
          <legend className="mb-1.5 text-[15px]">{p.type === "ticket" ? "Tickets" : "Quantity"}</legend>
          <QtyStepper qty={qty} setQty={setQty} max={maxQty} />
        </fieldset>
      )}

      <div className="mt-6 space-y-3">
        <button disabled={soldOut} onClick={() => addToCart(false)}
          className="h-10 w-full rounded-[20px] bg-brand text-base text-white hover:bg-[#006b20] disabled:opacity-50">
          {soldOut ? "Out of Stock" : "Add to Cart"}
        </button>
        <div className="flex gap-3">
          <button disabled={soldOut} onClick={() => addToCart(true)}
            className="h-[42px] flex-1 rounded-[20px] border border-black text-base hover:bg-black hover:text-white disabled:opacity-50">
            {p.type === "ticket" ? "Get Tickets" : "Buy Now"}
          </button>
          <WishlistButton productId={p.id} className="h-[42px] w-[42px] rounded-full border border-black" />
        </div>
      </div>
    </div>
  );
}
