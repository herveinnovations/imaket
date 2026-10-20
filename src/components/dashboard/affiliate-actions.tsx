"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex max-w-xl gap-2">
      <input readOnly value={value} className="input h-10 font-mono text-sm" aria-label="Link" onFocus={(e) => e.target.select()} />
      <Button size="sm" variant="secondary" className="h-10" onClick={async () => { await navigator.clipboard.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? <Check className="h-4 w-4 text-brand" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function AffiliateActions({ id, status }: { id: string; status: "active" | "paused" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/affiliates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: status === "active" ? "paused" : "active" }) });
    setBusy(false);
    if (!res.ok) return toast.error("Couldn't update the affiliate.");
    router.refresh();
  }
  return <Button size="sm" variant="ghost" loading={busy} onClick={toggle}>{status === "active" ? "Pause" : "Resume"}</Button>;
}
