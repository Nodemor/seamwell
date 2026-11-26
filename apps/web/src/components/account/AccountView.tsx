"use client";

import { LogOut, MailWarning, MapPin, Package, ShieldAlert, ShieldCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AddressesTab } from "@/components/account/AddressesTab";
import { OrdersTab } from "@/components/account/OrdersTab";
import { SecurityTab } from "@/components/account/SecurityTab";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const TABS = ["orders", "addresses", "security"] as const;
type Tab = (typeof TABS)[number];

export function AccountView({ initialTab, notice }: { initialTab: string; notice: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>((TABS as readonly string[]).includes(initialTab) ? (initialTab as Tab) : "orders");

  // Guests → sign in, then come back to the same tab.
  useEffect(() => {
    if (user === null) router.replace(`/login?next=${encodeURIComponent(`${pathname}?tab=${tab}`)}`);
  }, [user, router, pathname, tab]);

  // Admins must turn on two-factor before anything else.
  // (Kept in state, not just displayed, so the Security tab — and its one-time recovery codes — stays open
  // after MFA is switched on.)
  const adminNeedsMfa = user?.role === "admin" && !user.mfaEnabled;
  if (adminNeedsMfa && tab !== "security") setTab("security");
  const activeTab = tab;

  function changeTab(v: string) {
    const t = v as Tab;
    setTab(t);
    router.replace(`${pathname}?tab=${t}`, { scroll: false });
  }

  if (!user) {
    return (
      <div className="container-sw py-12 md:py-16" aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-12 w-72" />
        <Skeleton className="mt-10 h-11 w-80 rounded-full" />
        <Skeleton className="mt-8 h-48 w-full rounded-2xl" />
        <span className="sr-only">Loading your account…</span>
      </div>
    );
  }

  return (
    <div className="container-sw py-12 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="mt-3 text-[clamp(2.4rem,5vw,3.6rem)] leading-tight">
            Hello, <em>{user.name.split(" ")[0]}</em>
          </h1>
          <p className="mt-1 text-sm text-stone">{user.email}</p>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            await signOut();
            toast.success("You're signed out");
            router.replace("/");
          }}
        >
          <LogOut aria-hidden /> Sign out
        </Button>
      </div>

      {adminNeedsMfa && (
        <div role="alert" className="mt-8 flex items-start gap-3 rounded-2xl border border-wine/30 bg-wine/5 p-4 text-sm">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-wine" aria-hidden />
          <p>
            <strong className="font-medium">Admins must use two-factor authentication.</strong> Turn it on below to open the shop admin
            {notice === "admin-mfa" ? " — you were sent here because it's not on yet." : "."}
          </p>
        </div>
      )}
      {!user.emailVerified && <VerifyBanner />}

      <Tabs value={activeTab} onValueChange={changeTab} className="mt-10">
        <TabsList aria-label="Account sections">
          <TabsTrigger value="orders" disabled={adminNeedsMfa}>
            <Package aria-hidden /> Orders
          </TabsTrigger>
          <TabsTrigger value="addresses" disabled={adminNeedsMfa}>
            <MapPin aria-hidden /> Addresses
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldCheck aria-hidden /> Security
          </TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="mt-4">
          <OrdersTab emailVerified={user.emailVerified} />
        </TabsContent>
        <TabsContent value="addresses" className="mt-4">
          <AddressesTab />
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Shown until the email is confirmed: guest orders only join the account after that. */
function VerifyBanner() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brass/40 bg-brass/10 p-4 text-sm">
      <p className="flex items-start gap-3">
        <MailWarning className="mt-0.5 size-5 shrink-0 text-brass-ink" aria-hidden />
        <span>
          <strong className="font-medium">Please confirm your email.</strong> We sent you a link — once it&apos;s confirmed, orders you placed as a guest with this email appear here.
        </span>
      </p>
      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        disabled={sent}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api<{ alreadyVerified: boolean }>("/auth/email/resend", { method: "POST" });
            setSent(true);
            toast.success(r.alreadyVerified ? "Your email is already confirmed — refresh the page." : "Sent! Check your inbox for a new link.");
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Couldn't send the email. Try again in a moment.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <span aria-live="polite">{sent ? "Link sent" : "Resend link"}</span>
      </Button>
    </div>
  );
}
