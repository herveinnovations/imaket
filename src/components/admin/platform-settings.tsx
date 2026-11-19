"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Switch } from "@/components/ui/primitives";

const PROVIDERS = [
  ["mobile_money", "Mobile money", "MTN, Airtel, Zamtel, M-Pesa via your aggregator"],
  ["flutterwave", "Flutterwave", "Cards, bank transfer, USSD, mobile money"],
  ["dusupay", "DusuPay", "Mobile money and cards across East and Southern Africa"],
  ["stripe", "Stripe", "International cards"],
  ["paypal", "PayPal", "USD, EUR and GBP stores only"],
] as const;

export function PlatformSettingsForm({ settings, configured }: { settings: Record<string, unknown>; configured: Record<string, boolean> }) {
  const router = useRouter();
  const [s, setS] = useState({
    fee_percent: String(settings.fee_percent ?? 5),
    payout_hold_days: String(settings.payout_hold_days ?? 7),
    auto_approve_products: Boolean(settings.auto_approve_products),
    maintenance_mode: Boolean(settings.maintenance_mode),
    enabled_providers: (settings.enabled_providers as string[]) ?? [],
  });
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const fee = Number(s.fee_percent);
    if (Number.isNaN(fee) || fee < 0 || fee > 30) return toast.error("Platform fee must be between 0 and 30%.");
    setBusy(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...s, fee_percent: fee, payout_hold_days: Number(s.payout_hold_days) }),
    });
    setBusy(false);
    if (!res.ok) return toast.error("Couldn't save settings.");
    toast.success("Settings saved");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="max-w-3xl space-y-6">
      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-sans text-base font-semibold tracking-normal sm:col-span-2">Fees and payouts</h2>
        <Input label="Platform fee (%)" name="fee" inputMode="decimal" value={s.fee_percent} onChange={(e) => setS({ ...s, fee_percent: e.target.value })} hint="Applied to new orders only" />
        <Input label="Clearing period (days)" name="hold" inputMode="numeric" value={s.payout_hold_days} onChange={(e) => setS({ ...s, payout_hold_days: e.target.value.replace(/\D/g, "") })} hint="How long before sales can be withdrawn" />
      </section>

      <section className="card p-6">
        <h2 className="mb-1 font-sans text-base font-semibold tracking-normal">Payment methods</h2>
        <p className="mb-4 text-sm text-muted">A method only appears at checkout when it&apos;s enabled here and its API keys are set in the environment.</p>
        <div className="divide-y">
          {PROVIDERS.map(([id, label, desc]) => (
            <div key={id} className="py-3">
              <Switch label={label} checked={s.enabled_providers.includes(id)}
                description={`${desc}${configured[id] ? "" : " · keys not configured"}`}
                onChange={(v) => setS({ ...s, enabled_providers: v ? [...s.enabled_providers, id] : s.enabled_providers.filter((x) => x !== id) })} />
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="font-sans text-base font-semibold tracking-normal">Marketplace</h2>
        <Switch label="Approve new products automatically" description="Skip manual review. Products go live as soon as creators submit them." checked={s.auto_approve_products} onChange={(v) => setS({ ...s, auto_approve_products: v })} />
        <Switch label="Maintenance mode" description="Pauses checkout across the platform. Stores stay visible." checked={s.maintenance_mode} onChange={(v) => setS({ ...s, maintenance_mode: v })} />
      </section>

      <Button type="submit" size="lg" loading={busy}>Save settings</Button>
    </form>
  );
}
