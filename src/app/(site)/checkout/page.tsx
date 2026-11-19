import type { Metadata } from "next";
import { CheckoutForm, type MethodOption } from "@/components/checkout/checkout-form";
import { getSession } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { PROVIDERS } from "@/lib/payments";
import { MOMO_NETWORKS, CURRENCY_COUNTRY } from "@/lib/payments/mobile-money";
import { getPlatformSettings } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const [session, settings, sp] = await Promise.all([getSession(), getPlatformSettings(), searchParams]);
  const enabled = (settings.enabled_providers as string[]) ?? [];
  const methods: MethodOption[] = Object.values(PROVIDERS)
    .filter((p) => enabled.includes(p.id) && (isDemoMode || p.isConfigured()))
    // Flutterwave/DusuPay also appear under "Mobile money"; show them as card options
    .map((p) => ({ id: p.id, label: p.label, currencies: p.currencies }));

  return (
    <div className="container max-w-6xl py-10">
      <h1 className="text-4xl font-bold">Checkout</h1>
      {sp.cancelled && <p className="mt-4 rounded-xl bg-accent/15 p-3 text-sm">Payment was cancelled. Your cart is still here when you&apos;re ready.</p>}
      <CheckoutForm
        methods={methods}
        networks={MOMO_NETWORKS}
        currencyCountry={CURRENCY_COUNTRY}
        prefill={session && !session.demo ? { email: session.user.email, name: session.user.full_name ?? "", phone: session.user.phone ?? "" } : undefined}
      />
    </div>
  );
}
