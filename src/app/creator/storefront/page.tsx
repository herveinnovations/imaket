import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/dashboard/widgets";
import { StorefrontEditor } from "@/components/dashboard/storefront-editor";
import { ButtonLink } from "@/components/ui/button";
import { requireCreator } from "@/lib/auth";
import { getCreatorProducts } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Storefront" };

export default async function StorefrontSettingsPage() {
  const { creator } = await requireCreator("/creator/storefront");
  const products = await getCreatorProducts(creator.id);
  return (
    <>
      <PageHeader title="Storefront" description="How your store looks to buyers."
        actions={<ButtonLink href={`/${creator.handle}`} target="_blank" variant="secondary"><ExternalLink className="h-4 w-4" /> View store</ButtonLink>} />
      <StorefrontEditor creator={creator} products={products} />
    </>
  );
}
