import { ProductCardSkeleton } from "@/components/product/product-card";
import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="container py-10" aria-busy="true" aria-label="Loading products">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-10 grid gap-10 lg:grid-cols-[230px_1fr]">
        <div className="hidden space-y-2 lg:block">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-8" />)}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );
}
