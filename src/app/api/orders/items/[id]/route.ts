import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { getApiSession } from "@/lib/auth";
import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

const schema = z.object({
  fulfillment_status: z.enum(["shipped", "completed", "delivered"]),
  tracking_number: z.string().max(120).nullish(),
});

/** PATCH /api/orders/items/:id — creator fulfils a line (RLS: own items only). Notifies the buyer. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession(["creator", "admin"]);
  if (!session) return fail("Not allowed", 403);
  const body = await parseBody(req, schema);
  if ("response" in body) return body.response;
  if (isDemoMode) return ok({ updated: true, demo: true });

  const { id } = await params;
  const supabase = (await getServerSupabase())!;
  const { data: item, error } = await supabase.from("imaket_order_items").update(body.data).eq("id", id).select("order_id, title").maybeSingle();
  if (error) return fail(error.message, 400);
  if (!item) return fail("Order item not found", 404);

  const db = getAdminSupabase();
  const { data: order } = await db.from("imaket_orders").select("id, customer_id, order_number").eq("id", item.order_id).single();
  if (order?.customer_id) {
    await db.from("imaket_notifications").insert({
      user_id: order.customer_id, type: "order.shipped", title: "Your order is on its way",
      body: `${item.title}${body.data.tracking_number ? ` · tracking ${body.data.tracking_number}` : ""}`, link: "/dashboard/orders",
    });
  }
  // when every line is done, the order is fulfilled
  const { count } = await db.from("imaket_order_items").select("id", { count: "exact", head: true }).eq("order_id", item.order_id).eq("fulfillment_status", "unfulfilled");
  if (!count) await db.from("imaket_orders").update({ status: "fulfilled" }).eq("id", item.order_id).eq("status", "paid");
  return ok({ updated: true });
}
