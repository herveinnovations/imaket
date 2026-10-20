import type { Metadata } from "next";
import { AreaLayout } from "@/components/dashboard/area-layout";

export const metadata: Metadata = { title: { default: "Creator studio", template: "%s · Creator studio" }, robots: { index: false } };

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout area="creator">{children}</AreaLayout>;
}
