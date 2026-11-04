import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { PUBLIC_CREATOR_COLUMNS } from "@/lib/data/columns";
import { DEMO_CREATORS, DEMO_USER } from "@/lib/demo-data";
import type { AppUser, Creator, UserRole } from "@/lib/types";

export interface Session {
  user: AppUser;
  creator: Creator | null;
  demo: boolean;
}

/** Current signed-in user + their creator store (if any). Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  if (isDemoMode) {
    return { user: DEMO_USER, creator: DEMO_CREATORS[0], demo: true };
  }
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: creator }] = await Promise.all([
    supabase.from("imaket_users").select("*").eq("id", user.id).single(),
    ownCreatorRow(supabase, user.id),
  ]);
  if (!profile) return null;
  return { user: profile as AppUser, creator: (creator as Creator) ?? null, demo: false };
});

/**
 * The signed-in user's own store, including private payout details. Those columns
 * aren't readable through the public API roles, so this uses the service role,
 * keyed on the user id Supabase Auth just verified. Falls back to the public
 * columns if the service key isn't configured.
 */
async function ownCreatorRow(supabase: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>, userId: string) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return getAdminSupabase().from("imaket_creators").select("*").eq("user_id", userId).maybeSingle();
  }
  return supabase.from("imaket_creators").select(PUBLIC_CREATOR_COLUMNS).eq("user_id", userId).maybeSingle();
}

/**
 * Server-side role gate for layouts and server actions.
 * Middleware already redirects, this is defence in depth.
 * In demo mode, the demo user is treated as having every role.
 */
export async function requireRole(roles: UserRole[], next = "/"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (session.demo) return { ...session, user: { ...session.user, role: roles[0] } };
  if (!roles.includes(session.user.role)) redirect(session.user.role === "creator" ? "/creator" : "/dashboard");
  return session;
}

/** Creator pages: guarantees a creator store exists (customers are sent to open one). */
export async function requireCreator(next = "/creator") {
  const session = await requireRole(["creator", "admin"], next);
  if (!session.creator) redirect("/dashboard/settings#sell");
  return session as Session & { creator: Creator };
}

/** For API routes: returns session or null (never redirects). */
export async function getApiSession(roles?: UserRole[]) {
  const session = await getSession();
  if (!session) return null;
  if (session.demo) return session;
  if (roles && !roles.includes(session.user.role)) return null;
  return session;
}
