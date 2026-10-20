import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JoinAffiliate } from "@/components/product/join-affiliate";
import { getCreatorByHandle } from "@/lib/data/catalog";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Become an affiliate" };

export default async function AffiliateJoinPage({ params }: { params: Promise<{ handle: string }> }) {
  const creator = await getCreatorByHandle((await params).handle);
  if (!creator) notFound();
  const session = await getSession();
  return (
    <div className="container max-w-xl py-20">
      <h1 className="text-4xl font-bold">Promote {creator.store_name} and earn</h1>
      <p className="mt-4 text-lg text-muted">
        Get a personal link. When someone buys within 30 days of clicking it, you earn a commission on that sale, paid out alongside your iMaket balance.
      </p>
      <div className="mt-8"><JoinAffiliate creatorId={creator.id} handle={creator.handle} signedIn={!!session} /></div>
    </div>
  );
}
