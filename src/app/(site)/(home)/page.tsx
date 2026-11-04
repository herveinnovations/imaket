import Link from "next/link";
import { ProductCard } from "@/components/product/product-card";
import { NewsletterStrip } from "@/components/marketing/newsletter";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/primitives";
import { getFeaturedCreators, getProducts } from "@/lib/data/catalog";
import { getSiteContent } from "@/lib/site-content";
import type { Product } from "@/lib/types";


/** A hero/promo panel: an uploaded banner photo, else a product photo, else a plain grey panel. */
function Panel({ src, product, className, children }: { src?: string; product?: Product; className?: string; children?: React.ReactNode }) {
  const photo = src ?? product?.cover_url ?? null;
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${photo ? "" : "max-md:hidden"} ${className ?? ""}`}>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={product && !src ? product.title : ""} className="absolute inset-0 h-full w-full object-cover" />
      )}
      {product && !src && <Link href={`/p/${product.slug}`} aria-label={product.title} className="absolute inset-0" />}
      {children}
    </div>
  );
}

export default async function HomePage() {
  const [c, { items: drops }, creators] = await Promise.all([
    getSiteContent(),
    getProducts({ sort: "newest", pageSize: 12 }),
    getFeaturedCreators(6),
  ]);
  // banner panels only ever show real photos; otherwise they stay plain grey (as on Wix before images load)
  const withPhoto = drops.filter((p) => p.cover_url);
  const pick = (i: number) => withPhoto[i];
  const heroSrc = (i: number) => c.hero_images[i];
  const promoSrc = (i: number) => c.promo_images[i];

  return (
    <>
      {/* ─── Hero: photo · text column · photo ───────────────────────── */}
      <section className="grid bg-white md:h-[min(52vw,760px)] md:grid-cols-[2fr_1fr_2fr]">
        <Panel src={heroSrc(0)} product={heroSrc(0) ? undefined : pick(0)} className="aspect-[4/5] md:aspect-auto md:h-full" />

        <div className="flex flex-col bg-white">
          <div className="px-4 pb-6 pt-6 text-center md:px-2 md:pt-3">
            <h1 className="mx-auto max-w-[11ch] text-[2rem] md:text-[clamp(1.5rem,2.05vw,2.3rem)]">{c.hero_title}</h1>
          </div>
          <div className="flex flex-1 flex-col items-center justify-end gap-2 px-4 pb-4 text-center md:px-3">
            <p className="max-w-[17em] text-[17px] leading-[1.3] lg:text-[19px]">{c.hero_text}</p>
            <ButtonLink href="/marketplace" size="sm" className="mt-1 h-[30px] px-3 text-[17px] lg:text-[19px]">{c.hero_cta}</ButtonLink>
            <Link href="/register?role=creator" className="mt-1 text-sm underline underline-offset-4">or open your own store</Link>
          </div>
          <Panel src={heroSrc(1)} product={heroSrc(1) ? undefined : pick(1)} className="aspect-[4/5] md:aspect-auto md:h-[47%]" />
        </div>

        <Panel src={heroSrc(2)} product={heroSrc(2) ? undefined : pick(2)} className="aspect-[4/5] md:aspect-auto md:h-full">
          {c.sale_text && (
            <p className="absolute bottom-3 left-3 max-w-[9.5em] bg-white/0 text-[17px] leading-[1.3] text-black lg:text-[19px]"
              style={{ textShadow: "0 0 12px rgba(255,255,255,.9)" }}>
              {c.sale_text}
            </p>
          )}
        </Panel>
      </section>

      {/* ─── New Drops ────────────────────────────────────────────────── */}
      <section className="bg-white pb-12 pt-11">
        <h2 className="text-center text-[2rem] md:text-[clamp(1.6rem,2.05vw,2.3rem)]">New Drops</h2>
        {drops.length === 0 ? (
          <div className="mx-auto mt-10 max-w-md px-4 text-center">
            <p className="text-[17px]">New products from iMaket creators will appear here.</p>
            <ButtonLink href="/register?role=creator" className="mt-5">Open a store</ButtonLink>
          </div>
        ) : (
          <div className="mt-14 grid grid-cols-2 gap-x-2.5 gap-y-8 px-0.5 md:grid-cols-3">
            {drops.slice(0, 6).map((p) => <ProductCard key={p.id} product={p} align="center" showCreator={false} />)}
          </div>
        )}
        <div className="mt-14 flex justify-center">
          <ButtonLink href="/marketplace" size="sm" className="h-[30px] px-4 text-[17px] lg:text-[19px]">Shop All</ButtonLink>
        </div>
      </section>

      {/* ─── Promo: photo · 25% OFF · photo ──────────────────────────── */}
      <section className="grid bg-lime md:h-[min(52vw,741px)] md:grid-cols-3">
        <Panel src={promoSrc(0)} product={promoSrc(0) ? undefined : pick(3)} className="aspect-[4/5] md:aspect-auto md:h-full" />
        <div className="flex flex-col items-center justify-center gap-3 bg-surface-2 px-6 py-16 text-center md:py-0">
          <h2 className="text-[2rem] md:text-[clamp(1.6rem,2.05vw,2.3rem)]">{c.promo_title}</h2>
          <p className="max-w-[15em] text-[17px] leading-[1.3] lg:text-[19px]">{c.promo_text}</p>
          <ButtonLink href="/marketplace" size="sm" className="mt-1 h-[30px] px-4 text-[17px] lg:text-[19px]">Shop Now</ButtonLink>
        </div>
        <Panel src={promoSrc(1)} product={promoSrc(1) ? undefined : pick(4)} className="aspect-[4/5] md:aspect-auto md:h-full" />
      </section>

      {/* ─── Stores (the marketplace part of iMaket) ─────────────────── */}
      {creators.length > 0 && (
        <section className="bg-white py-12">
          <h2 className="text-center text-[2rem] md:text-[clamp(1.6rem,2.05vw,2.3rem)]">Shop the Stores</h2>
          <div className="mt-10 grid grid-cols-2 gap-2.5 px-0.5 sm:grid-cols-3 lg:grid-cols-6">
            {creators.map((s) => (
              <Link key={s.id} href={`/${s.handle}`} className="group flex flex-col items-center bg-stone px-4 py-8 text-center">
                <Avatar name={s.store_name} src={s.avatar_url} color="#000" size={84} />
                <p className="mt-4 text-[15px] group-hover:underline group-hover:underline-offset-4">{s.store_name}</p>
                {s.tagline && <p className="mt-1 line-clamp-2 text-sm text-muted">{s.tagline}</p>}
              </Link>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <ButtonLink href="/register?role=creator" size="sm" variant="secondary" className="h-[30px] px-4 text-[17px]">Sell on iMaket</ButtonLink>
          </div>
        </section>
      )}

      <NewsletterStrip text={c.strip_text} />
    </>
  );
}
