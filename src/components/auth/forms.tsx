"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, ShoppingBag, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { cn, siteHost } from "@/lib/utils";
import { requestPasswordReset, signIn, signUp, updatePassword, type AuthState } from "@/app/(auth)/actions";

function FormError({ state }: { state: AuthState }) {
  if (!state?.error && !state?.success) return null;
  return (
    <p role={state.error ? "alert" : "status"}
      className={cn("rounded-xl p-3 text-sm", state.error ? "bg-[rgb(var(--danger)/0.1)] text-danger" : "bg-brand-soft text-brand")}>
      {state.error ?? state.success}
    </p>
  );
}

function PasswordInput({ name = "password", label = "Password", autoComplete }: { name?: string; label?: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <div className="relative">
        <input id={name} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required minLength={8} className="input pr-11" />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted hover:text-fg" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function LoginForm({ next, error }: { next?: string; error?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  const initialError = error === "link_expired" ? "That link has expired. Log in or request a new one." : error === "suspended" ? "This account is suspended. Contact support." : undefined;
  return (
    <form action={action} className="space-y-5">
      <FormError state={state ?? (initialError ? { error: initialError } : undefined)} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Input label="Email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} />
      <PasswordInput autoComplete="current-password" />
      <div className="flex justify-end -mt-2"><Link href="/forgot-password" className="text-sm text-brand hover:underline">Forgot password?</Link></div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Log in</Button>
    </form>
  );
}

export function RegisterForm({ defaultRole }: { defaultRole: "creator" | "customer" }) {
  const [state, action, pending] = useActionState(signUp, undefined);
  const [role, setRole] = useState<"creator" | "customer">((state?.fields?.role as "creator") ?? defaultRole);
  const [handle, setHandle] = useState(state?.fields?.handle ?? "");
  return (
    <form action={action} className="space-y-5">
      <FormError state={state} />
      <fieldset>
        <legend className="label">I want to</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["creator", "Sell", Store], ["customer", "Buy", ShoppingBag]] as const).map(([r, label, I]) => (
            <label key={r} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border p-3.5 text-sm font-medium transition-colors",
              role === r ? "border-brand bg-brand-soft text-brand" : "bg-surface hover:border-fg/30")}>
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
              <I className="h-4 w-4" /> {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Input label="Full name" name="full_name" autoComplete="name" required defaultValue={state?.fields?.full_name} />
      <Input label="Email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} />
      {role === "creator" && (
        <div>
          <label htmlFor="handle" className="label">Store link</label>
          <div className="flex items-center rounded-xl border bg-surface focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
            <span className="pl-3.5 text-[15px] text-muted">{siteHost()}/</span>
            <input id="handle" name="handle" required value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              className="h-11 min-w-0 flex-1 bg-transparent pr-3 text-[15px] outline-none" placeholder="yourname" maxLength={32} />
          </div>
          <p className="mt-1.5 text-sm text-muted">You can change this later.</p>
        </div>
      )}
      <PasswordInput autoComplete="new-password" />
      <Button type="submit" size="lg" className="w-full" loading={pending}>{role === "creator" ? "Create my store" : "Create account"}</Button>
      <p className="text-center text-xs text-muted">By continuing you agree to the Terms and Privacy Policy.</p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="space-y-5">
      <FormError state={state} />
      <Input label="Email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>Send reset link</Button>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="space-y-5">
      <FormError state={state} />
      <PasswordInput label="New password" autoComplete="new-password" />
      <PasswordInput name="confirm" label="Confirm new password" autoComplete="new-password" />
      <Button type="submit" size="lg" className="w-full" loading={pending}>Save new password</Button>
    </form>
  );
}
