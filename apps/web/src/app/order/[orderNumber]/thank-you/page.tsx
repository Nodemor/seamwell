import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThankYou } from "./ThankYou";

export const metadata: Metadata = { title: "Thank you", robots: { index: false, follow: false } };

export default async function ThankYouPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const n = orderNumber.toUpperCase();
  if (!/^SW-[A-Z0-9]{6,10}$/.test(n)) notFound();
  return <ThankYou orderNumber={n} />;
}
