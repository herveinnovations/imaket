import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/widgets";
import { OrdersTable } from "@/components/dashboard/orders-table";
import { requireCreator } from "@/lib/auth";
import { getCreatorOrders } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Orders" };

export default async function CreatorOrdersPage() {
  const { creator } = await requireCreator("/creator/orders");
  const orders = await getCreatorOrders(creator.id, 200);
  return (
    <>
      <PageHeader title="Orders" description="New orders appear here in real time. Physical items need to be marked as shipped." />
      <OrdersTable orders={orders} creatorId={creator.id} />
    </>
  );
}
