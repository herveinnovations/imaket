import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  return (
    <>
      <h1 className="text-[2.4rem]">{role === "creator" ? "Open your store" : "Create an account"}</h1>
      <p className="mb-8 mt-2 text-muted">Free to start. You only pay 5% when you make a sale.</p>
      <RegisterForm defaultRole={role === "customer" ? "customer" : "creator"} />
      <p className="mt-8 text-center text-sm text-muted">Already have an account? <Link href="/login" className="underline underline-offset-4">Log in</Link></p>
    </>
  );
}
