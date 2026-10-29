import "server-only";
import { cache } from "react";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";

/** Editable storefront copy (Admin → Settings → Storefront). Defaults mirror the iMaket Wix site. */
export const siteContentSchema = z.object({
  hero_title: z.string().max(80),
  hero_text: z.string().max(240),
  hero_cta: z.string().max(30),
  sale_text: z.string().max(160),
  promo_title: z.string().max(40),
  promo_text: z.string().max(160),
  strip_text: z.string().max(80),
  newsletter_title: z.string().max(80),
  newsletter_text: z.string().max(160),
  newsletter_code: z.string().max(40),
  hero_images: z.array(z.string().url().max(1000)).max(3),
  promo_images: z.array(z.string().url().max(1000)).max(2),
  address: z.string().max(120),
  phone: z.string().max(40),
  email: z.string().max(120),
  facebook: z.string().max(300),
  tiktok: z.string().max(300),
  instagram: z.string().max(300),
});
export type SiteContent = z.infer<typeof siteContentSchema>;

export const DEFAULT_SITE_CONTENT: SiteContent = {
  hero_title: "The Latest in Streetwear Fashion",
  hero_text: "Clothing, prints and drops from independent creators, all in one marketplace.",
  hero_cta: "Shop Now",
  sale_text: "Sale is on! 25% off sitewide using TEES25 at checkout",
  promo_title: "25% OFF",
  promo_text: "25% off sitewide using TEES25 at checkout",
  strip_text: "Get 10% Off Your First Order",
  newsletter_title: "Get 10% Off Your First Order!",
  newsletter_text: "Sign up to our newsletter",
  newsletter_code: "WELCOME10",
  hero_images: [],
  promo_images: [],
  address: "Lusaka, Zambia",
  phone: "",
  email: "",
  facebook: "",
  tiktok: "",
  instagram: "",
};

export const getSiteContent = cache(async (): Promise<SiteContent> => {
  if (isDemoMode) return DEFAULT_SITE_CONTENT;
  try {
    const supabase = await getServerSupabase();
    const { data } = await supabase!.from("imaket_platform_settings").select("value").eq("key", "site_content").maybeSingle();
    const parsed = siteContentSchema.partial().safeParse(data?.value ?? {});
    return { ...DEFAULT_SITE_CONTENT, ...(parsed.success ? parsed.data : {}) };
  } catch {
    return DEFAULT_SITE_CONTENT;
  }
});
