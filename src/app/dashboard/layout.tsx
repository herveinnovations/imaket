import type { Metadata } from "next";
import { AreaLayout } from "@/components/dashboard/area-layout";

export const metadata: Metadata = { title: { default: "My account", template: "%s · My account" }, robots: { index: false } };

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout area="customer">{children}</AreaLayout>;
}
