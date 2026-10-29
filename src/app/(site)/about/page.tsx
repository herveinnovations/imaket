import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { getSiteContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "About Us" };

export default async function AboutPage() {
  const c = await getSiteContent();
  return (
    <div className="bg-white">
      <section className="grid md:grid-cols-2">
        <div className="flex flex-col justify-center bg-lime px-6 py-16 md:px-10">
          <h1 className="text-[2.6rem] sm:text-[3.4rem]">About iMaket</h1>
          <p className="mt-5 max-w-xl text-[19px] leading-[1.45]">
            iMaket is a marketplace for independent creators. Clothing labels, illustrators, educators, event organisers and makers
            each run their own store, and shoppers buy from all of them in one place, paying with mobile money, card or PayPal.
          </p>
        </div>
        <div className="grid bg-surface-2 px-6 py-16 md:px-10">
          <ul className="space-y-8 self-center">
            {[
              ["For shoppers", "New drops every week, one checkout across stores, secure downloads and easy returns."],
              ["For creators", "Your own store link, payouts to mobile money or bank, discount codes, affiliates and sales analytics. No monthly fee."],
              ["For the community", "Groups to share what you're making and Members to follow the stores you love."],
            ].map(([h, b]) => (
              <li key={h}><h2 className="text-[1.6rem]">{h}</h2><p className="mt-1 text-[17px]">{b}</p></li>
            ))}
          </ul>
        </div>
      </section>
      <section className="px-6 py-16 text-center">
        <p className="text-[19px]">Based in {c.address || "Zambia"}.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/marketplace">Shop Now</ButtonLink>
          <ButtonLink href="/register?role=creator" variant="secondary">Sell on iMaket</ButtonLink>
        </div>
      </section>
    </div>
  );
}
