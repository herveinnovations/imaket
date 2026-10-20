import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-4xl font-bold">Choose a new password</h1>
      <p className="mb-8 mt-2 text-muted">At least 8 characters, including a number.</p>
      <ResetForm />
    </>
  );
}
