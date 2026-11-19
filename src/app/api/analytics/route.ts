import { cookies } from "next/headers";
import { z } from "zod";
import { clientIp, ok, rateLimit } from "@/lib/api";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

const schema = z.object({
  event: z.enum(["store_view", "product_view", "add_to_cart"]),
  creatorId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  referrer: z.string().max(500).nullish(),
});

/** POST /api/analytics — lightweight first-party event tracking. Always 204-ish; never blocks the UI. */
export async function POST(req: Request) {
  if (isDemoMode) return ok({ ok: true });
  if (!rateLimit(`an:${clientIp(req)}`, 120)) return ok({ ok: true });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return ok({ ok: false });
  const { event, creatorId, productId, referrer } = parsed.data;
  const ref = (await cookies()).get("sk_ref")?.value;
  const db = getAdminSupabase();
  await db.from("imaket_analytics_events").insert({
    event, creator_id: creatorId, product_id: productId ?? null,
    referrer: ref ? `ref:${ref}` : referrer ?? null,
    country: req.headers.get("x-vercel-ip-country") ?? req.headers.get("x-country") ?? null,
  });
  if (event === "product_view" && productId) await db.rpc("imaket_increment_product_view", { p_product_id: productId });
  if (ref && event !== "add_to_cart") {
    const { data: aff } = await db.from("imaket_affiliates").select("id, clicks").ilike("code", ref).eq("creator_id", creatorId).maybeSingle();
    if (aff) await db.from("imaket_affiliates").update({ clicks: aff.clicks + 1 }).eq("id", aff.id);
  }
  return ok({ ok: true });
}
