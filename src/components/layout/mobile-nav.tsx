"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Search, X } from "lucide-react";
import { Logo } from "./logo";

export function MobileNav({ signedIn, dashHref }: { signedIn: boolean; dashHref: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="-ml-2 grid h-10 w-10 place-items-center rounded-xl md:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
            <motion.div className="absolute inset-0 bg-[#0D1220]/45" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.nav className="absolute inset-y-0 left-0 flex w-[84%] max-w-sm flex-col bg-surface p-5"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 30, stiffness: 320 }}>
              <div className="flex items-center justify-between">
                <Logo />
                <button onClick={close} className="rounded-lg p-2" aria-label="Close menu"><X className="h-5 w-5" /></button>
              </div>
              <form action="/marketplace" className="relative mt-6" role="search" onSubmit={close}>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input name="q" type="search" placeholder="Search" className="input pl-9" aria-label="Search" />
              </form>
              <ul className="mt-6 space-y-1 text-lg">
                {[["/marketplace", "Marketplace"], ["/#sell", "Sell on iMaket"], ["/#pricing", "Pricing"],
                  ...(signedIn ? [[dashHref, "Dashboard"]] : [["/login", "Log in"], ["/register?role=creator", "Start selling"]])]
                  .map(([href, label]) => (
                    <li key={href}><Link href={href} onClick={close} className="block rounded-xl px-3 py-2.5 hover:bg-surface-2">{label}</Link></li>
                  ))}
              </ul>
            </motion.nav>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
