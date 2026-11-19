import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { DEMO_CREATORS } from "@/lib/demo-data";

export interface Group {
  id: string; slug: string; name: string; description: string; cover_url: string | null;
  privacy: "public" | "private"; created_by: string | null; member_count: number; post_count: number; created_at: string;
}
export interface Author { id: string; full_name: string | null; avatar_url: string | null }
export interface GroupComment { id: string; post_id: string; author_id: string; body: string; created_at: string; author: Author }
export interface GroupPost {
  id: string; group_id: string; author_id: string; body: string; comment_count: number; created_at: string; updated_at: string;
  author: Author; group?: Pick<Group, "id" | "slug" | "name">; comments: GroupComment[];
}
export interface Membership { group_id: string; role: "admin" | "member"; status: "active" | "pending" }
export interface Member {
  id: string; full_name: string | null; avatar_url: string | null; bio: string | null; handle: string | null; store_name: string | null;
  followers: number; following: boolean; joined_at: string;
}
export interface GroupPerson { user_id: string; full_name: string | null; avatar_url: string | null; role: "admin" | "member"; status: "active" | "pending"; joined_at: string }

const DEMO_GROUP: Group = {
  id: "demo-group", slug: "imaket-community", name: "iMaket Community",
  description: "Say hello, share what you're making and swap tips with other buyers and creators.",
  cover_url: null, privacy: "public", created_by: null, member_count: 128, post_count: 2, created_at: new Date().toISOString(),
};

async function attachAuthors<T extends { author_id: string }>(rows: T[]): Promise<(T & { author: Author })[]> {
  if (!rows.length) return [];
  const supabase = (await getServerSupabase())!;
  const ids = [...new Set(rows.map((r) => r.author_id))];
  const { data } = await supabase.rpc("imaket_public_profiles", { p_ids: ids });
  const byId = new Map(((data ?? []) as Author[]).map((a) => [a.id, a]));
  return rows.map((r) => ({ ...r, author: byId.get(r.author_id) ?? { id: r.author_id, full_name: "Member", avatar_url: null } }));
}

export async function getGroups(search?: string): Promise<Group[]> {
  if (isDemoMode) return [DEMO_GROUP];
  const supabase = (await getServerSupabase())!;
  let q = supabase.from("imaket_groups").select("*").order("member_count", { ascending: false }).limit(50);
  if (search) q = q.ilike("name", `%${search.replace(/[%_]/g, "")}%`);
  const { data, error } = await q;
  if (error) { console.error("[groups]", error.message); return []; }
  return (data as Group[]) ?? [];
}

export async function getGroupBySlug(slug: string): Promise<Group | null> {
  if (isDemoMode) return slug === DEMO_GROUP.slug ? DEMO_GROUP : null;
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_groups").select("*").eq("slug", slug).maybeSingle();
  return (data as Group) ?? null;
}

export async function getMyMemberships(userId?: string): Promise<Membership[]> {
  if (isDemoMode || !userId) return [];
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_group_members").select("group_id, role, status").eq("user_id", userId);
  return (data as Membership[]) ?? [];
}

/** Posts the viewer may read (RLS: public groups + groups they belong to), newest first. */
export async function getPosts(opts: { groupId?: string; limit?: number } = {}): Promise<GroupPost[]> {
  if (isDemoMode) {
    const now = Date.now();
    return [
      { id: "dp1", group_id: DEMO_GROUP.id, author_id: "d1", body: "Welcome to the iMaket Community! Share your latest drop or ask other creators for tips.", comment_count: 1, created_at: new Date(now - 36e5).toISOString(), updated_at: "", author: { id: "d1", full_name: "iMaket Team", avatar_url: null }, group: DEMO_GROUP, comments: [{ id: "dc1", post_id: "dp1", author_id: "d2", body: "Excited to be here 👋", created_at: new Date(now - 18e5).toISOString(), author: { id: "d2", full_name: "Mutale Banda", avatar_url: null } }] },
      { id: "dp2", group_id: DEMO_GROUP.id, author_id: "d2", body: "Restocked the chitenge totes this morning. Lusaka pick-up available on Saturdays.", comment_count: 0, created_at: new Date(now - 864e5).toISOString(), updated_at: "", author: { id: "d2", full_name: "Mwila Threads", avatar_url: null }, group: DEMO_GROUP, comments: [] },
    ];
  }
  const supabase = (await getServerSupabase())!;
  let q = supabase.from("imaket_group_posts").select("*, group:imaket_groups(id, slug, name)").order("created_at", { ascending: false }).limit(opts.limit ?? 30);
  if (opts.groupId) q = q.eq("group_id", opts.groupId);
  const { data, error } = await q;
  if (error) { console.error("[posts]", error.message); return []; }
  const posts = await attachAuthors((data ?? []) as Omit<GroupPost, "author" | "comments">[]);
  if (!posts.length) return [];
  const { data: comments } = await supabase.from("imaket_group_comments").select("*").in("post_id", posts.map((p) => p.id)).order("created_at");
  const withAuthors = await attachAuthors((comments ?? []) as Omit<GroupComment, "author">[]);
  return posts.map((p) => ({ ...p, comments: withAuthors.filter((c) => c.post_id === p.id) }));
}

export async function getGroupPeople(groupId: string): Promise<GroupPerson[]> {
  if (isDemoMode) return [];
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.rpc("imaket_group_people", { p_group: groupId });
  return (data as GroupPerson[]) ?? [];
}

export async function getMemberDirectory(search?: string, page = 1): Promise<{ members: Member[]; total: number }> {
  const size = 24;
  if (isDemoMode) {
    const members = DEMO_CREATORS.map((c, i) => ({
      id: c.user_id, full_name: c.store_name, avatar_url: c.avatar_url, bio: c.tagline, handle: c.handle, store_name: c.store_name,
      followers: 40 - i * 5, following: i === 1, joined_at: c.created_at,
    }));
    const filtered = search ? members.filter((m) => m.full_name?.toLowerCase().includes(search.toLowerCase())) : members;
    return { members: filtered, total: filtered.length };
  }
  const supabase = (await getServerSupabase())!;
  const { data, error } = await supabase.rpc("imaket_member_directory", { p_search: search || null, p_limit: size, p_offset: (page - 1) * size });
  if (error) { console.error("[members]", error.message); return { members: [], total: 0 }; }
  const rows = (data ?? []) as (Member & { total: number })[];
  return { members: rows.map(({ total: _t, ...m }) => ({ ...m, followers: Number(m.followers) })), total: Number(rows[0]?.total ?? 0) };
}
