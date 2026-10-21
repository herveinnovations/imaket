"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { env, isDemoMode } from "@/lib/env";
import { rateLimit } from "@/lib/api";
import { siteHost } from "@/lib/utils";

export type AuthState = { error?: string; success?: string; fields?: Record<string, string> } | undefined;

const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : null);

async function limited(action: string) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "anon";
  return !rateLimit(`auth:${action}:${ip}`, 8, 60_000);
}

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (isDemoMode) redirect(safeNext(fd.get("next")) ?? "/creator");
  if (await limited("login")) return { error: "Too many attempts. Wait a minute and try again.", fields: { email } };
  const supabase = (await getServerSupabase())!;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.toLowerCase().includes("confirm")) return { error: "Confirm your email first. We sent you a link when you signed up.", fields: { email } };
    return { error: "That email and password don't match an account.", fields: { email } };
  }
  const { data: profile } = await supabase.from("imaket_users").select("role").eq("id", data.user.id).single();
  const home = profile?.role === "admin" ? "/admin" : profile?.role === "creator" ? "/creator" : "/dashboard";
  redirect(safeNext(fd.get("next")) ?? home);
}

const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters.").regex(/[A-Za-z]/, "Include a letter.").regex(/\d/, "Include a number."),
  role: z.enum(["creator", "customer"]),
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$/, "3–32 characters: letters, numbers, - or _.").optional(),
});

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  const raw = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  if (raw.role !== "creator") delete raw.handle;
  const parsed = registerSchema.safeParse(raw);
  const fields = { full_name: raw.full_name ?? "", email: raw.email ?? "", handle: raw.handle ?? "", role: raw.role ?? "customer" };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  if (isDemoMode) redirect("/verify-email?demo=1");
  if (await limited("register")) return { error: "Too many attempts. Wait a minute and try again.", fields };

  const supabase = (await getServerSupabase())!;
  if (parsed.data.role === "creator" && parsed.data.handle) {
    const { data: taken } = await supabase.from("imaket_creators").select("id").eq("handle", parsed.data.handle).maybeSingle();
    if (taken) return { error: `${siteHost()}/${parsed.data.handle} is taken. Try another store link.`, fields };
  }
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.appUrl}/auth/callback?next=${parsed.data.role === "creator" ? "/creator" : "/dashboard"}`,
      // read by public.handle_new_user(); 'admin' is never accepted from here
      data: { full_name: parsed.data.full_name, role: parsed.data.role, handle: parsed.data.handle, store_name: parsed.data.full_name },
    },
  });
  if (error) return { error: error.message, fields };
  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function requestPasswordReset(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = String(fd.get("email") ?? "").trim();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email address.", fields: { email } };
  if (!isDemoMode) {
    if (await limited("reset")) return { error: "Too many attempts. Wait a minute and try again." };
    const supabase = (await getServerSupabase())!;
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${env.appUrl}/auth/callback?next=/reset-password` });
  }
  // Same answer whether or not the account exists (no account enumeration)
  return { success: `If ${email} has an account, a reset link is on its way. It expires in one hour.` };
}

export async function updatePassword(_: AuthState, fd: FormData): Promise<AuthState> {
  const password = String(fd.get("password") ?? "");
  if (password.length < 8 || !/\d/.test(password)) return { error: "Use at least 8 characters, including a number." };
  if (password !== fd.get("confirm")) return { error: "The two passwords don't match." };
  if (isDemoMode) redirect("/login");
  const supabase = (await getServerSupabase())!;
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Your reset link has expired. Request a new one." };
  redirect("/dashboard?password=updated");
}

export async function signOut() {
  if (!isDemoMode) await (await getServerSupabase())!.auth.signOut();
  redirect("/");
}
