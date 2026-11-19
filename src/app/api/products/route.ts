import { fail, ok, parseBody } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getProducts } from "@/lib/data/catalog";
import { getServerSupabase } from "@/lib/supabase/server";
import { productRow, saveProductChildren } from "@/lib/products";
import { isDemoMode } from "@/lib/env";
import { productSchema } from "@/lib/validation";
import { uniqueSlug } from "@/lib/utils";
import type { ProductFilters, ProductType } from "@/lib/types";

/** GET /api/products?q=&category=&type=&min=&max=&sort=&page= — public catalogue */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const filters: ProductFilters = {
    q: sp.get("q") ?? undefined, category: sp.get("category") ?? undefined, type: (sp.get("type") as ProductType) ?? undefined,
    minPrice: sp.get("min") ? Number(sp.get("min")) : undefined, maxPrice: sp.get("max") ? Number(sp.get("max")) : undefined,
    sort: (sp.get("sort") as ProductFilters["sort"]) ?? undefined, page: Number(sp.get("page") ?? 1), pageSize: Number(sp.get("pageSize") ?? 24),
    creatorId: sp.get("creator") ?? undefined,
  };
  const result = await getProducts(filters);
  return ok(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}

/** POST /api/products — create a product (creator only). */
export async function POST(req: Request) {
  const session = await getApiSession(["creator", "admin"]);
  if (!session?.creator) return fail("Open a store before adding products.", 403);
  const body = await parseBody(req, productSchema);
  if ("response" in body) return body.response;
  const input = body.data;
  if (isDemoMode) return ok({ product: { id: "demo", status: input.status ?? "pending_review" }, demo: true }, { status: 201 });

  const supabase = (await getServerSupabase())!;
  const { data: product, error } = await supabase.from("imaket_products").insert({
    ...productRow(input),
    creator_id: session.creator.id,
    currency: input.currency ?? session.creator.currency,
    slug: uniqueSlug(input.title),
    status: input.status ?? "draft", // DB trigger turns "pending_review" into "published" when auto-approve is on
  }).select("id, slug, status").single();
  if (error) return fail(error.message, 400);

  try { await saveProductChildren(product.id, session.creator.id, input); }
  catch (e) {
    console.error("[products] children", e);
    return fail(`The product was saved as a draft, but its files or curriculum didn't save: ${(e as Error).message}. Open it from Products and try again.`, 500);
  }
  return ok({ product }, { status: 201 });
}
