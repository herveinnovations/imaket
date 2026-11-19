"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function signedIn() {
  const session = await getSession();
  if (!session) redirect("/login?next=/groups");
  return session;
}

const DEMO: ActionResult = { ok: false, error: "Groups are read-only in demo mode." };

function friendly(msg: string) {
  if (/row-level security|permission denied/i.test(msg)) return "You don't have permission to do that.";
  if (/duplicate key.*slug/i.test(msg)) return "A group with that name already exists. Try another name.";
  return "Something went wrong. Please try again.";
}

const groupSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters.").max(80),
  description: z.string().trim().max(1000).default(""),
  privacy: z.enum(["public", "private"]),
});

export async function createGroup(_: unknown, form: FormData): Promise<ActionResult> {
  const session = await signedIn();
  if (isDemoMode) return DEMO;
  const parsed = groupSchema.safeParse({ name: form.get("name"), description: form.get("description") ?? "", privacy: form.get("privacy") ?? "public" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const base = parsed.data.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 44) || "group";
  const slug = base.length < 3 ? `${base}-grp` : base;
  const supabase = (await getServerSupabase())!;
  let attempt = slug;
  for (let i = 0; i < 4; i++) {
    const { error } = await supabase.from("imaket_groups").insert({ ...parsed.data, slug: attempt, created_by: session.user.id });
    if (!error) { revalidatePath("/groups"); redirect(`/groups/${attempt}`); }
    if (!/duplicate key/i.test(error.message)) return { ok: false, error: friendly(error.message) };
    attempt = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return { ok: false, error: "A group with that name already exists. Try another name." };
}

export async function joinGroup(groupId: string): Promise<ActionResult> {
  const session = await signedIn();
  if (isDemoMode) return DEMO;
  const supabase = (await getServerSupabase())!;
  const { error } = await supabase.from("imaket_group_members").insert({ group_id: groupId, user_id: session.user.id });
  if (error && !/duplicate key/i.test(error.message)) return { ok: false, error: friendly(error.message) };
  const { data } = await supabase.from("imaket_group_members").select("status").eq("group_id", groupId).eq("user_id", session.user.id).maybeSingle();
  revalidatePath("/groups", "layout");
  return { ok: true, message: data?.status === "pending" ? "Request sent. A group admin will review it." : "You joined the group." };
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  const session = await signedIn();
  if (isDemoMode) return DEMO;
  const supabase = (await getServerSupabase())!;
  const { error } = await supabase.from("imaket_group_members").delete().eq("group_id", groupId).eq("user_id", session.user.id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/groups", "layout");
  return { ok: true, message: "You left the group." };
}

export async function reviewRequest(groupId: string, userId: string, approve: boolean): Promise<ActionResult> {
  await signedIn();
  if (isDemoMode) return DEMO;
  const supabase = (await getServerSupabase())!;
  const q = approve
    ? supabase.from("imaket_group_members").update({ status: "active" }).eq("group_id", groupId).eq("user_id", userId).select("user_id")
    : supabase.from("imaket_group_members").delete().eq("group_id", groupId).eq("user_id", userId).select("user_id");
  const { data, error } = await q;
  if (error) return { ok: false, error: friendly(error.message) };
  if (!data?.length) return { ok: false, error: "You don't have permission to do that." };
  revalidatePath("/groups", "layout");
  return { ok: true, message: approve ? "Request approved." : "Request declined." };
}

const postSchema = z.object({ groupId: z.string().uuid(), body: z.string().trim().min(1, "Write something first.").max(5000) });

export async function createPost(_: unknown, form: FormData): Promise<ActionResult> {
  const session = await signedIn();
  if (isDemoMode) return DEMO;
  const parsed = postSchema.safeParse({ groupId: form.get("groupId"), body: form.get("body") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = (await getServerSupabase())!;
  const { error } = await supabase.from("imaket_group_posts").insert({ group_id: parsed.data.groupId, author_id: session.user.id, body: parsed.data.body });
  if (error) return { ok: false, error: /row-level/i.test(error.message) ? "Join the group to post." : friendly(error.message) };
  revalidatePath("/groups", "layout");
  return { ok: true, message: "Posted." };
}

export async function deletePost(postId: string): Promise<ActionResult> {
  await signedIn();
  if (isDemoMode) return DEMO;
  const supabase = (await getServerSupabase())!;
  const { data, error } = await supabase.from("imaket_group_posts").delete().eq("id", postId).select("id");
  if (error) return { ok: false, error: friendly(error.message) };
  if (!data?.length) return { ok: false, error: "You can't delete that post." };
  revalidatePath("/groups", "layout");
  return { ok: true, message: "Post deleted." };
}

const commentSchema = z.object({ postId: z.string().uuid(), body: z.string().trim().min(1, "Write a comment first.").max(2000) });

export async function addComment(_: unknown, form: FormData): Promise<ActionResult> {
  const session = await signedIn();
  if (isDemoMode) return DEMO;
  const parsed = commentSchema.safeParse({ postId: form.get("postId"), body: form.get("body") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = (await getServerSupabase())!;
  const { error } = await supabase.from("imaket_group_comments").insert({ post_id: parsed.data.postId, author_id: session.user.id, body: parsed.data.body });
  if (error) return { ok: false, error: /row-level/i.test(error.message) ? "Join the group to comment." : friendly(error.message) };
  revalidatePath("/groups", "layout");
  return { ok: true };
}
