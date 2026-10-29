"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Switch, Textarea } from "@/components/ui/primitives";
import { CoverUpload } from "@/components/dashboard/file-upload";
import type { SiteContent } from "@/lib/site-content";

export interface SitewideCode {
  id: string; code: string; description: string | null; type: "percent" | "fixed"; value: number;
  first_order_only: boolean; min_order: number; max_uses: number | null; used_count: number; ends_at: string | null; active: boolean;
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? "Something went wrong.");
  return j;
}

export function StorefrontContentForm({ content }: { content: SiteContent }) {
  const router = useRouter();
  const [c, setC] = useState(content);
  const [busy, setBusy] = useState(false);
  const f = (k: keyof SiteContent) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC({ ...c, [k]: e.target.value });
  const setImg = (k: "hero_images" | "promo_images", i: number, url: string | null) => {
    const arr = [...c[k]]; if (url) arr[i] = url; else arr.splice(i, 1);
    setC({ ...c, [k]: arr.filter(Boolean) });
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await call("/api/admin/site-content", "PATCH", c); toast.success("Storefront saved"); router.refresh(); }
    catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="card grid gap-4 p-6">
        <h2 className="font-sans text-base font-bold tracking-normal">Homepage hero</h2>
        <Input label="Headline" name="hero_title" value={c.hero_title} onChange={f("hero_title")} maxLength={80} />
        <Textarea label="Text under the headline" name="hero_text" rows={2} value={c.hero_text} onChange={f("hero_text")} maxLength={240} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Button" name="hero_cta" value={c.hero_cta} onChange={f("hero_cta")} maxLength={30} />
          <Input label="Sale line (on the right photo)" name="sale_text" value={c.sale_text} onChange={f("sale_text")} maxLength={160} />
        </div>
        <div>
          <p className="label">Hero photos (left, middle, right)</p>
          <p className="mb-3 text-sm text-muted">Leave empty to use your newest product photos.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => <CoverUpload key={`h${i}-${c.hero_images[i] ?? ""}`} value={c.hero_images[i] ?? null} onChange={(u) => setImg("hero_images", i, u)} />)}
          </div>
        </div>
      </section>

      <section className="card grid gap-4 p-6">
        <h2 className="font-sans text-base font-bold tracking-normal">Promo section</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Promo title" name="promo_title" value={c.promo_title} onChange={f("promo_title")} maxLength={40} />
          <Input label="Promo text" name="promo_text" value={c.promo_text} onChange={f("promo_text")} maxLength={160} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => <CoverUpload key={`p${i}-${c.promo_images[i] ?? ""}`} value={c.promo_images[i] ?? null} onChange={(u) => setImg("promo_images", i, u)} />)}
        </div>
      </section>

      <section className="card grid gap-4 p-6">
        <h2 className="font-sans text-base font-bold tracking-normal">Newsletter pop-up</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Pop-up title" name="newsletter_title" value={c.newsletter_title} onChange={f("newsletter_title")} maxLength={80} />
          <Input label="Pop-up text" name="newsletter_text" value={c.newsletter_text} onChange={f("newsletter_text")} maxLength={160} />
          <Input label="Strip above the footer" name="strip_text" value={c.strip_text} onChange={f("strip_text")} maxLength={80} />
          <Input label="Code shown after signing up" name="newsletter_code" value={c.newsletter_code} onChange={f("newsletter_code")} maxLength={40}
            hint="Must match an active sitewide code below. Leave blank to show no code." />
        </div>
      </section>

      <section className="card grid gap-4 p-6">
        <h2 className="font-sans text-base font-bold tracking-normal">Footer contact &amp; social</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Address" name="address" value={c.address} onChange={f("address")} />
          <Input label="Phone" name="phone" value={c.phone} onChange={f("phone")} />
          <Input label="Email" name="email" type="email" value={c.email} onChange={f("email")} />
          <Input label="Facebook URL" name="facebook" value={c.facebook} onChange={f("facebook")} placeholder="https://facebook.com/…" />
          <Input label="TikTok URL" name="tiktok" value={c.tiktok} onChange={f("tiktok")} placeholder="https://tiktok.com/@…" />
          <Input label="Instagram URL" name="instagram" value={c.instagram} onChange={f("instagram")} placeholder="https://instagram.com/…" />
        </div>
        <p className="text-sm text-muted">Empty fields are hidden in the footer.</p>
      </section>

      <Button type="submit" size="lg" loading={busy}>Save storefront</Button>
    </form>
  );
}

export function SitewideCodes({ codes }: { codes: SitewideCode[] }) {
  const router = useRouter();
  const [n, setN] = useState({ code: "", description: "", type: "percent" as "percent" | "fixed", value: "10", first_order_only: false, max_uses: "", ends_at: "" });
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await call("/api/admin/codes", "POST", {
        code: n.code, description: n.description || null, type: n.type, value: Number(n.value), first_order_only: n.first_order_only,
        max_uses: n.max_uses ? Number(n.max_uses) : null, ends_at: n.ends_at ? new Date(`${n.ends_at}T23:59:59`).toISOString() : null,
      });
      toast.success(`Code ${n.code.toUpperCase()} created`);
      setN({ ...n, code: "", description: "", max_uses: "", ends_at: "" });
      router.refresh();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }
  const toggle = async (c: SitewideCode) => { try { await call(`/api/admin/codes/${c.id}`, "PATCH", { active: !c.active }); router.refresh(); } catch (e) { toast.error((e as Error).message); } };
  const remove = async (c: SitewideCode) => {
    if (!window.confirm(`Delete ${c.code}? Orders that used it keep their discount.`)) return;
    try { await call(`/api/admin/codes/${c.id}`, "DELETE"); toast.success("Code deleted"); router.refresh(); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <p className="text-[15px]">Sitewide codes work in every store that takes part in sitewide sales (stores can opt out in their storefront settings). The discount comes off the sale price before iMaket&apos;s fee.</p>
      {codes.length > 0 && (
        <ul className="divide-y divide-black/15 border border-black/20">
          {codes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
              <span className="font-display text-xl tracking-[-0.03em]">{c.code}</span>
              <span className="text-[15px]">{c.type === "percent" ? `${c.value}% off` : `${c.value} off`}{c.first_order_only ? " · first order only" : ""}</span>
              <span className="text-sm text-muted">Used {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""} times{c.ends_at ? ` · ends ${new Date(c.ends_at).toLocaleDateString()}` : ""}</span>
              <div className="ml-auto flex items-center gap-3">
                <Switch label={c.active ? "Active" : "Paused"} checked={c.active} onChange={() => toggle(c)} />
                <button onClick={() => remove(c)} className="p-2 hover:text-danger" aria-label={`Delete ${c.code}`}><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={create} className="card grid gap-4 p-5 sm:grid-cols-3">
        <Input label="Code" name="code" value={n.code} onChange={(e) => setN({ ...n, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} placeholder="SUMMER20" required />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input label="Discount" name="value" inputMode="decimal" value={n.value} onChange={(e) => setN({ ...n, value: e.target.value.replace(/[^\d.]/g, "") })} />
          <label className="self-end">
            <span className="sr-only">Type</span>
            <select value={n.type} onChange={(e) => setN({ ...n, type: e.target.value as "percent" | "fixed" })} className="input w-auto">
              <option value="percent">%</option><option value="fixed">fixed</option>
            </select>
          </label>
        </div>
        <Input label="Description (optional)" name="description" value={n.description} onChange={(e) => setN({ ...n, description: e.target.value })} />
        <Input label="Max uses (optional)" name="max_uses" inputMode="numeric" value={n.max_uses} onChange={(e) => setN({ ...n, max_uses: e.target.value.replace(/\D/g, "") })} />
        <Input label="Ends on (optional)" name="ends_at" type="date" value={n.ends_at} onChange={(e) => setN({ ...n, ends_at: e.target.value })} />
        <div className="self-end pb-2"><Switch label="First order only" checked={n.first_order_only} onChange={(v) => setN({ ...n, first_order_only: v })} /></div>
        <Button type="submit" loading={busy} disabled={n.code.length < 3 || !Number(n.value)} className="sm:col-span-3 sm:w-fit">Create code</Button>
      </form>
    </div>
  );
}

export function NewsletterExport({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <p className="text-[15px]"><span className="font-display text-3xl">{count}</span> newsletter {count === 1 ? "subscriber" : "subscribers"}</p>
      <a href="/api/admin/newsletter" className="inline-flex h-10 items-center gap-2 rounded-full border border-black px-5 hover:bg-black hover:text-white">
        <Download className="h-4 w-4" /> Download CSV
      </a>
    </div>
  );
}
