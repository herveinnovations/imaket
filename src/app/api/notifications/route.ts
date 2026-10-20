import { fail, ok } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getNotifications } from "@/lib/data/dashboard";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

/** GET /api/notifications — latest 20 for the signed-in user */
export async function GET() {
  const session = await getApiSession();
  if (!session) return fail("Not signed in", 401);
  return ok({ notifications: await getNotifications(session.user.id) });
}

/** PATCH /api/notifications — mark all as read */
export async function PATCH() {
  const session = await getApiSession();
  if (!session) return fail("Not signed in", 401);
  if (isDemoMode) return ok({ updated: true });
  const supabase = (await getServerSupabase())!;
  await supabase.from("imaket_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", session.user.id).is("read_at", null);
  return ok({ updated: true });
}
