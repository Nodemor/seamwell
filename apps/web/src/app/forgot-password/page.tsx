import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/RecoveryForms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const email = (await searchParams).email;
  return (
    <AuthShell
      eyebrow="Forgot password"
      title={<>Let&apos;s get you <em>back in</em></>}
      description="Enter the email you signed up with and we'll send you a link to choose a new password."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-midnight underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm initialEmail={typeof email === "string" ? email.slice(0, 254) : ""} />
    </AuthShell>
  );
}
