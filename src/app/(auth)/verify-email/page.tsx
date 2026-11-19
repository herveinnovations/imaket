import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string; demo?: string }> }) {
  const { email, demo } = await searchParams;
  return (
    <div className="text-center">
      <MailCheck className="mx-auto h-14 w-14 text-brand" strokeWidth={1.5} />
      <h1 className="mt-6 text-[2.4rem]">Check your inbox</h1>
      <p className="mt-3 text-muted">
        We sent a confirmation link to {email ? <strong className="text-fg">{email}</strong> : "your email"}.
        Open it on this device to activate your account. The link expires in 24 hours.
      </p>
      <p className="mt-4 text-sm text-muted">Nothing there? Check spam or promotions.</p>
      {demo && <ButtonLink href="/creator" className="mt-8">Continue to the demo dashboard</ButtonLink>}
    </div>
  );
}
