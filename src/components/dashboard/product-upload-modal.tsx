"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Download, GraduationCap, Handshake, Package, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Switch, Textarea } from "@/components/ui/primitives";
import { CoverUpload, FilesUpload, type UploadedFile } from "./file-upload";
import { cn, PRODUCT_TYPE_LABEL } from "@/lib/utils";
import type { Category, Product, ProductType } from "@/lib/types";

const TYPES: { type: ProductType; icon: React.ElementType; blurb: string }[] = [
  { type: "digital", icon: Download, blurb: "E-books, templates, presets, music, software" },
  { type: "course", icon: GraduationCap, blurb: "Video lessons in modules, with previews" },
  { type: "service", icon: Handshake, blurb: "Coaching, consultations, commissions" },
  { type: "ticket", icon: CalendarDays, blurb: "Events and workshops with limited seats" },
  { type: "physical", icon: Package, blurb: "Things you make and deliver" },
  { type: "membership", icon: Repeat, blurb: "Access to a community or content library" },
];

const STEPS = ["Type", "Details", "Price & delivery", "Review"];

interface Draft {
  type: ProductType; title: string; summary: string; description: string; category_id: string; audience: "" | "men" | "women" | "unisex"; cover_url: string | null;
  price: string; compare_at_price: string; pay_what_you_want: boolean; min_price: string;
  files: UploadedFile[]; download_limit: string;
  modules: { title: string; lessons: { title: string; is_preview: boolean }[] }[];
  event_starts_at: string; event_venue: string; inventory_qty: string;
  service_duration_minutes: string; booking_url: string;
  shipping_fee: string; sku: string; track_inventory: boolean;
  affiliate_enabled: boolean; affiliate_commission_percent: string; tags: string;
}

const empty = (type: ProductType = "digital"): Draft => ({
  type, title: "", summary: "", description: "", category_id: "", audience: "", cover_url: null,
  price: "", compare_at_price: "", pay_what_you_want: false, min_price: "",
  files: [], download_limit: "5",
  modules: [{ title: "Getting started", lessons: [{ title: "Welcome", is_preview: true }] }],
  event_starts_at: "", event_venue: "", inventory_qty: "",
  service_duration_minutes: "60", booking_url: "",
  shipping_fee: "", sku: "", track_inventory: type === "physical" || type === "ticket",
  affiliate_enabled: false, affiliate_commission_percent: "10", tags: "",
});

function fromProduct(p: Product): Draft {
  return {
    ...empty(p.type), title: p.title, summary: p.summary ?? "", description: p.description ?? "", category_id: p.category_id ?? "", audience: p.audience ?? "",
    cover_url: p.cover_url, price: String(p.price), compare_at_price: p.compare_at_price ? String(p.compare_at_price) : "",
    pay_what_you_want: p.pay_what_you_want, min_price: p.min_price ? String(p.min_price) : "",
    download_limit: p.download_limit ? String(p.download_limit) : "", event_starts_at: p.event_starts_at?.slice(0, 16) ?? "",
    event_venue: p.event_venue ?? "", inventory_qty: p.inventory_qty != null ? String(p.inventory_qty) : "",
    service_duration_minutes: p.service_duration_minutes ? String(p.service_duration_minutes) : "",
    shipping_fee: p.shipping_fee ? String(p.shipping_fee) : "", track_inventory: p.track_inventory,
    affiliate_enabled: p.affiliate_enabled, affiliate_commission_percent: String(p.affiliate_commission_percent ?? 10), tags: p.tags.join(", "),
    modules: p.modules?.map((m) => ({ title: m.title, lessons: m.lessons.map((l) => ({ title: l.title, is_preview: l.is_preview })) })) ?? empty().modules,
  };
}

export function ProductUploadModal({ open, onClose, categories, currency, product }: {
  open: boolean; onClose: () => void; categories: Category[]; currency: string; product?: Product;
}) {
  const router = useRouter();
  const [step, setStep] = useState(product ? 1 : 0);
  const [d, setD] = useState<Draft>(product ? fromProduct(product) : empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [uploading, setUploading] = useState(false);
  const up = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  function check(s: number) {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (d.title.trim().length < 3) e.title = "Give your product a title of at least 3 characters.";
      if (d.summary.trim().length < 10) e.summary = "Add a one-line summary buyers see on the card.";
    }
    if (s === 2) {
      const price = Number(d.price);
      if (d.price === "" || Number.isNaN(price) || price < 0) e.price = "Enter a price (0 for a free product).";
      if (d.pay_what_you_want && (num(d.min_price) ?? 0) > price) e.min_price = "The minimum can't be higher than the suggested price.";
      if (d.compare_at_price && Number(d.compare_at_price) <= price) e.compare_at_price = "The original price should be higher than the sale price.";
      if (d.type === "ticket" && !d.event_starts_at) e.event_starts_at = "Choose when the event starts.";
      if (d.type === "ticket" && !d.event_venue.trim()) e.event_venue = "Add a venue, or “Online”.";
      if ((d.type === "physical" || d.type === "ticket") && d.track_inventory && d.inventory_qty === "") e.inventory_qty = "How many can you sell?";
    }
    return e;
  }
  function validate(s: number) {
    const e = check(s);
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const next = () => validate(step) && setStep((s) => Math.min(s + 1, STEPS.length - 1));

  async function save(mode: "draft" | "submit") {
    const e1 = check(1), e2 = check(2);
    if (Object.keys(e1).length || Object.keys(e2).length) {
      setErrors({ ...e1, ...e2 });
      setStep(Object.keys(e1).length ? 1 : 2);
      return;
    }
    setSaving(mode);
    const body = {
      type: d.type, title: d.title.trim(), summary: d.summary.trim(), description: d.description.trim() || null,
      category_id: d.category_id || null, audience: d.audience || null, cover_url: d.cover_url, currency,
      price: Number(d.price), compare_at_price: num(d.compare_at_price),
      pay_what_you_want: d.pay_what_you_want, min_price: d.pay_what_you_want ? num(d.min_price) ?? 0 : null,
      download_limit: num(d.download_limit), files: d.files,
      modules: d.type === "course" ? d.modules : undefined,
      event_starts_at: d.event_starts_at ? new Date(d.event_starts_at).toISOString() : null, event_venue: d.event_venue || null,
      service_duration_minutes: num(d.service_duration_minutes), booking_url: d.booking_url || null,
      requires_shipping: d.type === "physical", shipping_fee: num(d.shipping_fee) ?? 0, sku: d.sku || null,
      track_inventory: d.track_inventory, inventory_qty: d.track_inventory ? num(d.inventory_qty) : null,
      affiliate_enabled: d.affiliate_enabled, affiliate_commission_percent: num(d.affiliate_commission_percent),
      tags: d.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10),
      status: mode === "draft" ? "draft" : "pending_review",
    };
    const res = await fetch(product ? `/api/products/${product.id}` : "/api/products", {
      method: product ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(null);
    if (!res.ok) return toast.error(json.error ?? "Couldn't save the product.");
    toast.success(mode === "draft" ? "Draft saved" : json.product?.status === "published" ? "Published. It's live in the shop." : "Submitted for review", {
      description: mode === "submit" && json.product?.status !== "published" ? "We usually review new products within a few hours." : undefined,
    });
    onClose();
    if (!product) { setD(empty()); setStep(0); }
    router.refresh();
  }

  const isLast = step === STEPS.length - 1;
  const waitLabel = uploading ? "Uploading files…" : null;

  return (
    <Modal open={open} onClose={onClose} size="lg" title={product ? "Edit product" : "New product"}
      description={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
      footer={
        <>
          {step > (product ? 1 : 0) && <Button variant="ghost" onClick={() => setStep(step - 1)} className="mr-auto">Back</Button>}
          {isLast ? (
            <>
              <Button variant="secondary" loading={saving === "draft"} disabled={uploading} onClick={() => save("draft")}>Save as draft</Button>
              <Button loading={saving === "submit"} disabled={uploading} onClick={() => save("submit")}>{product?.status === "published" ? "Save changes" : "Publish"}</Button>
            </>
          ) : step > 0 && <Button onClick={next} disabled={uploading}>{waitLabel ?? "Continue"}</Button>}
        </>
      }>
      <div className="mb-6 flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => <span key={s} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-brand" : "bg-surface-2")} />)}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.16 }}>
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {TYPES.map((t) => (
                <button key={t.type} type="button" onClick={() => { setD(empty(t.type)); setStep(1); }}
                  className="flex items-start gap-3 rounded-2xl border p-4 text-left hover:border-brand hover:bg-brand-soft/40">
                  <t.icon className="mt-0.5 h-5 w-5 text-brand" />
                  <span><span className="block font-medium">{PRODUCT_TYPE_LABEL[t.type]}</span><span className="text-sm text-muted">{t.blurb}</span></span>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
              <div className="space-y-5">
                <Input label="Title" name="title" value={d.title} onChange={(e) => up({ title: e.target.value })} error={errors.title} maxLength={140} placeholder="e.g. The Lusaka Budget Planner" />
                <Input label="Summary" name="summary" value={d.summary} onChange={(e) => up({ summary: e.target.value })} error={errors.summary} maxLength={180} hint="One line that sells it. Shown on product cards." />
                <Textarea label="Description" name="description" rows={6} value={d.description} onChange={(e) => up({ description: e.target.value })}
                  hint="Use a blank line between paragraphs, “- ” for bullet points and **bold** for emphasis." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select label="Category" name="category_id" value={d.category_id} onChange={(e) => up({ category_id: e.target.value })}>
                    <option value="">Choose a category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                  <Input label="Tags" name="tags" value={d.tags} onChange={(e) => up({ tags: e.target.value })} placeholder="budget, excel, finance" hint="Comma separated, helps search" />
                  <Select label="Shop collection" name="audience" value={d.audience} onChange={(e) => up({ audience: e.target.value as Draft["audience"] })}
                    hint="Shows the product under Men or Women in the shop menu">
                    <option value="">Not clothing / no collection</option>
                    <option value="men">Men</option>
                    <option value="women">Women</option>
                    <option value="unisex">Unisex (Men and Women)</option>
                  </Select>
                </div>
              </div>
              <CoverUpload value={d.cover_url} onChange={(cover_url) => up({ cover_url })} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={d.pay_what_you_want ? `Suggested price (${currency})` : `Price (${currency})`} name="price" inputMode="decimal" value={d.price}
                  onChange={(e) => up({ price: e.target.value.replace(/[^\d.]/g, "") })} error={errors.price} />
                <Input label="Original price (optional)" name="compare_at_price" inputMode="decimal" value={d.compare_at_price}
                  onChange={(e) => up({ compare_at_price: e.target.value.replace(/[^\d.]/g, "") })} error={errors.compare_at_price} hint="Shown struck through to signal a discount" />
              </div>
              <div className="rounded-2xl border p-4">
                <Switch label="Let buyers pay what they want" description="Buyers can pay more than your price, never less than the minimum." checked={d.pay_what_you_want} onChange={(v) => up({ pay_what_you_want: v })} />
                {d.pay_what_you_want && <Input className="mt-3 max-w-[200px]" label="Minimum" name="min_price" inputMode="decimal" value={d.min_price} onChange={(e) => up({ min_price: e.target.value.replace(/[^\d.]/g, "") })} error={errors.min_price} />}
              </div>

              {(d.type === "digital" || d.type === "membership") && (
                <div className="space-y-4">
                  <p className="font-medium">Files buyers receive</p>
                  <FilesUpload files={d.files} onChange={(files) => up({ files })} onUploadingChange={setUploading} />
                  <Input className="max-w-[240px]" label="Download limit per buyer" name="download_limit" inputMode="numeric" value={d.download_limit}
                    onChange={(e) => up({ download_limit: e.target.value.replace(/\D/g, "") })} hint="Leave empty for unlimited" />
                </div>
              )}

              {d.type === "course" && (
                <div className="space-y-4">
                  <p className="font-medium">Curriculum</p>
                  {d.modules.map((m, mi) => (
                    <div key={mi} className="rounded-2xl border p-4">
                      <div className="flex gap-2">
                        <input className="input font-medium" value={m.title} aria-label={`Module ${mi + 1} title`}
                          onChange={(e) => up({ modules: d.modules.map((x, i) => (i === mi ? { ...x, title: e.target.value } : x)) })} />
                        <button type="button" className="rounded-lg px-2 text-muted hover:text-danger" aria-label="Remove module"
                          onClick={() => up({ modules: d.modules.filter((_, i) => i !== mi) })}><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <ul className="mt-3 space-y-2 pl-3">
                        {m.lessons.map((l, li) => (
                          <li key={li} className="flex items-center gap-2">
                            <input className="input h-9 text-sm" value={l.title} aria-label={`Lesson ${li + 1} title`}
                              onChange={(e) => up({ modules: d.modules.map((x, i) => i !== mi ? x : { ...x, lessons: x.lessons.map((y, j) => (j === li ? { ...y, title: e.target.value } : y)) }) })} />
                            <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                              <input type="checkbox" checked={l.is_preview} className="accent-[rgb(var(--brand))]"
                                onChange={(e) => up({ modules: d.modules.map((x, i) => i !== mi ? x : { ...x, lessons: x.lessons.map((y, j) => (j === li ? { ...y, is_preview: e.target.checked } : y)) }) })} />
                              Free preview
                            </label>
                          </li>
                        ))}
                      </ul>
                      <button type="button" className="mt-2 pl-3 text-sm text-brand hover:underline"
                        onClick={() => up({ modules: d.modules.map((x, i) => (i === mi ? { ...x, lessons: [...x.lessons, { title: `Lesson ${x.lessons.length + 1}`, is_preview: false }] } : x)) })}>
                        Add lesson
                      </button>
                    </div>
                  ))}
                  <Button type="button" variant="secondary" size="sm" onClick={() => up({ modules: [...d.modules, { title: `Module ${d.modules.length + 1}`, lessons: [] }] })}>
                    <Plus className="h-4 w-4" /> Add module
                  </Button>
                  <p className="text-sm text-muted">Upload lesson videos from the course editor after saving.</p>
                </div>
              )}

              {d.type === "ticket" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Starts" type="datetime-local" name="event_starts_at" value={d.event_starts_at} onChange={(e) => up({ event_starts_at: e.target.value })} error={errors.event_starts_at} />
                  <Input label="Venue" name="event_venue" value={d.event_venue} onChange={(e) => up({ event_venue: e.target.value })} error={errors.event_venue} placeholder="Edinburgh Hotel, Kitwe" />
                  <Input label="Tickets available" name="inventory_qty" inputMode="numeric" value={d.inventory_qty} onChange={(e) => up({ inventory_qty: e.target.value.replace(/\D/g, ""), track_inventory: true })} error={errors.inventory_qty} />
                </div>
              )}

              {d.type === "service" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Session length (minutes)" name="service_duration_minutes" inputMode="numeric" value={d.service_duration_minutes} onChange={(e) => up({ service_duration_minutes: e.target.value.replace(/\D/g, "") })} />
                  <Input label="Booking link (optional)" name="booking_url" type="url" value={d.booking_url} onChange={(e) => up({ booking_url: e.target.value })} placeholder="https://calendly.com/…" hint="Sent to buyers after payment" />
                </div>
              )}

              {d.type === "physical" && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input label={`Delivery fee (${currency})`} name="shipping_fee" inputMode="decimal" value={d.shipping_fee} onChange={(e) => up({ shipping_fee: e.target.value.replace(/[^\d.]/g, "") })} />
                  <Input label="In stock" name="inventory_qty" inputMode="numeric" value={d.inventory_qty} onChange={(e) => up({ inventory_qty: e.target.value.replace(/\D/g, ""), track_inventory: true })} error={errors.inventory_qty} />
                  <Input label="SKU (optional)" name="sku" value={d.sku} onChange={(e) => up({ sku: e.target.value })} />
                </div>
              )}

              <div className="rounded-2xl border p-4">
                <Switch label="Let affiliates promote this" description="Affiliates earn a commission on sales they refer." checked={d.affiliate_enabled} onChange={(v) => up({ affiliate_enabled: v })} />
                {d.affiliate_enabled && <Input className="mt-3 max-w-[200px]" label="Commission %" name="aff" inputMode="numeric" value={d.affiliate_commission_percent} onChange={(e) => up({ affiliate_commission_percent: e.target.value.replace(/\D/g, "") })} />}
              </div>
            </div>
          )}

          {step === 3 && (
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {[
                ["Type", PRODUCT_TYPE_LABEL[d.type]], ["Title", d.title], ["Summary", d.summary],
                ["Category", categories.find((c) => c.id === d.category_id)?.name ?? "None"],
                ["Price", d.pay_what_you_want ? `Pay what you want, from ${currency} ${d.min_price || 0}` : `${currency} ${d.price}`],
                ...(d.type === "digital" ? [["Files", d.files.length ? d.files.map((f) => f.name).join(", ") : "None yet (you can add them later)"]] : []),
                ...(d.type === "course" ? [["Curriculum", `${d.modules.length} modules, ${d.modules.reduce((s, m) => s + m.lessons.length, 0)} lessons`]] : []),
                ...(d.type === "ticket" ? [["Event", `${d.event_starts_at.replace("T", " ")} at ${d.event_venue}, ${d.inventory_qty} tickets`]] : []),
                ...(d.type === "physical" ? [["Stock & delivery", `${d.inventory_qty} in stock, delivery ${currency} ${d.shipping_fee || 0}`]] : []),
              ].map(([k, v]) => (
                <div key={k} className={k === "Summary" ? "sm:col-span-2" : ""}><dt className="text-sm text-muted">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>
              ))}
              <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted sm:col-span-2">
                New products are checked by our team before they appear in the marketplace, usually within a few hours. You&apos;ll get a notification either way.
              </p>
            </dl>
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}

export function NewProductButton({ categories, currency }: { categories: Category[]; currency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New product</Button>
      <ProductUploadModal open={open} onClose={() => setOpen(false)} categories={categories} currency={currency} />
    </>
  );
}
