import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

const schema = z.object({ productId: z.string().uuid() });

async function handle(req: Request, add: boolean) {
  const session = await getApiSession();
  if (!session || isDemoMode) return ok({ synced: false }); // local-only wishlist when signed out
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  const supabase = (await getServerSupabase())!;
  const { error } = add
    ? await supabase.from("imaket_wishlists").upsert({ user_id: session.user.id, product_id: body.data.productId })
    : await supabase.from("imaket_wishlists").delete().eq("user_id", session.user.id).eq("product_id", body.data.productId);
  if (error) return fail(error.message, 400);
  return ok({ synced: true });
}

export const POST = (req: Request) => handle(req, true);
export const DELETE = (req: Request) => handle(req, false);
