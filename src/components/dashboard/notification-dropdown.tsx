"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn, timeAgo } from "@/lib/utils";
import type { Notification } from "@/lib/types";

export function NotificationDropdown({ userId, initial }: { userId: string; initial: Notification[] }) {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.read_at).length;

  // Real-time: new notifications (sales, approvals, payouts) appear instantly
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const ch = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "imaket_notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const n = payload.new as Notification;
        setItems((prev) => [n, ...prev].slice(0, 30));
        toast(n.title, { description: n.body ?? undefined });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    await fetch("/api/notifications", { method: "PATCH" }).catch(() => {});
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true"
        className="relative grid h-10 w-10 place-items-center rounded-xl text-fg/80 hover:bg-surface-2 hover:text-fg"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-bg bg-danger" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.14 }}
            className="absolute right-0 mt-2 w-[min(380px,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl border bg-surface shadow-lift">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="font-semibold">Notifications</p>
              {unread > 0 && <button onClick={markAllRead} className="text-sm text-brand hover:underline">Mark all as read</button>}
            </div>
            <ul className="max-h-[420px] divide-y overflow-y-auto">
              {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">You&apos;re all caught up.</li>}
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={n.link ?? "#"} onClick={() => setOpen(false)} className={cn("flex gap-3 px-4 py-3 hover:bg-surface-2", !n.read_at && "bg-brand-soft/40")}>
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-brand")} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{n.title}</span>
                      {n.body && <span className="block truncate text-sm text-muted">{n.body}</span>}
                      <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
