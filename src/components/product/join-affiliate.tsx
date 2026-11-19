"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { CopyField } from "@/components/dashboard/affiliate-actions";

export function JoinAffiliate({ creatorId, handle, signedIn }: { creatorId: string; handle: string; signedIn: boolean }) {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!signedIn) return <ButtonLink href={`/login?next=/${handle}/affiliate`} size="lg">Log in to get your link</ButtonLink>;
  if (code) {
    return (
      <div className="card space-y-3 p-5">
        <p className="font-medium">Your affiliate link</p>
        <CopyField value={`${window.location.origin}/${handle}?ref=${code}`} />
        <p className="text-sm text-muted">Works on any product link too. Just add ?ref={code}.</p>
      </div>
    );
  }
  async function join() {
    setBusy(true);
    const res = await fetch("/api/affiliates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creatorId }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(json.error ?? "Couldn't join the programme.");
    setCode(json.code);
  }
  return <Button size="lg" loading={busy} onClick={join}>Get my affiliate link</Button>;
}
