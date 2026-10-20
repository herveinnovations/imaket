"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { cartSummary, lineUnit, useCart } from "@/store/cart";
import { ProductCover } from "@/components/product/product-cover";
import { ButtonLink } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";

export function CartButton() {
  const items = useCart((s) => s.items);
  const setOpen = useCart((s) => s.setOpen);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? cartSummary(items).count : 0;
  return (
    <button onClick={() => setOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-xl text-fg/80 hover:bg-surface-2 hover:text-fg"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
      <ShoppingBag className="h-[19px] w-[19px]" />
      <AnimatePresence>
        {count > 0 && (
          <motion.span key={count} initial={{ scale: 0.4 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-[#1d1500]">
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export function CartDrawer() {
  const { items, open, setOpen, remove, setQty } = useCart();
  const s = cartSummary(items);
  const mixed = s.currencies.length > 1;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Your cart">
          <motion.div className="absolute inset-0 bg-[#0D1220]/45" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-surface shadow-lift"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 32, stiffness: 320 }}
          >
            <header className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-semibold">Your cart</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Close cart"><X className="h-5 w-5" /></button>
            </header>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
                <ShoppingBag className="h-10 w-10 text-muted" />
                <p className="font-medium">Your cart is empty</p>
                <p className="text-sm text-muted">Browse the marketplace to find guides, courses, tickets and more.</p>
                <ButtonLink href="/marketplace" variant="secondary" className="mt-2" onClick={() => setOpen(false)}>Browse the marketplace</ButtonLink>
              </div>
            ) : (
              <>
                <ul className="flex-1 divide-y overflow-y-auto px-5">
                  {items.map((i) => (
                    <li key={i.productId} className="flex gap-3 py-4">
                      <ProductCover id={i.productId} title={i.title} type={i.type} size="sm" className="h-20 w-16 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/p/${i.slug}`} onClick={() => setOpen(false)} className="line-clamp-2 text-sm font-medium hover:underline">{i.title}</Link>
                        <p className="text-xs text-muted">{i.creatorName}</p>
                        <div className="mt-2 flex items-center justify-between">
                          {["physical", "ticket"].includes(i.type) ? (
                            <div className="flex items-center rounded-lg border">
                              <button className="p-1.5 text-muted hover:text-fg" onClick={() => setQty(i.productId, i.quantity - 1)} aria-label="Decrease quantity"><Minus className="h-3.5 w-3.5" /></button>
                              <span className="w-6 text-center text-sm tabular-nums">{i.quantity}</span>
                              <button className="p-1.5 text-muted hover:text-fg" onClick={() => setQty(i.productId, i.quantity + 1)} aria-label="Increase quantity"><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : <span />}
                          <span className="text-sm font-semibold">{formatMoney(lineUnit(i) * i.quantity, i.currency)}</span>
                        </div>
                      </div>
                      <button onClick={() => remove(i.productId)} className="self-start rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-danger" aria-label={`Remove ${i.title}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <footer className="space-y-3 border-t px-5 py-4">
                  {mixed ? (
                    <p className="rounded-xl bg-accent/15 p-3 text-sm">Your cart has items priced in {s.currencies.join(" and ")}. Each currency checks out separately.</p>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm text-muted"><span>Subtotal</span><span>{formatMoney(s.subtotal, s.currencies[0])}</span></div>
                      {s.shipping > 0 && <div className="flex justify-between text-sm text-muted"><span>Delivery</span><span>{formatMoney(s.shipping, s.currencies[0])}</span></div>}
                      <div className="flex justify-between font-semibold"><span>Total</span><span>{formatMoney(s.total, s.currencies[0])}</span></div>
                    </>
                  )}
                  <ButtonLink href="/checkout" size="lg" className="w-full" onClick={() => setOpen(false)}>Go to checkout</ButtonLink>
                </footer>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
