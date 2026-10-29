import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { CreateGroupButton, JoinButton, PostCard, PostComposer } from "@/components/community/groups-ui";
import { getSession } from "@/lib/auth";
import { getGroups, getMyMemberships, getPosts } from "@/lib/data/community";

export const metadata: Metadata = { title: "Groups", description: "Groups and posts from the iMaket community." };

type SP = Promise<{ q?: string }>;

export default async function GroupsFeedPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = sp.q?.slice(0, 60);
  const session = await getSession();
  const [groups, memberships, posts] = await Promise.all([getGroups(q), getMyMemberships(session?.user.id), getPosts({ limit: 30 })]);
  const mine = new Map(memberships.map((m) => [m.group_id, m]));
  const stateOf = (id: string) => {
    const m = mine.get(id);
    return !m ? "none" : m.status === "pending" ? "pending" : m.role === "admin" ? "admin" : "member";
  };
  const activeGroups = groups.filter((g) => ["member", "admin"].includes(stateOf(g.id))).map((g) => ({ id: g.id, name: g.name }));
  const isAdmin = session?.user.role === "admin";

  return (
    <div className="bg-white px-5 pb-20 pt-8">
      <h1 className="text-[2.05rem]">Groups Feed</h1>
      <p className="mt-1 text-[17px]">View groups and posts below.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="order-2 space-y-4 lg:order-1">
          {session && <PostComposer groups={activeGroups} user={{ name: session.user.full_name ?? session.user.email, avatar: session.user.avatar_url }} />}
          {posts.length === 0 ? (
            <div className="border border-black/30 px-6 py-16 text-center">
              <p className="text-xl">Be the first to post</p>
              <p className="mt-2 text-[15px]">Create a post and start connecting with other members.</p>
              {!session && <Link href="/login?next=/groups" className="mt-6 inline-flex h-10 items-center rounded-full bg-brand px-6 text-white">Log In to Post</Link>}
              {session && activeGroups.length === 0 && <p className="mt-4 text-sm">Join a group on the right to start posting.</p>}
            </div>
          ) : posts.map((p) => {
            const st = stateOf(p.group_id);
            return <PostCard key={p.id} post={p} canComment={st === "member" || st === "admin"} canDelete={!!session && (p.author_id === session.user.id || st === "admin" || isAdmin)} />;
          })}
        </div>

        <aside className="order-1 space-y-6 lg:order-2">
          <form className="relative" role="search">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input name="q" defaultValue={q} type="search" placeholder="Search" aria-label="Search groups"
              className="h-10 w-full border border-black/60 pl-9 pr-3 text-[15px] focus:border-black focus:outline-none" />
          </form>
          <div className="border border-black/30 p-5">
            <h2 className="font-sans text-[17px] tracking-normal">{q ? `Groups matching “${q}”` : "Suggested Groups"}</h2>
            {groups.length === 0 ? <p className="mt-4 text-sm">No groups found.</p> : (
              <ul className="mt-4 divide-y divide-black/15">
                {groups.slice(0, 12).map((g) => (
                  <li key={g.id} className="flex items-center gap-3 py-3">
                    <Link href={`/groups/${g.slug}`} className="grid h-12 w-12 shrink-0 place-items-center bg-lime font-display text-lg" aria-hidden tabIndex={-1}>
                      {g.name.slice(0, 1).toUpperCase()}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/groups/${g.slug}`} className="block truncate text-[15px] hover:underline">{g.name}</Link>
                      <p className="text-sm text-muted">{g.member_count} {g.member_count === 1 ? "member" : "members"}{g.privacy === "private" ? " · Private" : ""}</p>
                    </div>
                    <JoinButton groupId={g.id} privacy={g.privacy} state={stateOf(g.id)} signedIn={!!session} className="h-8 px-3 text-sm" />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4"><CreateGroupButton signedIn={!!session} /></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
