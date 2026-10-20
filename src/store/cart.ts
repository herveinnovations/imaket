"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/types";

export interface CartItem {
  productId: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  type: Product["type"];
  creatorName: string;
  creatorId: string;
  quantity: number;
  customPrice?: number;
  requiresShipping: boolean;
  shippingFee: number;
  maxQty?: number | null;
}

interface CartState {
  items: CartItem[];
  open: boolean;
  setOpen: (o: boolean) => void;
  add: (p: Product, opts?: { quantity?: number; customPrice?: number }) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, q: number) => void;
  clear: () => void;
}

const MULTI = new Set(["physical", "ticket"]);

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      open: false,
      setOpen: (open) => set({ open }),
      add: (p, opts) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === p.id);
          if (existing) {
            if (!MULTI.has(p.type)) return { open: true };
            return {
              open: true,
              items: s.items.map((i) =>
                i.productId === p.id ? { ...i, quantity: Math.min(i.quantity + (opts?.quantity ?? 1), i.maxQty ?? 50) } : i),
            };
          }
          return {
            open: true,
            items: [
              ...s.items,
              {
                productId: p.id, slug: p.slug, title: p.title, price: p.price, currency: p.currency, type: p.type,
                creatorName: p.creator?.store_name ?? "", creatorId: p.creator_id,
                quantity: MULTI.has(p.type) ? opts?.quantity ?? 1 : 1, customPrice: opts?.customPrice,
                requiresShipping: p.requires_shipping, shippingFee: p.shipping_fee,
                maxQty: p.track_inventory ? p.inventory_qty : null,
              },
            ],
          };
        }),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.productId !== id) })),
      setQty: (id, q) =>
        set((s) => ({ items: s.items.map((i) => (i.productId === id ? { ...i, quantity: Math.max(1, Math.min(q, i.maxQty ?? 50)) } : i)) })),
      clear: () => set({ items: [] }),
    }),
    { name: "sk-cart", partialize: (s) => ({ items: s.items }) },
  ),
);

export const lineUnit = (i: CartItem) => i.customPrice ?? i.price;

export function cartSummary(items: CartItem[]) {
  const currencies = [...new Set(items.map((i) => i.currency))];
  const subtotal = items.reduce((s, i) => s + lineUnit(i) * i.quantity, 0);
  const shipping = items.reduce((s, i) => s + (i.requiresShipping ? i.shippingFee : 0), 0);
  return { currencies, subtotal, shipping, total: subtotal + shipping, count: items.reduce((s, i) => s + i.quantity, 0) };
}
