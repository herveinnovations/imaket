import { Skeleton } from "./primitives";
import { cn } from "@/lib/utils";

/** Page-shaped skeleton loaders (grey blocks with a shimmer), one per page type. */

function Busy({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white", className)} role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

export function ProductTileSkeleton({ center }: { center?: boolean }) {
  return (
    <div>
      <Skeleton className="aspect-square w-full" />
      <div className={cn("mt-4 space-y-2", center && "flex flex-col items-center")}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <Busy label="Loading home page">
      <div className="grid md:h-[min(52vw,760px)] md:grid-cols-[2fr_1fr_2fr]">
        <Skeleton className="aspect-[4/5] md:aspect-auto md:h-full" />
        <div className="flex flex-col items-center gap-3 px-4 py-6">
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-8 w-3/5" />
          <div className="flex-1" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="mb-3 h-8 w-28 rounded-full" />
          <Skeleton className="hidden h-[47%] w-full md:block" />
        </div>
        <Skeleton className="hidden md:block md:h-full" />
      </div>
      <div className="flex justify-center pt-11"><Skeleton className="h-8 w-48" /></div>
      <div className="mt-14 grid grid-cols-2 gap-x-2.5 gap-y-8 px-0.5 pb-12 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <ProductTileSkeleton key={i} center />)}
      </div>
    </Busy>
  );
}

export function ShopSkeleton() {
  return (
    <Busy label="Loading products" className="px-5 pb-16 pt-1">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-5 h-10 w-64" />
      <div className="mt-16 grid gap-10 lg:grid-cols-[200px_1fr]">
        <div className="hidden space-y-3 lg:block">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-4 w-32" />)}
          <Skeleton className="mt-6 h-5 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div>
          <div className="mb-5 flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-6 w-48" /></div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <ProductTileSkeleton key={i} />)}
          </div>
        </div>
      </div>
    </Busy>
  );
}

export function ProductSkeleton() {
  return (
    <Busy label="Loading product" className="px-2.5 pb-16 pt-3 sm:px-3">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,826px)_1fr]">
        <div className="flex gap-3">
          <div className="hidden w-[45px] flex-col gap-1.5 sm:flex">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[45px] w-[45px]" />)}</div>
          <Skeleton className="aspect-square flex-1" />
        </div>
        <div className="space-y-4 lg:pr-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-4/5" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-[38px] w-[104px]" />
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-[42px] w-full rounded-full" />
          <div className="space-y-2 pt-4"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-2/3" /></div>
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    </Busy>
  );
}

export function StorefrontSkeleton() {
  return (
    <Busy label="Loading store">
      <Skeleton className="h-44 w-full sm:h-64" />
      <div className="px-5">
        <div className="-mt-14 flex items-end gap-4 sm:-mt-16">
          <Skeleton className="h-[120px] w-[120px] rounded-full border-[5px] border-white" />
          <div className="space-y-2 pb-2"><Skeleton className="h-9 w-56" /><Skeleton className="h-4 w-40" /></div>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-x-2.5 gap-y-8 pb-16 md:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <ProductTileSkeleton key={i} />)}
        </div>
      </div>
    </Busy>
  );
}

function PostSkeleton() {
  return (
    <div className="border border-black/15 p-4">
      <div className="flex gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-20" /></div></div>
      <div className="mt-4 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
    </div>
  );
}

export function GroupsSkeleton() {
  return (
    <Busy label="Loading groups" className="px-5 pb-20 pt-8">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">{Array.from({ length: 3 }, (_, i) => <PostSkeleton key={i} />)}</div>
        <div className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <div className="space-y-4 border border-black/15 p-5">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3"><Skeleton className="h-12 w-12" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/3" /></div></div>
            ))}
          </div>
        </div>
      </div>
    </Busy>
  );
}

export function MembersSkeleton() {
  return (
    <Busy label="Loading members" className="px-5 pb-20 pt-8">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-10 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-3 bg-stone/60 px-5 py-8">
            <Skeleton className="h-[88px] w-[88px] rounded-full" />
            <Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-9 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </Busy>
  );
}

export function TextPageSkeleton() {
  return (
    <Busy label="Loading page" className="mx-auto max-w-3xl px-5 pb-24 pt-12">
      <Skeleton className="h-12 w-2/3" />
      <div className="mt-10 space-y-8">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" /></div>
        ))}
      </div>
    </Busy>
  );
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[118px]" />)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <div className="mt-6 space-y-2 border border-black/15 p-4">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    </div>
  );
}
