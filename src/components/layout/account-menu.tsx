"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { signOut } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

type U = { name: string; avatar: string | null; isAdmin: boolean; isCreator: boolean; handle: string | null } | null;

/** Wix-style member login bar: avatar icon + "Log In", or the member's avatar with a menu. */
export function AccountMenu({ user, compact }: { user: U; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (!user) {
    return (
      <Link href="/login" className="flex h-10 items-center gap-2 px-1.5 text-[17px] hover:underline hover:underline-offset-4 xl:text-[19px]" aria-label="Log in">
        <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-black text-lime"><UserRound className="h-4 w-4" aria-hidden /></span>
        {!compact && <span>Log In</span>}
      </Link>
    );
  }

  const links: [string, string][] = [
    ["/dashboard/orders", "My Orders"],
    ["/dashboard/downloads", "My Library"],
    ["/dashboard/wishlist", "My Wishlist"],
    ["/members", "Members"],
    ["/dashboard/settings", "My Account"],
    ...(user.isCreator ? [["/creator", "Creator Studio"] as [string, string]] : [["/register?role=creator", "Start Selling"] as [string, string]]),
    ...(user.handle ? [[`/${user.handle}`, "My Store"] as [string, string]] : []),
    ...(user.isAdmin ? [["/admin", "Admin"] as [string, string]] : []),
  ];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex h-10 items-center gap-1.5 px-1" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        <Avatar name={user.name} src={user.avatar} size={30} />
        {!compact && <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />}
      </button>
      {open && (
        <div role="menu" className={cn("absolute top-full z-50 mt-1 w-56 border border-black bg-white py-2 text-[15px] text-black", compact ? "left-0" : "right-0")}>
          <p className="truncate px-4 pb-2 font-bold">{user.name}</p>
          {links.map(([href, label]) => (
            <Link key={href} role="menuitem" href={href} onClick={() => setOpen(false)} className="block px-4 py-1.5 hover:bg-lime">{label}</Link>
          ))}
          <form action={signOut} className="mt-1 border-t border-black/15 pt-1">
            <button role="menuitem" className="w-full px-4 py-1.5 text-left hover:bg-lime">Log Out</button>
          </form>
        </div>
      )}
    </div>
  );
}
