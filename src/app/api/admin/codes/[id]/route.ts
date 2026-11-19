import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { adminOnly } from "@/lib/admin-guard";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

type Ctx = { params: Promise<{ id: string }> };
const patch = z.object({ active: z.boolean().optional(), ends_at: z.string().datetime().nullish(), max_uses: z.number().int().positive().nullish(), description: z.string().max(200).nullish() });

export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await adminOnly();
  if ("response" in guard) return guard.response;
  const body = await parseBody(req, patch);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ updated: true, demo: true });
  const { id } = await params;
  const { error } = await getAdminSupabase().from("imaket_platform_coupons").update(body.data).eq("id", id);
  return error ? fail(error.message, 400) : ok({ updated: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const guard = await adminOnly();
  if ("response" in guard) return guard.response;
  if (isDemoMode) return ok({ deleted: true, demo: true });
  const { id } = await params;
  const { error } = await getAdminSupabase().from("imaket_platform_coupons").delete().eq("id", id);
  return error ? fail(error.message, 400) : ok({ deleted: true });
}
