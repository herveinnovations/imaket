import Link from "next/link";
import { Logo } from "./logo";

const COLS = [
  { title: "Buy", links: [["/marketplace", "Marketplace"], ["/marketplace?type=course", "Courses"], ["/marketplace?type=ticket", "Events"], ["/dashboard/downloads", "Your purchases"]] },
  { title: "Sell", links: [["/register?role=creator", "Open a store"], ["/#pricing", "Pricing"], ["/creator/affiliates", "Affiliates"], ["/creator/payouts", "Payouts"]] },
  { title: "Company", links: [["/#", "About"], ["/#", "Help centre"], ["/#", "Terms"], ["/#", "Privacy"]] },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-surface">
      <div className="container grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
            The storefront for African creators. Sell anything you make and get paid on mobile money, card or PayPal.
          </p>
          <p className="mt-4 text-sm text-muted">Made in Lusaka.</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h3 className="font-sans text-sm font-semibold tracking-normal">{c.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {c.links.map(([href, label]) => <li key={label}><Link href={href} className="hover:text-fg">{label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="container flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:justify-between">
          <span>© 2026 iMaket</span>
          <span>Payments by Flutterwave, DusuPay, Stripe and PayPal</span>
        </div>
      </div>
    </footer>
  );
}
