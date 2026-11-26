import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@seamwell/shared";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  const registerHref = next === "/account" ? "/register" : `/register?next=${encodeURIComponent(next)}`;
  return (
    <AuthShell
      eyebrow="Your account"
      title={<>Welcome <em>back</em></>}
      description="Sign in to see your orders, saved addresses and security settings."
      footer={
        <>
          New to Seamwell?{" "}
          <Link href={registerHref} className="font-medium text-midnight underline-offset-4 hover:underline">
            Create an account
          </Link>{" "}
          — or keep shopping as a guest; you can always track orders with your order number.
        </>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
