import { clientIp, fail, ok, parseBody, rateLimit } from "@/lib/api";
import { isDemoMode } from "@/lib/env";
import { getSession } from "@/lib/auth";
import { checkoutSchema, createOrderAndCheckout } from "@/lib/orders";
import { PaymentError } from "@/lib/payments";

/**
 * POST /api/checkout
 * Creates a pending order priced on the server and starts the provider's
 * checkout. Returns { orderId, redirectUrl, awaitingCustomerApproval }.
 */
export async function POST(req: Request) {
  if (!rateLimit(`checkout:${clientIp(req)}`, 10)) return fail("Too many attempts. Wait a minute and try again.", 429);
  const body = await parseBody(req, checkoutSchema);
  if ("response" in body) return body.response;

  if (isDemoMode) {
    return ok({ orderId: "demo", orderNumber: "SK-DEMO01", redirectUrl: "/checkout/success?order=demo" });
  }

  try {
    const session = await getSession();
    const result = await createOrderAndCheckout(body.data, session?.user.id ?? null);
    if ("error" in result) return fail(result.error!, 422);
    return ok(result);
  } catch (e) {
    console.error("[checkout]", e);
    if (e instanceof PaymentError) return fail(`The payment provider rejected the request: ${e.message}`, 502);
    return fail("Checkout failed. No money was taken. Please try again.", 500);
  }
}
