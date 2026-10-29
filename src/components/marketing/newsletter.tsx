"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, X } from "lucide-react";

const OPEN_EVENT = "imaket:newsletter";
const SEEN_KEY = "imaket-newsletter-seen";

/** Any element that opens the newsletter popup (footer "Subscribe", the strip above the footer). */
export function NewsletterLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      {children}
    </button>
  );
}

/** White strip with the offer, between the last section and the footer (as on Wix). */
export function NewsletterStrip({ text }: { text: string }) {
  return (
    <div className="bg-white">
      <NewsletterLink className="flex h-12 w-full items-center px-3 text-left text-[17px] hover:underline hover:underline-offset-4 xl:text-[19px]">
        {text}
      </NewsletterLink>
    </div>
  );
}

/** Lime bottom sheet: "Get 10% Off Your First Order!" with email + consent + Submit. */
export function NewsletterPopup({ title, text, autoOpen = true }: { title: string; text: string; autoOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (autoOpen) {
      let seen = false;
      try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch { /* storage blocked */ }
      if (!seen) t = setTimeout(show, 6000);
    }
    return () => { window.removeEventListener(OPEN_EVENT, show); if (t) clearTimeout(t); };
  }, [autoOpen]);

  function close() {
    setOpen(false);
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* storage blocked */ }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Enter a valid email address.");
    if (!consent) return setError("Tick the box to subscribe.");
    setState("busy");
    const res = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, consent, source: "popup" }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setState("idle"); return setError(j.error ?? "Couldn't subscribe right now. Try again."); }
    setCode(j.code ?? null);
    setState("done");
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* storage blocked */ }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="nl-title">
          <motion.div className="absolute inset-0 bg-black/50" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="absolute inset-x-0 bottom-0 bg-lime text-black"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "tween", duration: 0.3 }}>
            <button onClick={close} className="absolute right-3 top-3 grid h-10 w-10 place-items-center" aria-label="Close"><X className="h-6 w-6" /></button>
            <div className="grid gap-8 px-4 pb-10 pt-6 md:grid-cols-2 md:px-6 md:pb-14">
              <div>
                <h2 id="nl-title" className="max-w-[16ch] font-display text-[2.1rem] leading-[1.05] tracking-[-0.05em] md:text-[2.6rem]">{title}</h2>
                <p className="mt-3 text-[15px]">{text}</p>
              </div>
              {state === "done" ? (
                <div className="self-center md:pr-10" aria-live="polite">
                  <p className="font-display text-2xl tracking-[-0.04em]">Thanks for subscribing!</p>
                  {code && (
                    <div className="mt-4">
                      <p className="text-[15px]">Use this code at checkout on your first order:</p>
                      <button onClick={() => { navigator.clipboard.writeText(code).catch(() => {}); setCopied(true); }}
                        className="mt-2 inline-flex items-center gap-3 border-2 border-black bg-white px-4 py-2 font-display text-xl tracking-[-0.03em]">
                        {code} {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4 md:pr-10" noValidate>
                  <div>
                    <label htmlFor="nl-email" className="mb-1 block text-[15px]">Email *</label>
                    <input id="nl-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="h-10 w-full border-b-2 border-black bg-transparent px-0 text-base focus:outline-none" required />
                  </div>
                  <label className="flex items-center gap-2.5 text-[15px]">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="h-4 w-4 accent-black" />
                    Yes, subscribe me to your newsletter. *
                  </label>
                  {error && <p className="text-sm font-bold text-[#b00020]" role="alert">{error}</p>}
                  <button disabled={state === "busy"} className="h-11 w-full rounded-full bg-black text-[15px] text-white hover:bg-black/85 disabled:opacity-60">
                    {state === "busy" ? "Submitting…" : "Submit"}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
