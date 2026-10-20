"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/primitives";
import { ThemeSelect } from "@/components/layout/theme-toggle";
import type { AppUser } from "@/lib/types";

const COUNTRIES = [["ZM", "Zambia"], ["NG", "Nigeria"], ["KE", "Kenya"], ["GH", "Ghana"], ["UG", "Uganda"], ["TZ", "Tanzania"], ["RW", "Rwanda"], ["ZA", "South Africa"], ["MW", "Malawi"], ["ZW", "Zimbabwe"], ["BW", "Botswana"], ["US", "United States"], ["GB", "United Kingdom"]];

async function send(url: string, body: unknown, method = "PATCH") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
  return json;
}

export function AccountSettings({ user, isCreator }: { user: AppUser; isCreator: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const run = (key: string, fn: () => Promise<unknown>, msg: string) => async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(key);
    try { await fn(); toast.success(msg); router.refresh(); } catch (err) { toast.error((err as Error).message); } finally { setBusy(null); }
  };

  const [profile, setProfile] = useState({ full_name: user.full_name ?? "", phone: user.phone ?? "", country: user.country ?? "ZM" });
  const [email, setEmail] = useState(user.email);
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [handle, setHandle] = useState("");

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={run("profile", () => send("/api/account", profile), "Profile saved")} className="card space-y-4 p-6">
        <h2 className="font-sans text-base font-semibold tracking-normal">Profile</h2>
        <Input label="Full name" name="full_name" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Phone" name="phone" type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          <Select label="Country" name="country" value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })}>
            {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </Select>
        </div>
        <Button type="submit" variant="secondary" loading={busy === "profile"}>Save profile</Button>
      </form>

      <form onSubmit={run("email", () => send("/api/account", { email }), "Check both inboxes to confirm the change")} className="card space-y-4 p-6">
        <h2 className="font-sans text-base font-semibold tracking-normal">Email</h2>
        <Input label="Email address" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} hint="We'll send a confirmation link to the old and new address." />
        <Button type="submit" variant="secondary" loading={busy === "email"} disabled={email === user.email}>Change email</Button>
      </form>

      <form onSubmit={run("pw", async () => {
        if (pw.password.length < 8 || !/\d/.test(pw.password)) throw new Error("Use at least 8 characters, including a number.");
        if (pw.password !== pw.confirm) throw new Error("The two passwords don't match.");
        await send("/api/account", { password: pw.password });
        setPw({ password: "", confirm: "" });
      }, "Password updated")} className="card space-y-4 p-6">
        <h2 className="font-sans text-base font-semibold tracking-normal">Password</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="New password" name="password" type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
          <Input label="Confirm" name="confirm" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        </div>
        <Button type="submit" variant="secondary" loading={busy === "pw"}>Update password</Button>
      </form>

      <section className="card space-y-3 p-6">
        <h2 className="font-sans text-base font-semibold tracking-normal">Appearance</h2>
        <ThemeSelect />
      </section>

      {!isCreator && (
        <form id="sell" onSubmit={run("sell", async () => { await send("/api/creator/become", { handle }, "POST"); router.push("/creator"); }, "Your store is ready")}
          className="card scroll-mt-24 space-y-4 border-brand/40 bg-brand-soft/30 p-6">
          <h2 className="font-sans text-base font-semibold tracking-normal">Start selling</h2>
          <p className="text-sm text-muted">Open a store on this account. It&apos;s free; you pay 5% only when you sell.</p>
          <div className="flex items-center rounded-xl border bg-surface focus-within:border-brand">
            <span className="pl-3.5 text-[15px] text-muted">imaket.africa/</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="yourname" aria-label="Store link" className="h-11 min-w-0 flex-1 bg-transparent pr-3 outline-none" />
          </div>
          <Button type="submit" loading={busy === "sell"} disabled={handle.length < 3}>Open my store</Button>
        </form>
      )}
    </div>
  );
}
