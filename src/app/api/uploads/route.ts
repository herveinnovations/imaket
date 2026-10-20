import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

const schema = z.object({
  bucket: z.enum(["imaket-covers", "imaket-product-files"]),
  fileName: z.string().min(1).max(255),
  contentType: z.string().max(120),
  size: z.number().int().positive(),
});

const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 50); // Supabase free plan cap
const LIMITS = { "imaket-covers": 10 * 1024 ** 2, "imaket-product-files": MAX_UPLOAD_MB * 1024 ** 2 };
const IMAGE = /^image\/(png|jpe?g|webp|gif|avif)$/;

/**
 * POST /api/uploads — returns a signed upload URL scoped to the caller's
 * folder (<creator_id>/… or <user_id>/… for avatars). Storage RLS enforces
 * the folder again on upload.
 */
export async function POST(req: Request) {
  const session = await getApiSession();
  if (!session) return fail("Log in to upload files.", 401);
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  const { bucket, fileName, contentType, size } = body.data;

  if (size > LIMITS[bucket]) return fail(`File is too large (max ${bucket === "imaket-covers" ? "10 MB" : `${MAX_UPLOAD_MB} MB`}).`, 413);
  if (bucket === "imaket-covers" && !IMAGE.test(contentType)) return fail("Images must be PNG, JPG, WebP, GIF or AVIF.", 415);
  if (bucket === "imaket-product-files" && !session.creator) return fail("Only creators can upload product files.", 403);

  const owner = session.creator?.id ?? session.user.id;
  const safe = fileName.normalize("NFKD").replace(/[^\w.-]+/g, "-").slice(-120);
  const path = `${owner}/${crypto.randomUUID()}-${safe}`;
  if (isDemoMode) return ok({ path, demo: true });

  const supabase = (await getServerSupabase())!;
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error) return fail(error.message, 400);
  const publicUrl = bucket === "imaket-covers" ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : undefined;
  return ok({ path, signedUrl: data.signedUrl, token: data.token, publicUrl });
}
