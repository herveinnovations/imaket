import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { adminOnly } from "@/lib/admin-guard";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { emails, sendEmail } from "@/lib/email";

const schema = z.object({ status: z.enum(["processing", "paid", "rejected"]), reference: z.string().max(120).nullish(), note: z.string().max(500).optional() });
const ALLOWED: Record<string, string[]> = { requested: ["processing", "paid", "rejected"], processing: ["paid", "rejected"] };

/** PATCH /api/admin/payouts/:id — move a payout through requested → processing → paid | rejected */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await adminOnly();
  if ("response" in guard) return guard.response;
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ updated: true, demo: true });

  const { id } = await params;
  const db = getAdminSupabase();
  const { data: p } = await db.from("imaket_payouts").select("*, creator:imaket_creators(user_id, user:imaket_users(email))").eq("id", id).single();
  if (!p) return fail("Payout not found", 404);
  if (!ALLOWED[p.status]?.includes(body.data.status)) return fail(`Can't move a ${p.status} payout to ${body.data.status}.`, 409);
  if (body.data.status === "paid" && !body.data.reference) return fail("Add the transfer reference.", 400);

  const { error } = await db.from("imaket_payouts").update({
    status: body.data.status, reference: body.data.reference ?? p.reference, note: body.data.note ?? p.note,
    processed_by: guard.session.user.id, processed_at: ["paid", "rejected"].includes(body.data.status) ? new Date().toISOString() : null,
  }).eq("id", id);
  if (error) return fail(error.message, 400);

  const creator = p.creator as { user_id: string; user: { email: string } };
  await db.from("imaket_notifications").insert({
    user_id: creator.user_id, type: `payout.${body.data.status}`,
    title: body.data.status === "paid" ? "Payout sent" : body.data.status === "rejected" ? "Payout rejected" : "Payout processing",
    body: `${p.currency} ${p.amount}${body.data.reference ? ` · ref ${body.data.reference}` : ""}`, link: "/creator/payouts",
  });
  const m = emails.payoutUpdate({ amount: Number(p.amount), currency: p.currency, status: body.data.status, reference: body.data.reference });
  await sendEmail(creator.user.email, m.subject, m.html);
  return ok({ updated: true });
}
