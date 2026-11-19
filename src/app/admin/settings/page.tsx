import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/widgets";
import { PlatformSettingsForm } from "@/components/admin/platform-settings";
import { requireRole } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/data/dashboard";
import { PROVIDERS } from "@/lib/payments";

export const metadata: Metadata = { title: "Platform settings" };

export default async function AdminSettingsPage() {
  await requireRole(["admin"], "/admin/settings");
  const settings = await getPlatformSettings();
  const configured = Object.fromEntries(Object.values(PROVIDERS).map((p) => [p.id, p.isConfigured()]));
  return (
    <>
      <PageHeader title="Platform settings" description="Changes apply immediately for every store." />
      <PlatformSettingsForm settings={settings} configured={configured} />
    </>
  );
}
