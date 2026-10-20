import "server-only";
import { getApiSession } from "@/lib/auth";
import { fail } from "@/lib/api";

/** Admin API guard: returns the session, or a 403 response. Admin writes use the service client AFTER this check. */
export async function adminOnly() {
  const session = await getApiSession(["admin"]);
  if (!session || (!session.demo && session.user.role !== "admin")) return { response: fail("Admins only", 403) } as const;
  return { session } as const;
}
