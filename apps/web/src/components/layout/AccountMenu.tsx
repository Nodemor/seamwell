"use client";

import { LayoutDashboard, LogOut, MapPin, Package, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const itemClass =
  "flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-xl px-3 text-sm text-ink outline-none transition-colors data-[highlighted]:bg-linen sm:min-h-10 [&_svg]:size-4 [&_svg]:text-brass";

/** Navbar account control: a sign-in link for guests, a menu (orders, addresses, security, sign out) when signed in. */
export function AccountMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (!user) {
    const next = pathname && pathname !== "/" && pathname !== "/login" ? `?next=${encodeURIComponent(pathname)}` : "";
    return (
      <Link
        href={`/login${next}`}
        aria-label="Sign in"
        className="hidden size-11 place-items-center rounded-full text-ink/80 transition-colors hover:bg-linen hover:text-ink sm:grid"
      >
        <User className="h-[18px] w-[18px]" />
      </Link>
    );
  }

  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Account menu for ${user.name}`}
        className="relative hidden size-11 place-items-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-brass/35 sm:grid"
      >
        <span className="grid size-8 place-items-center rounded-full bg-midnight text-[0.7rem] font-semibold tracking-wide text-ivory">{initials || "Me"}</span>
        {!user.emailVerified && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full border-2 border-ivory bg-brass" aria-hidden />}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[60] w-64 rounded-2xl border border-line bg-paper p-2 shadow-[0_24px_60px_-24px_rgb(31_42_68/.45)]"
        >
          <div className="px-3 pb-2 pt-1.5">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-stone">{user.email}</p>
            {!user.emailVerified && <p className="mt-1 text-xs text-brass-ink">Email not confirmed yet</p>}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href="/account?tab=orders"><Package aria-hidden /> Orders</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href="/account?tab=addresses"><MapPin aria-hidden /> Addresses</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href="/account?tab=security"><ShieldCheck aria-hidden /> Security</Link>
          </DropdownMenu.Item>
          {user.role === "admin" && user.adminPath && (
            <DropdownMenu.Item asChild className={itemClass}>
              <Link href={`/${user.adminPath}`}><LayoutDashboard aria-hidden /> Shop admin</Link>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            className={itemClass}
            onSelect={async () => {
              const inAdmin = !!user.adminPath && pathname.startsWith(`/${user.adminPath}`);
              await signOut();
              toast.success("You're signed out");
              if (pathname.startsWith("/account") || inAdmin) router.replace("/");
            }}
          >
            <LogOut aria-hidden /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
