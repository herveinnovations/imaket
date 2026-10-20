"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Percent, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { EmptyState, Input, Select, StatusBadge, Switch, Table, THead } from "@/components/ui/primitives";
import { formatDate, formatMoney } from "@/lib/utils";
import type { Coupon } from "@/lib/types";

export function CouponsManager({ coupons, currency }: { coupons: Coupon[]; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ code: "", type: "percent", value: "", min_order: "", max_uses: "", ends_at: "" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[A-Za-z0-9_-]{3,24}$/.test(f.code)) return toast.error("Codes are 3–24 letters or numbers, no spaces.");
    const value = Number(f.value);
    if (!value || value <= 0 || (f.type === "percent" && value > 100)) return toast.error(f.type === "percent" ? "Enter a percentage between 1 and 100." : "Enter a discount amount.");
    setSaving(true);
    const res = await fetch("/api/coupons", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: f.code.toUpperCase(), type: f.type, value, min_order: Number(f.min_order || 0), max_uses: f.max_uses ? Number(f.max_uses) : null, ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return toast.error(json.error ?? "Couldn't create the code.");
    toast.success(`${f.code.toUpperCase()} created`);
    setOpen(false);
    setF({ code: "", type: "percent", value: "", min_order: "", max_uses: "", ends_at: "" });
    router.refresh();
  }

  async function patch(c: Coupon, body: Partial<Coupon> | null) {
    const res = await fetch(`/api/coupons/${c.id}`, body ? { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { method: "DELETE" });
    if (!res.ok) return toast.error("That didn't work.");
    toast.success(body ? "Updated" : `${c.code} deleted`);
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New code</Button></div>
      {coupons.length === 0 ? (
        <EmptyState icon={Percent} title="No discount codes yet" body="Codes are great for launches, WhatsApp groups and loyal customers." />
      ) : (
        <Table>
          <THead cols={["Code", "Discount", "Used", "Expires", "Status", ""]} />
          <tbody className="divide-y">
            {coupons.map((c) => {
              const expired = c.ends_at && new Date(c.ends_at) < new Date();
              const full = c.max_uses != null && c.used_count >= c.max_uses;
              return (
                <tr key={c.id}>
                  <td data-label="Code"><code className="rounded-md bg-surface-2 px-2 py-1 font-mono text-sm font-semibold">{c.code}</code></td>
                  <td data-label="Discount">{c.type === "percent" ? `${c.value}% off` : `${formatMoney(c.value, currency)} off`}{c.min_order > 0 && <span className="block text-xs text-muted">Orders over {formatMoney(c.min_order, currency)}</span>}</td>
                  <td data-label="Used" className="tabular-nums">{c.used_count}{c.max_uses != null && ` / ${c.max_uses}`}</td>
                  <td data-label="Expires" className="text-muted">{c.ends_at ? formatDate(c.ends_at) : "Never"}</td>
                  <td data-label="Status">
                    {expired || full ? <StatusBadge status={expired ? "expired" : "used up"} />
                      : <Switch label="" checked={c.active} onChange={(v) => patch(c, { active: v })} />}
                  </td>
                  <td className="text-right"><button onClick={() => confirm(`Delete ${c.code}?`) && patch(c, null)} className="rounded-lg p-2 text-muted hover:text-danger" aria-label={`Delete ${c.code}`}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New discount code" description="Works on all your products unless you set limits."
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button form="coupon-form" type="submit" loading={saving}>Create code</Button></>}>
        <form id="coupon-form" onSubmit={create} className="grid gap-4 sm:grid-cols-2">
          <Input className="sm:col-span-2" label="Code" name="code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="MONTHEND" />
          <Select label="Type" name="type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="percent">Percentage off</option><option value="fixed">Fixed amount off</option>
          </Select>
          <Input label={f.type === "percent" ? "Percent" : `Amount (${currency})`} name="value" inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value.replace(/[^\d.]/g, "") })} />
          <Input label="Minimum order (optional)" name="min_order" inputMode="decimal" value={f.min_order} onChange={(e) => setF({ ...f, min_order: e.target.value.replace(/[^\d.]/g, "") })} />
          <Input label="Usage limit (optional)" name="max_uses" inputMode="numeric" value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: e.target.value.replace(/\D/g, "") })} />
          <Input className="sm:col-span-2" label="Expires (optional)" type="date" name="ends_at" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} />
        </form>
      </Modal>
    </>
  );
}
