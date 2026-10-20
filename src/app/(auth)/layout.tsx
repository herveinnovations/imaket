import { Logo } from "@/components/layout/logo";
import { DemoBanner } from "@/components/layout/demo-banner";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoBanner />
      <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
        <div className="flex flex-col px-6 py-8 sm:px-12">
          <Logo />
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</div>
        </div>
        <aside className="relative hidden overflow-hidden bg-brand text-brand-fg lg:flex lg:flex-col lg:justify-end lg:p-12" aria-hidden>
          <svg className="absolute inset-0 h-full w-full opacity-[0.12]">
            <defs><pattern id="auth-p" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M0 17h34M17 0v34" stroke="currentColor" strokeWidth="1" /></pattern></defs>
            <rect width="100%" height="100%" fill="url(#auth-p)" />
          </svg>
          <div className="relative">
            <p className="font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight">
              “I shared my link on WhatsApp status on Friday. By Monday I&apos;d sold 41 planners, all paid on MoMo.”
            </p>
            <p className="mt-6 text-brand-fg/80">Mutale Banda, sells budgeting tools from Lusaka</p>
          </div>
        </aside>
      </div>
    </>
  );
}
