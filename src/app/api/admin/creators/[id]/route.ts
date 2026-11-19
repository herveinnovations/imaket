import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { adminOnly } from "@/lib/admin-guard";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

const schema = z.object({ verified: z.boolean().optional(), status: z.enum(["active", "suspended", "pending"]).optional() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await adminOnly();
  if ("response" in guard) return guard.response;
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ updated: true, demo: true });
  const { id } = await params;
  const db = getAdminSupabase();
  const { data, error } = await db.from("imaket_creators").update(body.data).eq("id", id).select("user_id, store_name").single();
  if (error) return fail(error.message, 400);
  if (body.data.status || body.data.verified !== undefined) {
    await db.from("imaket_notifications").insert({
      user_id: data.user_id, type: "store.updated",
      title: body.data.status === "suspended" ? "Your store has been suspended" : body.data.verified ? "Your store is verified" : "Store status updated",
      body: body.data.status === "suspended" ? "Contact support to appeal." : null, link: "/creator",
    });
  }
  return ok({ updated: true });
}
