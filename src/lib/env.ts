export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "iMaket",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  defaultCurrency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "ZMW",
  platformFeePercent: Number(process.env.PLATFORM_FEE_PERCENT ?? 5),
};

/**
 * When Supabase isn't configured the app runs in DEMO MODE:
 * pages render seeded sample data, dashboards are viewable without login,
 * and mutating API routes return a simulated success.
 */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const isDemoMode = !isSupabaseConfigured;
