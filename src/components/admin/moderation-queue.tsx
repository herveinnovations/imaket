"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, CheckCheck, X } from "lucide-react";
import { toast } from "sonner";
import { ProductCover } from "@/components/product/product-cover";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { EmptyState, Textarea } from "@/components/ui/primitives";
import { formatMoney, PRODUCT_TYPE_LABEL, timeAgo } from "@/lib/utils";
import type { Product } from "@/lib/types";

const REASONS = [
  "The description doesn't say what buyers receive.",
  "The cover or title uses content you don't have rights to.",
  "This looks like resold or private-label content.",
  "Prohibited item under our seller rules.",
];

export function ModerationQueue({ products }: { products: Product[] }) {
  const router = useRouter();
  const [items, setItems] = useState(products);
  const [rejecting, setRejecting] = useState<Product | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(p: Product, decision: "approve" | "reject", why?: string) {
    setBusy(p.id);
    const res = await fetch(`/api/admin/products/${p.id}/moderate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, reason: why }) });
    setBusy(null);
    if (!res.ok) return toast.error("Couldn't save the decision.");
    setItems((x) => x.filter((i) => i.id !== p.id));
    toast.success(decision === "approve" ? `“${p.title}” is live` : "Sent back to the creator with your note");
    setRejecting(null); setReason("");
    router.refresh();
  }

  if (!items.length) return <EmptyState icon={CheckCheck} title="Queue is clear" body="New and edited products will appear here for review." />;

  return (
    <>
      <ul className="space-y-4">
        {items.map((p) => (
          <li key={p.id} className="card grid gap-5 p-5 sm:grid-cols-[120px_1fr_auto]">
            <ProductCover id={p.id} title={p.title} type={p.type} coverUrl={p.cover_url} size="sm" className="aspect-[4/5] w-[120px] rounded-xl" />
            <div className="min-w-0">
              <p className="text-xs text-muted" suppressHydrationWarning>{PRODUCT_TYPE_LABEL[p.type]} · {p.category?.name ?? "No category"} · submitted {timeAgo(p.created_at)}</p>
              <h3 className="mt-1 font-sans text-lg font-semibold tracking-normal">{p.title}</h3>
              <p className="text-sm">by <Link href={`/${p.creator?.handle}`} target="_blank" className="font-medium hover:underline">{p.creator?.store_name}</Link>{p.creator?.verified && " (verified)"}</p>
              <p className="mt-2 text-sm text-muted">{p.summary}</p>
              <p className="mt-2 font-semibold">{formatMoney(p.price, p.currency)}</p>
            </div>
            <div className="flex gap-2 sm:flex-col">
              <Button loading={busy === p.id} onClick={() => decide(p, "approve")}><Check className="h-4 w-4" /> Approve</Button>
              <Button variant="secondary" onClick={() => setRejecting(p)}><X className="h-4 w-4" /> Request changes</Button>
            </div>
          </li>
        ))}
      </ul>
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Request changes" description="The creator sees this note and can resubmit."
        footer={<><Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="danger" disabled={reason.trim().length < 10} loading={!!busy} onClick={() => rejecting && decide(rejecting, "reject", reason.trim())}>Send back</Button></>}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">{REASONS.map((r) => <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border px-3 py-1.5 text-left text-sm hover:bg-surface-2">{r}</button>)}</div>
          <Textarea label="Note to the creator" name="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain what needs to change" />
        </div>
      </Modal>
    </>
  );
}
