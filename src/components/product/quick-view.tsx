"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, X } from "lucide-react";
import { ProductCover } from "./product-cover";
import { useCart } from "@/store/cart";
import { formatMoney, PRODUCT_TYPE_LABEL } from "@/lib/utils";
import type { Product } from "@/lib/types";

/** The translucent "Quick View" bar on product tiles, and the modal it opens. */
export function QuickViewButton({ product: p }: { product: Product }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="absolute inset-x-0 bottom-0 h-[50px] translate-y-full bg-white/75 text-sm transition-transform duration-200 focus:translate-y-0 group-hover:translate-y-0 max-md:hidden">
        Quick View
      </button>
      <QuickViewModal product={p} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function QuickViewModal({ product: p, open, onClose }: { product: Product; open: boolean; onClose: () => void }) {
  const add = useCart((s) => s.add);
  const multi = p.type === "physical" || p.type === "ticket";
  const soldOut = p.track_inventory && p.inventory_qty === 0;
  const maxQty = p.track_inventory ? p.inventory_qty ?? 50 : 50;
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[55] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={`Quick view: ${p.title}`}>
          <motion.div className="absolute inset-0 bg-black/50" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="relative grid w-full max-w-4xl overflow-y-auto bg-white md:grid-cols-2" style={{ maxHeight: "90vh" }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}>
            <button onClick={onClose} className="absolute right-2 top-2 z-10 grid h-10 w-10 place-items-center bg-white/80" aria-label="Close"><X className="h-5 w-5" /></button>
            <ProductCover id={p.id} title={p.title} type={p.type} creator={p.creator?.store_name} coverUrl={p.cover_url} className="aspect-square bg-surface-2" />
            <div className="flex flex-col p-6 md:p-8">
              <p className="text-sm text-muted">{PRODUCT_TYPE_LABEL[p.type]}{p.creator && <> · {p.creator.store_name}</>}</p>
              <h2 className="mt-1 text-[1.9rem]">{p.title}</h2>
              <p className="mt-2 text-[15px]">
                {p.compare_at_price && p.compare_at_price > p.price && <s className="mr-2 text-muted">{formatMoney(p.compare_at_price, p.currency)}</s>}
                {p.pay_what_you_want ? `From ${formatMoney(p.min_price ?? 0, p.currency)}` : formatMoney(p.price, p.currency)}
              </p>
              {multi && !soldOut && (
                <fieldset className="mt-6">
                  <legend className="mb-1.5 text-[15px]">Quantity</legend>
                  <QtyStepper qty={qty} setQty={setQty} max={maxQty} />
                </fieldset>
              )}
              <button disabled={soldOut} onClick={() => { add(p, { quantity: qty, customPrice: p.pay_what_you_want ? p.price : undefined }); onClose(); }}
                className="mt-6 h-10 w-full rounded-full bg-brand text-base text-white hover:bg-[#006b20] disabled:opacity-50">
                {soldOut ? "Out of Stock" : "Add to Cart"}
              </button>
              <Link href={`/p/${p.slug}`} onClick={onClose} className="mt-4 text-[15px] underline underline-offset-4">View More Details</Link>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function QtyStepper({ qty, setQty, max }: { qty: number; setQty: (n: number) => void; max: number }) {
  return (
    <div className="inline-flex h-[38px] items-center border border-black/60 bg-white">
      <button type="button" className="grid h-full w-7 place-items-center disabled:opacity-30" disabled={qty <= 1} onClick={() => setQty(qty - 1)} aria-label="Decrement"><Minus className="h-3.5 w-3.5" /></button>
      <span className="w-[46px] text-center tabular-nums" aria-live="polite">{qty}</span>
      <button type="button" className="grid h-full w-7 place-items-center disabled:opacity-30" disabled={qty >= max} onClick={() => setQty(qty + 1)} aria-label="Increment"><Plus className="h-3.5 w-3.5" /></button>
    </div>
  );
}
