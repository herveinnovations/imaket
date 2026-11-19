import { fail, ok, rateLimit } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

/**
 * GET /api/downloads/:entitlementId?file=:fileId
 * Secure download: verifies the caller owns the entitlement, checks limit
 * and expiry, counts the download, then returns a 60-second signed URL to
 * the private bucket. Guests can use ?token=<access_token> from their receipt.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const fileId = url.searchParams.get("file");
  const token = url.searchParams.get("token");
  if (isDemoMode) return ok({ demo: true });
  if (!fileId) return fail("Choose a file to download.", 400);

  const session = await getApiSession();
  if (!session && !token) return fail("Log in to download your purchases.", 401);
  if (!rateLimit(`dl:${session?.user.id ?? token}`, 30)) return fail("Too many downloads in a short time. Try again in a minute.", 429);

  const db = getAdminSupabase();
  const { data: ent } = await db.from("imaket_downloads").select("*").eq("id", id).maybeSingle();
  if (!ent) return fail("Download not found.", 404);

  const owns = token
    ? token === ent.access_token
    : ent.customer_id === session!.user.id || ent.customer_email?.toLowerCase() === session!.user.email.toLowerCase();
  if (!owns) return fail("This download belongs to a different account.", 403);
  if (ent.expires_at && new Date(ent.expires_at) < new Date()) return fail("Your access to this product has expired.", 410);
  if (ent.max_downloads != null && ent.download_count >= ent.max_downloads) {
    return fail("You've reached the download limit for this purchase. Contact the creator for more.", 429);
  }

  const { data: file } = await db.from("imaket_product_files").select("storage_path, file_name").eq("id", fileId).eq("product_id", ent.product_id).maybeSingle();
  if (!file) return fail("File not found.", 404);

  const { data: signed, error } = await db.storage.from("imaket-product-files").createSignedUrl(file.storage_path, 60, { download: file.file_name });
  if (error || !signed) return fail("Couldn't prepare the download. Try again.", 500);

  // Atomic-enough increment guarded by the limit check (single-row update)
  await db.from("imaket_downloads").update({ download_count: ent.download_count + 1, last_downloaded_at: new Date().toISOString() })
    .eq("id", id).eq("download_count", ent.download_count);

  return ok({ url: signed.signedUrl, fileName: file.file_name }, { headers: { "Cache-Control": "no-store" } });
}
