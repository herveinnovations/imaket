import Link from "next/link";
import { LogoMark } from "./logo";
import { NewsletterLink } from "@/components/marketing/newsletter";
import { getSiteContent } from "@/lib/site-content";

const POLICIES: [string, string][] = [
  ["/policies/refund", "Refund Policy"],
  ["/policies/accessibility", "Accessibility Statement"],
  ["/policies/terms", "Terms & Conditions"],
  ["/policies/shipping", "Shipping Policy"],
  ["/policies/privacy", "Privacy Policy"],
];
const SHOP: [string, string][] = [
  ["/marketplace", "All Products"],
  ["/marketplace?audience=men", "Men"],
  ["/marketplace?audience=women", "Women"],
  ["/marketplace?new=1", "New"],
  ["/groups", "Groups"],
  ["/members", "Members"],
];

const link = "hover:underline hover:underline-offset-4";

export async function SiteFooter() {
  const c = await getSiteContent();
  const socials = ([["Facebook", c.facebook], ["Tiktok", c.tiktok], ["Instagram", c.instagram]] as const).filter(([, url]) => url);

  return (
    <footer className="bg-lime text-black">
      <div className="grid gap-x-6 gap-y-10 px-3 py-6 text-[17px] leading-[1.3] sm:grid-cols-3 sm:py-3 xl:text-[19px]">
        {/* column 1 */}
        <div className="flex min-h-full flex-col justify-between gap-10 sm:min-h-[520px]">
          <div className="space-y-0">
            {c.address && <p>{c.address}</p>}
            <div className="mt-[3.2em]">
              {c.phone && <p><a href={`tel:${c.phone.replace(/\s/g, "")}`} className={link}>{c.phone}</a></p>}
              {c.email && <p><a href={`mailto:${c.email}`} className={link}>{c.email}</a></p>}
            </div>
          </div>
          <ul className="space-y-0.5">
            {POLICIES.map(([href, label]) => <li key={href}><Link href={href} className={link}>{label}</Link></li>)}
          </ul>
        </div>

        {/* column 2 with the centred logo */}
        <div className="relative flex flex-col justify-between gap-10 sm:min-h-[520px]">
          <div>
            <p className="mb-2">Our Store</p>
            <ul className="space-y-0.5">
              <li><Link href="/about" className={link}>About Us</Link></li>
              <li><NewsletterLink className={link}>Subscribe</NewsletterLink></li>
              <li><Link href="/faq" className={link}>FAQ</Link></li>
              <li><Link href="/register?role=creator" className={link}>Sell on iMaket</Link></li>
            </ul>
          </div>
          <Link href="/" aria-label="iMaket home" className="self-start sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
            <LogoMark />
          </Link>
          <ul className="space-y-0.5">
            {socials.length
              ? socials.map(([label, url]) => <li key={label}><a href={url} target="_blank" rel="noopener noreferrer" className={link}>{label}</a></li>)
              : <li className="opacity-0" aria-hidden>.</li>}
          </ul>
        </div>

        {/* column 3 */}
        <div className="flex flex-col justify-between gap-10 sm:min-h-[520px]">
          <div>
            <p className="mb-2">Shop</p>
            <ul className="space-y-0.5 text-[16px] xl:text-[17px]">
              {SHOP.map(([href, label]) => <li key={href}><Link href={href} className={link}>{label}</Link></li>)}
            </ul>
          </div>
          <p className="max-w-[12rem]">© 2026 by iMaket. Powered and secured by <span className="underline underline-offset-2">HCA.</span></p>
        </div>
      </div>
    </footer>
  );
}
