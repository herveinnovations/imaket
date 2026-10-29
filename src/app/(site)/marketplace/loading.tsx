import { ProductCardSkeleton } from "@/components/product/product-card";
import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="px-5 pb-16 pt-1" aria-busy="true" aria-label="Loading products">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-5 h-10 w-64" />
      <div className="mt-16 grid gap-10 lg:grid-cols-[200px_1fr]">
        <div className="hidden space-y-2 lg:block">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-7" />)}</div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );
}
