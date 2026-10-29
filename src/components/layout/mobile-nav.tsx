"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Search, X } from "lucide-react";
import { LogoMark } from "./logo";

const ITEMS: [string, string][] = [
  ["/marketplace", "All Products"],
  ["/marketplace?audience=men", "Men"],
  ["/marketplace?audience=women", "Women"],
  ["/marketplace?new=1", "New"],
  ["/groups", "Groups"],
  ["/members", "Members"],
  ["/register?role=creator", "Sell on iMaket"],
];

/** Full-screen lime menu, as on the Wix mobile site. */
export function MobileNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center lg:hidden" aria-label="Open menu">
        <Menu className="h-7 w-7" strokeWidth={2.2} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex flex-col bg-lime text-black lg:hidden" role="dialog" aria-modal="true" aria-label="Menu"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <div className="flex h-[62px] items-center justify-between px-3">
              <LogoMark />
              <button onClick={close} className="grid h-10 w-10 place-items-center" aria-label="Close menu"><X className="h-7 w-7" /></button>
            </div>
            <nav className="flex-1 overflow-y-auto px-6 pb-10 pt-6">
              <ul className="space-y-1">
                {ITEMS.map(([href, label]) => (
                  <li key={href}><Link href={href} onClick={close} className="block py-2 font-display text-[2rem] leading-tight tracking-[-0.05em]">{label}</Link></li>
                ))}
                <li><Link href={signedIn ? "/dashboard" : "/login"} onClick={close} className="block py-2 font-display text-[2rem] leading-tight tracking-[-0.05em]">{signedIn ? "My Account" : "Log In"}</Link></li>
              </ul>
              <form action="/marketplace" className="relative mt-8" role="search" onSubmit={close}>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" />
                <input name="q" type="search" placeholder="Search products and stores" aria-label="Search"
                  className="h-12 w-full border-2 border-black bg-white pl-11 pr-3 text-base focus:outline-none" />
              </form>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
