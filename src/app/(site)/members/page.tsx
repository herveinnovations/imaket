import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { FollowToggle } from "@/components/community/follow-toggle";
import { getSession } from "@/lib/auth";
import { getMemberDirectory } from "@/lib/data/community";

export const metadata: Metadata = { title: "Members" };

type SP = Promise<{ q?: string; page?: string }>;

export default async function MembersPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();

  if (!session) {
    return (
      <section className="flex min-h-[340px] flex-col items-center justify-center bg-white px-6 py-20 text-center">
        <h1 className="font-sans text-[1.65rem] font-normal tracking-normal">Log In to Connect With Members</h1>
        <p className="mt-4 max-w-[22rem] text-[15px]">View and follow other members, leave comments &amp; more.</p>
        <Link href="/login?next=/members" className="mt-8 inline-flex h-10 items-center bg-brand px-14 text-[15px] text-white hover:bg-[#006b20]">Log In</Link>
      </section>
    );
  }

  const sp = await searchParams;
  const q = sp.q?.slice(0, 60) ?? "";
  const page = Math.max(1, Number(sp.page ?? 1));
  const { members, total } = await getMemberDirectory(q, page);
  const pages = Math.ceil(total / 24);

  return (
    <div className="bg-white px-5 pb-20 pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[2.05rem]">Members</h1>
          <p className="mt-1 text-[15px]">{total} {total === 1 ? "member" : "members"} · creators and shoppers on iMaket</p>
        </div>
        <form className="relative w-full sm:w-72" role="search">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input name="q" defaultValue={q} type="search" placeholder="Search members" aria-label="Search members"
            className="h-10 w-full border border-black/60 pl-9 pr-3 text-[15px] focus:border-black focus:outline-none" />
        </form>
      </div>

      {members.length === 0 ? (
        <p className="py-20 text-center text-[17px]">{q ? `No members match “${q}”.` : "No members to show yet."}</p>
      ) : (
        <ul className="mt-10 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {members.map((m) => (
            <li key={m.id} className="flex flex-col items-center bg-stone px-5 py-8 text-center">
              <Avatar name={m.full_name} src={m.avatar_url} size={88} />
              <p className="mt-4 text-[17px]">{m.full_name ?? "Member"}</p>
              {m.handle ? (
                <Link href={`/${m.handle}`} className="mt-0.5 text-sm underline underline-offset-4">{m.store_name}</Link>
              ) : <p className="mt-0.5 text-sm text-muted">Shopper</p>}
              {m.bio && <p className="mt-2 line-clamp-2 text-sm">{m.bio}</p>}
              <p className="mt-3 text-sm">{m.followers} {m.followers === 1 ? "follower" : "followers"}</p>
              {m.id !== session.user.id
                ? <FollowToggle userId={m.id} initial={m.following} signedIn className="mt-4" />
                : <Link href="/dashboard/settings" className="mt-4 text-sm underline underline-offset-4">Edit your profile</Link>}
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-12 flex justify-center gap-1" aria-label="Pagination">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`/members?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`} aria-current={p === page ? "page" : undefined}
              className={`grid h-9 min-w-9 place-items-center px-2 ${p === page ? "bg-black text-white" : "hover:underline"}`}>{p}</Link>
          ))}
        </nav>
      )}

      <p className="mt-14 text-center text-sm text-muted">
        Don&apos;t want to appear here? Turn off &ldquo;Show me in the member directory&rdquo; in <Link href="/dashboard/settings" className="underline">your account settings</Link>.
      </p>
    </div>
  );
}
