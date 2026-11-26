import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@seamwell/shared";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNextPath((await searchParams).next);
  const loginHref = next === "/account" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
  return (
    <AuthShell
      eyebrow="Create account"
      title={<>Your <em>fitting room</em>, saved</>}
      description="Optional — guests can buy and track orders too. An account keeps your orders, addresses and try-on looks in one place."
      footer={
        <>
          Already have an account?{" "}
          <Link href={loginHref} className="font-medium text-midnight underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm next={next} />
    </AuthShell>
  );
}
