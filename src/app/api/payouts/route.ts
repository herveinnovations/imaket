import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getAdminSupabase } from "@/lib/supabase/server";
import { getCreatorPayouts, getPlatformSettings } from "@/lib/data/dashboard";
import { isDemoMode } from "@/lib/env";
import { describeMethodServer } from "@/lib/payout-method";
import type { PayoutMethod } from "@/lib/types";

export async function GET() {
  const session = await getApiSession(["creator", "admin"]);
  if (!session?.creator) return fail("Not allowed", 403);
  return ok({ payouts: await getCreatorPayouts(session.creator.id) });
}

const schema = z.object({ amount: z.number().positive() });

/**
 * POST /api/payouts — request a withdrawal. Balance is checked server-side
 * against the creator_balances view; one open request at a time.
 */
export async function POST(req: Request) {
  const session = await getApiSession(["creator", "admin"]);
  if (!session?.creator) return fail("Not allowed", 403);
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ payout: { id: "demo", status: "requested" }, demo: true }, { status: 201 });

  const db = getAdminSupabase();
  const creatorId = session.creator.id;
  const { data: c } = await db.from("imaket_creators").select("currency, payout_method, status").eq("id", creatorId).single();
  if (!c || c.status !== "active") return fail("Your store isn't active.", 403);
  const method = c.payout_method as PayoutMethod | null;
  if (!method) return fail("Add a payout method first.", 400);

  const settings = await getPlatformSettings();
  const min = (settings.min_payout as Record<string, number>)[c.currency] ?? 0;
  if (body.data.amount < min) return fail(`The minimum withdrawal is ${c.currency} ${min}.`, 400);

  const { count: open } = await db.from("imaket_payouts").select("id", { count: "exact", head: true }).eq("creator_id", creatorId).in("status", ["requested", "processing"]);
  if (open) return fail("You already have a withdrawal in progress. You can request another once it's paid.", 409);

  const { data: bal } = await db.from("imaket_creator_balances").select("available").eq("creator_id", creatorId).single();
  if (!bal || Number(bal.available) + 0.001 < body.data.amount) return fail("That's more than your available balance.", 400);

  const { data, error } = await db.from("imaket_payouts").insert({
    creator_id: creatorId, amount: body.data.amount, currency: c.currency,
    method: describeMethodServer(method), destination: method, status: "requested",
  }).select().single();
  if (error) return fail(error.message, 400);
  return ok({ payout: data }, { status: 201 });
}
