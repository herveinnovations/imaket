"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, Input, Textarea } from "@/components/ui/primitives";
import { CoverUpload } from "./file-upload";
import { cn, siteHost } from "@/lib/utils";
import type { Creator, Product } from "@/lib/types";

const SWATCHES = ["#0B7A56", "#1E3A8A", "#6D28D9", "#9D174D", "#B45309", "#0F766E", "#C2410C", "#161A33"];

export function StorefrontEditor({ creator, products }: { creator: Creator; products: Product[] }) {
  const router = useRouter();
  const [s, setS] = useState({
    store_name: creator.store_name, handle: creator.handle, tagline: creator.tagline ?? "", bio: creator.bio ?? "",
    brand_color: creator.brand_color ?? "#0B7A56", avatar_url: creator.avatar_url, banner_url: creator.banner_url,
    socials: { instagram: "", tiktok: "", x: "", youtube: "", website: "", whatsapp: "", ...creator.socials },
    featured_product_ids: creator.featured_product_ids ?? [],
  });
  const [busy, setBusy] = useState(false);
  const up = (p: Partial<typeof s>) => setS((x) => ({ ...x, ...p }));
  const social = (k: keyof typeof s.socials) => (e: React.ChangeEvent<HTMLInputElement>) => up({ socials: { ...s.socials, [k]: e.target.value } });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$/.test(s.handle)) return toast.error("Store links are 3–32 lowercase letters, numbers, - or _.");
    setBusy(true);
    const socials = Object.fromEntries(Object.entries(s.socials).filter(([, v]) => v));
    const res = await fetch("/api/creator/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...s, socials }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(json.error ?? "Couldn't save your store.");
    toast.success("Store updated");
    router.refresh();
  }

  const live = products.filter((p) => p.status === "published");

  return (
    <form onSubmit={save} className="grid gap-8 xl:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        <section className="card space-y-5 p-6">
          <h2 className="font-sans text-base font-semibold tracking-normal">Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Store name" name="store_name" value={s.store_name} onChange={(e) => up({ store_name: e.target.value })} required />
            <div>
              <label htmlFor="handle" className="label">Store link</label>
              <div className="flex items-center rounded-xl border bg-surface focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
                <span className="pl-3.5 text-[15px] text-muted">{siteHost()}/</span>
                <input id="handle" value={s.handle} onChange={(e) => up({ handle: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} className="h-11 min-w-0 flex-1 bg-transparent pr-3 outline-none" />
              </div>
              {s.handle !== creator.handle && <p className="mt-1.5 text-sm text-warning">Your old link stops working when you save.</p>}
            </div>
          </div>
          <Input label="Tagline" name="tagline" value={s.tagline} maxLength={90} onChange={(e) => up({ tagline: e.target.value })} hint="One line under your name" />
          <Textarea label="About" name="bio" value={s.bio} maxLength={600} onChange={(e) => up({ bio: e.target.value })} hint={`${s.bio.length}/600`} />
        </section>

        <section className="card space-y-5 p-6">
          <h2 className="font-sans text-base font-semibold tracking-normal">Look</h2>
          <div>
            <span className="label">Brand colour</span>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button key={c} type="button" onClick={() => up({ brand_color: c })} aria-label={`Use ${c}`} aria-pressed={s.brand_color === c}
                  className={cn("h-9 w-9 rounded-full ring-offset-2 ring-offset-surface", s.brand_color === c && "ring-2 ring-fg")} style={{ background: c }} />
              ))}
              <label className="ml-2 flex items-center gap-2 text-sm text-muted">
                Custom <input type="color" value={s.brand_color} onChange={(e) => up({ brand_color: e.target.value })} className="h-9 w-12 cursor-pointer rounded-lg border bg-transparent" />
              </label>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div><p className="mb-1.5 text-sm font-medium">Profile photo</p><CoverUpload value={s.avatar_url} onChange={(avatar_url) => up({ avatar_url })} /></div>
            <div><p className="mb-1.5 text-sm font-medium">Banner</p><CoverUpload value={s.banner_url} onChange={(banner_url) => up({ banner_url })} /></div>
          </div>
        </section>

        <section className="card space-y-5 p-6">
          <h2 className="font-sans text-base font-semibold tracking-normal">Social links</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Instagram username" name="instagram" value={s.socials.instagram} onChange={social("instagram")} />
            <Input label="TikTok username" name="tiktok" value={s.socials.tiktok} onChange={social("tiktok")} />
            <Input label="X username" name="x" value={s.socials.x} onChange={social("x")} />
            <Input label="YouTube handle" name="youtube" value={s.socials.youtube} onChange={social("youtube")} />
            <Input label="WhatsApp number" name="whatsapp" type="tel" value={s.socials.whatsapp} onChange={social("whatsapp")} placeholder="+260 97…" />
            <Input label="Website" name="website" type="url" value={s.socials.website} onChange={social("website")} placeholder="https://" />
          </div>
        </section>

        <section className="card p-6">
          <h2 className="font-sans text-base font-semibold tracking-normal">Featured products</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Pick up to two to show at the top of your store.</p>
          <ul className="space-y-2">
            {live.map((p) => {
              const on = s.featured_product_ids.includes(p.id);
              return (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 hover:bg-surface-2/50">
                    <input type="checkbox" checked={on} className="h-4 w-4 accent-[rgb(var(--brand))]"
                      onChange={() => up({ featured_product_ids: on ? s.featured_product_ids.filter((x) => x !== p.id) : [...s.featured_product_ids, p.id].slice(-2) })} />
                    <span className="text-sm font-medium">{p.title}</span>
                  </label>
                </li>
              );
            })}
            {live.length === 0 && <p className="text-sm text-muted">Publish a product to feature it here.</p>}
          </ul>
        </section>

        <Button type="submit" size="lg" loading={busy}>Save store</Button>
      </div>

      {/* Live preview */}
      <aside className="xl:sticky xl:top-24 xl:self-start" aria-label="Preview">
        <p className="mb-2 text-sm text-muted">Preview</p>
        <div className="overflow-hidden rounded-3xl border bg-bg shadow-card">
          <div className="h-24" style={{ background: s.banner_url ? `url(${s.banner_url}) center/cover` : s.brand_color }} />
          <div className="px-5 pb-6">
            <Avatar name={s.store_name} src={s.avatar_url} color={s.brand_color} size={72} className="-mt-9 border-4 border-bg" />
            <p className="mt-3 flex items-center gap-1.5 font-display text-xl font-bold">{s.store_name || "Your store"}{creator.verified && <BadgeCheck className="h-5 w-5 text-brand" />}</p>
            <p className="text-sm text-muted">{s.tagline || "Your tagline"}</p>
            <p className="mt-3 line-clamp-4 text-sm leading-6">{s.bio}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {Object.entries(s.socials).filter(([, v]) => v).map(([k]) => <span key={k} className="rounded-full border px-2.5 py-1 text-xs capitalize">{k}</span>)}
            </div>
            <span className="mt-5 inline-block rounded-xl px-4 py-2 text-sm font-medium text-white" style={{ background: s.brand_color }}>Buy now</span>
          </div>
        </div>
      </aside>
    </form>
  );
}
