import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, Clock, Download, MapPin, PlayCircle, RefreshCw, ShieldCheck, Star, Truck, Users } from "lucide-react";
import { ProductCover } from "@/components/product/product-cover";
import { PurchasePanel } from "@/components/product/purchase-panel";
import { RichText } from "@/components/product/rich-text";
import { ReviewForm } from "@/components/product/review-form";
import { ProductCard } from "@/components/product/product-card";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { Avatar } from "@/components/ui/primitives";
import { getProductBySlug, getProductReviews, getRelatedProducts } from "@/lib/data/catalog";
import { formatDate, formatMoney, PRODUCT_TYPE_LABEL, timeAgo } from "@/lib/utils";
import type { Product } from "@/lib/types";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return { title: "Product not found" };
  return {
    title: p.title,
    description: p.summary ?? undefined,
    openGraph: { title: p.title, description: p.summary ?? undefined, images: p.cover_url ? [p.cover_url] : undefined },
  };
}

function deliveryFacts(p: Product) {
  const f: { icon: React.ElementType; text: string }[] = [];
  switch (p.type) {
    case "digital":
      f.push({ icon: Download, text: "Instant download after payment" });
      f.push({ icon: RefreshCw, text: p.download_limit ? `Download up to ${p.download_limit} times` : "Unlimited downloads" });
      break;
    case "course":
      f.push({ icon: PlayCircle, text: `${p.modules?.reduce((s, m) => s + m.lessons.length, 0) ?? "Self-paced"} lessons, watch on any device` });
      f.push({ icon: RefreshCw, text: "Lifetime access, including updates" });
      break;
    case "ticket":
      if (p.event_starts_at) f.push({ icon: CalendarDays, text: formatDate(p.event_starts_at, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) });
      if (p.event_venue) f.push({ icon: MapPin, text: p.event_venue });
      if (p.inventory_qty != null) f.push({ icon: Users, text: `${p.inventory_qty} tickets left` });
      break;
    case "service":
      if (p.service_duration_minutes) f.push({ icon: Clock, text: `${p.service_duration_minutes}-minute session` });
      f.push({ icon: CalendarDays, text: "Book a time after payment" });
      break;
    case "physical":
      f.push({ icon: Truck, text: p.shipping_fee ? `Delivery ${formatMoney(p.shipping_fee, p.currency)}` : "Free delivery" });
      if (p.inventory_qty != null) f.push({ icon: Users, text: p.inventory_qty > 0 ? `${p.inventory_qty} in stock` : "Sold out" });
      break;
  }
  f.push({ icon: ShieldCheck, text: "Secure checkout with mobile money or card" });
  return f;
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p || p.status !== "published") notFound();
  const [reviews, related] = await Promise.all([getProductReviews(p.id), getRelatedProducts(p)]);
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }));

  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: p.title, description: p.summary,
    offers: { "@type": "Offer", price: p.price, priceCurrency: p.currency, availability: p.inventory_qty === 0 ? "OutOfStock" : "InStock" },
    ...(p.rating_count ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating_avg, reviewCount: p.rating_count } } : {}),
  };

  return (
    <div className="container py-8 sm:py-12">
      <AnalyticsBeacon event="product_view" creatorId={p.creator_id} productId={p.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
        <Link href="/marketplace" className="hover:text-fg">Marketplace</Link>
        {p.category && <> <span aria-hidden>/</span> <Link href={`/marketplace?category=${p.category.slug}`} className="hover:text-fg">{p.category.name}</Link></>}
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-14">
        <div>
          <ProductCover id={p.id} title={p.title} type={p.type} creator={p.creator?.store_name} coverUrl={p.cover_url} size="lg" className="aspect-[4/3] rounded-3xl" />
          {p.gallery.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.gallery.slice(0, 4).map((src) => <img key={src} src={src} alt="" className="aspect-square rounded-xl object-cover" />)}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm text-muted">{PRODUCT_TYPE_LABEL[p.type]}</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight sm:text-[2.6rem]">{p.title}</h1>
          {p.creator && (
            <Link href={`/${p.creator.handle}`} className="mt-4 inline-flex items-center gap-2.5 rounded-full py-1 pr-3 hover:bg-surface-2">
              <Avatar name={p.creator.store_name} src={p.creator.avatar_url} size={30} />
              <span className="text-sm font-medium">{p.creator.store_name}</span>
              {p.creator.verified && <BadgeCheck className="h-4 w-4 text-brand" aria-label="Verified" />}
            </Link>
          )}
          {p.rating_count > 0 && (
            <a href="#reviews" className="mt-3 flex items-center gap-1.5 text-sm">
              <span className="flex" aria-hidden>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${p.rating_avg >= n - 0.25 ? "fill-accent text-accent" : "text-fg/20"}`} />)}</span>
              <span className="font-medium">{p.rating_avg.toFixed(1)}</span>
              <span className="text-muted">({p.rating_count} reviews) · {p.sales_count.toLocaleString()} sold</span>
            </a>
          )}
          {p.summary && <p className="mt-5 text-[17px] leading-7 text-fg/85">{p.summary}</p>}

          <div className="mt-6"><PurchasePanel product={p} /></div>

          <ul className="mt-6 space-y-2.5 border-t pt-6 text-sm">
            {deliveryFacts(p).map(({ icon: I, text }) => (
              <li key={text} className="flex items-center gap-3"><I className="h-4 w-4 shrink-0 text-brand" aria-hidden /> {text}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-16 grid gap-14 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-14">
          {p.description && (
            <section>
              <h2 className="mb-4 text-2xl font-bold">About this {p.type === "course" ? "course" : p.type === "ticket" ? "event" : "product"}</h2>
              <RichText text={p.description} />
            </section>
          )}

          {p.modules && p.modules.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-bold">Curriculum</h2>
              <ol className="divide-y rounded-2xl border bg-surface">
                {p.modules.sort((a, b) => a.sort_order - b.sort_order).map((m, mi) => (
                  <li key={m.id} className="p-5">
                    <p className="font-semibold">Module {mi + 1}: {m.title}</p>
                    <ul className="mt-3 space-y-2">
                      {m.lessons.map((l) => (
                        <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2"><PlayCircle className="h-4 w-4 text-muted" aria-hidden />{l.title}</span>
                          <span className="shrink-0 text-muted">
                            {l.is_preview && <span className="mr-2 font-medium text-brand">Free preview</span>}
                            {l.duration_seconds ? `${Math.round(l.duration_seconds / 60)} min` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section id="reviews" className="scroll-mt-24">
            <h2 className="mb-6 text-2xl font-bold">Reviews</h2>
            {reviews.length > 0 && (
              <div className="mb-8 flex flex-wrap items-center gap-8">
                <div>
                  <p className="font-display text-5xl font-bold">{p.rating_avg.toFixed(1)}</p>
                  <p className="text-sm text-muted">{p.rating_count} ratings</p>
                </div>
                <ul className="min-w-[220px] flex-1 space-y-1.5" aria-label="Rating distribution">
                  {dist.map(({ n, c }) => (
                    <li key={n} className="flex items-center gap-2 text-sm">
                      <span className="w-3 text-muted">{n}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${(c / reviews.length) * 100}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="space-y-6">
              {reviews.map((r) => (
                <li key={r.id} className="border-b pb-6">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.author?.full_name} src={r.author?.avatar_url} size={34} color="#5C637A" />
                    <div>
                      <p className="text-sm font-medium">{r.author?.full_name ?? "Verified buyer"}</p>
                      <p className="flex items-center gap-1 text-xs text-muted">
                        <span className="flex" aria-label={`${r.rating} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-3 w-3 ${r.rating >= n ? "fill-accent text-accent" : "text-fg/20"}`} />)}</span>
                        {timeAgo(r.created_at)}
                      </p>
                    </div>
                  </div>
                  {r.title && <p className="mt-3 font-medium">{r.title}</p>}
                  {r.body && <p className="mt-1 text-[15px] leading-7 text-fg/85">{r.body}</p>}
                  {r.creator_reply && (
                    <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
                      <span className="font-medium">{p.creator?.store_name} replied:</span> {r.creator_reply}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-8"><ReviewForm productId={p.id} /></div>
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-8 text-2xl font-bold">You might also like</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {related.map((r) => <ProductCard key={r.id} product={r} />)}
          </div>
        </section>
      )}
    </div>
  );
}
