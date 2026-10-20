"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareStoreButton({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/${handle}` : `/${handle}`;
  async function copy() {
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <>
      <Button variant="secondary" onClick={copy}>{copied ? <Check className="h-4 w-4 text-brand" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy store link"}</Button>
      <a href={`https://wa.me/?text=${encodeURIComponent(`Check out my store: ${url}`)}`} target="_blank" rel="noopener noreferrer"
        className="inline-flex h-11 items-center gap-2 rounded-xl border bg-surface px-4 text-[15px] font-medium hover:bg-surface-2" aria-label="Share on WhatsApp">
        <MessageCircle className="h-4 w-4 text-[#25D366]" /> <span className="hidden sm:inline">WhatsApp</span>
      </a>
    </>
  );
}
