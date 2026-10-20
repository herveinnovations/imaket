import type { Metadata } from "next";
import { Banknote } from "lucide-react";
import { PageHeader, Panel } from "@/components/dashboard/widgets";
import { PayoutMethodForm, RequestPayout } from "@/components/dashboard/payouts-panel";
import { EmptyState, StatusBadge, Table, THead } from "@/components/ui/primitives";
import { requireCreator } from "@/lib/auth";
import { getCreatorPayouts, getCreatorStats, getPlatformSettings } from "@/lib/data/dashboard";
import { formatDate, formatMoney } from "@/lib/utils";
import type { PayoutMethod } from "@/lib/types";

export const metadata: Metadata = { title: "Payouts" };

export default async function PayoutsPage() {
  const { creator, demo } = await requireCreator("/creator/payouts");
  const [stats, payouts, settings] = await Promise.all([getCreatorStats(creator.id), getCreatorPayouts(creator.id), getPlatformSettings()]);
  const cur = creator.currency;
  const min = (settings.min_payout as Record<string, number>)[cur] ?? 0;
  const hold = Number(settings.payout_hold_days ?? 7);
  const method: PayoutMethod | null = creator.payout_method ?? (demo ? { type: "mobile_money", network: "MTN MoMo", number: "0976504521", name: "Mutale Banda" } : null);
  const b = stats.balance;

  return (
    <>
      <PageHeader title="Payouts" description={`Sales clear after ${hold} days, then you can withdraw to mobile money or your bank.`} />

      <section className="mb-6 grid overflow-hidden rounded-3xl bg-[#161A33] text-white md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="p-6 sm:p-8">
          <p className="text-sm text-white/70">Available to withdraw</p>
          <p className="mt-2 font-display text-5xl font-bold tracking-tight tabular-nums">{formatMoney(b.available, cur)}</p>
          <div className="mt-6 [&_button]:bg-accent [&_button]:text-[#1d1500]"><RequestPayout available={b.available} currency={cur} min={min} method={method} /></div>
        </div>
        {[["Clearing", b.pending, `Available within ${hold} days`], ["Paid out", b.paid_out, "All time"], ["Lifetime earnings", b.lifetime, "After fees"]].map(([l, v, h]) => (
          <div key={l as string} className="border-t border-white/10 p-6 md:border-l md:border-t-0 sm:p-8">
            <p className="text-sm text-white/70">{l}</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{formatMoney(v as number, cur)}</p>
            <p className="mt-1 text-xs text-white/50">{h}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Withdrawal history">
          {payouts.length === 0 ? <EmptyState icon={Banknote} title="No withdrawals yet" body={`Once you've earned ${formatMoney(min, cur)}, you can withdraw.`} /> : (
            <Table className="border-0">
              <THead cols={["Requested", "Method", "Status", { label: "Amount", className: "text-right" }]} />
              <tbody className="divide-y">
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Requested">{formatDate(p.requested_at)}{p.reference && <span className="block font-mono text-xs text-muted">{p.reference}</span>}</td>
                    <td data-label="Method" className="text-muted">{p.method}</td>
                    <td data-label="Status"><StatusBadge status={p.status} /></td>
                    <td data-label="Amount" className="text-right font-semibold tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
        <Panel title="Payout method"><PayoutMethodForm method={method} country={creator.country ?? "ZM"} /></Panel>
      </div>
    </>
  );
}
