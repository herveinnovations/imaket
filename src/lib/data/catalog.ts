import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { DEMO_CATEGORIES, DEMO_CREATORS, DEMO_PRODUCTS, demoReviews } from "@/lib/demo-data";
import type { Category, Creator, Product, ProductFilters, Review } from "@/lib/types";

const PRODUCT_SELECT =
  "*, creator:imaket_creators!inner(id, handle, store_name, avatar_url, verified, status), category:imaket_categories(id, slug, name)";

export async function getCategories(): Promise<Category[]> {
  if (isDemoMode) return DEMO_CATEGORIES;
  const supabase = await getServerSupabase();
  const { data } = await supabase!.from("imaket_categories").select("*").order("sort_order");
  return (data as Category[]) ?? [];
}

export async function getProducts(f: ProductFilters = {}): Promise<{ items: Product[]; total: number }> {
  const page = Math.max(1, f.page ?? 1);
  const size = Math.min(48, f.pageSize ?? 24);

  if (isDemoMode) {
    let items = DEMO_PRODUCTS.filter((p) => p.status === "published");
    if (f.creatorId) items = items.filter((p) => p.creator_id === f.creatorId);
    if (f.category) items = items.filter((p) => p.category?.slug === f.category);
    if (f.type) items = items.filter((p) => p.type === f.type);
    if (f.q) {
      const q = f.q.toLowerCase();
      items = items.filter((p) =>
        [p.title, p.summary, p.creator?.store_name, ...p.tags].some((s) => s?.toLowerCase().includes(q)));
    }
    if (f.minPrice != null) items = items.filter((p) => p.price >= f.minPrice!);
    if (f.maxPrice != null) items = items.filter((p) => p.price <= f.maxPrice!);
    items = sortProducts(items, f.sort);
    return { items: items.slice((page - 1) * size, page * size), total: items.length };
  }

  const supabase = (await getServerSupabase())!;
  let q = supabase
    .from("imaket_products")
    .select(PRODUCT_SELECT, { count: "exact" })
    .eq("status", "published")
    .eq("creator.status", "active");
  if (f.creatorId) q = q.eq("creator_id", f.creatorId);
  if (f.type) q = q.eq("type", f.type);
  if (f.category) {
    const { data: cat } = await supabase.from("imaket_categories").select("id").eq("slug", f.category).maybeSingle();
    if (cat) q = q.eq("category_id", cat.id);
  }
  if (f.q) q = q.textSearch("search", f.q.trim().split(/\s+/).map((w) => `${w}:*`).join(" & "), { config: "simple" });
  if (f.minPrice != null) q = q.gte("price", f.minPrice);
  if (f.maxPrice != null) q = q.lte("price", f.maxPrice);
  switch (f.sort) {
    case "newest": q = q.order("published_at", { ascending: false }); break;
    case "price_asc": q = q.order("price", { ascending: true }); break;
    case "price_desc": q = q.order("price", { ascending: false }); break;
    case "rating": q = q.order("rating_avg", { ascending: false }); break;
    default: q = q.order("featured", { ascending: false }).order("sales_count", { ascending: false });
  }
  const { data, count } = await q.range((page - 1) * size, page * size - 1);
  return { items: (data as Product[]) ?? [], total: count ?? 0 };
}

function sortProducts(items: Product[], sort: ProductFilters["sort"]) {
  const s = [...items];
  switch (sort) {
    case "newest": return s.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
    case "price_asc": return s.sort((a, b) => a.price - b.price);
    case "price_desc": return s.sort((a, b) => b.price - a.price);
    case "rating": return s.sort((a, b) => b.rating_avg - a.rating_avg);
    default: return s.sort((a, b) => Number(b.featured) - Number(a.featured) || b.sales_count - a.sales_count);
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (isDemoMode) return DEMO_PRODUCTS.find((p) => p.slug === slug) ?? null;
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase
    .from("imaket_products")
    .select(`${PRODUCT_SELECT},
             modules:imaket_course_modules(id, title, sort_order, lessons:imaket_course_lessons(id, title, duration_seconds, is_preview, sort_order))`)
    .eq("slug", slug)
    .maybeSingle();
  return (data as Product) ?? null;
}

export async function getProductReviews(productId: string): Promise<Review[]> {
  if (isDemoMode) return demoReviews(productId);
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase
    .from("imaket_reviews")
    .select("*")
    .eq("product_id", productId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);
  const reviews = (data as Review[]) ?? [];
  if (!reviews.length) return reviews;
  // names + avatars only, via a security-definer function (emails never leave the DB)
  const { data: authors } = await supabase.rpc("imaket_public_profiles", { p_ids: reviews.map((r) => r.customer_id) });
  const byId = new Map(((authors ?? []) as { id: string; full_name: string | null; avatar_url: string | null }[]).map((a) => [a.id, a]));
  return reviews.map((r) => ({ ...r, author: byId.get(r.customer_id) ?? { full_name: "Verified buyer", avatar_url: null } }));
}

export async function getCreatorByHandle(handle: string): Promise<Creator | null> {
  if (isDemoMode) return DEMO_CREATORS.find((c) => c.handle === handle.toLowerCase()) ?? null;
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_creators").select("*").eq("handle", handle.toLowerCase()).eq("status", "active").maybeSingle();
  return (data as Creator) ?? null;
}

export async function getFeaturedCreators(limit = 6): Promise<Creator[]> {
  if (isDemoMode) return DEMO_CREATORS.slice(0, limit);
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase
    .from("imaket_creators").select("*").eq("status", "active")
    .order("verified", { ascending: false }).order("created_at", { ascending: true }).limit(limit);
  return (data as Creator[]) ?? [];
}

export async function getRelatedProducts(p: Product, limit = 4): Promise<Product[]> {
  const { items } = await getProducts({ category: p.category?.slug, pageSize: limit + 1 });
  const pool = items.filter((x) => x.id !== p.id);
  if (pool.length >= limit) return pool.slice(0, limit);
  const more = await getProducts({ pageSize: limit * 2 });
  return [...pool, ...more.items.filter((x) => x.id !== p.id && !pool.some((y) => y.id === x.id))].slice(0, limit);
}
