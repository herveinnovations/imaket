"use client";

import { useRouter } from "next/navigation";
import { startNavigation } from "@/components/ui/page-loader";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Switch, Textarea } from "@/components/ui/primitives";
import type { AppUser } from "@/lib/types";
import { siteHost } from "@/lib/utils";

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
  const [community, setCommunity] = useState({ public_profile: user.public_profile ?? true, bio: user.bio ?? "" });

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

      <form onSubmit={run("community", () => send("/api/account", { public_profile: community.public_profile, bio: community.bio.trim() || null }), "Community settings saved")} className="card space-y-4 p-6">
        <h2 className="font-sans text-base font-semibold tracking-normal">Community</h2>
        <Switch label="Show me in the member directory" checked={community.public_profile}
          description="Signed-in members can see your name, photo and bio on the Members page and follow you."
          onChange={(v) => setCommunity({ ...community, public_profile: v })} />
        <Textarea label="Short bio" name="bio" rows={2} maxLength={300} value={community.bio} onChange={(e) => setCommunity({ ...community, bio: e.target.value })} hint="Up to 300 characters" />
        <Button type="submit" variant="secondary" loading={busy === "community"}>Save community settings</Button>
      </form>

      {!isCreator && (
        <form id="sell" onSubmit={run("sell", async () => { await send("/api/creator/become", { handle }, "POST"); startNavigation(); router.push("/creator"); }, "Your store is ready")}
          className="card scroll-mt-24 space-y-4 border-black bg-lime p-6">
          <h2 className="font-sans text-base font-semibold tracking-normal">Start selling</h2>
          <p className="text-sm text-muted">Open a store on this account. It&apos;s free; you pay 5% only when you sell.</p>
          <div className="flex items-center border border-black bg-white">
            <span className="pl-3.5 text-[15px] text-muted">{siteHost()}/</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="yourname" aria-label="Store link" className="h-11 min-w-0 flex-1 bg-transparent pr-3 outline-none" />
          </div>
          <Button type="submit" loading={busy === "sell"} disabled={handle.length < 3}>Open my store</Button>
        </form>
      )}
    </div>
  );
}
