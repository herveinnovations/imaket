import type { Metadata } from "next";
import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/dashboard/widgets";
import { PayoutsQueue } from "@/components/admin/admin-tables";
import { EmptyState } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth";
import { getAllPayouts } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Payouts" };

export default async function AdminPayoutsPage() {
  await requireRole(["admin"], "/admin/payouts");
  const payouts = await getAllPayouts();
  return (
    <>
      <PageHeader title="Payouts" description="Send the transfer, then mark it paid with the reference so the creator can reconcile it." />
      {payouts.length ? <PayoutsQueue payouts={payouts} /> : <EmptyState icon={Banknote} title="No payout requests" body="Creator withdrawal requests appear here." />}
    </>
  );
}
