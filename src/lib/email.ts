import "server-only";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/utils";

/**
 * Transactional email via Resend's REST API. Without RESEND_API_KEY the
 * message is logged instead (useful in development).
 * Auth emails (verify, reset) are sent by Supabase Auth — customise them in
 * Supabase → Authentication → Email Templates.
 */
export async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email:dev] to=${to} subject="${subject}"`);
    return { id: "dev", skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? `${env.appName} <onboarding@resend.dev>`, to, subject, html }),
  });
  if (!res.ok) console.error("[email] send failed", res.status, await res.text());
  return res.ok ? await res.json() : null;
}

const shell = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#F3F5F2;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#161A33">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table width="100%" style="max-width:520px;background:#fff;border-radius:16px;padding:28px" cellpadding="0" cellspacing="0">
<tr><td style="font-size:20px;font-weight:700;color:#0B7A56;padding-bottom:20px">${env.appName}</td></tr>
<tr><td><h1 style="font-size:22px;margin:0 0 12px">${title}</h1>${body}</td></tr>
<tr><td style="padding-top:28px;font-size:12px;color:#6B7280">You received this because of activity on ${env.appName}.</td></tr>
</table></td></tr></table></body></html>`;

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#0B7A56;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${label}</a>`;

export const emails = {
  orderReceipt(o: { orderNumber: string; total: number; currency: string; items: { title: string; line_total: number }[]; accessUrl: string }) {
    const rows = o.items.map((i) => `<tr><td style="padding:6px 0">${i.title}</td><td align="right">${formatMoney(i.line_total, o.currency)}</td></tr>`).join("");
    return {
      subject: `Your order ${o.orderNumber} is confirmed`,
      html: shell("Thanks for your purchase", `<p>Your payment went through. Downloads and access links are ready.</p>
        <table width="100%" style="font-size:14px;border-top:1px solid #eee;margin:16px 0">${rows}
        <tr><td style="padding-top:10px;font-weight:700">Total</td><td align="right" style="font-weight:700">${formatMoney(o.total, o.currency)}</td></tr></table>
        ${button(o.accessUrl, "Open your purchases")}`),
    };
  },
  creatorSale(s: { title: string; earnings: number; currency: string; buyer: string }) {
    return {
      subject: `New sale: ${s.title}`,
      html: shell("You made a sale", `<p><strong>${s.buyer}</strong> bought <strong>${s.title}</strong>.</p>
        <p style="font-size:28px;font-weight:700;color:#0B7A56;margin:12px 0">+${formatMoney(s.earnings, s.currency)}</p>
        ${button(`${env.appUrl}/creator/orders`, "View order")}`),
    };
  },
  payoutUpdate(p: { amount: number; currency: string; status: string; reference?: string | null }) {
    return {
      subject: `Payout ${p.status}: ${formatMoney(p.amount, p.currency)}`,
      html: shell(`Payout ${p.status}`, `<p>Your payout of <strong>${formatMoney(p.amount, p.currency)}</strong> is now <strong>${p.status}</strong>.</p>
        ${p.reference ? `<p>Reference: ${p.reference}</p>` : ""}${button(`${env.appUrl}/creator/payouts`, "View payouts")}`),
    };
  },
  productModerated(p: { title: string; approved: boolean; reason?: string | null }) {
    return {
      subject: p.approved ? `${p.title} is live` : `${p.title} needs changes`,
      html: shell(p.approved ? "Your product is live" : "Your product needs changes",
        p.approved ? `<p><strong>${p.title}</strong> passed review and is now visible in the marketplace.</p>`
          : `<p><strong>${p.title}</strong> wasn't approved yet.</p><p style="background:#FFF7E6;padding:12px;border-radius:8px">${p.reason ?? ""}</p>`)
        + button(`${env.appUrl}/creator/products`, "Open products"),
    };
  },
};
