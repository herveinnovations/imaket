import type { Metadata } from "next";
import { PendingPayment } from "@/components/checkout/pending-payment";

export const metadata: Metadata = { title: "Approve payment", robots: { index: false } };

export default async function PendingPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return <PendingPayment orderId={order ?? ""} />;
}
