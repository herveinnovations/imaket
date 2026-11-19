import type { Metadata } from "next";
import { Share2 } from "lucide-react";
import { PageHeader, Panel, StatCard } from "@/components/dashboard/widgets";
import { AffiliateActions, CopyField } from "@/components/dashboard/affiliate-actions";
import { EmptyState, StatusBadge, Table, THead } from "@/components/ui/primitives";
import { requireCreator } from "@/lib/auth";
import { getCreatorAffiliates } from "@/lib/data/dashboard";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Affiliates" };

export default async function AffiliatesPage() {
  const { creator } = await requireCreator("/creator/affiliates");
  const affiliates = await getCreatorAffiliates(creator.id);
  const clicks = affiliates.reduce((s, a) => s + a.clicks, 0);
  const conv = affiliates.reduce((s, a) => s + a.conversions, 0);
  const paid = affiliates.reduce((s, a) => s + Number(a.earnings), 0);

  return (
    <>
      <PageHeader title="Affiliates" description="People who promote your products and earn a commission on each sale they refer." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Referred clicks" value={clicks.toLocaleString()} />
        <StatCard label="Referred sales" value={conv.toLocaleString()} hint={clicks ? `${((conv / clicks) * 100).toFixed(1)}% conversion` : undefined} />
        <StatCard label="Commission earned by affiliates" value={formatMoney(paid, creator.currency)} />
      </div>

      <Panel title="Invite affiliates" className="mb-6">
        <p className="mb-3 max-w-2xl text-sm text-muted">
          Share this sign-up link. Each affiliate gets a personal code; any link to your store or products with <code className="font-mono">?ref=CODE</code> credits them for 30 days.
          Commission comes out of your earnings on referred sales only. Set the rate per product in the product editor.
        </p>
        <CopyField value={`${env.appUrl}/${creator.handle}/affiliate`} />
      </Panel>

      {affiliates.length === 0 ? (
        <EmptyState icon={Share2} title="No affiliates yet" body="Invite fans, podcasters and community admins who already talk about your work." />
      ) : (
        <Table>
          <THead cols={["Affiliate", "Code", { label: "Commission", className: "text-right" }, { label: "Clicks", className: "text-right" }, { label: "Sales", className: "text-right" }, { label: "Earned", className: "text-right" }, "Status", ""]} />
          <tbody className="divide-y">
            {affiliates.map((a) => (
              <tr key={a.id}>
                <td data-label=""><p className="font-medium">{a.name}</p><p className="text-xs text-muted">{a.email}</p></td>
                <td data-label="Code"><code className="font-mono text-sm">{a.code}</code></td>
                <td data-label="Commission" className="text-right tabular-nums">{a.commission_percent}%</td>
                <td data-label="Clicks" className="text-right tabular-nums">{a.clicks.toLocaleString()}</td>
                <td data-label="Sales" className="text-right tabular-nums">{a.conversions}</td>
                <td data-label="Earned" className="text-right font-medium tabular-nums">{formatMoney(Number(a.earnings), creator.currency)}</td>
                <td data-label="Status"><StatusBadge status={a.status} /></td>
                <td className="text-right"><AffiliateActions id={a.id} status={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
