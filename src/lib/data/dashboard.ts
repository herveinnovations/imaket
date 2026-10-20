import "server-only";
import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import {
  DEMO_AFFILIATES, DEMO_COUPONS, DEMO_CREATORS, DEMO_CUSTOMER_ORDERS, DEMO_DOWNLOADS, DEMO_NOTIFICATIONS,
  DEMO_PAYOUTS, DEMO_PENDING_PRODUCTS, DEMO_PRODUCTS, DEMO_USERS, demoAllOrders, demoCreatorOrders, demoDailySeries,
} from "@/lib/demo-data";
import type {
  Affiliate, AppUser, Coupon, Creator, DailyPoint, Download, Notification, Order, Payout, Product,
} from "@/lib/types";

// ─── Creator ────────────────────────────────────────────────────────

export interface CreatorStats {
  revenue30: number;
  revenuePrev30: number;
  orders30: number;
  ordersPrev30: number;
  views30: number;
  conversion: number;
  balance: { available: number; pending: number; lifetime: number; paid_out: number };
  series: DailyPoint[];
  topProducts: { id: string; title: string; sales: number; revenue: number }[];
  trafficSources: { source: string; visits: number }[];
}

export async function getCreatorStats(creatorId: string, days = 30): Promise<CreatorStats> {
  if (isDemoMode) {
    const series = demoDailySeries(days * 2, 3);
    const cur = series.slice(days), prev = series.slice(0, days);
    const sum = (a: DailyPoint[], k: keyof Omit<DailyPoint, "day">) => a.reduce((s, x) => s + x[k], 0);
    const products = DEMO_PRODUCTS.filter((p) => p.creator_id === creatorId);
    return {
      revenue30: sum(cur, "revenue"), revenuePrev30: sum(prev, "revenue"),
      orders30: sum(cur, "orders"), ordersPrev30: sum(prev, "orders"),
      views30: 9420, conversion: 3.4,
      balance: { available: 5380.5, pending: 1890, lifetime: 48210, paid_out: 37550 },
      series: cur,
      topProducts: products.map((p) => ({ id: p.id, title: p.title, sales: Math.round(p.sales_count / 10), revenue: Math.round(p.sales_count / 10) * p.price })),
      trafficSources: [
        { source: "WhatsApp", visits: 3880 }, { source: "Instagram", visits: 2410 }, { source: "Direct", visits: 1530 },
        { source: "TikTok", visits: 960 }, { source: "Affiliates", visits: 640 },
      ],
    };
  }

  const supabase = (await getServerSupabase())!;
  const since = new Date(Date.now() - days * 2 * 86400000).toISOString();
  const [{ data: series2 }, { data: bal }, { data: products }, { count: views }, { data: refs }] = await Promise.all([
    supabase.rpc("imaket_creator_daily_sales", { p_creator_id: creatorId, p_days: days * 2 }),
    supabase.from("imaket_creator_balances").select("*").eq("creator_id", creatorId).maybeSingle(),
    supabase.from("imaket_products").select("id, title, sales_count, price").eq("creator_id", creatorId).order("sales_count", { ascending: false }).limit(5),
    supabase.from("imaket_analytics_events").select("id", { count: "exact", head: true })
      .eq("creator_id", creatorId).in("event", ["product_view", "store_view"]).gte("created_at", new Date(Date.now() - days * 86400000).toISOString()),
    supabase.from("imaket_analytics_events").select("referrer").eq("creator_id", creatorId).gte("created_at", since).limit(5000),
  ]);
  const all = ((series2 as DailyPoint[]) ?? []).map((d) => ({ ...d, revenue: Number(d.revenue), orders: Number(d.orders) }));
  const cur = all.slice(-days), prev = all.slice(0, Math.max(0, all.length - days));
  const sum = (a: DailyPoint[], k: "revenue" | "orders") => a.reduce((s, x) => s + x[k], 0);
  const orders30 = sum(cur, "orders");
  const bySource = new Map<string, number>();
  (refs ?? []).forEach((r: { referrer: string | null }) => {
    const s = classifyReferrer(r.referrer);
    bySource.set(s, (bySource.get(s) ?? 0) + 1);
  });
  return {
    revenue30: sum(cur, "revenue"), revenuePrev30: sum(prev, "revenue"),
    orders30, ordersPrev30: sum(prev, "orders"),
    views30: views ?? 0,
    conversion: views ? Math.round((orders30 / views) * 1000) / 10 : 0,
    balance: {
      available: Number(bal?.available ?? 0), pending: Number(bal?.pending ?? 0),
      lifetime: Number(bal?.lifetime_earnings ?? 0), paid_out: Number(bal?.paid_out ?? 0),
    },
    series: cur,
    topProducts: (products ?? []).map((p) => ({ id: p.id, title: p.title, sales: p.sales_count, revenue: p.sales_count * Number(p.price) })),
    trafficSources: [...bySource.entries()].map(([source, visits]) => ({ source, visits })).sort((a, b) => b.visits - a.visits),
  };
}

function classifyReferrer(ref: string | null) {
  if (!ref) return "Direct";
  const r = ref.toLowerCase();
  if (r.includes("whatsapp") || r.includes("wa.me")) return "WhatsApp";
  if (r.includes("instagram")) return "Instagram";
  if (r.includes("tiktok")) return "TikTok";
  if (r.includes("facebook") || r.includes("fb.")) return "Facebook";
  if (r.includes("t.co") || r.includes("twitter") || r.includes("x.com")) return "X";
  if (r.includes("google")) return "Search";
  if (r.startsWith("ref:")) return "Affiliates";
  return "Other";
}

export async function getCreatorProducts(creatorId: string): Promise<Product[]> {
  if (isDemoMode) return [...DEMO_PRODUCTS.filter((p) => p.creator_id === creatorId), { ...DEMO_PENDING_PRODUCTS[0], creator_id: creatorId }];
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_products").select("*, category:imaket_categories(id, slug, name)")
    .eq("creator_id", creatorId).order("created_at", { ascending: false });
  return (data as Product[]) ?? [];
}

export async function getCreatorOrders(creatorId: string, limit = 50): Promise<Order[]> {
  if (isDemoMode) return demoCreatorOrders(creatorId).slice(0, limit);
  const supabase = (await getServerSupabase())!;
  // Fetch this creator's items, grouped into their orders (only their own lines are visible)
  const { data } = await supabase
    .from("imaket_orders")
    .select("*, items:imaket_order_items!inner(*)")
    .eq("items.creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as Order[]) ?? [];
}

export interface CustomerRow { email: string; name: string | null; orders: number; spent: number; currency: string; last: string }

export async function getCreatorCustomers(creatorId: string): Promise<CustomerRow[]> {
  const orders = (await getCreatorOrders(creatorId, 500)).filter((o) => ["paid", "fulfilled"].includes(o.status));
  const map = new Map<string, CustomerRow>();
  for (const o of orders) {
    const mine = (o.items ?? []).filter((i) => i.creator_id === creatorId).reduce((s, i) => s + Number(i.line_total), 0);
    const row = map.get(o.customer_email) ?? { email: o.customer_email, name: o.customer_name, orders: 0, spent: 0, currency: o.currency, last: o.created_at };
    row.orders += 1;
    row.spent += mine;
    if (o.created_at > row.last) row.last = o.created_at;
    map.set(o.customer_email, row);
  }
  return [...map.values()].sort((a, b) => b.spent - a.spent);
}

export async function getCreatorCoupons(creatorId: string): Promise<Coupon[]> {
  if (isDemoMode) return DEMO_COUPONS;
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_coupons").select("*").eq("creator_id", creatorId).order("created_at", { ascending: false });
  return (data as Coupon[]) ?? [];
}

export async function getCreatorPayouts(creatorId: string): Promise<Payout[]> {
  if (isDemoMode) return DEMO_PAYOUTS;
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_payouts").select("*").eq("creator_id", creatorId).order("requested_at", { ascending: false });
  return (data as Payout[]) ?? [];
}

export async function getCreatorAffiliates(creatorId: string): Promise<Affiliate[]> {
  if (isDemoMode) return DEMO_AFFILIATES;
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_affiliates").select("*").eq("creator_id", creatorId).order("earnings", { ascending: false });
  return (data as Affiliate[]) ?? [];
}

// ─── Customer ───────────────────────────────────────────────────────

export async function getCustomerOrders(userId: string): Promise<Order[]> {
  if (isDemoMode) return DEMO_CUSTOMER_ORDERS;
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_orders").select("*, items:imaket_order_items(*)").eq("customer_id", userId).order("created_at", { ascending: false });
  return (data as Order[]) ?? [];
}

export async function getCustomerDownloads(userId: string): Promise<Download[]> {
  if (isDemoMode) return DEMO_DOWNLOADS;
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase
    .from("imaket_downloads")
    .select("*, product:imaket_products(id, title, slug, cover_url, type, creator:imaket_creators(store_name, handle))")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });
  const downloads = (data as Download[]) ?? [];
  if (!downloads.length) return downloads;
  // product_files are hidden from buyers by RLS; list names/sizes only (never paths) via the service client
  const { data: files } = await getAdminSupabase()
    .from("imaket_product_files").select("id, product_id, file_name, size_bytes")
    .in("product_id", downloads.map((d) => d.product_id)).order("sort_order");
  return downloads.map((d) => ({
    ...d,
    product: d.product && { ...d.product, files: (files ?? []).filter((f) => f.product_id === d.product_id).map(({ id, file_name, size_bytes }) => ({ id, file_name, size_bytes })) },
  }));
}

export async function getWishlist(userId: string): Promise<Product[]> {
  if (isDemoMode) return DEMO_PRODUCTS.slice(2, 5);
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_wishlists")
    .select("product:imaket_products(*, creator:imaket_creators(id, handle, store_name, avatar_url, verified))")
    .eq("user_id", userId);
  return ((data ?? []) as unknown as { product: Product }[]).map((r) => r.product).filter(Boolean);
}

export async function getNotifications(userId: string, limit = 20): Promise<Notification[]> {
  if (isDemoMode) return DEMO_NOTIFICATIONS;
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return (data as Notification[]) ?? [];
}

// ─── Admin ──────────────────────────────────────────────────────────

export interface AdminStats {
  gmv30: number; fees30: number; orders30: number; gmvPrev30: number;
  creators: number; customers: number; pendingProducts: number; pendingPayouts: number;
  series: { day: string; gmv: number; fees: number; orders: number }[];
}

export async function getAdminStats(): Promise<AdminStats> {
  if (isDemoMode) {
    const s = demoDailySeries(60, 9, 6);
    const cur = s.slice(30), prev = s.slice(0, 30);
    const series = cur.map((d) => ({ day: d.day, gmv: d.revenue, fees: Math.round(d.revenue * 0.05), orders: d.orders }));
    return {
      gmv30: series.reduce((a, d) => a + d.gmv, 0), fees30: series.reduce((a, d) => a + d.fees, 0),
      orders30: series.reduce((a, d) => a + d.orders, 0), gmvPrev30: prev.reduce((a, d) => a + d.revenue, 0),
      creators: 1284, customers: 23950, pendingProducts: DEMO_PENDING_PRODUCTS.length, pendingPayouts: 7, series,
    };
  }
  const supabase = (await getServerSupabase())!;
  const [{ data: series }, { count: creators }, { count: customers }, { count: pendingProducts }, { count: pendingPayouts }] = await Promise.all([
    supabase.rpc("imaket_platform_daily_revenue", { p_days: 60 }),
    supabase.from("imaket_creators").select("id", { count: "exact", head: true }),
    supabase.from("imaket_users").select("id", { count: "exact", head: true }).eq("role", "customer"),
    supabase.from("imaket_products").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("imaket_payouts").select("id", { count: "exact", head: true }).in("status", ["requested", "processing"]),
  ]);
  const all = ((series ?? []) as { day: string; gmv: number; fees: number; orders: number }[]).map((d) => ({
    day: d.day, gmv: Number(d.gmv), fees: Number(d.fees), orders: Number(d.orders),
  }));
  const cur = all.slice(-30), prev = all.slice(0, -30);
  return {
    gmv30: cur.reduce((a, d) => a + d.gmv, 0), fees30: cur.reduce((a, d) => a + d.fees, 0),
    orders30: cur.reduce((a, d) => a + d.orders, 0), gmvPrev30: prev.reduce((a, d) => a + d.gmv, 0),
    creators: creators ?? 0, customers: customers ?? 0, pendingProducts: pendingProducts ?? 0, pendingPayouts: pendingPayouts ?? 0,
    series: cur,
  };
}

export async function getModerationQueue(): Promise<Product[]> {
  if (isDemoMode) return DEMO_PENDING_PRODUCTS;
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_products")
    .select("*, creator:imaket_creators(id, handle, store_name, avatar_url, verified), category:imaket_categories(id, slug, name)")
    .eq("status", "pending_review").order("updated_at", { ascending: true });
  return (data as Product[]) ?? [];
}

export async function getAllCreators(): Promise<Creator[]> {
  if (isDemoMode) return DEMO_CREATORS;
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_creators").select("*").order("created_at", { ascending: false }).limit(200);
  return (data as Creator[]) ?? [];
}

export async function getAllUsers(): Promise<(AppUser & { orders?: number })[]> {
  if (isDemoMode) return DEMO_USERS;
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_users").select("*").order("created_at", { ascending: false }).limit(200);
  return (data as AppUser[]) ?? [];
}

export async function getAllOrders(limit = 50): Promise<Order[]> {
  if (isDemoMode) return demoAllOrders();
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_orders").select("*, items:imaket_order_items(*)").order("created_at", { ascending: false }).limit(limit);
  return (data as Order[]) ?? [];
}

export async function getAllPayouts(): Promise<(Payout & { creator?: Pick<Creator, "store_name" | "handle"> })[]> {
  if (isDemoMode) {
    return DEMO_PAYOUTS.map((p, i) => ({ ...p, id: `ap${i}`, status: i === 0 ? "requested" : p.status, creator: DEMO_CREATORS[i] }));
  }
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_payouts").select("*, creator:imaket_creators(store_name, handle)").order("requested_at", { ascending: false }).limit(100);
  return (data as (Payout & { creator?: Pick<Creator, "store_name" | "handle"> })[]) ?? [];
}

export async function getPlatformSettings(): Promise<Record<string, unknown>> {
  const defaults = {
    fee_percent: 5, payout_hold_days: 7, auto_approve_products: false, maintenance_mode: false,
    enabled_providers: ["flutterwave", "dusupay", "mobile_money", "stripe", "paypal"],
    min_payout: { ZMW: 100, NGN: 5000, KES: 500, GHS: 50, UGX: 20000, USD: 10 },
  };
  if (isDemoMode) return defaults;
  const supabase = (await getServerSupabase())!;
  const { data } = await supabase.from("imaket_platform_settings").select("key, value");
  return { ...defaults, ...Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) };
}
