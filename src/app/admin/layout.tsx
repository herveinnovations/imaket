import type { Metadata } from "next";
import { AreaLayout } from "@/components/dashboard/area-layout";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout area="admin">{children}</AreaLayout>;
}
