import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, Clock, Download, MapPin, PlayCircle, RefreshCw, ShieldCheck, Star, Truck, Users } from "lucide-react";
import { FacebookIcon, PinterestIcon, WhatsAppIcon, XIcon } from "@/components/ui/brand-icons";
import { ProductGallery, InfoSection } from "@/components/product/product-gallery";
import { PurchasePanel } from "@/components/product/purchase-panel";
import { RichText } from "@/components/product/rich-text";
import { ReviewForm } from "@/components/product/review-form";
import { ProductCard } from "@/components/product/product-card";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { Avatar } from "@/components/ui/primitives";
import { getProductBySlug, getProductReviews, getRelatedProducts } from "@/lib/data/catalog";
import { absoluteUrl, formatDate, formatMoney, PRODUCT_TYPE_LABEL, timeAgo } from "@/lib/utils";
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

  const images = [p.cover_url, ...p.gallery].filter((x): x is string => !!x);
  const url = absoluteUrl(`/p/${p.slug}`);
  const share = [
    ["Share on Facebook", `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, FacebookIcon],
    ["Share on WhatsApp", `https://wa.me/?text=${encodeURIComponent(`${p.title} ${url}`)}`, WhatsAppIcon],
    ["Share on X", `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(p.title)}`, XIcon],
    ["Pin on Pinterest", `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}${p.cover_url ? `&media=${encodeURIComponent(p.cover_url)}` : ""}`, PinterestIcon],
  ] as const;

  return (
    <div className="bg-white px-2.5 pb-16 pt-3 sm:px-3">
      <AnalyticsBeacon event="product_view" creatorId={p.creator_id} productId={p.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,826px)_1fr] lg:gap-8">
        <ProductGallery id={p.id} title={p.title} type={p.type} creator={p.creator?.store_name} images={images} />

        <div className="lg:sticky lg:top-[74px] lg:self-start lg:pr-2">
          <nav aria-label="Breadcrumb" className="mb-3 text-sm">
            <Link href="/marketplace" className="hover:underline">All Products</Link>
            {p.category && <> <span aria-hidden className="mx-1">›</span> <Link href={`/marketplace?category=${p.category.slug}`} className="hover:underline">{p.category.name}</Link></>}
          </nav>
          <h1 className="text-[2.05rem] leading-[1.15]">{p.title}</h1>
          {p.creator && (
            <Link href={`/${p.creator.handle}`} className="mt-2 inline-flex items-center gap-2 text-[15px] hover:underline">
              <Avatar name={p.creator.store_name} src={p.creator.avatar_url} size={24} />
              {p.creator.store_name}
              {p.creator.verified && <BadgeCheck className="h-4 w-4" aria-label="Verified" />}
            </Link>
          )}
          {p.rating_count > 0 && (
            <a href="#reviews" className="mt-2 flex items-center gap-1.5 text-sm">
              <span className="flex" aria-hidden>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-3.5 w-3.5 ${p.rating_avg >= n - 0.25 ? "fill-black text-black" : "text-black/25"}`} />)}</span>
              {p.rating_avg.toFixed(1)} ({p.rating_count}) · {p.sales_count.toLocaleString()} sold
            </a>
          )}

          <div className="mt-3"><PurchasePanel product={p} /></div>

          {p.summary && <p className="mt-7 text-base leading-[1.4]">{p.summary}</p>}

          <div className="mt-7 border-t border-black/30">
            <InfoSection title="Product Info" defaultOpen>
              <ul className="space-y-1.5">
                <li>{PRODUCT_TYPE_LABEL[p.type]}{p.audience ? ` · ${p.audience === "unisex" ? "Unisex" : p.audience === "men" ? "Men" : "Women"}` : ""}</li>
                {deliveryFacts(p).map(({ icon: I, text }) => (
                  <li key={text} className="flex items-center gap-2"><I className="h-4 w-4 shrink-0" aria-hidden /> {text}</li>
                ))}
              </ul>
            </InfoSection>
            <InfoSection title="Return & Refund Policy">
              <p>{p.refund ? p.refund : <>Each store sets its own returns. If something isn&apos;t right, message <strong>{p.creator?.store_name ?? "the seller"}</strong> from your order page within 7 days of delivery. Digital items can be refunded if the file is faulty or not as described.</>}{" "}<Link href="/policies/refund" className="underline">Read the full policy</Link>.</p>
            </InfoSection>
            {(p.type === "physical" || p.requires_shipping) && (
              <InfoSection title="Shipping Info">
                <p>{p.delivery || (p.shipping_fee ? `Delivery costs ${formatMoney(p.shipping_fee, p.currency)}.` : "Free delivery.")} Orders are packed and shipped by the store; you&apos;ll get tracking when it&apos;s on its way. <Link href="/policies/shipping" className="underline">Shipping policy</Link>.</p>
              </InfoSection>
            )}
          </div>

          <ul className="mt-6 flex gap-3.5" aria-label="Share">
            {share.map(([label, href, Icon]) => (
              <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid h-6 w-6 place-items-center hover:opacity-70"><Icon className="h-5 w-5" /></a></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-20 grid max-w-5xl gap-14 px-2">
        <div className="space-y-14">
          {p.description && (
            <section>
              <h2 className="mb-4 text-[2rem]">About this {p.type === "course" ? "course" : p.type === "ticket" ? "event" : "product"}</h2>
              <RichText text={p.description} />
            </section>
          )}

          {p.modules && p.modules.length > 0 && (
            <section>
              <h2 className="mb-4 text-[2rem]">Curriculum</h2>
              <ol className="divide-y divide-black/20 border border-black/30">
                {p.modules.sort((a, b) => a.sort_order - b.sort_order).map((m, mi) => (
                  <li key={m.id} className="p-5">
                    <p className="font-semibold">Module {mi + 1}: {m.title}</p>
                    <ul className="mt-3 space-y-2">
                      {m.lessons.map((l) => (
                        <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2"><PlayCircle className="h-4 w-4 text-muted" aria-hidden />{l.title}</span>
                          <span className="shrink-0 text-muted">
                            {l.is_preview && <span className="mr-2 bg-lime px-1.5 py-0.5 text-black">Free preview</span>}
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
            <h2 className="mb-6 text-[2rem]">Reviews</h2>
            {reviews.length > 0 && (
              <div className="mb-8 flex flex-wrap items-center gap-8">
                <div>
                  <p className="font-display text-5xl">{p.rating_avg.toFixed(1)}</p>
                  <p className="text-sm text-muted">{p.rating_count} ratings</p>
                </div>
                <ul className="min-w-[220px] flex-1 space-y-1.5" aria-label="Rating distribution">
                  {dist.map(({ n, c }) => (
                    <li key={n} className="flex items-center gap-2 text-sm">
                      <span className="w-3 text-muted">{n}</span>
                      <span className="h-2 flex-1 overflow-hidden bg-surface-2">
                        <span className="block h-full bg-black" style={{ width: `${(c / reviews.length) * 100}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="space-y-6">
              {reviews.map((r) => (
                <li key={r.id} className="border-b border-black/20 pb-6">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.author?.full_name} src={r.author?.avatar_url} size={34} />
                    <div>
                      <p className="text-sm font-medium">{r.author?.full_name ?? "Verified buyer"}</p>
                      <p className="flex items-center gap-1 text-xs text-muted">
                        <span className="flex" aria-label={`${r.rating} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-3 w-3 ${r.rating >= n ? "fill-black text-black" : "text-fg/20"}`} />)}</span>
                        {timeAgo(r.created_at)}
                      </p>
                    </div>
                  </div>
                  {r.title && <p className="mt-3 font-medium">{r.title}</p>}
                  {r.body && <p className="mt-1 text-[15px] leading-7 text-fg/85">{r.body}</p>}
                  {r.creator_reply && (
                    <div className="mt-3 bg-stone p-3 text-sm">
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
        <section className="mt-24">
          <h2 className="mb-10 text-center text-[2rem]">You Might Also Like</h2>
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-8 md:grid-cols-4">
            {related.map((r) => <ProductCard key={r.id} product={r} align="center" />)}
          </div>
        </section>
      )}
    </div>
  );
}
