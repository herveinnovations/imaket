"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setFollow } from "@/app/(site)/members/actions";
import { cn } from "@/lib/utils";

export function FollowToggle({ userId, initial, signedIn, className }: { userId: string; initial: boolean; signedIn: boolean; className?: string }) {
  const [following, setFollowing] = useState(initial);
  const [pending, start] = useTransition();
  const cls = cn("inline-flex h-9 items-center rounded-full px-5 text-[15px] transition-colors disabled:opacity-60",
    following ? "border border-black bg-white hover:bg-black hover:text-white" : "bg-brand text-white hover:bg-[#006b20]", className);

  if (!signedIn) return <Link href="/login?next=/members" className={cls}>Follow</Link>;
  return (
    <button disabled={pending} aria-pressed={following} className={cls}
      onClick={() => start(async () => {
        const r = await setFollow(userId, !following);
        if (!r.ok) return void toast.error(r.error);
        setFollowing(!!r.following);
      })}>
      {following ? "Following" : "Follow"}
    </button>
  );
}
