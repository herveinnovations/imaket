import { fail, ok, parseBody } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getCreatorCoupons } from "@/lib/data/dashboard";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { couponSchema } from "@/lib/validation";

export async function GET() {
  const session = await getApiSession(["creator", "admin"]);
  if (!session?.creator) return fail("Not allowed", 403);
  return ok({ coupons: await getCreatorCoupons(session.creator.id) });
}

/** POST /api/coupons — create a discount code for the caller's store */
export async function POST(req: Request) {
  const session = await getApiSession(["creator", "admin"]);
  if (!session?.creator) return fail("Not allowed", 403);
  const body = await parseBody(req, couponSchema);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ coupon: { id: "demo", ...body.data }, demo: true }, { status: 201 });
  const supabase = (await getServerSupabase())!;
  const { data, error } = await supabase.from("imaket_coupons").insert({ ...body.data, code: body.data.code.toUpperCase(), creator_id: session.creator.id }).select().single();
  if (error) return fail(error.code === "23505" ? "You already have a code with that name." : error.message, 400);
  return ok({ coupon: data }, { status: 201 });
}
