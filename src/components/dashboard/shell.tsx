"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Banknote, Boxes, CreditCard, Download, ExternalLink, Gavel, Heart, LayoutDashboard, LogOut, Menu,
  Package, Percent, Receipt, Settings, ShieldCheck, Store, Tags, UserCog, Users, Share2, X,
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationDropdown } from "./notification-dropdown";
import { Avatar } from "@/components/ui/primitives";
import { signOut } from "@/app/(auth)/actions";
import { cn, siteHost } from "@/lib/utils";
import type { Notification } from "@/lib/types";

type Area = "customer" | "creator" | "admin";
type NavItem = { href: string; label: string; icon: React.ElementType; exact?: boolean };

const NAV: Record<Area, { group?: string; items: NavItem[] }[]> = {
  creator: [
    { items: [
      { href: "/creator", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/creator/products", label: "Products", icon: Package },
      { href: "/creator/orders", label: "Orders", icon: Receipt },
      { href: "/creator/customers", label: "Customers", icon: Users },
      { href: "/creator/analytics", label: "Analytics", icon: BarChart3 },
    ] },
    { group: "Grow", items: [
      { href: "/creator/coupons", label: "Discount codes", icon: Percent },
      { href: "/creator/affiliates", label: "Affiliates", icon: Share2 },
    ] },
    { group: "Money", items: [
      { href: "/creator/payouts", label: "Payouts", icon: Banknote },
    ] },
    { group: "Store", items: [
      { href: "/creator/storefront", label: "Storefront", icon: Store },
      { href: "/creator/settings", label: "Settings", icon: Settings },
    ] },
  ],
  customer: [
    { items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/downloads", label: "Library", icon: Download },
      { href: "/dashboard/orders", label: "Orders", icon: Receipt },
      { href: "/dashboard/wishlist", label: "Wishlist", icon: Heart },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ] },
  ],
  admin: [
    { items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/admin/moderation", label: "Moderation", icon: Gavel },
      { href: "/admin/creators", label: "Creators", icon: Store },
      { href: "/admin/users", label: "Users", icon: UserCog },
      { href: "/admin/transactions", label: "Transactions", icon: CreditCard },
      { href: "/admin/payouts", label: "Payouts", icon: Banknote },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/settings", label: "Platform settings", icon: ShieldCheck },
    ] },
  ],
};

const AREA_SWITCH: Record<Area, { href: string; label: string; icon: React.ElementType }> = {
  creator: { href: "/creator", label: "Creator studio", icon: Boxes },
  customer: { href: "/dashboard", label: "My purchases", icon: Tags },
  admin: { href: "/admin", label: "Admin", icon: ShieldCheck },
};

export function DashboardShell({
  area, user, storeHandle, notifications, areas, children,
}: {
  area: Area;
  user: { id: string; name: string; email: string; avatar: string | null };
  storeHandle?: string;
  notifications: Notification[];
  areas: Area[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (i: NavItem) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + "/"));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo href={AREA_SWITCH[area].href} />
        <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      {area === "creator" && storeHandle && (
        <Link href={`/${storeHandle}`} target="_blank" className="mx-3 mb-3 flex items-center justify-between rounded-xl border bg-bg px-3 py-2.5 text-sm hover:border-fg/25">
          <span className="truncate text-muted">{siteHost()}/<span className="text-fg">{storeHandle}</span></span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" />
        </Link>
      )}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Dashboard">
        {NAV[area].map((g, gi) => (
          <div key={gi}>
            {g.group && <p className="mb-1 px-3 text-xs font-medium text-muted">{g.group}</p>}
            <ul className="space-y-0.5">
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} onClick={() => setOpen(false)} aria-current={active(i) ? "page" : undefined}
                    className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2 text-[14.5px] transition-colors",
                      active(i) ? "bg-brand-soft font-medium text-brand" : "text-fg/75 hover:bg-surface-2 hover:text-fg")}>
                    <i.icon className="h-[18px] w-[18px]" aria-hidden /> {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t p-3">
        {areas.filter((a) => a !== area).map((a) => {
          const s = AREA_SWITCH[a];
          return (
            <Link key={a} href={s.href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-fg/75 hover:bg-surface-2">
              <s.icon className="h-4 w-4" /> {s.label}
            </Link>
          );
        })}
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <Avatar name={user.name} src={user.avatar} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <form action={signOut}>
            <button className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Log out" title="Log out"><LogOut className="h-4 w-4" /></button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r bg-surface lg:block">{sidebar}</aside>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-[#0D1220]/45" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.aside className="absolute inset-y-0 left-0 w-72 bg-surface" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}>{sidebar}</motion.aside>
          </div>
        )}
      </AnimatePresence>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-bg/85 px-4 backdrop-blur-md sm:px-6">
          <button className="-ml-2 rounded-xl p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <Link href="/marketplace" className="hidden text-sm text-muted hover:text-fg sm:block">Marketplace</Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationDropdown userId={user.id} initial={notifications} />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
