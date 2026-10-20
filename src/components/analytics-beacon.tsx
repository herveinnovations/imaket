"use client";

import { useEffect } from "react";

/** Fire-and-forget view tracking (store_view / product_view). */
export function AnalyticsBeacon({ event, creatorId, productId }: { event: "store_view" | "product_view"; creatorId: string; productId?: string }) {
  useEffect(() => {
    const body = JSON.stringify({ event, creatorId, productId, referrer: document.referrer || null });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
    else fetch("/api/analytics", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }, [event, creatorId, productId]);
  return null;
}
