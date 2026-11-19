import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/widgets";
import { CouponsManager } from "@/components/dashboard/coupons-manager";
import { requireCreator } from "@/lib/auth";
import { getCreatorCoupons } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Discount codes" };

export default async function CouponsPage() {
  const { creator } = await requireCreator("/creator/coupons");
  const coupons = await getCreatorCoupons(creator.id);
  return (
    <>
      <PageHeader title="Discount codes" description="Buyers enter these at checkout. Try MONTHEND in the demo checkout." />
      <CouponsManager coupons={coupons} currency={creator.currency} />
    </>
  );
}
