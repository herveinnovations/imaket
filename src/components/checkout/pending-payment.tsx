"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import { ButtonLink } from "@/components/ui/button";

/** Push-to-phone mobile money: poll the order until the webhook marks it paid. */
export function PendingPayment({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"waiting" | "failed" | "timeout">("waiting");

  useEffect(() => {
    if (!orderId) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const res = await fetch(`/api/orders/${orderId}/status`, { cache: "no-store" }).catch(() => null);
      const json = res?.ok ? await res.json() : null;
      if (json?.status === "paid" || json?.status === "fulfilled") { clearInterval(t); router.replace(`/checkout/success?order=${orderId}`); }
      else if (json?.status === "failed") { clearInterval(t); setState("failed"); }
      else if (tries > 60) { clearInterval(t); setState("timeout"); }
    }, 3000);
    return () => clearInterval(t);
  }, [orderId, router]);

  return (
    <div className="container flex max-w-md flex-col items-center py-24 text-center">
      <motion.div animate={state === "waiting" ? { rotate: [0, -8, 8, -8, 0] } : {}} transition={{ repeat: Infinity, duration: 1.4, repeatDelay: 1.2 }}>
        <Smartphone className="h-16 w-16 text-brand" strokeWidth={1.5} />
      </motion.div>
      {state === "waiting" && <>
        <h1 className="mt-6 text-3xl font-bold">Check your phone</h1>
        <p className="mt-3 text-muted">Approve the payment prompt and enter your PIN. This page updates on its own once the payment clears.</p>
      </>}
      {state === "failed" && <>
        <h1 className="mt-6 text-3xl font-bold">Payment didn&apos;t go through</h1>
        <p className="mt-3 text-muted">The prompt was declined or timed out. No money was taken. Try again, or use a different number or method.</p>
        <ButtonLink href="/checkout" className="mt-6">Back to checkout</ButtonLink>
      </>}
      {state === "timeout" && <>
        <h1 className="mt-6 text-3xl font-bold">Still waiting on the network</h1>
        <p className="mt-3 text-muted">If you approved the prompt, you&apos;ll get an email as soon as it clears. If not, you can try again.</p>
        <ButtonLink href="/checkout" variant="secondary" className="mt-6">Back to checkout</ButtonLink>
      </>}
    </div>
  );
}
