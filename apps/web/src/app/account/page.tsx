import type { Metadata } from "next";
import { AccountView } from "@/components/account/AccountView";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return <AccountView initialTab={str(sp.tab)} notice={str(sp.notice)} />;
}
