import "server-only";
import { NextResponse } from "next/server";
import type { z, ZodTypeAny } from "zod";

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);
export const fail = (error: string, status = 400, extra?: Record<string, unknown>) =>
  NextResponse.json({ error, ...extra }, { status });

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<{ data: z.output<S> } | { response: NextResponse }> {
  let raw: unknown;
  try { raw = await req.json(); } catch { return { response: fail("Request body must be JSON.") }; }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { response: fail(`${first.path.join(".") || "body"}: ${first.message}`, 422, { issues: parsed.error.issues }) };
  }
  return { data: parsed.data };
}

/**
 * Minimal fixed-window rate limiter (per server instance). For multi-region
 * production use Upstash Redis or Vercel KV with the same interface.
 */
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { n: 1, reset: now + windowMs }); return true; }
  b.n++;
  return b.n <= limit;
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "anon";
}
