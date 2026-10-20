import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/widgets";
import { AccountSettings } from "@/components/dashboard/account-settings";
import { requireCreator } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function CreatorSettingsPage() {
  const { user } = await requireCreator("/creator/settings");
  return (
    <>
      <PageHeader title="Settings" description="Your account, login and appearance." />
      <AccountSettings user={user} isCreator />
    </>
  );
}
