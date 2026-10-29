import { z } from "zod";
import { clientIp, fail, ok, parseBody, rateLimit } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getSiteContent } from "@/lib/site-content";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  consent: z.literal(true, { errorMap: () => ({ message: "Tick the box to subscribe." }) }),
  source: z.string().max(40).optional(),
});

/** POST /api/newsletter — store a sign-up and hand back the welcome code (if one is active). */
export async function POST(req: Request) {
  if (!rateLimit(`nl:${clientIp(req)}`, 5, 60_000)) return fail("Too many attempts. Try again in a minute.", 429);
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  const content = await getSiteContent();
  const code = content.newsletter_code || null;
  if (isDemoMode) return ok({ subscribed: true, code });

  const db = getAdminSupabase();
  const session = await getApiSession();
  const { error } = await db.from("imaket_newsletter_subscribers").insert({
    email: body.data.email, consent: true, source: body.data.source ?? "site", user_id: session?.user.id ?? null,
  });
  // already subscribed is fine (unique on lower(email)); re-subscribe if they had left
  if (error && error.code !== "23505") { console.error("[newsletter]", error); return fail("Couldn't subscribe right now.", 500); }
  if (error?.code === "23505") {
    await db.from("imaket_newsletter_subscribers").update({ unsubscribed_at: null, consent: true }).ilike("email", body.data.email);
  }

  let activeCode: string | null = null;
  if (code) {
    const { data } = await db.from("imaket_platform_coupons").select("code, active, ends_at").ilike("code", code).maybeSingle();
    if (data?.active && (!data.ends_at || new Date(data.ends_at) > new Date())) activeCode = data.code;
  }
  return ok({ subscribed: true, code: activeCode });
}
