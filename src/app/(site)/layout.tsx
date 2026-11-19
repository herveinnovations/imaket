import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DemoBanner } from "@/components/layout/demo-banner";
import { NewsletterPopup } from "@/components/marketing/newsletter";
import { getSiteContent } from "@/lib/site-content";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const c = await getSiteContent();
  return (
    <>
      <DemoBanner />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <NewsletterPopup title={c.newsletter_title} text={c.newsletter_text} />
    </>
  );
}
