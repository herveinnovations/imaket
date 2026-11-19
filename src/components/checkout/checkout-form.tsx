"use client";

import Link from "next/link";
import { startNavigation } from "@/components/ui/page-loader";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CreditCard, Lock, ShoppingBag, Smartphone, Tag, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useCart, lineUnit, type CartItem } from "@/store/cart";
import { ProductCover } from "@/components/product/product-cover";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, Input } from "@/components/ui/primitives";
import { cn, formatMoney } from "@/lib/utils";

export interface MethodOption { id: string; label: string; currencies: string[] | null }

interface Quote {
  currency: string; subtotal: number; discount_total: number; shipping_total: number; total: number;
  coupon_applied: boolean; errors: string[]; requires_shipping: boolean;
}

const METHOD_UI: Record<string, { title: string; sub: string; icon: React.ElementType }> = {
  mobile_money: { title: "Mobile money", sub: "Approve a prompt on your phone", icon: Smartphone },
  flutterwave: { title: "Card or bank", sub: "Visa, Mastercard, bank transfer via Flutterwave", icon: CreditCard },
  dusupay: { title: "Card (DusuPay)", sub: "Visa and Mastercard", icon: CreditCard },
  stripe: { title: "International card", sub: "Visa, Mastercard, Amex via Stripe", icon: CreditCard },
  paypal: { title: "PayPal", sub: "Pay with your PayPal balance or card", icon: Wallet },
};

export function CheckoutForm({
  methods, networks, currencyCountry, prefill,
}: {
  methods: MethodOption[];
  networks: Record<string, { label: string; code: string }[]>;
  currencyCountry: Record<string, string>;
  prefill?: { email: string; name: string; phone: string };
}) {
  const router = useRouter();
  const allItems = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const remove = useCart((s) => s.remove);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const currencies = useMemo(() => [...new Set(allItems.map((i) => i.currency))], [allItems]);
  const [currency, setCurrency] = useState<string | null>(null);
  const activeCurrency = currency && currencies.includes(currency) ? currency : currencies[0];
  const items = allItems.filter((i) => i.currency === activeCurrency);

  const available = methods.filter((m) => !m.currencies || m.currencies.includes(activeCurrency));
  const [method, setMethod] = useState<string>("");
  const activeMethod = available.some((m) => m.id === method) ? method : available[0]?.id ?? "";

  const country = currencyCountry[activeCurrency];
  const nets = networks[country] ?? [];
  const [network, setNetwork] = useState("");
  const activeNetwork = nets.some((n) => n.code === network) ? network : nets[0]?.code ?? "";

  const [form, setForm] = useState({ email: prefill?.email ?? "", name: prefill?.name ?? "", phone: prefill?.phone ?? "", momoPhone: prefill?.phone ?? "", line1: "", city: "", notes: "" });
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isFree = quote != null && quote.total === 0 && quote.errors.length === 0;

  const payload = (code?: string) => ({
    items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, customPrice: i.customPrice })),
    couponCode: code,
    email: /^\S+@\S+\.\S+$/.test(form.email.trim()) ? form.email.trim() : undefined,
  });

  // Server-priced quote whenever the cart or coupon changes
  useEffect(() => {
    if (!mounted || !items.length) return;
    const ctl = new AbortController();
    setQuoting(true);
    fetch("/api/checkout/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(appliedCoupon)), signal: ctl.signal })
      .then((r) => r.json()).then((q: Quote) => setQuote(q)).catch(() => {}).finally(() => setQuoting(false));
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, JSON.stringify(items), appliedCoupon]);

  async function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!coupon.trim()) return;
    const res = await fetch("/api/checkout/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(coupon.trim())) });
    const q: Quote = await res.json();
    if (q.coupon_applied) { setAppliedCoupon(coupon.trim()); setQuote(q); toast.success(`Code ${coupon.trim().toUpperCase()} applied`); }
    else toast.error(q.errors.at(-1) ?? "That code doesn't work for this cart.");
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter the email where we'll send your receipt and downloads.";
    if (form.name.trim().length < 2) e.name = "Enter your full name.";
    if (!isFree && activeMethod === "mobile_money" && !/^\+?\d{9,15}$/.test(form.momoPhone.replace(/\s/g, ""))) e.momoPhone = "Enter the mobile money number, e.g. 0971234567.";
    if (quote?.requires_shipping) {
      if (form.line1.trim().length < 3) e.line1 = "Enter a street address or area.";
      if (form.city.trim().length < 2) e.city = "Enter your town or city.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (quote?.errors.length) return toast.error(quote.errors[0]);
    setPaying(true);
    const momoPhone = normalizePhone(form.momoPhone.replace(/\s/g, ""), country);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload(appliedCoupon),
        email: form.email.trim(), name: form.name.trim(), phone: form.phone || undefined,
        provider: activeMethod || "mobile_money", // ignored for free orders
        momo: !isFree && activeMethod === "mobile_money" ? { network: activeNetwork, phone: momoPhone } : undefined,
        shippingAddress: quote?.requires_shipping ? { line1: form.line1, city: form.city, country: country ?? "ZM", notes: form.notes || undefined } : undefined,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setPaying(false); return toast.error(json.error ?? "Payment couldn't start. Try again or pick another method."); }
    // remove the purchased currency group from the cart
    items.forEach((i) => remove(i.productId));
    if (allItems.length === items.length) clear();
    if (json.redirectUrl?.startsWith("http")) window.location.href = json.redirectUrl;
    else { startNavigation(); router.push(json.redirectUrl ?? `/checkout/success?order=${json.orderId}`); }
  }

  if (!mounted) return <div className="mt-10 h-96 animate-pulse rounded-3xl bg-surface-2" />;
  if (!allItems.length) {
    return <div className="mt-10"><EmptyState icon={ShoppingBag} title="Your cart is empty" body="Add something from the marketplace, then come back here to pay." action={<ButtonLink href="/marketplace">Browse the marketplace</ButtonLink>} /></div>;
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={pay} noValidate className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
      <div className="space-y-10">
        {currencies.length > 1 && (
          <div className="rounded-2xl bg-accent/15 p-4 text-sm">
            <p>Your cart has items in {currencies.join(" and ")}. Pay for one currency at a time:</p>
            <div className="mt-3 flex gap-2">
              {currencies.map((c) => (
                <button type="button" key={c} onClick={() => setCurrency(c)} aria-pressed={c === activeCurrency}
                  className={cn("rounded-full border px-4 py-1.5 font-medium", c === activeCurrency ? "border-fg bg-fg text-bg" : "bg-surface")}>{c}</button>
              ))}
            </div>
          </div>
        )}

        <section aria-labelledby="contact-h">
          <h2 id="contact-h" className="text-xl font-semibold">Your details</h2>
          <p className="mt-1 text-sm text-muted">Your receipt and download links go to this email.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Input label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} className="sm:col-span-2" />
            <Input label="Full name" name="name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
            <Input label="Phone (optional)" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />
          </div>
        </section>

        {quote?.requires_shipping && (
          <section aria-labelledby="ship-h">
            <h2 id="ship-h" className="text-xl font-semibold">Delivery address</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input label="Street address or area" name="line1" autoComplete="street-address" value={form.line1} onChange={set("line1")} error={errors.line1} className="sm:col-span-2" />
              <Input label="Town or city" name="city" autoComplete="address-level2" value={form.city} onChange={set("city")} error={errors.city} />
              <Input label="Directions for the courier (optional)" name="notes" value={form.notes} onChange={set("notes")} />
            </div>
          </section>
        )}

        <section aria-labelledby="pay-h">
          <h2 id="pay-h" className="text-xl font-semibold">Payment</h2>
          {isFree ? (
            <p className="mt-4 rounded-xl bg-brand-soft p-4 text-sm text-brand">Nothing to pay. Your order total is {formatMoney(0, activeCurrency)}, so no payment details are needed.</p>
          ) : available.length === 0 ? (
            <p className="mt-4 rounded-xl border p-4 text-sm text-muted">No payment method is set up for {activeCurrency} yet. The store owner needs to enable one.</p>
          ) : (
            <div className="mt-5 space-y-3" role="radiogroup" aria-label="Payment method">
              {available.map((m) => {
                const ui = METHOD_UI[m.id] ?? { title: m.label, sub: "", icon: CreditCard };
                const on = m.id === activeMethod;
                return (
                  <div key={m.id} className={cn("rounded-2xl border bg-surface transition-colors", on && "border-brand ring-4 ring-brand/10")}>
                    <button type="button" role="radio" aria-checked={on} onClick={() => setMethod(m.id)} className="flex w-full items-center gap-4 p-4 text-left">
                      <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", on ? "border-brand" : "border-fg/25")}>
                        {on && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                      </span>
                      <ui.icon className="h-5 w-5 text-muted" aria-hidden />
                      <span><span className="block font-medium">{ui.title}</span><span className="block text-sm text-muted">{ui.sub}</span></span>
                    </button>
                    <AnimatePresence initial={false}>
                      {on && m.id === "mobile_money" && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="space-y-4 border-t px-4 pb-5 pt-4">
                            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Network">
                              {nets.map((n) => (
                                <button type="button" key={n.code} role="radio" aria-checked={n.code === activeNetwork} onClick={() => setNetwork(n.code)}
                                  className={cn("rounded-xl border px-4 py-2 text-sm font-medium", n.code === activeNetwork ? "border-fg bg-fg text-bg" : "hover:border-fg/30")}>
                                  {n.label}
                                </button>
                              ))}
                            </div>
                            <Input label="Mobile money number" name="momoPhone" type="tel" inputMode="tel" placeholder={country === "ZM" ? "097 123 4567" : "Phone number"}
                              value={form.momoPhone} onChange={set("momoPhone")} error={errors.momoPhone}
                              hint="You'll get a prompt on this phone. Enter your PIN to approve." />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ─── Summary ─── */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-6">
          <h2 className="font-sans text-base font-semibold tracking-normal">Order summary</h2>
          <ul className="mt-4 divide-y">
            {items.map((i: CartItem) => (
              <li key={i.productId} className="flex gap-3 py-3">
                <ProductCover id={i.productId} title={i.title} type={i.type} size="sm" className="h-16 w-12 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Link href={`/p/${i.slug}`} className="line-clamp-2 text-sm font-medium">{i.title}</Link>
                  <p className="text-xs text-muted">{i.creatorName}{i.quantity > 1 && ` · ×${i.quantity}`}</p>
                </div>
                <span className="text-sm font-medium">{formatMoney(lineUnit(i) * i.quantity, i.currency)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex gap-2 border-t pt-4">
            <div className="relative flex-1">
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Discount code" aria-label="Discount code"
                className="input h-10 pl-9 uppercase placeholder:normal-case" onKeyDown={(e) => e.key === "Enter" && applyCoupon(e)} />
            </div>
            <Button type="button" variant="secondary" size="sm" className="h-10" onClick={applyCoupon}>Apply</Button>
          </div>

          <dl className={cn("mt-4 space-y-2 border-t pt-4 text-sm", quoting && "opacity-60")} aria-live="polite">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatMoney(quote?.subtotal ?? 0, activeCurrency)}</dd></div>
            {!!quote?.discount_total && <div className="flex justify-between text-brand"><dt>Discount ({appliedCoupon?.toUpperCase()})</dt><dd>−{formatMoney(quote.discount_total, activeCurrency)}</dd></div>}
            {!!quote?.shipping_total && <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{formatMoney(quote.shipping_total, activeCurrency)}</dd></div>}
            <div className="flex justify-between border-t pt-3 text-lg font-semibold"><dt>Total</dt><dd>{formatMoney(quote?.total ?? 0, activeCurrency)}</dd></div>
          </dl>
          {quote?.errors.filter((e) => !e.includes("code")).map((e) => <p key={e} className="mt-3 text-sm text-danger">{e}</p>)}

          <Button type="submit" size="lg" className="mt-5 w-full" loading={paying} disabled={(!available.length && !isFree) || quoting || !quote}>
            {isFree ? "Complete order" : quote ? `Pay ${formatMoney(quote.total, activeCurrency)}` : "Pay"}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted"><Lock className="h-3 w-3" /> Payments are encrypted and processed by licensed providers</p>
        </div>
      </aside>
    </form>
  );
}

function normalizePhone(p: string, country?: string) {
  const cc: Record<string, string> = { ZM: "260", UG: "256", KE: "254", GH: "233", TZ: "255", RW: "250" };
  if (p.startsWith("+")) return p;
  if (p.startsWith("0") && country && cc[country]) return `+${cc[country]}${p.slice(1)}`;
  return p;
}
