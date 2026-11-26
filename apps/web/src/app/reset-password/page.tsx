import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/RecoveryForms";

// no-referrer: the one-time token in this URL must never leak to another site through the Referer header.
export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = (await searchParams).token;
  return (
    <AuthShell eyebrow="Reset password" title={<>Choose a <em>new</em> password</>} description="Once it's saved you'll be signed out everywhere, then you can sign in with the new one.">
      <ResetPasswordForm token={typeof token === "string" ? token.slice(0, 200) : ""} />
    </AuthShell>
  );
}
