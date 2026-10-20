import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/widgets";
import { AccountSettings } from "@/components/dashboard/account-settings";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function CustomerSettingsPage() {
  const { user, creator } = await requireRole(["customer", "creator", "admin"], "/dashboard/settings");
  return (
    <>
      <PageHeader title="Settings" description="Your profile, login and appearance." />
      <AccountSettings user={user} isCreator={!!creator} />
    </>
  );
}
