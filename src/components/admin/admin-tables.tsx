"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BadgeCheck, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, StatusBadge, Table, THead } from "@/components/ui/primitives";
import { formatCompact, formatDate, formatMoney } from "@/lib/utils";
import type { AppUser, Creator, Payout } from "@/lib/types";

async function adminPatch(url: string, body: unknown) {
  const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Update failed");
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-4 max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input h-10 pl-9" aria-label={placeholder} />
    </div>
  );
}

export function CreatorsTable({ creators }: { creators: Creator[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const shown = useMemo(() => creators.filter((c) => !q || `${c.store_name} ${c.handle}`.toLowerCase().includes(q.toLowerCase())), [creators, q]);
  const act = async (c: Creator, body: Partial<Creator>, msg: string) => {
    try { await adminPatch(`/api/admin/creators/${c.id}`, body); toast.success(msg); router.refresh(); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <>
      <SearchBox value={q} onChange={setQ} placeholder="Search stores" />
      <Table>
        <THead cols={["Store", "Country", { label: "Products", className: "text-right" }, { label: "Sales", className: "text-right" }, "Joined", "Status", ""]} />
        <tbody className="divide-y">
          {shown.map((c) => (
            <tr key={c.id}>
              <td data-label="">
                <div className="flex items-center gap-3">
                  <Avatar name={c.store_name} src={c.avatar_url} color={c.brand_color} size={36} />
                  <div><Link href={`/${c.handle}`} target="_blank" className="flex items-center gap-1 font-medium hover:underline">{c.store_name}{c.verified && <BadgeCheck className="h-4 w-4 text-brand" />}</Link><p className="text-xs text-muted">/{c.handle}</p></div>
                </div>
              </td>
              <td data-label="Country">{c.country}</td>
              <td data-label="Products" className="text-right tabular-nums">{c.product_count ?? "—"}</td>
              <td data-label="Sales" className="text-right tabular-nums">{c.sales_count != null ? formatCompact(c.sales_count) : "—"}</td>
              <td data-label="Joined" className="text-muted">{formatDate(c.created_at)}</td>
              <td data-label="Status"><StatusBadge status={c.status} /></td>
              <td className="whitespace-nowrap text-right">
                <Button size="sm" variant="ghost" onClick={() => act(c, { verified: !c.verified }, c.verified ? "Verification removed" : "Store verified")}>{c.verified ? "Unverify" : "Verify"}</Button>
                <Button size="sm" variant="ghost" className={c.status === "suspended" ? "" : "text-danger"}
                  onClick={() => (c.status === "suspended" || confirm(`Suspend ${c.store_name}? Their store and products disappear from the marketplace.`)) &&
                    act(c, { status: c.status === "suspended" ? "active" : "suspended" }, c.status === "suspended" ? "Store reinstated" : "Store suspended")}>
                  {c.status === "suspended" ? "Reinstate" : "Suspend"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

export function UsersTable({ users }: { users: (AppUser & { orders?: number })[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const shown = users.filter((u) => (role === "all" || u.role === role) && (!q || `${u.full_name} ${u.email}`.toLowerCase().includes(q.toLowerCase())));
  const act = async (u: AppUser, body: Partial<AppUser>, msg: string) => {
    try { await adminPatch(`/api/admin/users/${u.id}`, body); toast.success(msg); router.refresh(); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search name or email" />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="input h-10 w-auto pr-8" aria-label="Filter by role">
          {["all", "customer", "creator", "admin"].map((r) => <option key={r} value={r}>{r === "all" ? "All roles" : r[0].toUpperCase() + r.slice(1) + "s"}</option>)}
        </select>
      </div>
      <Table>
        <THead cols={["User", "Role", "Country", "Joined", "Status", ""]} />
        <tbody className="divide-y">
          {shown.map((u) => (
            <tr key={u.id}>
              <td data-label=""><div className="flex items-center gap-3"><Avatar name={u.full_name ?? u.email} size={34} color="#5C637A" /><div><p className="font-medium">{u.full_name}</p><p className="text-xs text-muted">{u.email}</p></div></div></td>
              <td data-label="Role">
                <select defaultValue={u.role} onChange={(e) => act(u, { role: e.target.value as AppUser["role"] }, "Role updated")} className="input h-8 w-auto rounded-lg py-0 pr-8 text-sm" aria-label={`Role for ${u.email}`}>
                  <option value="customer">Customer</option><option value="creator">Creator</option><option value="admin">Admin</option>
                </select>
              </td>
              <td data-label="Country">{u.country}</td>
              <td data-label="Joined" className="text-muted">{formatDate(u.created_at)}</td>
              <td data-label="Status"><StatusBadge status={u.is_banned ? "suspended" : "active"} /></td>
              <td className="text-right">
                <Button size="sm" variant="ghost" className={u.is_banned ? "" : "text-danger"} onClick={() => act(u, { is_banned: !u.is_banned }, u.is_banned ? "Account restored" : "Account banned")}>
                  {u.is_banned ? "Unban" : "Ban"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

export function PayoutsQueue({ payouts }: { payouts: (Payout & { creator?: { store_name: string; handle: string } })[] }) {
  const router = useRouter();
  const act = async (p: Payout, status: Payout["status"]) => {
    const reference = status === "paid" ? prompt("Transfer reference (from the MoMo or bank transfer)") : null;
    if (status === "paid" && !reference) return;
    try { await adminPatch(`/api/admin/payouts/${p.id}`, { status, reference }); toast.success(`Payout marked ${status}`); router.refresh(); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Table>
      <THead cols={["Creator", "Requested", "Method", "Status", { label: "Amount", className: "text-right" }, ""]} />
      <tbody className="divide-y">
        {payouts.map((p) => (
          <tr key={p.id}>
            <td data-label="Creator" className="font-medium">{p.creator?.store_name}</td>
            <td data-label="Requested" className="text-muted">{formatDate(p.requested_at)}</td>
            <td data-label="Method">{p.method}</td>
            <td data-label="Status"><StatusBadge status={p.status} />{p.reference && <span className="ml-2 font-mono text-xs text-muted">{p.reference}</span>}</td>
            <td data-label="Amount" className="text-right font-semibold tabular-nums">{formatMoney(p.amount, p.currency)}</td>
            <td className="whitespace-nowrap text-right">
              {p.status === "requested" && <Button size="sm" variant="secondary" onClick={() => act(p, "processing")}>Start</Button>}
              {(p.status === "requested" || p.status === "processing") && <>
                <Button size="sm" className="ml-1" onClick={() => act(p, "paid")}>Mark paid</Button>
                <Button size="sm" variant="ghost" className="ml-1 text-danger" onClick={() => confirm("Reject this payout? The amount returns to the creator's balance.") && act(p, "rejected")}>Reject</Button>
              </>}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
