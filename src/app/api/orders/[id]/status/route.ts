import { fail, ok } from "@/lib/api";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

/** GET /api/orders/:id/status — polled by the "approve on your phone" screen. Exposes status only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isDemoMode) return ok({ status: "paid" });
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail("Invalid order id", 400);
  const { data } = await getAdminSupabase().from("imaket_orders").select("status").eq("id", id).maybeSingle();
  if (!data) return fail("Order not found", 404);
  return ok({ status: data.status }, { headers: { "Cache-Control": "no-store" } });
}
