import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="text-[2.4rem]">Log In</h1>
      <p className="mb-8 mt-2 text-muted">Log in to your store or your purchases.</p>
      <LoginForm next={sp.next} error={sp.error} />
      <p className="mt-8 text-center text-sm text-muted">New to iMaket? <Link href="/register" className="underline underline-offset-4">Create an account</Link></p>
    </>
  );
}
