import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <h1 className="text-5xl font-bold">This page isn&apos;t here</h1>
      <p className="max-w-md text-muted">The link may be mistyped, or the store or product has been removed.</p>
      <div className="flex gap-3">
        <ButtonLink href="/marketplace">Browse the marketplace</ButtonLink>
        <ButtonLink href="/" variant="secondary">Go home</ButtonLink>
      </div>
    </div>
  );
}
