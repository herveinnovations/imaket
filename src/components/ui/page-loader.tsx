"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

/** The iMaket loading animation (Uiverse.io, choudhary-usman). */
export function Loader({ className }: { className?: string }) {
  return <div className={`loader ${className ?? ""}`} role="status" aria-label="Loading" />;
}

/** Full-page loading state, used by the route-level loading.tsx files. */
export function PageLoading() {
  return (
    <div className="grid min-h-[60vh] place-items-center bg-white">
      <Loader />
    </div>
  );
}

const START = "imaket:navigate";
/** Call before router.push() so the overlay shows for programmatic navigation too. */
export function startNavigation() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(START));
}

function isInternalNav(e: MouseEvent): boolean {
  // runs in the capture phase, before Next's <Link> calls preventDefault() for client navigation
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.("a");
  if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download") || a.dataset.noLoader !== undefined) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;                 // file downloads (CSV etc.)
  const same = url.pathname === location.pathname && url.search === location.search;
  return !same;                                                        // hash-only / same-page links don't navigate
}

const MIN_VISIBLE_MS = 550;   // always visible long enough to notice, even on instant pages

function Overlay() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [visible, setVisible] = useState(false);
  const startedAt = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafe = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  // navigation finished → hide, but not before the minimum display time
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!startedAt.current) return;
    const left = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt.current));
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { setVisible(false); startedAt.current = 0; }, left);
  }, [pathname, search]);

  useEffect(() => {
    const start = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      startedAt.current = Date.now();
      setVisible(true);                                  // show immediately on click
      if (failsafe.current) clearTimeout(failsafe.current);
      failsafe.current = setTimeout(() => { setVisible(false); startedAt.current = 0; }, 15000);
    };
    const onClick = (e: MouseEvent) => { if (isInternalNav(e)) start(); };
    const onSubmit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement;
      // plain GET forms (search boxes) navigate; server-action forms stay on the page
      if (!e.defaultPrevented && (f.method || "get").toLowerCase() === "get" && !f.getAttribute("action")?.startsWith("javascript")) start();
    };
    const onPop = () => start();
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("popstate", onPop);
    window.addEventListener(START, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener(START, start);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-white/75 backdrop-blur-[1px]" aria-live="polite" aria-busy="true">
      <Loader />
    </div>
  );
}

/** Shows the loader the moment a link/button that changes page is clicked. */
export function NavigationLoader() {
  return <Suspense fallback={null}><Overlay /></Suspense>;
}
