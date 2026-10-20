"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, FileText, PlayCircle, Ticket } from "lucide-react";
import { toast } from "sonner";
import { ProductCover } from "@/components/product/product-cover";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDate } from "@/lib/utils";
import type { Download as DL } from "@/lib/types";

/** Library of purchased items. Downloads go through /api/downloads, which checks the entitlement and returns a 60-second signed URL. */
export function Library({ items }: { items: DL[] }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function download(d: DL, fileId: string) {
    setBusy(fileId);
    const res = await fetch(`/api/downloads/${d.id}?file=${fileId}`);
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error(json.error ?? "Download unavailable.");
    if (json.demo) return toast.info("Demo mode: in production this starts the file download.");
    window.location.href = json.url;
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {items.map((d) => {
        const p = d.product!;
        const left = d.max_downloads != null ? d.max_downloads - d.download_count : null;
        const expired = d.expires_at && new Date(d.expires_at) < new Date();
        return (
          <li key={d.id} className="card flex gap-4 p-4">
            <ProductCover id={p.id} title={p.title} type={p.type} coverUrl={p.cover_url} size="sm" className="h-28 w-[84px] shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <Link href={`/p/${p.slug}`} className="font-medium hover:underline">{p.title}</Link>
              <p className="text-sm text-muted">{p.creator?.store_name} · bought {formatDate(d.created_at)}</p>
              {p.type === "course" ? (
                <Button size="sm" className="mt-3" onClick={() => toast.info("Course player opens here: lessons stream from signed URLs.")}><PlayCircle className="h-4 w-4" /> Continue course</Button>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {(p.files ?? []).map((f) => (
                    <li key={f.id} className="flex items-center gap-2 text-sm">
                      {p.type === "ticket" ? <Ticket className="h-4 w-4 shrink-0 text-muted" /> : <FileText className="h-4 w-4 shrink-0 text-muted" />}
                      <span className="min-w-0 flex-1 truncate">{f.file_name}</span>
                      <span className="text-xs text-muted">{formatBytes(f.size_bytes)}</span>
                      <button onClick={() => download(d, f.id)} disabled={busy === f.id || !!expired || left === 0}
                        className="rounded-lg p-1.5 text-brand hover:bg-brand-soft disabled:opacity-40" aria-label={`Download ${f.file_name}`}>
                        <Download className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted">
                {expired ? "Access expired" : left != null ? `${left} of ${d.max_downloads} downloads left` : "Unlimited downloads"}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
