import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

/** Per-request client acting as the signed-in user (RLS applies). */
export async function getServerSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — middleware refreshes the session instead.
        }
      },
    },
  });
}

let admin: SupabaseClient | null = null;

/**
 * Service-role client. BYPASSES RLS — only use in trusted server code
 * (webhooks, order creation, signed downloads, admin actions after an
 * explicit role check). Never import from a client component.
 */
export function getAdminSupabase(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  if (!admin) {
    admin = createClient(env.supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
