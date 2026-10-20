import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import type { ProductInput } from "@/lib/validation";

/** Strip relational fields; return the columns row. */
export function productRow(p: Partial<ProductInput>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { files, modules, ...row } = p;
  return row;
}

/** Saves files + course structure for a product (runs as the creator; RLS enforces ownership). */
export async function saveProductChildren(productId: string, creatorId: string, input: Partial<ProductInput>) {
  const supabase = (await getServerSupabase())!;
  if (input.files) {
    // only accept paths inside the creator's own folder
    const files = input.files.filter((f) => f.path.startsWith(`${creatorId}/`));
    await supabase.from("imaket_product_files").delete().eq("product_id", productId);
    if (files.length) {
      const { error } = await supabase.from("imaket_product_files").insert(files.map((f, i) => ({
        product_id: productId, storage_path: f.path, file_name: f.name, size_bytes: f.size, mime_type: f.mime, sort_order: i,
      })));
      if (error) throw error;
    }
  }
  if (input.modules) {
    await supabase.from("imaket_course_modules").delete().eq("product_id", productId);
    for (const [mi, m] of input.modules.entries()) {
      const { data: mod, error } = await supabase.from("imaket_course_modules").insert({ product_id: productId, title: m.title, sort_order: mi }).select("id").single();
      if (error) throw error;
      if (m.lessons.length) {
        const { error: lessonErr } = await supabase.from("imaket_course_lessons").insert(m.lessons.map((l, li) => ({
          product_id: productId, module_id: mod.id, title: l.title, is_preview: l.is_preview, sort_order: li,
        })));
        if (lessonErr) throw lessonErr;
      }
    }
  }
}

