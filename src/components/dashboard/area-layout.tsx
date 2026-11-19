import { DashboardShell } from "./shell";
import { DemoBanner } from "@/components/layout/demo-banner";
import { requireRole } from "@/lib/auth";
import { getNotifications } from "@/lib/data/dashboard";
import type { UserRole } from "@/lib/types";

type Area = "customer" | "creator" | "admin";
const ROLES: Record<Area, UserRole[]> = { admin: ["admin"], creator: ["creator", "admin"], customer: ["customer", "creator", "admin"] };
const PATH: Record<Area, string> = { admin: "/admin", creator: "/creator", customer: "/dashboard" };

/** Server layout used by /dashboard, /creator and /admin. Enforces role, loads notifications. */
export async function AreaLayout({ area, children }: { area: Area; children: React.ReactNode }) {
  const session = await requireRole(ROLES[area], PATH[area]);
  const notifications = await getNotifications(session.user.id);
  const role = session.user.role;
  const areas: Area[] = session.demo
    ? ["creator", "customer", "admin"]
    : role === "admin" ? ["admin", "customer", ...(session.creator ? (["creator"] as Area[]) : [])]
    : role === "creator" ? ["creator", "customer"] : ["customer"];

  return (
    <>
      <DemoBanner />
      <DashboardShell
        area={area}
        areas={areas}
        storeHandle={session.creator?.handle}
        notifications={notifications}
        user={{ id: session.user.id, name: session.user.full_name ?? session.user.email, email: session.user.email, avatar: session.user.avatar_url }}
      >
        {children}
      </DashboardShell>
    </>
  );
}
