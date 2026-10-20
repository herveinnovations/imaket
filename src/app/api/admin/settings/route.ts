import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { adminOnly } from "@/lib/admin-guard";
import { getAdminSupabase } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/data/dashboard";
import { isDemoMode } from "@/lib/env";

const schema = z.object({
  fee_percent: z.number().min(0).max(30).optional(),
  payout_hold_days: z.number().int().min(0).max(60).optional(),
  auto_approve_products: z.boolean().optional(),
  maintenance_mode: z.boolean().optional(),
  enabled_providers: z.array(z.enum(["mobile_money", "flutterwave", "dusupay", "stripe", "paypal"])).optional(),
  min_payout: z.record(z.string().length(3), z.number().nonnegative()).optional(),
});

export async function GET() {
  const guard = await adminOnly();
  if ("response" in guard) return guard.response;
  return ok({ settings: await getPlatformSettings() });
}

export async function PATCH(req: Request) {
  const guard = await adminOnly();
  if ("response" in guard) return guard.response;
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ updated: true, demo: true });
  const rows = Object.entries(body.data).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
  const { error } = await getAdminSupabase().from("imaket_platform_settings").upsert(rows);
  return error ? fail(error.message, 400) : ok({ updated: true });
}
