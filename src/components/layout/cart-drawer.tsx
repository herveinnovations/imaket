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
    <button onClick={() => setOpen(true)} className="grid h-10 min-w-10 place-items-center px-1"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
      {/* Wix cart icon: count inside a black circle */}
      <motion.span key={count} initial={{ scale: 0.7 }} animate={{ scale: 1 }}
        className="grid h-[30px] min-w-[30px] place-items-center rounded-full bg-black px-1.5 text-[15px] font-bold text-lime tabular-nums">
        {count}
      </motion.span>
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
          <motion.div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside
            className="absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col bg-white"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 32, stiffness: 320 }}
          >
            <header className="flex items-center justify-between bg-lime px-5 py-4">
              <h2 className="text-2xl">Cart <span className="font-sans text-base tracking-normal">({s.count} {s.count === 1 ? "item" : "items"})</span></h2>
              <button onClick={() => setOpen(false)} className="p-2" aria-label="Close cart"><X className="h-6 w-6" /></button>
            </header>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
                <ShoppingBag className="h-10 w-10" />
                <p className="font-display text-2xl">Cart is empty</p>
                <ButtonLink href="/marketplace" className="mt-2" onClick={() => setOpen(false)}>Continue Browsing</ButtonLink>
              </div>
            ) : (
              <>
                <ul className="flex-1 divide-y divide-black/15 overflow-y-auto px-5">
                  {items.map((i) => (
                    <li key={i.productId} className="flex gap-3 py-4">
                      <ProductCover id={i.productId} title={i.title} type={i.type} coverUrl={i.coverUrl} size="sm" className="h-24 w-24 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/p/${i.slug}`} onClick={() => setOpen(false)} className="line-clamp-2 text-[15px] hover:underline">{i.title}</Link>
                        <p className="text-sm">{formatMoney(lineUnit(i), i.currency)}</p>
                        <p className="text-xs text-muted">{i.creatorName}</p>
                        <div className="mt-2 flex items-center justify-between">
                          {["physical", "ticket"].includes(i.type) ? (
                            <div className="flex items-center border border-black/60">
                              <button className="p-1.5 text-muted hover:text-fg" onClick={() => setQty(i.productId, i.quantity - 1)} aria-label="Decrease quantity"><Minus className="h-3.5 w-3.5" /></button>
                              <span className="w-6 text-center text-sm tabular-nums">{i.quantity}</span>
                              <button className="p-1.5 text-muted hover:text-fg" onClick={() => setQty(i.productId, i.quantity + 1)} aria-label="Increase quantity"><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : <span />}
                          <span className="text-sm">{formatMoney(lineUnit(i) * i.quantity, i.currency)}</span>
                        </div>
                      </div>
                      <button onClick={() => remove(i.productId)} className="self-start p-1.5 hover:text-danger" aria-label={`Remove ${i.title}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <footer className="space-y-3 border-t border-black px-5 py-5">
                  {mixed ? (
                    <p className="bg-lime p-3 text-sm">Your cart has items priced in {s.currencies.join(" and ")}. Each currency checks out separately.</p>
                  ) : (
                    <>
                                            {s.shipping > 0 && <div className="flex justify-between text-sm text-muted"><span>Delivery</span><span>{formatMoney(s.shipping, s.currencies[0])}</span></div>}
                      <div className="flex justify-between text-xl"><span>Subtotal</span><span>{formatMoney(s.total, s.currencies[0])}</span></div>
                      <p className="text-sm text-muted">Taxes and discount codes are applied at checkout.</p>
                    </>
                  )}
                  <ButtonLink href="/checkout" size="lg" className="w-full" onClick={() => setOpen(false)}>Checkout</ButtonLink>
                  <button onClick={() => setOpen(false)} className="w-full text-center text-sm underline underline-offset-4">Continue Browsing</button>
                </footer>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
