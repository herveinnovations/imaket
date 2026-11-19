"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

export async function setFollow(userId: string, follow: boolean): Promise<{ ok: boolean; error?: string; following?: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Log in to follow members." };
  if (!z.string().uuid().safeParse(userId).success) return { ok: false, error: "Unknown member." };
  if (userId === session.user.id) return { ok: false, error: "You can't follow yourself." };
  if (isDemoMode) return { ok: true, following: follow };
  const supabase = (await getServerSupabase())!;
  const { error } = follow
    ? await supabase.from("imaket_follows").insert({ follower_id: session.user.id, followee_id: userId })
    : await supabase.from("imaket_follows").delete().eq("follower_id", session.user.id).eq("followee_id", userId);
  if (error && !/duplicate key/i.test(error.message)) {
    return { ok: false, error: /row-level/i.test(error.message) ? "This member's profile is private." : "Couldn't update. Try again." };
  }
  revalidatePath("/members");
  return { ok: true, following: follow };
}
