import { fail, ok, parseBody } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { productSchema } from "@/lib/validation";
import { productRow, saveProductChildren } from "@/lib/products";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (isDemoMode) return ok({ product: null, demo: true });
  const supabase = (await getServerSupabase())!;
  const { data, error } = await supabase.from("imaket_products").select("*, files:imaket_product_files(id, file_name, size_bytes, mime_type, storage_path), modules:imaket_course_modules(id, title, sort_order, lessons:imaket_course_lessons(id, title, summary, sort_order, duration_seconds, is_preview))").eq("id", id).maybeSingle();
  if (error || !data) return fail("Product not found", 404);
  return ok({ product: data });
}

/** PATCH /api/products/:id — partial update. RLS ensures only the owner (or admin) can write. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await getApiSession(["creator", "admin"]);
  if (!session?.creator && session?.user.role !== "admin") return fail("Not allowed", 403);
  const body = await parseBody(req, productSchema.partial());
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ product: { id, status: body.data.status ?? "published" }, demo: true });

  const supabase = (await getServerSupabase())!;
  const { data, error } = await supabase.from("imaket_products").update(productRow(body.data)).eq("id", id).select("id, status, creator_id").maybeSingle();
  if (error) return fail(error.message, 400);
  if (!data) return fail("Product not found", 404);
  try { await saveProductChildren(id, data.creator_id, body.data); } catch (e) { return fail((e as Error).message, 400); }
  return ok({ product: data });
}

/** DELETE /api/products/:id — products with sales are archived instead (buyers keep access). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const session = await getApiSession(["creator", "admin"]);
  if (!session) return fail("Not allowed", 403);
  if (isDemoMode) return ok({ deleted: true, demo: true });
  const supabase = (await getServerSupabase())!;
  const { count } = await supabase.from("imaket_order_items").select("id", { count: "exact", head: true }).eq("product_id", id);
  if (count) {
    const { error } = await supabase.from("imaket_products").update({ status: "archived" }).eq("id", id);
    if (error) return fail(error.message, 400);
    return ok({ archived: true, reason: "Product has sales, so it was archived to keep buyers' access." });
  }
  const { error } = await supabase.from("imaket_products").delete().eq("id", id);
  if (error) return fail(error.message, 400);
  return ok({ deleted: true });
}
