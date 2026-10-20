import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

const schema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().max(2000).optional(),
});

/** POST /api/reviews — verified buyers only (RLS: has_purchased()). Upserts one review per buyer per product. */
export async function POST(req: Request) {
  const session = await getApiSession();
  if (!session) return fail("Log in with the account you bought with to leave a review.", 401);
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ review: { id: "demo" }, demo: true }, { status: 201 });

  const supabase = (await getServerSupabase())!;
  const { productId, rating, title, body: text } = body.data;
  const { data, error } = await supabase.from("imaket_reviews")
    .upsert({ product_id: productId, customer_id: session.user.id, rating, title: title ?? null, body: text ?? null }, { onConflict: "product_id,customer_id" })
    .select("id").single();
  if (error) {
    if (error.code === "42501" || error.message.includes("row-level security")) return fail("Only buyers of this product can review it.", 403);
    return fail(error.message, 400);
  }

  // notify the creator
  const db = getAdminSupabase();
  const { data: p } = await db.from("imaket_products").select("title, creator:imaket_creators(user_id)").eq("id", productId).single();
  const creatorUser = (p?.creator as unknown as { user_id: string } | null)?.user_id;
  if (creatorUser) {
    await db.from("imaket_notifications").insert({ user_id: creatorUser, type: "review.new", title: `New ${rating}-star review`, body: `${session.user.full_name ?? "A buyer"} reviewed ${p!.title}`, link: "/creator/products" });
  }
  return ok({ review: data }, { status: 201 });
}
