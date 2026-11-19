import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/widgets";
import { NewProductButton } from "@/components/dashboard/product-upload-modal";
import { ProductsTable } from "@/components/dashboard/products-table";
import { requireCreator } from "@/lib/auth";
import { getCategories } from "@/lib/data/catalog";
import { getCreatorProducts } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Products" };

export default async function CreatorProductsPage() {
  const { creator } = await requireCreator("/creator/products");
  const [products, categories] = await Promise.all([getCreatorProducts(creator.id), getCategories()]);
  return (
    <>
      <PageHeader title="Products" description="Everything you sell: downloads, courses, services, tickets and physical goods."
        actions={<NewProductButton categories={categories} currency={creator.currency} />} />
      <ProductsTable products={products} categories={categories} currency={creator.currency} />
    </>
  );
}
