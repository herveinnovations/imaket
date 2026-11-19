import { adminOnly } from "@/lib/admin-guard";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // neutralise spreadsheet formulas and quote everything
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** GET /api/admin/newsletter — CSV of newsletter sign-ups (admins only). */
export async function GET() {
  const guard = await adminOnly();
  if ("response" in guard) return guard.response;
  const rows = isDemoMode ? [] : ((await getAdminSupabase().from("imaket_newsletter_subscribers")
    .select("email, consent, source, created_at, unsubscribed_at").order("created_at", { ascending: false }).limit(50000)).data ?? []);
  const csv = ["email,consent,source,subscribed_at,unsubscribed_at", ...rows.map((r) => [r.email, r.consent, r.source, r.created_at, r.unsubscribed_at].map(csvCell).join(","))].join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="imaket-newsletter-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
