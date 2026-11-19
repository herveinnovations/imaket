import { fail, ok, parseBody } from "@/lib/api";
import { adminOnly } from "@/lib/admin-guard";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getSiteContent, siteContentSchema } from "@/lib/site-content";

/** PATCH /api/admin/site-content — homepage copy, banners, footer contact details */
export async function PATCH(req: Request) {
  const guard = await adminOnly();
  if ("response" in guard) return guard.response;
  const body = await parseBody(req, siteContentSchema.partial());
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ updated: true, demo: true });
  const value = { ...(await getSiteContent()), ...body.data };
  const { error } = await getAdminSupabase().from("imaket_platform_settings").upsert({ key: "site_content", value, updated_at: new Date().toISOString() });
  return error ? fail(error.message, 400) : ok({ updated: true });
}
