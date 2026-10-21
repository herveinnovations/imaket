import Link from "next/link";
import { BadgeCheck, Check } from "lucide-react";
import { SaleStream } from "@/components/marketing/sale-stream";
import { ProductCard } from "@/components/product/product-card";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/primitives";
import { getFeaturedCreators, getProducts } from "@/lib/data/catalog";
import { formatCompact, formatMoney, siteHost } from "@/lib/utils";

const SELLABLE = [
  { type: "digital", name: "Downloads", example: "Budget spreadsheets, e-books, Procreate brushes, beat packs", eg: "The Lusaka Budget Planner, K150" },
  { type: "course", name: "Courses", example: "Video lessons with modules, previews and progress tracking", eg: "Kwacha Investing 101, K650" },
  { type: "service", name: "Coaching & services", example: "Sessions, consultations and commissions, booked and paid upfront", eg: "1:1 Burnout Recovery, K900" },
  { type: "ticket", name: "Event tickets", example: "Capacity limits and a ticket PDF sent to every buyer", eg: "Copperbelt Creatives Summit, K350" },
  { type: "physical", name: "Things you ship", example: "Stock counts, delivery fees and order tracking", eg: "Chitenge Weekender Tote, K480" },
];

const METHODS = ["MTN MoMo", "Airtel Money", "Zamtel Kwacha", "M-Pesa", "Telecel Cash", "Visa & Mastercard", "PayPal", "Bank transfer"];

export default async function LandingPage() {
  const [{ items: featured }, creators] = await Promise.all([
    getProducts({ sort: "popular", pageSize: 8 }),
    getFeaturedCreators(6),
  ]);

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="container grid items-center gap-12 pb-20 pt-12 md:pt-20 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <h1 className="max-w-[13ch] text-[2.9rem] font-bold leading-[0.95] sm:text-6xl lg:text-[5.2rem]">
              Sell what you make. Get paid on mobile money.
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-8 text-muted">
              One storefront for e-books, courses, presets, coaching, event tickets and things you ship.
              Buyers pay with MoMo, Airtel Money, M-Pesa or card, and you withdraw to your phone.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/register?role=creator" size="lg">Open your store, free</ButtonLink>
              <ButtonLink href="/marketplace" size="lg" variant="secondary">Browse the marketplace</ButtonLink>
            </div>
            <p className="mt-5 text-sm text-muted">5% per sale. No monthly fee. Live in about ten minutes.</p>
          </div>
          <div className="relative">
            <div className="absolute -inset-x-10 top-10 bottom-0 -z-10 rounded-[3rem] bg-brand-soft lg:-right-24" aria-hidden />
            <div className="py-10"><SaleStream /></div>
          </div>
        </div>
      </section>

      {/* ─── Payment methods ──────────────────────────────────────── */}
      <section aria-label="Accepted payment methods" className="border-y bg-surface">
        <div className="container flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-5 text-[15px] font-medium text-fg/70">
          {METHODS.map((m) => <span key={m}>{m}</span>)}
        </div>
      </section>

      {/* ─── What you can sell ────────────────────────────────────── */}
      <section id="sell" className="container scroll-mt-20 py-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <h2 className="text-4xl font-bold leading-tight sm:text-5xl">One store for everything you sell</h2>
            <p className="mt-4 max-w-md text-muted">
              Each product type gets the checkout it needs: instant downloads, course access, ticket PDFs or a delivery address.
            </p>
          </div>
          <ul className="divide-y border-y">
            {SELLABLE.map((s) => (
              <li key={s.type}>
                <Link href={`/marketplace?type=${s.type}`} className="group grid gap-1 py-6 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-6">
                  <span className="font-display text-2xl font-semibold group-hover:text-brand sm:text-3xl">{s.name}</span>
                  <span className="text-sm text-muted sm:text-right">{s.eg}</span>
                  <span className="text-muted sm:col-span-2">{s.example}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Featured products ────────────────────────────────────── */}
      <section className="container pb-24">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="text-3xl font-bold sm:text-4xl">Selling well this week</h2>
          <Link href="/marketplace" className="shrink-0 text-sm font-medium text-brand hover:underline">See all products</Link>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* ─── How payment works (a real sequence) ──────────────────── */}
      <section className="bg-[#161A33] py-24 text-white">
        <div className="container">
          <h2 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">From a WhatsApp link to money on your phone</h2>
          <ol className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              ["Share your store link", `${siteHost()}/yourname works anywhere: WhatsApp status, Instagram bio, TikTok. Track which one sells.`],
              ["Buyers pay how they like", "A prompt appears on the buyer's phone for MoMo, Airtel Money or M-Pesa. Cards and PayPal work too. Files are delivered the moment payment clears."],
              ["Withdraw to MoMo or bank", "Sales clear after 7 days. Withdraw to your mobile money number or bank account in your own currency."],
            ].map(([t, b], i) => (
              <li key={t} className="border-t border-white/15 pt-6">
                <span className="font-display text-5xl font-bold text-accent">{i + 1}</span>
                <h3 className="mt-4 text-xl font-semibold">{t}</h3>
                <p className="mt-2 leading-7 text-white/70">{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── Creators ─────────────────────────────────────────────── */}
      <section className="container py-24">
        <h2 className="text-3xl font-bold sm:text-4xl">Stores on iMaket</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((c) => (
            <Link key={c.id} href={`/${c.handle}`} className="card flex gap-4 p-5 transition-colors hover:border-fg/25">
              <Avatar name={c.store_name} src={c.avatar_url} color={c.brand_color} size={52} />
              <div className="min-w-0">
                <p className="flex items-center gap-1 font-semibold">
                  <span className="truncate">{c.store_name}</span>
                  {c.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand" aria-label="Verified" />}
                </p>
                <p className="line-clamp-1 text-sm text-muted">{c.tagline}</p>
                {c.sales_count != null && (
                  <p className="mt-2 text-xs text-muted">{c.product_count} products · {formatCompact(c.sales_count)} sales</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Pricing ──────────────────────────────────────────────── */}
      <section id="pricing" className="container scroll-mt-20 pb-8">
        <div className="grid overflow-hidden rounded-3xl border bg-surface lg:grid-cols-2">
          <div className="p-8 sm:p-12">
            <h2 className="text-3xl font-bold sm:text-4xl">Pricing</h2>
            <p className="mt-6 font-display text-7xl font-bold tracking-tight text-brand">5%</p>
            <p className="mt-2 text-lg">per sale, plus the payment network&apos;s fee.</p>
            <p className="mt-4 max-w-sm text-muted">
              Sell a {formatMoney(150, "ZMW")} planner and keep {formatMoney(142.5, "ZMW")} before processing. No monthly plan, no listing fees.
            </p>
            <ButtonLink href="/register?role=creator" size="lg" className="mt-8">Open your store, free</ButtonLink>
          </div>
          <ul className="space-y-4 border-t bg-surface-2/50 p-8 sm:p-12 lg:border-l lg:border-t-0">
            {[
              "Unlimited products and file uploads",
              "Your own store link and brand colour",
              "Discount codes and an affiliate programme",
              "Sales, traffic and customer analytics",
              "Payouts to mobile money or bank, in your currency",
              "Secure downloads with limits and expiry",
            ].map((f) => (
              <li key={f} className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden /> {f}</li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
