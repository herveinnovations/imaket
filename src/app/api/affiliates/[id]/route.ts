import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

const schema = z.object({ status: z.enum(["active", "paused"]).optional(), commission_percent: z.number().min(0).max(90).optional() });

/** PATCH /api/affiliates/:id — creator pauses/resumes an affiliate or changes their rate (RLS: own store only) */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(["creator", "admin"]);
  if (!session) return fail("Not allowed", 403);
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ updated: true, demo: true });
  const { error } = await (await getServerSupabase())!.from("imaket_affiliates").update(body.data).eq("id", (await params).id);
  return error ? fail(error.message, 400) : ok({ updated: true });
}
