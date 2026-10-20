import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-4xl font-bold">Reset your password</h1>
      <p className="mb-8 mt-2 text-muted">Enter your account email and we&apos;ll send a link to choose a new password.</p>
      <ForgotForm />
      <p className="mt-8 text-center text-sm text-muted"><Link href="/login" className="font-medium text-brand hover:underline">Back to log in</Link></p>
    </>
  );
}
