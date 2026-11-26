import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmail } from "@/components/auth/RecoveryForms";

// no-referrer: the one-time token in this URL must never leak to another site through the Referer header.
export const metadata: Metadata = { title: "Confirm your email", robots: { index: false }, referrer: "no-referrer" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = (await searchParams).token;
  return (
    <AuthShell eyebrow="Confirm email" title={<>One last <em>stitch</em></>}>
      <VerifyEmail token={typeof token === "string" ? token.slice(0, 200) : ""} />
    </AuthShell>
  );
}
