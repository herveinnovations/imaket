import Link from "next/link";
import { Logo, LogoMark } from "@/components/layout/logo";
import { DemoBanner } from "@/components/layout/demo-banner";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoBanner />
      <div className="grid min-h-dvh bg-white lg:grid-cols-[1fr_minmax(0,560px)]">
        <div className="flex flex-col px-6 py-6 sm:px-12">
          <div className="flex items-center justify-between">
            <Logo />
            <Link href="/" className="text-[15px] hover:underline">‹ Back to shop</Link>
          </div>
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</div>
        </div>
        <aside className="relative hidden flex-col items-center justify-center gap-8 bg-lime p-12 text-center text-black lg:flex" aria-hidden>
          <LogoMark size="lg" className="scale-150" />
          <p className="mt-6 max-w-[14ch] font-display text-[2.6rem] leading-[1.05] tracking-[-0.05em]">Shop independent creators.</p>
          <p className="max-w-xs text-[17px]">New drops, one checkout, and a community of makers. Or open your own store in minutes.</p>
        </aside>
      </div>
    </>
  );
}
