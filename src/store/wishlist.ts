"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistState {
  ids: string[];
  toggle: (id: string) => boolean; // returns new saved state
  has: (id: string) => boolean;
}

/** Local wishlist; also mirrored to the `wishlists` table when signed in (see WishlistButton). */
export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const saved = !get().ids.includes(id);
        set({ ids: saved ? [...get().ids, id] : get().ids.filter((x) => x !== id) });
        return saved;
      },
      has: (id) => get().ids.includes(id),
    }),
    { name: "sk-wishlist" },
  ),
);
