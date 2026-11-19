import type { Metadata } from "next";
import { Library as LibraryIcon } from "lucide-react";
import { PageHeader } from "@/components/dashboard/widgets";
import { Library } from "@/components/dashboard/library";
import { EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { getCustomerDownloads } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Library" };

export default async function DownloadsPage() {
  const { user } = await requireRole(["customer", "creator", "admin"], "/dashboard/downloads");
  const items = await getCustomerDownloads(user.id);
  return (
    <>
      <PageHeader title="Library" description="Everything you've bought. Download links are generated fresh each time and expire after a minute." />
      {items.length ? <Library items={items} /> : (
        <EmptyState icon={LibraryIcon} title="Your library is empty" body="Bought something with a different email? Log in with that email to see it here."
          action={<ButtonLink href="/marketplace">Browse the marketplace</ButtonLink>} />
      )}
    </>
  );
}
