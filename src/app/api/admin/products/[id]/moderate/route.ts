import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { adminOnly } from "@/lib/admin-guard";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { emails, sendEmail } from "@/lib/email";

const schema = z.object({ decision: z.enum(["approve", "reject"]), reason: z.string().max(1000).optional() })
  .refine((d) => d.decision === "approve" || (d.reason?.trim().length ?? 0) >= 10, { message: "Explain what needs to change (10+ characters)", path: ["reason"] });

/** POST /api/admin/products/:id/moderate — approve or send back. DB trigger notifies the creator in-app. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await adminOnly();
  if ("response" in guard) return guard.response;
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ status: body.data.decision === "approve" ? "published" : "rejected", demo: true });

  const { id } = await params;
  const approved = body.data.decision === "approve";
  const db = getAdminSupabase();
  const { data: p, error } = await db.from("imaket_products").update({
    status: approved ? "published" : "rejected",
    rejection_reason: approved ? null : body.data.reason,
    reviewed_by: guard.session.user.id,
    reviewed_at: new Date().toISOString(),
  }).eq("id", id).select("title, creator:imaket_creators(user:imaket_users(email))").single();
  if (error) return fail(error.message, 400);

  const email = (p.creator as unknown as { user: { email: string } } | null)?.user?.email;
  if (email) {
    const m = emails.productModerated({ title: p.title, approved, reason: body.data.reason });
    await sendEmail(email, m.subject, m.html);
  }
  return ok({ status: approved ? "published" : "rejected" });
}
