"use client";

import { CalendarClock, ClipboardList, LayoutDashboard, MessageSquareText, Package, ScrollText, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminGate } from "@/components/auth/AdminGate";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/products", label: "Products", icon: Package },
  { href: "/rentals", label: "Rentals", icon: CalendarClock },
  { href: "/reviews", label: "Reviews", icon: MessageSquareText },
  { href: "/audit", label: "Audit log", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * The admin area's base URL as the browser sees it: "/<secret ADMIN_PATH>" in production, "/admin" in dev.
 * Read from the current address, so the secret never has to be built into the JavaScript.
 */
export function useAdminBase() {
  const pathname = usePathname();
  return `/${pathname.split("/")[1] || "admin"}`;
}

/** Shop admin frame: role/MFA gate (UX only — the API enforces it) + a simple section nav. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const base = useAdminBase();
  const active = (href: string) => (href === "" ? pathname === base : pathname.startsWith(base + href));
  return (
    <AdminGate>
      <div className="border-b border-line bg-paper">
        <nav aria-label="Shop admin" className="container-sw flex items-center gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
          <span className="mr-3 hidden shrink-0 font-display text-xl text-midnight md:inline">Admin</span>
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={base + href}
              aria-current={active(href) ? "page" : undefined}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm transition-colors focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none sm:h-10",
                active(href) ? "bg-midnight text-ivory" : "text-stone hover:bg-linen hover:text-ink",
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="container-sw py-8 md:py-10">{children}</div>
    </AdminGate>
  );
}

export function AdminHeading({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[clamp(2rem,4vw,2.8rem)] leading-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone">{description}</p>}
      </div>
      {action}
    </div>
  );
}
