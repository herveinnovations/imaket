import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { adminOnly } from "@/lib/admin-guard";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

const schema = z.object({ role: z.enum(["admin", "creator", "customer"]).optional(), is_banned: z.boolean().optional() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await adminOnly();
  if ("response" in guard) return guard.response;
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  const { id } = await params;
  if (isDemoMode) return ok({ updated: true, demo: true });
  if (id === guard.session.user.id) return fail("You can't change your own role or ban yourself.", 400);

  const db = getAdminSupabase();
  const { error } = await db.from("imaket_users").update(body.data).eq("id", id);
  if (error) return fail(error.message, 400);
  // Banning also signs the user out everywhere
  if (body.data.is_banned) await db.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  if (body.data.is_banned === false) await db.auth.admin.updateUserById(id, { ban_duration: "none" });
  return ok({ updated: true });
}
