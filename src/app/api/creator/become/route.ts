import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

const schema = z.object({ handle: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$/, "Store links are 3–32 letters, numbers, - or _.") });

/** POST /api/creator/become — a customer opens a store on their existing account */
export async function POST(req: Request) {
  const session = await getApiSession();
  if (!session) return fail("Log in first.", 401);
  if (session.creator) return ok({ creator: session.creator });
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ demo: true });

  const supabase = (await getServerSupabase())!;
  const { data: taken } = await supabase.from("imaket_creators").select("id").eq("handle", body.data.handle).maybeSingle();
  if (taken) return fail("That store link is taken.", 409);
  const { data, error } = await supabase.from("imaket_creators")
    .insert({ user_id: session.user.id, handle: body.data.handle, store_name: session.user.full_name ?? body.data.handle, country: session.user.country })
    .select().single();
  if (error) return fail(error.message.includes("reserved") ? "That store link is reserved." : error.message, 400);
  if (session.user.role === "customer") await supabase.from("imaket_users").update({ role: "creator" }).eq("id", session.user.id); // allowed by guard trigger
  return ok({ creator: data }, { status: 201 });
}
