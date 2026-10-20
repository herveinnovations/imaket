import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { CartButton, CartDrawer } from "./cart-drawer";
import { MobileNav } from "./mobile-nav";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/primitives";
import { getSession } from "@/lib/auth";

export async function SiteHeader() {
  const session = await getSession();
  const dashHref = session?.user.role === "admin" ? "/admin" : session?.creator ? "/creator" : "/dashboard";
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-fg/5 bg-bg/85 backdrop-blur-md">
        <div className="container flex h-16 items-center gap-4">
          <MobileNav signedIn={!!session} dashHref={dashHref} />
          <Logo />
          <nav className="ml-4 hidden items-center gap-1 text-[15px] md:flex" aria-label="Main">
            <Link href="/marketplace" className="rounded-lg px-3 py-2 text-fg/80 hover:text-fg">Marketplace</Link>
            <Link href="/#sell" className="rounded-lg px-3 py-2 text-fg/80 hover:text-fg">Sell on iMaket</Link>
            <Link href="/#pricing" className="rounded-lg px-3 py-2 text-fg/80 hover:text-fg">Pricing</Link>
          </nav>
          <form action="/marketplace" className="relative ml-auto hidden w-full max-w-xs lg:block" role="search">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input name="q" type="search" placeholder="Search products and creators" aria-label="Search"
              className="h-10 w-full rounded-xl border bg-surface pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15" />
          </form>
          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <ThemeToggle />
            <CartButton />
            {session ? (
              <Link href={dashHref} className="ml-1 rounded-full" aria-label="Your dashboard">
                <Avatar name={session.user.full_name ?? session.user.email} src={session.user.avatar_url} size={36} />
              </Link>
            ) : (
              <div className="ml-1 hidden items-center gap-1 sm:flex">
                <ButtonLink href="/login" variant="ghost" size="sm">Log in</ButtonLink>
                <ButtonLink href="/register?role=creator" size="sm">Start selling</ButtonLink>
              </div>
            )}
          </div>
        </div>
      </header>
      <CartDrawer />
    </>
  );
}
