"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useWishlist } from "@/store/wishlist";
import { cn } from "@/lib/utils";

export function WishlistButton({ productId, className, withLabel }: { productId: string; className?: string; withLabel?: boolean }) {
  const toggle = useWishlist((s) => s.toggle);
  const saved = useWishlist((s) => s.ids.includes(productId));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const on = mounted && saved;

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    const nowSaved = toggle(productId);
    toast(nowSaved ? "Saved to wishlist" : "Removed from wishlist");
    // Mirror to the server for signed-in users (silently ignored when signed out / demo)
    fetch("/api/wishlist", {
      method: nowSaved ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    }).catch(() => {});
  }

  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? "Remove from wishlist" : "Save to wishlist"}
      className={cn(
        withLabel
          ? "inline-flex h-11 items-center gap-2 rounded-xl border bg-surface px-4 text-[15px] font-medium hover:bg-surface-2"
          : "grid h-9 w-9 place-items-center rounded-full bg-surface/90 text-fg shadow-sm backdrop-blur hover:bg-surface",
        className,
      )}
    >
      <motion.span key={String(on)} initial={{ scale: on ? 0.6 : 1 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
        <Heart className={cn("h-[18px] w-[18px]", on && "fill-danger text-danger")} />
      </motion.span>
      {withLabel && (on ? "Saved" : "Save")}
    </button>
  );
}
