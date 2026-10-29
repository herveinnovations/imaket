import Link from "next/link";
import { Logo } from "./logo";
import { CartButton, CartDrawer } from "./cart-drawer";
import { MobileNav } from "./mobile-nav";
import { AccountMenu } from "./account-menu";
import { getSession } from "@/lib/auth";

export const NAV = [
  ["/marketplace", "All Products"],
  ["/marketplace?audience=men", "Men"],
  ["/marketplace?audience=women", "Women"],
  ["/marketplace?new=1", "New"],
  ["/groups", "Groups"],
  ["/members", "Members"],
] as const;

export async function SiteHeader() {
  const session = await getSession();
  const user = session
    ? {
        name: session.user.full_name ?? session.user.email,
        avatar: session.user.avatar_url,
        isAdmin: session.user.role === "admin",
        isCreator: !!session.creator,
        handle: session.creator?.handle ?? null,
      }
    : null;

  return (
    <>
      <header className="sticky top-0 z-40 bg-lime text-black">
        <div className="relative flex h-[62px] items-center px-2.5 sm:px-3">
          {/* mobile: account left */}
          <div className="lg:hidden"><AccountMenu user={user} compact /></div>

          <nav className="hidden min-w-0 max-w-[calc(50%-90px)] items-center gap-0.5 overflow-x-auto scrollbar-none lg:flex" aria-label="Main">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="shrink-0 whitespace-nowrap px-2 py-1.5 text-[16px] hover:underline hover:underline-offset-4 xl:text-[19px]">
                {label}
              </Link>
            ))}
          </nav>

          <Logo className="absolute left-1/2 -translate-x-1/2" />

          <div className="ml-auto flex items-center gap-1">
            <div className="hidden lg:block"><AccountMenu user={user} /></div>
            <CartButton />
            <MobileNav signedIn={!!user} />
          </div>
        </div>
      </header>
      <CartDrawer />
    </>
  );
}
