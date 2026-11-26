import type { Metadata } from "next";
import { MyOrder } from "@/components/account/MyOrder";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  return <MyOrder orderNumber={orderNumber.toUpperCase().slice(0, 16)} />;
}
