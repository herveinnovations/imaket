import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

const schema = z.object({ creatorId: z.string().min(1) });

/** POST /api/affiliates — join a creator's affiliate programme; returns your code (idempotent). */
export async function POST(req: Request) {
  const session = await getApiSession();
  if (!session) return fail("Log in to become an affiliate.", 401);
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  const base = (session.user.full_name ?? session.user.email.split("@")[0]).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 10) || "AFF";
  if (isDemoMode) return ok({ code: base });

  const supabase = (await getServerSupabase())!;
  const { data: existing } = await supabase.from("imaket_affiliates").select("code").eq("creator_id", body.data.creatorId).eq("user_id", session.user.id).maybeSingle();
  if (existing) return ok({ code: existing.code });
  if (session.creator?.id === body.data.creatorId) return fail("You can't be an affiliate of your own store.", 400);

  for (let i = 0; i < 5; i++) {
    const code = i ? `${base}${Math.floor(Math.random() * 900 + 100)}` : base;
    const { data, error } = await supabase.from("imaket_affiliates").insert({ creator_id: body.data.creatorId, user_id: session.user.id, code }).select("code").single();
    if (!error) return ok({ code: data.code }, { status: 201 });
    if (error.code !== "23505") return fail(error.message, 400);
  }
  return fail("Couldn't generate a unique code. Try again.", 500);
}
