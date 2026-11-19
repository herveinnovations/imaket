import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/widgets";
import { ModerationQueue } from "@/components/admin/moderation-queue";
import { requireRole } from "@/lib/auth";
import { getModerationQueue } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Moderation" };

export default async function ModerationPage() {
  await requireRole(["admin"], "/admin/moderation");
  const queue = await getModerationQueue();
  return (
    <>
      <PageHeader title="Moderation" description={`${queue.length} product${queue.length === 1 ? "" : "s"} waiting. Approved products go live immediately; creators are notified either way.`} />
      <ModerationQueue products={queue} />
    </>
  );
}
