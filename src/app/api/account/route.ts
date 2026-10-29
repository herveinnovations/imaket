import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { env, isDemoMode } from "@/lib/env";

const schema = z.object({
  full_name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().max(30).optional(),
  country: z.string().length(2).optional(),
  avatar_url: z.string().url().nullish(),
  public_profile: z.boolean().optional(),
  bio: z.string().trim().max(300).nullish(),
  email: z.string().email().optional(),
  password: z.string().min(8).regex(/\d/, "Include a number").optional(),
});

/** PATCH /api/account — profile fields, or email/password via Supabase Auth */
export async function PATCH(req: Request) {
  const session = await getApiSession();
  if (!session) return fail("Not signed in", 401);
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ updated: true, demo: true });

  const supabase = (await getServerSupabase())!;
  const { email, password, ...profile } = body.data;
  if (email || password) {
    const { error } = await supabase.auth.updateUser({ ...(email ? { email } : {}), ...(password ? { password } : {}) }, { emailRedirectTo: `${env.appUrl}/auth/callback?next=/dashboard/settings` });
    if (error) return fail(error.message, 400);
  }
  if (Object.keys(profile).length) {
    const { error } = await supabase.from("imaket_users").update(profile).eq("id", session.user.id);
    if (error) return fail(error.message, 400);
  }
  return ok({ updated: true });
}
