/**
 * Demo dataset used when Supabase is not configured, so every page renders
 * out of the box. Deterministic (seeded PRNG) to avoid hydration mismatches.
 */
import type {
  Affiliate, AppUser, Category, Coupon, Creator, DailyPoint, Download, Notification,
  Order, Payout, Product, Review,
} from "./types";

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const NOW = new Date("2026-10-16T12:00:00Z").getTime();
const daysAgo = (d: number, h = 0) => new Date(NOW - d * 86400000 - h * 3600000).toISOString();

export const DEMO_CATEGORIES: Category[] = [
  ["ebooks", "E-books & guides", "BookOpen"],
  ["courses", "Online courses", "GraduationCap"],
  ["templates", "Templates & presets", "LayoutTemplate"],
  ["music", "Music & audio", "Music"],
  ["design", "Design assets", "Palette"],
  ["coaching", "Coaching & services", "Handshake"],
  ["events", "Events & tickets", "Ticket"],
  ["fashion", "Fashion & merch", "Shirt"],
  ["business", "Business & finance", "Briefcase"],
].map(([slug, name, icon], i) => ({ id: `cat-${slug}`, slug, name, icon, sort_order: i }));

const c = (
  id: string, handle: string, store_name: string, tagline: string, bio: string,
  country: string, currency: string, brand_color: string, verified: boolean, socials: Creator["socials"],
): Creator => ({
  id, user_id: `u-${id}`, handle, store_name, tagline, bio, avatar_url: null, banner_url: null,
  brand_color, socials, country, currency, status: "active", verified, featured_product_ids: [],
  created_at: daysAgo(400 - id.length * 20),
});

export const DEMO_CREATORS: Creator[] = [
  c("cr-mutale", "mutale", "Mutale Banda", "Money habits for young Zambians",
    "Chartered accountant turned educator. I help first-jobbers in Lusaka build budgets that survive month-end, and invest their first K1,000 with confidence.",
    "ZM", "ZMW", "#0B7A56", true, { instagram: "mutale.money", x: "mutalebanda", youtube: "MutaleMoney", whatsapp: "+260970000000" }),
  c("cr-adaeze", "adaeze", "Adaeze Studio", "Brushes, type & brand kits from Lagos",
    "Illustrator and brand designer. Everything in the shop is what I use on client work — tested on real Procreate canvases and real deadlines.",
    "NG", "NGN", "#7A3FD1", true, { instagram: "adaeze.studio", website: "https://adaeze.studio" }),
  c("cr-wanjiru", "wanjiru", "Wanjiru Kamau Photo", "Golden-hour presets for East African light",
    "Nairobi-based portrait photographer. My presets are built for deep skin tones and harsh equatorial sun.",
    "KE", "KES", "#C2410C", false, { instagram: "wanjiru.shoots", tiktok: "wanjiruphoto" }),
  c("cr-kofi", "kofimakes", "Kofi Makes Beats", "Drum kits & loops — Amapiano, Afrobeats, Highlife",
    "Producer from Accra with placements on Ghanaian radio. Royalty-free kits, every sound mixed and tagged.",
    "GH", "GHS", "#1D4ED8", true, { instagram: "kofimakes", youtube: "KofiMakesBeats" }),
  c("cr-thandi", "thandiwellness", "Thandi Wellness", "Coaching for burnt-out professionals",
    "Certified wellness coach. 1:1 sessions on WhatsApp video, plus self-paced guides for when you can't book a call.",
    "ZM", "ZMW", "#BE185D", false, { instagram: "thandi.wellness", whatsapp: "+260960000000" }),
  c("cr-mwila", "mwilathreads", "Mwila Threads", "Chitenge pieces, made in Kitwe",
    "Small-batch clothing and accessories in bold chitenge prints. Every piece is cut and sewn in our Kitwe workshop.",
    "ZM", "ZMW", "#B45309", false, { instagram: "mwilathreads", whatsapp: "+260950000000" }),
  c("cr-zedcreatives", "zedcreatives", "Zed Creatives Collective", "Events for Zambia's creative economy",
    "We run meetups, workshops and the annual Copperbelt Creatives Summit.",
    "ZM", "ZMW", "#0F766E", true, { instagram: "zedcreatives", website: "https://zedcreatives.org" }),
];

type Seed = Partial<Product> & Pick<Product, "id" | "creator_id" | "title" | "type" | "price" | "currency" | "category_id">;

const P = (s: Seed, i: number): Product => {
  const r = rng(i + 7);
  const creator = DEMO_CREATORS.find((x) => x.id === s.creator_id)!;
  const cat = DEMO_CATEGORIES.find((x) => x.id === s.category_id) ?? null;
  return {
    status: "published",
    slug: s.id.replace(/^p-/, ""),
    summary: null,
    description: null,
    compare_at_price: null,
    pay_what_you_want: false,
    min_price: null,
    cover_url: null,
    gallery: [],
    tags: [],
    featured: false,
    track_inventory: false,
    inventory_qty: null,
    requires_shipping: false,
    shipping_fee: 0,
    event_starts_at: null,
    event_venue: null,
    service_duration_minutes: null,
    download_limit: 5,
    affiliate_enabled: true,
    affiliate_commission_percent: 15,
    rating_avg: Math.round((4.2 + r() * 0.8) * 10) / 10,
    rating_count: Math.floor(8 + r() * 140),
    sales_count: Math.floor(30 + r() * 900),
    view_count: Math.floor(800 + r() * 9000),
    rejection_reason: null,
    published_at: daysAgo(20 + i * 9),
    created_at: daysAgo(25 + i * 9),
    ...s,
    creator: { id: creator.id, handle: creator.handle, store_name: creator.store_name, avatar_url: null, verified: creator.verified },
    category: cat ? { id: cat.id, slug: cat.slug, name: cat.name } : null,
  };
};

export const DEMO_PRODUCTS: Product[] = ([
  {
    id: "p-lusaka-budget-planner", creator_id: "cr-mutale", category_id: "cat-business", type: "digital",
    title: "The Lusaka Budget Planner", price: 150, compare_at_price: 220, currency: "ZMW", featured: true,
    summary: "A spreadsheet + printable workbook that plans around ZESCO tokens, minibus fares and month-end.",
    description: "Built for salaried Zambians earning K4,000–K25,000.\n\n**What's inside**\n- Google Sheets & Excel budget with automatic NAPSA/PAYE estimates\n- 12-month printable workbook (A4 PDF)\n- Emergency-fund and chilimba tracker\n- 40-minute walkthrough video\n\nInstant download after payment. Lifetime updates.",
    tags: ["budget", "spreadsheet", "personal finance"],
  },
  {
    id: "p-kwacha-investing-101", creator_id: "cr-mutale", category_id: "cat-courses", type: "course",
    title: "Kwacha Investing 101", price: 650, currency: "ZMW", featured: true,
    summary: "Treasury bills, LuSE stocks and unit trusts explained in six evenings.",
    description: "A self-paced course for first-time investors. 6 modules, 31 lessons, worksheets and a private WhatsApp community for Q&A.",
    tags: ["investing", "course", "LuSE"],
    modules: [
      { id: "m1", title: "Before you invest", sort_order: 0, lessons: [
        { id: "l1", title: "Why your savings account is losing money", duration_seconds: 540, is_preview: true },
        { id: "l2", title: "Your emergency fund first", duration_seconds: 720, is_preview: false },
      ] },
      { id: "m2", title: "Government securities", sort_order: 1, lessons: [
        { id: "l3", title: "How T-bills work at Bank of Zambia auctions", duration_seconds: 960, is_preview: false },
        { id: "l4", title: "Bonds vs bills: picking tenors", duration_seconds: 840, is_preview: false },
      ] },
      { id: "m3", title: "The Lusaka Securities Exchange", sort_order: 2, lessons: [
        { id: "l5", title: "Opening a CSD account", duration_seconds: 600, is_preview: false },
        { id: "l6", title: "Reading a company's annual report", duration_seconds: 1320, is_preview: false },
      ] },
    ],
  },
  {
    id: "p-afro-brush-pack", creator_id: "cr-adaeze", category_id: "cat-design", type: "digital",
    title: "Afro Texture Brush Pack for Procreate", price: 8500, compare_at_price: 12000, currency: "NGN", featured: true,
    summary: "64 brushes for coils, braids, kente weaves and adire patterns.",
    description: "Every brush is pressure-tuned for Apple Pencil. Includes 6 sample canvases and a quick-start PDF.",
    tags: ["procreate", "brushes", "illustration"],
  },
  {
    id: "p-brand-identity-kit", creator_id: "cr-adaeze", category_id: "cat-templates", type: "digital",
    title: "Small Business Brand Identity Kit", price: 15000, currency: "NGN",
    summary: "Logo templates, colour systems and 40 Canva social posts — editable in an afternoon.",
    tags: ["canva", "branding", "templates"],
  },
  {
    id: "p-golden-hour-presets", creator_id: "cr-wanjiru", category_id: "cat-templates", type: "digital",
    title: "Golden Hour Lightroom Presets", price: 1500, currency: "KES", featured: true,
    summary: "12 mobile + desktop presets tuned for melanin-rich skin in strong sun.",
    tags: ["lightroom", "presets", "photography"],
  },
  {
    id: "p-portrait-masterclass", creator_id: "cr-wanjiru", category_id: "cat-courses", type: "course",
    title: "Phone Portrait Masterclass", price: 4500, currency: "KES",
    summary: "Shoot magazine-quality portraits with the phone you already own.",
    tags: ["photography", "course", "mobile"],
  },
  {
    id: "p-amapiano-drum-kit", creator_id: "cr-kofi", category_id: "cat-music", type: "digital",
    title: "Log Drum Essentials — Amapiano Kit", price: 180, currency: "GHS", featured: true,
    summary: "180 one-shots, 45 loops and 12 log-drum presets. Royalty free.",
    tags: ["amapiano", "drum kit", "samples"],
  },
  {
    id: "p-beat-lease", creator_id: "cr-kofi", category_id: "cat-music", type: "service",
    title: "Custom Afrobeats Beat (Exclusive)", price: 1200, currency: "GHS", service_duration_minutes: null,
    summary: "A beat produced for your voice, with two revision rounds and stems.",
    tags: ["afrobeats", "custom beat"],
  },
  {
    id: "p-coaching-session", creator_id: "cr-thandi", category_id: "cat-coaching", type: "service",
    title: "1:1 Burnout Recovery Session", price: 900, currency: "ZMW", service_duration_minutes: 60,
    summary: "A 60-minute WhatsApp video call with a written plan sent afterwards.",
    tags: ["coaching", "wellness"],
  },
  {
    id: "p-21-day-reset", creator_id: "cr-thandi", category_id: "cat-ebooks", type: "digital",
    title: "The 21-Day Reset Journal", price: 120, currency: "ZMW", pay_what_you_want: true, min_price: 60,
    summary: "Daily prompts and habit trackers to rebuild energy, one small step at a time.",
    tags: ["journal", "ebook", "habits"],
  },
  {
    id: "p-chitenge-tote", creator_id: "cr-mwila", category_id: "cat-fashion", type: "physical", audience: "unisex",
    title: "Chitenge Weekender Tote", price: 480, currency: "ZMW", requires_shipping: true, shipping_fee: 60,
    track_inventory: true, inventory_qty: 14, featured: true,
    summary: "Lined canvas tote with a chitenge outer and leather handles. Fits a 15\" laptop.",
    tags: ["chitenge", "bag", "handmade"],
  },
  {
    id: "p-chitenge-bomber", creator_id: "cr-mwila", category_id: "cat-fashion", type: "physical", audience: "men",
    title: "Kitwe Bomber Jacket", price: 1250, currency: "ZMW", requires_shipping: true, shipping_fee: 60,
    track_inventory: true, inventory_qty: 3,
    summary: "Reversible bomber: black twill on one side, chitenge on the other.",
    tags: ["chitenge", "jacket"],
  },
  {
    id: "p-copperbelt-summit", creator_id: "cr-zedcreatives", category_id: "cat-events", type: "ticket",
    title: "Copperbelt Creatives Summit 2026", price: 350, currency: "ZMW", featured: true,
    event_starts_at: "2026-11-21T08:00:00+02:00", event_venue: "Edinburgh Hotel, Kitwe",
    track_inventory: true, inventory_qty: 86,
    summary: "A day of talks and workshops on getting paid for creative work in Zambia.",
    tags: ["event", "kitwe", "conference"],
  },
] as Seed[]).map(P);

DEMO_CREATORS.forEach((cr) => {
  const mine = DEMO_PRODUCTS.filter((p) => p.creator_id === cr.id);
  cr.product_count = mine.length;
  cr.sales_count = mine.reduce((a, p) => a + p.sales_count, 0);
  cr.featured_product_ids = mine.filter((p) => p.featured).map((p) => p.id);
});

const REVIEWERS = ["Chipo M.", "Bwalya K.", "Tunde A.", "Akosua B.", "Njeri W.", "Lindiwe S.", "Emeka O.", "Natasha C."];
const REVIEW_TEXT = [
  ["Worth every ngwee", "Finally a budget that understands how money actually moves here. Set it up in one evening."],
  ["Exactly as described", "Download arrived instantly after I paid with Airtel Money. Very clear instructions."],
  ["Changed how I work", "I use this every single week now. The creator also answered my question within an hour."],
  ["Great quality", "Well organised files and nothing felt like filler. Would buy from this store again."],
  ["Solid, a few gaps", "Mostly excellent. I'd love a version for freelancers with irregular income."],
];

export function demoReviews(productId: string): Review[] {
  const r = rng(productId.length * 31);
  return Array.from({ length: 4 }, (_, i) => {
    const [title, body] = REVIEW_TEXT[(i + productId.length) % REVIEW_TEXT.length];
    return {
      id: `${productId}-r${i}`, product_id: productId, customer_id: `cust-${i}`,
      rating: i === 3 ? 4 : 5, title, body, creator_reply: i === 0 ? "Thank you — this made my week!" : null,
      created_at: daysAgo(Math.floor(2 + r() * 60)),
      author: { full_name: REVIEWERS[Math.floor(r() * REVIEWERS.length)], avatar_url: null },
    };
  });
}

/** Creator analytics series for the last N days */
export function demoDailySeries(days = 30, seed = 3, scale = 1): DailyPoint[] {
  const r = rng(seed);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(NOW - (days - 1 - i) * 86400000);
    const weekend = [0, 6].includes(d.getUTCDay());
    const trend = 1 + i / days;
    const orders = Math.max(0, Math.round((4 + r() * 7) * trend * (weekend ? 0.7 : 1) * scale));
    return { day: d.toISOString().slice(0, 10), orders, revenue: Math.round(orders * (130 + r() * 160)) };
  });
}

const BUYERS = [
  ["Chipo Mwansa", "chipo@example.com"], ["Bwalya Kunda", "bwalya@example.com"],
  ["Natasha Chanda", "natasha@example.com"], ["Lindiwe Sakala", "lindiwe@example.com"],
  ["Mapalo Zulu", "mapalo@example.com"], ["Kondwani Tembo", "kondwani@example.com"],
  ["Musonda Lungu", "musonda@example.com"], ["Joseph Mulenga", "joseph@example.com"],
];
const PROVIDERS = ["mobile_money", "mobile_money", "flutterwave", "dusupay", "stripe", "mobile_money"] as const;

/** Orders for one creator's products (creator dashboard) */
export function demoCreatorOrders(creatorId = "cr-mutale", n = 14): Order[] {
  const r = rng(11);
  const mine = DEMO_PRODUCTS.filter((p) => p.creator_id === creatorId);
  return Array.from({ length: n }, (_, i) => {
    const p = mine[Math.floor(r() * mine.length)];
    const [name, email] = BUYERS[i % BUYERS.length];
    const status = i === 2 ? "pending" : i === 9 ? "refunded" : "paid";
    const fee = Math.round(p.price * 0.05 * 100) / 100;
    return {
      id: `ord-${i}`, order_number: `SK-${100240 - i}`, customer_id: `cust-${i}`, customer_email: email, customer_name: name,
      status, currency: p.currency, subtotal: p.price, discount_total: 0, shipping_total: p.shipping_fee, total: p.price + p.shipping_fee,
      payment_provider: PROVIDERS[i % PROVIDERS.length], created_at: daysAgo(Math.floor(i / 2), i * 3), paid_at: status === "paid" ? daysAgo(Math.floor(i / 2), i * 3) : null,
      items: [{
        id: `oi-${i}`, order_id: `ord-${i}`, product_id: p.id, creator_id: creatorId, title: p.title, product_type: p.type,
        unit_price: p.price, quantity: 1, line_total: p.price, platform_fee: fee, creator_earnings: p.price - fee,
        fulfillment_status: p.type === "physical" ? (i % 3 ? "shipped" : "unfulfilled") : "delivered",
      }],
    };
  });
}

/** Platform-wide orders (admin) */
export function demoAllOrders(n = 20): Order[] {
  const r = rng(29);
  return Array.from({ length: n }, (_, i) => {
    const p = DEMO_PRODUCTS[Math.floor(r() * DEMO_PRODUCTS.length)];
    const [name, email] = BUYERS[(i + 3) % BUYERS.length];
    const status = i === 4 ? "failed" : i === 7 ? "pending" : "paid";
    const fee = Math.round(p.price * 0.05 * 100) / 100;
    return {
      id: `aord-${i}`, order_number: `SK-${100400 - i}`, customer_id: null, customer_email: email, customer_name: name,
      status, currency: p.currency, subtotal: p.price, discount_total: 0, shipping_total: 0, total: p.price,
      payment_provider: PROVIDERS[(i + 2) % PROVIDERS.length], created_at: daysAgo(0, i * 2), paid_at: null,
      items: [{
        id: `aoi-${i}`, order_id: `aord-${i}`, product_id: p.id, creator_id: p.creator_id, title: p.title, product_type: p.type,
        unit_price: p.price, quantity: 1, line_total: p.price, platform_fee: fee, creator_earnings: p.price - fee, fulfillment_status: "delivered",
      }],
    };
  });
}

export const DEMO_USER: AppUser = {
  id: "demo-user", email: "demo@imaket.africa", full_name: "Mutale Banda", avatar_url: null,
  role: "creator", country: "ZM", created_at: daysAgo(400),
};

export const DEMO_CUSTOMER_ORDERS: Order[] = [
  ["p-lusaka-budget-planner", 1], ["p-afro-brush-pack", 6], ["p-copperbelt-summit", 12], ["p-chitenge-tote", 20],
].map(([pid, d], i) => {
  const p = DEMO_PRODUCTS.find((x) => x.id === pid)!;
  return {
    id: `my-${i}`, order_number: `SK-${100180 + i}`, customer_id: "demo-user", customer_email: DEMO_USER.email, customer_name: DEMO_USER.full_name,
    status: p.type === "physical" ? "fulfilled" : "paid", currency: p.currency, subtotal: p.price, discount_total: 0,
    shipping_total: p.shipping_fee, total: p.price + p.shipping_fee, payment_provider: "mobile_money",
    created_at: daysAgo(d as number), paid_at: daysAgo(d as number),
    items: [{ id: `myi-${i}`, order_id: `my-${i}`, product_id: p.id, creator_id: p.creator_id, title: p.title, product_type: p.type,
      unit_price: p.price, quantity: 1, line_total: p.price, platform_fee: 0, creator_earnings: 0,
      fulfillment_status: p.type === "physical" ? "shipped" : "delivered" }],
  };
});

export const DEMO_DOWNLOADS: Download[] = DEMO_CUSTOMER_ORDERS
  .filter((o) => o.items![0].product_type !== "physical")
  .map((o, i) => {
    const p = DEMO_PRODUCTS.find((x) => x.id === o.items![0].product_id)!;
    const cr = DEMO_CREATORS.find((x) => x.id === p.creator_id)!;
    return {
      id: `dl-${i}`, product_id: p.id, order_item_id: o.items![0].id, download_count: i, max_downloads: p.download_limit,
      expires_at: null, created_at: o.created_at,
      product: {
        id: p.id, title: p.title, slug: p.slug, cover_url: null, type: p.type,
        creator: { store_name: cr.store_name, handle: cr.handle },
        files: p.type === "ticket"
          ? [{ id: `f-${i}`, file_name: "ticket-SK-100182.pdf", size_bytes: 184_320 }]
          : [{ id: `f-${i}a`, file_name: `${p.slug}.zip`, size_bytes: 48_234_496 }, { id: `f-${i}b`, file_name: "README.pdf", size_bytes: 512_000 }],
      },
    };
  });

export const DEMO_COUPONS: Coupon[] = [
  { id: "cp1", creator_id: "cr-mutale", code: "MONTHEND", type: "percent", value: 20, min_order: 0, max_uses: 100, used_count: 41, starts_at: null, ends_at: daysAgo(-14), active: true },
  { id: "cp2", creator_id: "cr-mutale", code: "UNZA50", type: "fixed", value: 50, min_order: 150, max_uses: null, used_count: 112, starts_at: null, ends_at: null, active: true },
  { id: "cp3", creator_id: "cr-mutale", code: "LAUNCH", type: "percent", value: 35, min_order: 0, max_uses: 50, used_count: 50, starts_at: null, ends_at: daysAgo(30), active: false },
  // sitewide codes (creator_id null), as on the iMaket Wix site
  { id: "pc1", creator_id: null, code: "TEES25", type: "percent", value: 25, min_order: 0, max_uses: null, used_count: 0, starts_at: null, ends_at: null, active: true },
  { id: "pc2", creator_id: null, code: "WELCOME10", type: "percent", value: 10, min_order: 0, max_uses: null, used_count: 0, starts_at: null, ends_at: null, active: true },
];

export const DEMO_PAYOUTS: Payout[] = [
  { id: "po1", creator_id: "cr-mutale", amount: 4200, currency: "ZMW", method: "MTN MoMo ••• 4521", status: "processing", reference: null, requested_at: daysAgo(1), processed_at: null },
  { id: "po2", creator_id: "cr-mutale", amount: 6850, currency: "ZMW", method: "MTN MoMo ••• 4521", status: "paid", reference: "MP261002.1432.C81", requested_at: daysAgo(15), processed_at: daysAgo(14) },
  { id: "po3", creator_id: "cr-mutale", amount: 3100, currency: "ZMW", method: "Zanaco ••• 0098", status: "paid", reference: "ZN-88231", requested_at: daysAgo(31), processed_at: daysAgo(29) },
];

export const DEMO_AFFILIATES: Affiliate[] = [
  { id: "af1", code: "CHIPO", commission_percent: 15, clicks: 1840, conversions: 62, earnings: 1395, status: "active", name: "Chipo Mwansa", email: "chipo@example.com" },
  { id: "af2", code: "ZEDFINANCE", commission_percent: 20, clicks: 3120, conversions: 88, earnings: 2640, status: "active", name: "Zed Finance Podcast", email: "podcast@example.com" },
  { id: "af3", code: "BWALYA", commission_percent: 15, clicks: 220, conversions: 4, earnings: 90, status: "paused", name: "Bwalya Kunda", email: "bwalya@example.com" },
];

export const DEMO_NOTIFICATIONS: Notification[] = [
  { id: "n1", type: "order.paid", title: "New sale", body: "The Lusaka Budget Planner — K142.50 via MTN MoMo", link: "/creator/orders", read_at: null, created_at: daysAgo(0, 1) },
  { id: "n2", type: "review.new", title: "New 5-star review", body: "Chipo M. reviewed Kwacha Investing 101", link: "/creator/products", read_at: null, created_at: daysAgo(0, 5) },
  { id: "n3", type: "payout.processing", title: "Payout on its way", body: "K4,200 to MTN MoMo ••• 4521", link: "/creator/payouts", read_at: daysAgo(1), created_at: daysAgo(1) },
  { id: "n4", type: "product.published", title: "Product approved", body: "Kwacha Investing 101 is now live.", link: "/creator/products", read_at: daysAgo(3), created_at: daysAgo(3) },
];

export const DEMO_USERS: (AppUser & { orders: number })[] = [
  ...DEMO_CREATORS.map((cr, i) => ({ id: cr.user_id, email: `${cr.handle}@example.com`, full_name: cr.store_name, avatar_url: null, role: "creator" as const, country: cr.country, created_at: cr.created_at, orders: i })),
  ...BUYERS.map(([name, email], i) => ({ id: `cust-${i}`, email, full_name: name, avatar_url: null, role: "customer" as const, country: "ZM", created_at: daysAgo(10 + i * 13), orders: 1 + (i % 4) })),
  { id: "admin-1", email: "ops@imaket.africa", full_name: "iMaket Ops", avatar_url: null, role: "admin", country: "ZM", created_at: daysAgo(500), orders: 0 },
];

export const DEMO_PENDING_PRODUCTS: Product[] = [
  P({ id: "p-ndola-wedding-planner", creator_id: "cr-thandi", category_id: "cat-templates", type: "digital", title: "Ndola Wedding Budget & Planner", price: 200, currency: "ZMW", summary: "Vendor checklists, kitchen-party planning and a budget sheet." }, 40),
  P({ id: "p-zambian-sign-language", creator_id: "cr-zedcreatives", category_id: "cat-courses", type: "course", title: "Zambian Sign Language Basics", price: 400, currency: "ZMW", summary: "A beginner course in 20 short video lessons." }, 41),
  P({ id: "p-ankara-pattern-pack", creator_id: "cr-adaeze", category_id: "cat-design", type: "digital", title: "Ankara Seamless Pattern Pack", price: 6000, currency: "NGN", summary: "48 seamless vector patterns, commercial licence." }, 42),
].map((p) => ({ ...p, status: "pending_review" as const, published_at: null }));
