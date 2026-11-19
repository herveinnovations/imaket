import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/widgets";
import { CreatorsTable } from "@/components/admin/admin-tables";
import { requireRole } from "@/lib/auth";
import { getAllCreators } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Creators" };

export default async function AdminCreatorsPage() {
  await requireRole(["admin"], "/admin/creators");
  const creators = await getAllCreators();
  return (
    <>
      <PageHeader title="Creators" description="Verify trusted stores, or suspend stores that break the seller rules." />
      <CreatorsTable creators={creators} />
    </>
  );
}
