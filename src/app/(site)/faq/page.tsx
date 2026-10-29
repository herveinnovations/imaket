import type { Metadata } from "next";
import { FAQ } from "@/lib/policies";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl bg-white px-5 pb-24 pt-12">
      <h1 className="text-[2.4rem] sm:text-[3rem]">FAQ</h1>
      <div className="mt-10 border-t border-black">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group border-b border-black py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[19px] [&::-webkit-details-marker]:hidden">
              {q}
              <span className="text-2xl leading-none group-open:rotate-45 transition-transform" aria-hidden>+</span>
            </summary>
            <p className="mt-3 text-[17px] leading-[1.55]">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
