import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { UserRole } from "@/lib/types";

/** Route prefix → roles allowed. Checked in middleware AND again in layouts. */
const PROTECTED: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/creator", roles: ["creator", "admin"] },
  { prefix: "/dashboard", roles: ["customer", "creator", "admin"] },
];

const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response; // demo mode: everything open

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // IMPORTANT: getUser() revalidates the JWT with Supabase Auth.
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const rule = PROTECTED.find((r) => path === r.prefix || path.startsWith(r.prefix + "/"));

  if (rule && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (rule && user) {
    const { data: profile } = await supabase.from("imaket_users").select("role, is_banned").eq("id", user.id).single();
    const role = (profile?.role ?? "customer") as UserRole;
    if (profile?.is_banned) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "suspended");
      return NextResponse.redirect(url);
    }
    if (!rule.roles.includes(role)) {
      const url = request.nextUrl.clone();
      url.pathname = role === "creator" ? "/creator" : "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  if (user && AUTH_PAGES.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
