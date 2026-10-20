"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banknote, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/primitives";
import { cn, formatMoney } from "@/lib/utils";
import type { PayoutMethod } from "@/lib/types";

export function RequestPayout({ available, currency, min, method }: { available: number; currency: string; min: number; method: PayoutMethod | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(Math.floor(available)));
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const err = !method ? "Add a payout method first." : n < min ? `The minimum withdrawal is ${formatMoney(min, currency)}.` : n > available ? "That's more than your available balance." : null;

  async function submit() {
    if (err) return toast.error(err);
    setBusy(true);
    const res = await fetch("/api/payouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: n }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(json.error ?? "Couldn't request the payout.");
    toast.success("Withdrawal requested", { description: "Mobile money payouts usually arrive within one working day." });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)} disabled={available < min}>Withdraw</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Withdraw earnings"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={busy} onClick={submit} disabled={!!err}>Withdraw {formatMoney(n || 0, currency)}</Button></>}>
        <div className="space-y-4">
          <Input label={`Amount (${currency})`} name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} error={amount ? err ?? undefined : undefined}
            hint={`Available: ${formatMoney(available, currency)}`} />
          <div className="flex gap-2">
            {[0.25, 0.5, 1].map((f) => <button key={f} type="button" onClick={() => setAmount(String(Math.floor(available * f)))} className="rounded-full border px-3 py-1 text-sm hover:bg-surface-2">{f === 1 ? "All" : `${f * 100}%`}</button>)}
          </div>
          {method && <p className="rounded-xl bg-surface-2 p-3 text-sm">Paid to: <strong>{describeMethod(method)}</strong></p>}
        </div>
      </Modal>
    </>
  );
}

export function describeMethod(m: PayoutMethod) {
  if (m.type === "mobile_money") return `${m.network} ••• ${m.number.slice(-4)} (${m.name})`;
  if (m.type === "bank") return `${m.bank} ••• ${m.account_number.slice(-4)}`;
  return `PayPal ${m.email}`;
}

export function PayoutMethodForm({ method, country }: { method: PayoutMethod | null; country: string }) {
  const router = useRouter();
  const [type, setType] = useState<PayoutMethod["type"]>(method?.type ?? "mobile_money");
  const [busy, setBusy] = useState(false);
  const nets = country === "KE" ? ["M-Pesa", "Airtel Money"] : country === "GH" ? ["MTN MoMo", "Telecel Cash", "AT Money"] : ["MTN MoMo", "Airtel Money", "Zamtel Kwacha"];

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    const res = await fetch("/api/creator/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payout_method: { type, ...fd } }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(json.error ?? "Couldn't save your payout method.");
    toast.success("Payout method saved");
    router.refresh();
  }

  const mm = method?.type === "mobile_money" ? method : null;
  const bank = method?.type === "bank" ? method : null;
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {([["mobile_money", "Mobile money", Smartphone], ["bank", "Bank account", Banknote]] as const).map(([t, l, I]) => (
          <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
            className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm font-medium", type === t ? "border-brand bg-brand-soft text-brand" : "hover:border-fg/30")}>
            <I className="h-4 w-4" /> {l}
          </button>
        ))}
      </div>
      {type === "mobile_money" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Network" name="network" defaultValue={mm?.network ?? nets[0]}>{nets.map((n) => <option key={n}>{n}</option>)}</Select>
          <Input label="Number" name="number" type="tel" required defaultValue={mm?.number} placeholder="0971234567" />
          <Input className="sm:col-span-2" label="Registered name" name="name" required defaultValue={mm?.name} hint="Must match the name on the mobile money account" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Bank" name="bank" required defaultValue={bank?.bank} placeholder="Zanaco" />
          <Input label="Account number" name="account_number" required defaultValue={bank?.account_number} />
          <Input className="sm:col-span-2" label="Account name" name="account_name" required defaultValue={bank?.account_name} />
        </div>
      )}
      <Button type="submit" variant="secondary" loading={busy}>Save payout method</Button>
    </form>
  );
}
