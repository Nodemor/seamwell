import type { Metadata } from "next";
import { TrackOrder } from "@/components/orders/TrackOrder";

export const metadata: Metadata = { title: "Track your order" };

export default async function TrackOrderPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return (
    <div className="container-sw max-w-3xl py-12">
      <p className="eyebrow">Order tracking</p>
      <h1 className="mt-3 text-[clamp(2.4rem,5vw,4rem)] leading-tight">Where&apos;s my order?</h1>
      <p className="mt-3 text-stone">Enter your order number (like SW-7K3F9Q) and the email you used at checkout.</p>
      <TrackOrder initialOrder={order && /^SW-[A-Z0-9]{6,10}$/i.test(order) ? order.toUpperCase() : ""} />
    </div>
  );
}
