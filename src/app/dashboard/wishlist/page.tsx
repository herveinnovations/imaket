import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { PageHeader } from "@/components/dashboard/widgets";
import { ProductCard } from "@/components/product/product-card";
import { EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { getWishlist } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const { user } = await requireRole(["customer", "creator", "admin"], "/dashboard/wishlist");
  const items = await getWishlist(user.id);
  return (
    <>
      <PageHeader title="Wishlist" description="Products you've saved. Tap the heart on any product to add it here." />
      {items.length === 0 ? (
        <EmptyState icon={Heart} title="Nothing saved yet" body="Save products to compare them or buy later." action={<ButtonLink href="/marketplace">Browse the marketplace</ButtonLink>} />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">{items.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      )}
    </>
  );
}
