import { isDemoMode } from "@/lib/env";

export function DemoBanner() {
  if (!isDemoMode) return null;
  return (
    <div className="bg-black px-4 py-2 text-center text-xs text-lime">
      Demo mode: sample data, payments are simulated. Add your Supabase keys to <code className="font-mono">.env.local</code> to go live.
    </div>
  );
}
