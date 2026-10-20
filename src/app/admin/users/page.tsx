import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/widgets";
import { UsersTable } from "@/components/admin/admin-tables";
import { requireRole } from "@/lib/auth";
import { getAllUsers } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  await requireRole(["admin"], "/admin/users");
  const users = await getAllUsers();
  return (
    <>
      <PageHeader title="Users" description="Change roles or ban accounts. Banned users are signed out and can't log in." />
      <UsersTable users={users} />
    </>
  );
}
