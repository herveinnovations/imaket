import { fail, ok, parseBody } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { creatorProfileSchema } from "@/lib/validation";

/** PATCH /api/creator/profile — storefront settings & payout method (RLS: own store; status/verified are trigger-protected) */
export async function PATCH(req: Request) {
  const session = await getApiSession(["creator", "admin"]);
  if (!session?.creator) return fail("Not allowed", 403);
  const body = await parseBody(req, creatorProfileSchema);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ updated: true, demo: true });

  const supabase = (await getServerSupabase())!;
  if (body.data.handle && body.data.handle !== session.creator.handle) {
    const { data: taken } = await supabase.from("imaket_creators").select("id").eq("handle", body.data.handle).maybeSingle();
    if (taken) return fail("That store link is taken.", 409);
  }
  const { error } = await supabase.from("imaket_creators").update(body.data).eq("id", session.creator.id);
  if (error) return fail(error.message.includes("reserved") ? "That store link is reserved. Pick another." : error.message, 400);
  return ok({ updated: true });
}
