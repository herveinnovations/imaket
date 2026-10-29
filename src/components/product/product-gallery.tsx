"use client";

import { useState } from "react";
import { Maximize2, X } from "lucide-react";
import { ProductCover } from "./product-cover";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/types";

/** Wix product media: vertical thumbnails on the left, large square image, "Enlarge" lightbox. */
export function ProductGallery({ id, title, type, creator, images }: { id: string; title: string; type: ProductType; creator?: string; images: string[] }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const current = images[i] ?? null;
  return (
    <div className="flex gap-3">
      {images.length > 1 && (
        <ul className="hidden w-[45px] shrink-0 flex-col gap-1.5 sm:flex">
          {images.map((src, n) => (
            <li key={src}>
              <button onClick={() => setI(n)} aria-label={`Show image ${n + 1}`} aria-current={n === i}
                className={cn("block h-[45px] w-[45px] overflow-hidden border", n === i ? "border-black" : "border-transparent opacity-80 hover:opacity-100")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative flex-1">
        <ProductCover id={id} title={title} type={type} creator={creator} coverUrl={current} size="lg" className="aspect-square w-full bg-surface-2" />
        {current && (
          <button onClick={() => setZoom(true)} className="absolute bottom-4 right-4 grid h-[30px] w-[30px] place-items-center rounded-full bg-white" aria-label="Enlarge">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
        {images.length > 1 && (
          <div className="mt-2 flex gap-1.5 sm:hidden">
            {images.map((src, n) => (
              <button key={src} onClick={() => setI(n)} className={cn("h-2 w-2 rounded-full", n === i ? "bg-black" : "bg-black/25")} aria-label={`Show image ${n + 1}`} />
            ))}
          </div>
        )}
      </div>
      {zoom && current && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-white p-4" role="dialog" aria-modal="true" aria-label={title}>
          <button onClick={() => setZoom(false)} className="absolute right-4 top-4 grid h-10 w-10 place-items-center" aria-label="Close"><X className="h-6 w-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current} alt={title} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}

/** Wix "Product Info / Return & Refund Policy / Shipping Info" collapsible rows. */
export function InfoSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group border-b border-black/30 py-4" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-base [&::-webkit-details-marker]:hidden">
        {title}
        <span className="text-xl leading-none group-open:hidden" aria-hidden>+</span>
        <span className="hidden text-xl leading-none group-open:inline" aria-hidden>−</span>
      </summary>
      <div className="mt-3 text-sm leading-6">{children}</div>
    </details>
  );
}
