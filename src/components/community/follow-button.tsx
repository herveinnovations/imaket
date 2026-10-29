import { getSession } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { FollowToggle } from "./follow-toggle";

/** Server wrapper: works out whether the viewer already follows `userId`. */
export async function FollowButton({ userId, className }: { userId: string; className?: string }) {
  const session = await getSession();
  if (session && session.user.id === userId && !isDemoMode) return null;
  let following = false;
  if (session && !isDemoMode) {
    const supabase = (await getServerSupabase())!;
    const { data } = await supabase.from("imaket_follows").select("followee_id").eq("follower_id", session.user.id).eq("followee_id", userId).maybeSingle();
    following = !!data;
  }
  return <FollowToggle userId={userId} initial={following} signedIn={!!session} className={className} />;
}
