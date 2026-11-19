import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

type Ctx = { params: Promise<{ id: string }> };
const patchSchema = z.object({ active: z.boolean().optional(), max_uses: z.number().int().positive().nullish(), ends_at: z.string().datetime().nullish() });

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getApiSession(["creator", "admin"]);
  if (!session) return fail("Not allowed", 403);
  const body = await parseBody(req, patchSchema);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ updated: true, demo: true });
  const { error } = await (await getServerSupabase())!.from("imaket_coupons").update(body.data).eq("id", (await params).id);
  return error ? fail(error.message, 400) : ok({ updated: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getApiSession(["creator", "admin"]);
  if (!session) return fail("Not allowed", 403);
  if (isDemoMode) return ok({ deleted: true, demo: true });
  const { error } = await (await getServerSupabase())!.from("imaket_coupons").delete().eq("id", (await params).id);
  return error ? fail(error.message, 400) : ok({ deleted: true });
}
