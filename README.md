# iMaket — African creator marketplace

Design follows the iMaket Wix site (Harmony streetwear template): lime `#D6FF38` header/footer, Arial Black headlines, square imagery, green pill buttons, Quick View, Men/Women/New, Groups and Members.

A full-stack marketplace where creators sell **digital downloads, online courses, services, event tickets, memberships and physical products** from their own storefront, and buyers pay with **mobile money (MTN, Airtel, Zamtel, M-Pesa…), cards or PayPal**.

**Stack:** Next.js 15 (App Router, React 19) · Tailwind CSS · Framer Motion · Supabase (Postgres, Auth, Storage, Realtime) · Recharts · Zod · Zustand
**Deploys to:** Vercel or Netlify.

---

## Quick start (demo mode, no setup)

```bash
npm install
npm run dev          # http://localhost:3000
```

With no Supabase keys, the app runs in **demo mode**: seeded creators and products from Lusaka, Lagos, Nairobi and Accra; every dashboard (creator, customer, admin) is viewable without login; checkout and uploads are simulated. Try the discount code `MONTHEND` at checkout.

## Going live (Supabase project "imaket")

iMaket runs on the **`imaket_*` tables** in your Supabase project. The schema includes imaket's extras too: QR ticket check-in, service bookings, shipping rates, shipment tracking, lesson progress and reports.

### 1. Database
**Already done for the live project:** all 28 tables, RLS policies, functions, triggers, storage buckets, seed categories/settings and realtime are installed.

For **another empty project**, paste `supabase/fresh-install/imaket_schema.sql` into the SQL Editor and Run, then run `supabase/migrations/20261029000001_imaket_storefront_community.sql` (no DROP statements in either).

**Storefront & community update (Oct 2026):** `20261029000001_imaket_storefront_community.sql` adds Men/Women collections, sitewide discount codes (TEES25, WELCOME10), newsletter sign-ups, Groups (posts, comments, private groups with join requests) and the Members directory with follows. It only adds things. Checks: `begin;` + the migration + `supabase/tests/community_checks.sql` + `rollback;` (32 results).

For a project that still has the **older imaket tables**, use the merge instead: `supabase/migrations/` holds imaket's original seven migrations plus `20261021000001_sokoni_merge_into_imaket.sql`. Dry run: `begin;` + the merge + `supabase/tests/merge_rehearsal.sql` + `rollback;` (ends with a **REHEARSAL RESULTS** error listing 40 checks; nothing is kept). The earlier standalone schema is in `supabase/legacy-standalone/` for reference only.

### 2. Environment
Copy `.env.example` to `.env.local` and fill in the project URL and publishable key (Project Settings → API Keys), plus the one secret:

```
SUPABASE_SERVICE_ROLE_KEY=   # Project Settings → API Keys → secret / service_role
```

Then `npm install && npm run dev`. Clearing the two `NEXT_PUBLIC_SUPABASE_*` lines switches back to demo mode.

**Auth settings:** Authentication → URL configuration: set the site URL to your domain and add `https://yourdomain.com/auth/callback` (and `http://localhost:3000/auth/callback`) as redirect URLs. Keep "Confirm email" on.

**Make yourself admin** after signing up:
```sql
update public.imaket_users set role = 'admin' where email = 'you@example.com';
```

**Uploads:** the free plan caps files at 50 MB, and the app enforces the same limit. On Pro, raise the global limit in Storage settings and set `NEXT_PUBLIC_MAX_UPLOAD_MB`.

### 3. Payment webhooks
Point each provider's webhook at:

| Provider | Webhook URL | Signature |
|---|---|---|
| Flutterwave | `/api/webhooks/flutterwave` | `verif-hash` header = `FLUTTERWAVE_WEBHOOK_HASH` |
| DusuPay | `/api/webhooks/dusupay` | `DUSUPAY_WEBHOOK_SECRET` (see note below) |
| Stripe | `/api/webhooks/stripe` | `STRIPE_WEBHOOK_SECRET`; events `checkout.session.*` |
| PayPal | `/api/webhooks/paypal` | `PAYPAL_WEBHOOK_ID`; event `PAYMENT.CAPTURE.COMPLETED` |
| Mobile money | `/api/webhooks/mobile_money` | routed to the aggregator in `MOBILE_MONEY_GATEWAY` |

Every webhook is signature-checked, then **re-verified with the provider's API**, then the amount and currency are compared with the stored order before anything is marked paid.

### 4. Deploy
- **Vercel:** import the repo, add env vars, deploy. `vercel.json` sets a Cape Town region and a daily cron (`/api/cron/cleanup`, protected by `CRON_SECRET`) that recovers missed webhooks and cancels stale pending orders.
- **Netlify:** `netlify.toml` uses `@netlify/plugin-nextjs`. Add a Scheduled Function that calls `/api/cron/cleanup` with the `Authorization: Bearer $CRON_SECRET` header.

---

## How money moves

```
Buyer clicks Pay
  └─ POST /api/checkout
       • reloads products from DB, re-prices server-side (src/lib/pricing.ts)
       • applies coupon (scoped to its creator) + affiliate cookie
       • creates order + order_items + payment rows (service role)
       • starts provider checkout → redirect URL or "approve on your phone"
Provider confirms
  ├─ webhook  /api/webhooks/[provider]   (signature → API re-verify)
  └─ redirect /api/payments/callback     (API re-verify)
        └─ finalizePaidOrder()  amount/currency check
             └─ SQL imaket_finalize_order()  (idempotent, row-locked)
                  • order → paid, payment → succeeded
                  • download entitlements created
                  • inventory decremented, sales counted
                  • coupon / affiliate counters updated
                  • creator + buyer notified (Realtime)
             └─ receipt + "new sale" emails
```

Each order item stores `platform_fee`, `affiliate_fee` and `creator_earnings` at the moment of sale. The `imaket_creator_balances` view derives **available** (cleared after `payout_hold_days`), **pending** and **paid out** balances; payouts are requested via `/api/payouts` (balance-checked) and processed by admins.

## Security model
- **RLS on every table.** Browsers can only read what they own or what is public. Orders, payments, entitlements and payouts are written only by server code using the service role.
- **Triggers guard sensitive columns:** users can't change their own role or ban status; creators can't self-publish (moderation), set `featured`, edit sales/rating counters, verify themselves, or change money columns on order items.
- **Self-signup can never create an admin** (`handle_new_user` ignores `role: admin`).
- **Secure downloads:** files live in a private bucket. `/api/downloads/[id]` checks ownership, expiry and download limit, then returns a 60-second signed URL.
- **Uploads** go browser → Storage with a signed upload URL scoped to the creator's folder (enforced again by storage policies).
- Zod validation on every API body; rate limiting on auth, checkout and downloads; no account enumeration on password reset.

The merged schema was tested on an exact local copy of imaket (Postgres 16 + PostgREST): 40 database checks (moderation, role escalation, idempotent `imaket_finalize_order`, balances, ratings, tamper attempts, RLS and column visibility, account deletion), plus a 46-step browser run of the app covering signup, product upload, moderation, search, checkout, secure download, reviews, wishlist, affiliates, payouts and access control.

## Project structure

```
supabase/
  migrations/               imaket base (7) + marketplace merge
  tests/merge_rehearsal.sql 40 security & behaviour checks (run inside a rolled-back transaction)
  legacy-standalone/        original standalone schema (early prototype) (reference)
src/
  middleware.ts             session refresh, role-gated routes, ?ref= affiliate cookie
  app/
    (site)/                 public storefront (header + footer)
      page.tsx              landing
      marketplace/          search, filters, sort, pagination, skeletons
      p/[slug]/             product page, reviews, JSON-LD
      [handle]/             creator storefront  (imaket.africa/yourname)
      [handle]/affiliate/   join a creator's affiliate programme
      checkout/             checkout · pending (MoMo approval) · success
    (auth)/                 login · register · forgot/reset password · verify email + server actions
    auth/callback/          email-link code exchange
    dashboard/              customer: overview, library, orders, wishlist, settings
    creator/                creator studio: overview, products, orders, customers, analytics,
                            discount codes, affiliates, payouts, storefront, settings
    admin/                  overview, moderation, creators, users, transactions, payouts,
                            analytics, platform settings
    api/                    REST endpoints (see below)
  components/
    ui/                     Button, Badge, Input, Select, Switch, Modal, Table, Skeleton, EmptyState
    layout/                 header, footer, cart drawer, mobile nav, theme toggle, logo
    product/                cards, generated covers, purchase panel, filters, reviews, wishlist
    checkout/               checkout form, pending payment poller
    dashboard/              shell + sidebar, notifications (Realtime), charts, product upload
                            modal, file uploads, tables, storefront editor, payouts
    admin/                  moderation queue, admin tables, platform settings
    marketing/              hero sale stream
  lib/
    supabase/               browser · server · service-role · middleware clients
    payments/               provider adapters: stripe, paypal, flutterwave, dusupay, mobile-money
    data/                   catalog + dashboard queries (with demo-mode fallback)
    pricing.ts              pure cart pricing (unit-tested)
    orders.ts               create order + checkout, finalise paid orders
    auth.ts                 getSession / requireRole / requireCreator
    email.ts                Resend + HTML templates
    validation.ts           Zod schemas
  store/                    cart + wishlist (Zustand, persisted)
tests/pricing.test.ts       npm test
```

### REST API

| Method | Route | Who |
|---|---|---|
| GET | `/api/products` | public catalogue (filters, sort, paging) |
| POST | `/api/products` | creator: create |
| GET · PATCH · DELETE | `/api/products/:id` | owner / admin (delete archives if sold) |
| POST | `/api/uploads` | signed upload URL |
| POST | `/api/checkout/quote` | server-priced totals |
| POST | `/api/checkout` | create order + start payment |
| GET | `/api/payments/callback` | provider redirect |
| POST | `/api/webhooks/:provider` | provider webhooks |
| GET | `/api/orders/:id/status` | MoMo approval polling |
| PATCH | `/api/orders/items/:id` | creator: mark shipped |
| GET | `/api/downloads/:id?file=` | buyer: signed download URL |
| POST | `/api/reviews` | verified buyers |
| POST · DELETE | `/api/wishlist` | signed-in users |
| GET · POST, PATCH · DELETE | `/api/coupons`, `/api/coupons/:id` | creator |
| POST, PATCH | `/api/affiliates`, `/api/affiliates/:id` | join / creator manage |
| GET · POST | `/api/payouts` | creator |
| PATCH | `/api/creator/profile` | storefront + payout method |
| POST | `/api/creator/become` | customer opens a store |
| PATCH | `/api/account` | profile, email, password |
| GET · PATCH | `/api/notifications` | list / mark all read |
| POST | `/api/analytics` | views & add-to-cart events |
| POST | `/api/admin/products/:id/moderate` | admin |
| PATCH | `/api/admin/creators/:id`, `/users/:id`, `/payouts/:id`, `/settings` | admin |
| GET | `/api/cron/cleanup` | cron (Bearer `CRON_SECRET`) |

## Before launch — things to confirm
- **DusuPay:** the adapter follows their v1 collections API, but confirm field names, provider codes (`mtn_zm`, `airtel_zm` …) and the webhook signature scheme against your merchant docs. Some accounts use RSA signatures instead of HMAC; adjust `parseWebhook` in `src/lib/payments/dusupay.ts`.
- **PayPal** doesn't settle ZMW/NGN/KES; it only appears for USD/EUR/GBP stores.
- **Course player:** curriculum (modules, lessons, free previews) is stored and shown; the lesson video upload UI and in-browser player are the next piece to build (lessons already have `video_path` and RLS for buyers).
- **Multi-currency admin totals** add amounts across currencies as-is. Add an FX table before relying on platform-wide GMV.
- **Rate limiting** is in-memory per server instance; swap in Upstash/Vercel KV for multi-region.
- Auth emails (verification, reset) are sent by Supabase; brand them under Authentication → Email Templates. Transactional email uses Resend when `RESEND_API_KEY` is set.

## Scripts
```bash
npm run dev        # development
npm run build      # production build
npm start          # serve the build
npm run typecheck  # tsc --noEmit
npm test           # pricing engine tests
npm run db:types   # generate Supabase types (CLI)
```
