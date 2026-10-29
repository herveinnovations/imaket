import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { JoinButton, PostCard, PostComposer, RequestRow } from "@/components/community/groups-ui";
import { getSession } from "@/lib/auth";
import { getGroupBySlug, getGroupPeople, getMyMemberships, getPosts } from "@/lib/data/community";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const g = await getGroupBySlug((await params).slug);
  return { title: g?.name ?? "Group not found", description: g?.description };
}

export default async function GroupPage({ params }: { params: Params }) {
  const { slug } = await params;
  const group = await getGroupBySlug(slug);
  if (!group) notFound();
  const session = await getSession();
  const memberships = await getMyMemberships(session?.user.id);
  const m = memberships.find((x) => x.group_id === group.id);
  const state = !m ? "none" : m.status === "pending" ? "pending" : m.role === "admin" ? "admin" : "member";
  const isMember = state === "member" || state === "admin";
  const isPlatformAdmin = session?.user.role === "admin";
  const canRead = group.privacy === "public" || isMember || isPlatformAdmin;
  const [posts, people] = canRead ? await Promise.all([getPosts({ groupId: group.id, limit: 50 }), getGroupPeople(group.id)]) : [[], []];
  const active = people.filter((p) => p.status === "active");
  const requests = people.filter((p) => p.status === "pending");

  return (
    <div className="bg-white pb-20">
      <section className="bg-lime px-5 pb-8 pt-10">
        <Link href="/groups" className="text-[15px] hover:underline">‹ Groups Feed</Link>
        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[2.4rem] sm:text-[3rem]">{group.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 text-[15px]">
              {group.privacy === "private" ? <span className="inline-flex items-center gap-1"><Lock className="h-4 w-4" /> Private group</span> : <span>Public group</span>}
              <span>· {group.member_count} {group.member_count === 1 ? "member" : "members"}</span>
              <span>· {group.post_count} {group.post_count === 1 ? "post" : "posts"}</span>
            </p>
            {group.description && <p className="mt-3 max-w-2xl text-[17px]">{group.description}</p>}
          </div>
          <JoinButton groupId={group.id} privacy={group.privacy} state={state} signedIn={!!session} />
        </div>
      </section>

      <div className="grid gap-8 px-5 pt-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {!canRead ? (
            <div className="border border-black/30 px-6 py-16 text-center">
              <Lock className="mx-auto h-8 w-8" />
              <p className="mt-4 text-xl">This group is private</p>
              <p className="mt-2 text-[15px]">{state === "pending" ? "Your request is waiting for a group admin." : "Request to join to see posts and members."}</p>
            </div>
          ) : (
            <>
              {session && isMember && <PostComposer groups={[{ id: group.id, name: group.name }]} user={{ name: session.user.full_name ?? session.user.email, avatar: session.user.avatar_url }} />}
              {posts.length === 0 ? (
                <div className="border border-black/30 px-6 py-16 text-center">
                  <p className="text-xl">Be the first to post</p>
                  <p className="mt-2 text-[15px]">{isMember ? "Write something above to get the conversation going." : "Join the group to start posting."}</p>
                </div>
              ) : posts.map((p) => (
                <PostCard key={p.id} post={p} showGroup={false} canComment={isMember}
                  canDelete={!!session && (p.author_id === session.user.id || state === "admin" || isPlatformAdmin)} />
              ))}
            </>
          )}
        </div>

        {canRead && (
          <aside className="space-y-6">
            {state === "admin" && requests.length > 0 && (
              <div className="border border-black p-5">
                <h2 className="font-sans text-[17px] tracking-normal">Requests to join ({requests.length})</h2>
                <ul className="mt-2 divide-y divide-black/15">
                  {requests.map((r) => <RequestRow key={r.user_id} groupId={group.id} userId={r.user_id} name={r.full_name} avatar={r.avatar_url} />)}
                </ul>
              </div>
            )}
            <div className="border border-black/30 p-5">
              <h2 className="font-sans text-[17px] tracking-normal">Members</h2>
              {active.length === 0 ? <p className="mt-3 text-sm">{session ? "No members yet." : "Log in to see who's here."}</p> : (
                <ul className="mt-3 space-y-2.5">
                  {active.slice(0, 30).map((p) => (
                    <li key={p.user_id} className="flex items-center gap-2.5 text-[15px]">
                      <Avatar name={p.full_name} src={p.avatar_url} size={30} />
                      <span className="flex-1 truncate">{p.full_name ?? "Member"}</span>
                      {p.role === "admin" && <span className="bg-black px-1.5 py-0.5 text-xs text-lime">Admin</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
