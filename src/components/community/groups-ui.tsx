"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Lock, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { addComment, createGroup, createPost, deletePost, joinGroup, leaveGroup, reviewRequest, type ActionResult } from "@/app/(site)/groups/actions";
import { cn, timeAgo } from "@/lib/utils";
import type { GroupPost } from "@/lib/data/community";

const pill = "inline-flex h-9 items-center justify-center rounded-full px-5 text-[15px] transition-colors disabled:opacity-60";

/** Join / Request To Join / Requested / Leave */
export function JoinButton({ groupId, privacy, state, signedIn, className }: {
  groupId: string; privacy: "public" | "private"; state: "none" | "pending" | "member" | "admin"; signedIn: boolean; className?: string;
}) {
  const [pending, start] = useTransition();
  if (!signedIn) return <Link href="/login?next=/groups" className={cn(pill, "bg-brand text-white hover:bg-[#006b20]", className)}>{privacy === "private" ? "Request To Join" : "Join Group"}</Link>;
  if (state === "admin") return <span className={cn(pill, "border border-black", className)}>Admin</span>;
  const run = (fn: () => Promise<ActionResult>) => start(async () => {
    const r = await fn();
    if (r.ok) { if (r.message) toast.success(r.message); } else toast.error(r.error);
  });
  if (state === "member") return <button disabled={pending} onClick={() => run(() => leaveGroup(groupId))} className={cn(pill, "border border-black bg-white hover:bg-black hover:text-white", className)}>Joined ✓</button>;
  if (state === "pending") return <button disabled={pending} onClick={() => run(() => leaveGroup(groupId))} className={cn(pill, "border border-black bg-white", className)} title="Cancel request">Requested</button>;
  return (
    <button disabled={pending} onClick={() => run(() => joinGroup(groupId))} className={cn(pill, "bg-brand text-white hover:bg-[#006b20]", className)}>
      {privacy === "private" ? "Request To Join" : "Join Group"}
    </button>
  );
}

function useResultToast(state: ActionResult | null, onOk?: () => void) {
  useEffect(() => {
    if (!state) return;
    if (state.ok) { if (state.message) toast.success(state.message); onOk?.(); } else toast.error(state.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

/** "Write something…" composer; pick the group when posting from the main feed. */
export function PostComposer({ groups, user }: { groups: { id: string; name: string }[]; user: { name: string; avatar: string | null } }) {
  const [state, action, pending] = useActionState(createPost, null);
  const ref = useRef<HTMLFormElement>(null);
  useResultToast(state, () => ref.current?.reset());
  if (!groups.length) return null;
  return (
    <form ref={ref} action={action} className="border border-black/30 bg-white p-4">
      <div className="flex gap-3">
        <Avatar name={user.name} src={user.avatar} size={40} />
        <textarea name="body" required maxLength={5000} rows={3} placeholder="Write something…" aria-label="Write a post"
          className="min-h-[84px] flex-1 resize-y border-0 bg-transparent text-base focus:outline-none" />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-black/15 pt-3">
        {groups.length > 1 ? (
          <label className="mr-auto flex items-center gap-2 text-sm">Post in
            <select name="groupId" className="h-9 border border-black/60 bg-white px-2 text-sm">{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          </label>
        ) : <input type="hidden" name="groupId" value={groups[0].id} />}
        <button disabled={pending} className={cn(pill, "bg-black text-white hover:bg-black/85")}>{pending ? "Posting…" : "Publish"}</button>
      </div>
    </form>
  );
}

export function PostCard({ post, canComment, canDelete, showGroup = true }: { post: GroupPost; canComment: boolean; canDelete: boolean; showGroup?: boolean }) {
  const [open, setOpen] = useState(post.comments.length > 0 && post.comments.length <= 3);
  const [state, action, pending] = useActionState(addComment, null);
  const [deleting, startDelete] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  useResultToast(state, () => ref.current?.reset());
  return (
    <article className="border border-black/30 bg-white">
      <header className="flex items-start gap-3 p-4 pb-0">
        <Avatar name={post.author.full_name} src={post.author.avatar_url} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px]"><span className="font-bold">{post.author.full_name ?? "Member"}</span>
            {showGroup && post.group && <> <span className="text-muted">in</span> <Link href={`/groups/${post.group.slug}`} className="underline underline-offset-2">{post.group.name}</Link></>}
          </p>
          <p className="text-sm text-muted" suppressHydrationWarning>{timeAgo(post.created_at)}</p>
        </div>
        {canDelete && (
          <button disabled={deleting} onClick={() => startDelete(async () => { const r = await deletePost(post.id); r.ok ? toast.success(r.message ?? "Deleted") : toast.error(r.error); })}
            className="p-1.5 hover:text-danger" aria-label="Delete post"><Trash2 className="h-4 w-4" /></button>
        )}
      </header>
      <p className="whitespace-pre-line px-4 py-4 text-base leading-[1.45]">{post.body}</p>
      <div className="border-t border-black/15 px-4 py-2.5">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-sm hover:underline">
          <MessageSquare className="h-4 w-4" /> {post.comment_count} {post.comment_count === 1 ? "comment" : "comments"}
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-black/15 bg-stone/50 px-4 py-3">
          {post.comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar name={c.author.full_name} src={c.author.avatar_url} size={28} />
              <div className="bg-white px-3 py-2 text-sm">
                <p><span className="font-bold">{c.author.full_name ?? "Member"}</span> <span className="text-muted" suppressHydrationWarning>· {timeAgo(c.created_at)}</span></p>
                <p className="mt-0.5 whitespace-pre-line">{c.body}</p>
              </div>
            </div>
          ))}
          {canComment ? (
            <form ref={ref} action={action} className="flex gap-2">
              <input type="hidden" name="postId" value={post.id} />
              <input name="body" required maxLength={2000} placeholder="Write a comment…" aria-label="Write a comment" className="h-9 flex-1 border border-black/40 bg-white px-3 text-sm focus:border-black focus:outline-none" />
              <button disabled={pending} className="h-9 bg-black px-4 text-sm text-white disabled:opacity-60">Send</button>
            </form>
          ) : <p className="text-sm text-muted">Join the group to comment.</p>}
        </div>
      )}
    </article>
  );
}

export function CreateGroupButton({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createGroup, null);
  useResultToast(state && !state.ok ? state : null);
  if (!signedIn) return <Link href="/login?next=/groups" className={cn(pill, "w-full border border-black hover:bg-black hover:text-white")}>Create a Group</Link>;
  return (
    <>
      <button onClick={() => setOpen(true)} className={cn(pill, "w-full border border-black hover:bg-black hover:text-white")}>Create a Group</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Create a Group">
        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="g-name" className="label">Group name</label>
            <input id="g-name" name="name" required minLength={3} maxLength={80} className="input" />
          </div>
          <div>
            <label htmlFor="g-desc" className="label">Description</label>
            <textarea id="g-desc" name="description" maxLength={1000} rows={3} className="input h-auto py-2" />
          </div>
          <fieldset>
            <legend className="label">Privacy</legend>
            <label className="flex items-start gap-2 py-1 text-[15px]"><input type="radio" name="privacy" value="public" defaultChecked className="mt-1 accent-black" /> <span><b>Public</b> — anyone can see posts and join.</span></label>
            <label className="flex items-start gap-2 py-1 text-[15px]"><input type="radio" name="privacy" value="private" className="mt-1 accent-black" /> <span><b>Private</b> — only members see posts; you approve requests.</span></label>
          </fieldset>
          <button disabled={pending} className={cn(pill, "w-full bg-brand text-white hover:bg-[#006b20]")}>{pending ? "Creating…" : "Create Group"}</button>
        </form>
      </Modal>
    </>
  );
}

export function RequestRow({ groupId, userId, name, avatar }: { groupId: string; userId: string; name: string | null; avatar: string | null }) {
  const [pending, start] = useTransition();
  const run = (approve: boolean) => start(async () => { const r = await reviewRequest(groupId, userId, approve); r.ok ? toast.success(r.message ?? "Done") : toast.error(r.error); });
  return (
    <li className="flex items-center gap-3 py-2">
      <Avatar name={name} src={avatar} size={32} />
      <span className="flex-1 truncate text-[15px]">{name ?? "Member"}</span>
      <button disabled={pending} onClick={() => run(true)} className="h-8 rounded-full bg-brand px-3 text-sm text-white">Approve</button>
      <button disabled={pending} onClick={() => run(false)} className="h-8 rounded-full border border-black px-3 text-sm">Decline</button>
    </li>
  );
}

export function PrivateBadge() {
  return <span className="inline-flex items-center gap-1 text-sm"><Lock className="h-3.5 w-3.5" /> Private group</span>;
}
