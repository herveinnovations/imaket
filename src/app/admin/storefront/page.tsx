import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/widgets";
import { NewsletterExport, SitewideCodes, StorefrontContentForm, type SitewideCode } from "@/components/admin/storefront-settings";
import { requireRole } from "@/lib/auth";
import { getAdminSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getSiteContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Storefront & codes" };

export default async function AdminStorefrontPage() {
  await requireRole(["admin"], "/admin/storefront");
  const content = await getSiteContent();
  let codes: SitewideCode[] = [];
  let subscribers = 0;
  if (!isDemoMode) {
    const db = getAdminSupabase();
    const [c, s] = await Promise.all([
      db.from("imaket_platform_coupons").select("*").order("created_at", { ascending: false }),
      db.from("imaket_newsletter_subscribers").select("id", { count: "exact", head: true }).is("unsubscribed_at", null),
    ]);
    codes = (c.data as SitewideCode[]) ?? [];
    subscribers = s.count ?? 0;
  }
  return (
    <>
      <PageHeader title="Storefront & codes" description="Homepage wording and photos, sitewide discount codes and newsletter sign-ups." />
      <div className="max-w-4xl space-y-12">
        <StorefrontContentForm content={content} />
        <section>
          <h2 className="mb-4 text-[1.8rem]">Sitewide codes</h2>
          <SitewideCodes codes={codes} />
        </section>
        <section>
          <h2 className="mb-4 text-[1.8rem]">Newsletter</h2>
          <NewsletterExport count={subscribers} />
        </section>
      </div>
    </>
  );
}
