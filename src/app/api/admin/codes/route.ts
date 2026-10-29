import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { adminOnly } from "@/lib/admin-guard";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

const codeSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, "Use 3–40 letters, numbers, - or _"),
  description: z.string().trim().max(200).nullish(),
  type: z.enum(["percent", "fixed"]),
  value: z.number().positive(),
  first_order_only: z.boolean().default(false),
  min_order: z.number().nonnegative().default(0),
  max_uses: z.number().int().positive().nullish(),
  ends_at: z.string().datetime().nullish(),
  active: z.boolean().default(true),
}).refine((c) => c.type !== "percent" || c.value <= 100, { message: "Percent codes can't exceed 100%", path: ["value"] });

/** Sitewide discount codes (admin). */
export async function GET() {
  const guard = await adminOnly();
  if ("response" in guard) return guard.response;
  if (isDemoMode) return ok({ codes: [] });
  const { data, error } = await getAdminSupabase().from("imaket_platform_coupons").select("*").order("created_at", { ascending: false });
  return error ? fail(error.message, 400) : ok({ codes: data });
}

export async function POST(req: Request) {
  const guard = await adminOnly();
  if ("response" in guard) return guard.response;
  const body = await parseBody(req, codeSchema);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ created: true, demo: true }, { status: 201 });
  const db = getAdminSupabase();
  const { data: clash } = await db.from("imaket_coupons").select("id").ilike("code", body.data.code).limit(1);
  if (clash?.length) return fail("A store already uses that code. Pick another.", 409);
  const { data, error } = await db.from("imaket_platform_coupons").insert(body.data).select().single();
  if (error) return fail(error.code === "23505" ? "That code already exists." : error.message, 400);
  return ok({ code: data }, { status: 201 });
}
