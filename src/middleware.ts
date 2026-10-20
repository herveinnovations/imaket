import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Affiliate links: ?ref=CODE → remember for 30 days, attributed at checkout
  const ref = request.nextUrl.searchParams.get("ref");
  const response = await updateSession(request);
  if (ref && /^[a-zA-Z0-9_-]{3,32}$/.test(ref) && response instanceof NextResponse) {
    response.cookies.set("sk_ref", ref, { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", httpOnly: true });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|woff2)$).*)"],
};
