import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Globe, MessageCircle } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { ProductCover } from "@/components/product/product-cover";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { Avatar, EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { getCreatorByHandle, getProducts } from "@/lib/data/catalog";
import { formatCompact, formatMoney, PRODUCT_TYPE_LABEL } from "@/lib/utils";
import { Store } from "lucide-react";
import type { Socials } from "@/lib/types";

type Params = Promise<{ handle: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const c = await getCreatorByHandle((await params).handle);
  if (!c) return { title: "Store not found" };
  return { title: c.store_name, description: c.tagline ?? c.bio ?? undefined };
}

const SOCIAL: { key: keyof Socials; label: string; url: (v: string) => string }[] = [
  { key: "instagram", label: "Instagram", url: (v) => `https://instagram.com/${v}` },
  { key: "tiktok", label: "TikTok", url: (v) => `https://tiktok.com/@${v}` },
  { key: "x", label: "X", url: (v) => `https://x.com/${v}` },
  { key: "youtube", label: "YouTube", url: (v) => `https://youtube.com/@${v}` },
];

export default async function StorefrontPage({ params }: { params: Params }) {
  const { handle } = await params;
  if (!/^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$/i.test(handle)) notFound();
  const creator = await getCreatorByHandle(handle);
  if (!creator) notFound();
  const { items } = await getProducts({ creatorId: creator.id, pageSize: 48 });
  const featured = items.filter((p) => creator.featured_product_ids.includes(p.id)).slice(0, 2);
  const rest = items.filter((p) => !featured.some((f) => f.id === p.id));
  const brand = creator.brand_color ?? "#0B7A56";
  const s = creator.socials ?? {};

  return (
    <div>
      <AnalyticsBeacon event="store_view" creatorId={creator.id} />
      {/* Banner: uploaded image, or a field of the creator's brand colour */}
      <div className="relative h-44 sm:h-64" style={{ background: brand }}>
        {creator.banner_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={creator.banner_url} alt="" className="h-full w-full object-cover" />
          : (
            <svg className="absolute inset-0 h-full w-full opacity-25" aria-hidden>
              <defs><pattern id="sk-p" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="28" stroke="white" strokeWidth="1.5" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#sk-p)" />
            </svg>
          )}
      </div>

      <div className="container">
        <div className="-mt-14 flex flex-col gap-6 sm:-mt-16 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Avatar name={creator.store_name} src={creator.avatar_url} color={brand} size={120} className="border-[5px] border-bg text-4xl" />
            <div className="pb-1">
              <h1 className="flex items-center gap-2 text-3xl font-bold sm:text-4xl">
                {creator.store_name}
                {creator.verified && <BadgeCheck className="h-7 w-7 text-brand" aria-label="Verified creator" />}
              </h1>
              {creator.tagline && <p className="mt-1 text-muted">{creator.tagline}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {SOCIAL.filter((x) => s[x.key]).map((x) => (
              <a key={x.key} href={x.url(s[x.key]!)} target="_blank" rel="noopener noreferrer" className="rounded-full border px-3.5 py-1.5 text-sm hover:bg-surface-2">{x.label}</a>
            ))}
            {s.website && <a href={s.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm hover:bg-surface-2"><Globe className="h-3.5 w-3.5" /> Website</a>}
            {s.whatsapp && (
              <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 py-1.5 text-sm font-medium text-[#062e16]">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_280px]">
          <div>
            {featured.length > 0 && (
              <section className="mb-14">
                <h2 className="sr-only">Featured</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {featured.map((p) => (
                    <Link key={p.id} href={`/p/${p.slug}`} className="group grid overflow-hidden rounded-3xl border bg-surface sm:grid-cols-[180px_1fr]">
                      <ProductCover id={p.id} title={p.title} type={p.type} coverUrl={p.cover_url} size="sm" className="aspect-[4/3] sm:aspect-auto sm:h-full" />
                      <div className="flex flex-col p-5">
                        <span className="text-xs font-medium" style={{ color: brand }}>Featured · {PRODUCT_TYPE_LABEL[p.type]}</span>
                        <span className="mt-1 font-display text-xl font-semibold leading-tight group-hover:underline">{p.title}</span>
                        <span className="mt-2 line-clamp-2 text-sm text-muted">{p.summary}</span>
                        <span className="mt-auto pt-3 font-semibold">{formatMoney(p.price, p.currency)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            <section>
              <h2 className="mb-6 text-xl font-bold">All products <span className="font-sans text-base font-normal text-muted">({items.length})</span></h2>
              {items.length === 0 ? (
                <EmptyState icon={Store} title="No products yet" body={`${creator.store_name} is setting up. Check back soon.`} />
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
                  {(rest.length ? rest : items).map((p) => <ProductCard key={p.id} product={p} showCreator={false} />)}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {creator.bio && (
              <div>
                <h2 className="mb-2 font-sans text-sm font-semibold tracking-normal">About</h2>
                <p className="text-[15px] leading-7 text-fg/85">{creator.bio}</p>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-3">
              <div className="card p-4"><dt className="text-xs text-muted">Products</dt><dd className="mt-1 font-display text-2xl font-bold">{items.length}</dd></div>
              <div className="card p-4"><dt className="text-xs text-muted">Sales</dt><dd className="mt-1 font-display text-2xl font-bold">{formatCompact(items.reduce((a, p) => a + p.sales_count, 0))}</dd></div>
            </dl>
            <ButtonLink href="/register?role=creator" variant="outline" className="w-full">Open your own store</ButtonLink>
          </aside>
        </div>
      </div>
    </div>
  );
}
