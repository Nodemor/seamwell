"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

/**
 * Client-side gate for the admin area (UX only — every admin API route is protected by requireAdmin on the server).
 * Guests → sign in. Admins without two-factor → Account → Security, with a message.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const needsMfa = user?.role === "admin" && !user.mfaEnabled;

  useEffect(() => {
    if (user === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (needsMfa) router.replace("/account?tab=security&notice=admin-mfa");
  }, [user, needsMfa, router, pathname]);

  if (!user || needsMfa) {
    return (
      <div className="container-sw max-w-2xl py-20" aria-busy="true">
        <Skeleton className="mx-auto h-12 w-64" />
        <span className="sr-only">Checking your access…</span>
      </div>
    );
  }
  if (user.role !== "admin") {
    return (
      <div className="container-sw max-w-xl py-20 text-center">
        <ShieldAlert className="mx-auto size-10 text-brass" aria-hidden />
        <h1 className="mt-4 text-4xl">Staff only</h1>
        <p className="mt-3 text-stone">This area is for the Seamwell team. Your orders and settings are in your account.</p>
        <Button asChild className="mt-8">
          <Link href="/account">Go to your account</Link>
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
