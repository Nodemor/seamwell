"use client";

import { Menu, Search, ShoppingBag, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Logo } from "@/components/brand/Logo";
import { AccountMenu } from "@/components/layout/AccountMenu";

// The search dialog and the bag sheet are only loaded when first needed (most visits never open them), so their
// code isn't part of every page's first load. Hovering / focusing the button starts the download early.
const loadSearch = () => import("@/components/search/SearchDialog");
const loadBag = () => import("@/components/cart/BagSheet");
const SearchDialog = dynamic(() => loadSearch().then((m) => m.SearchDialog), { ssr: false });
const BagSheet = dynamic(() => loadBag().then((m) => m.BagSheet), { ssr: false });
import { TryOnButton } from "@/components/tryon/TryOnButton";
import { useAuth } from "@/lib/auth";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { cartCount, useCart } from "@/store/cart";

const LINKS = [
  { href: "/shop?gender=men", label: "Men" },
  { href: "/shop?gender=women", label: "Women" },
  { href: "/shop?category=suits", label: "Suits" },
  { href: "/track-order", label: "Track order" },
];

/** The bag count lives in localStorage — only show it after hydration to avoid a mismatch. */
const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

/** Below the `lg` breakpoint the bag opens as a slide-in sheet; on desktop it's the /cart page. */
const isCompactViewport = () => window.matchMedia("(max-width: 1023.98px)").matches;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  /** Mounted once first opened (then kept, so closing animates and reopening is instant). */
  const [searchUsed, setSearchUsed] = useState(false);
  const [bagUsed, setBagUsed] = useState(false);
  const searchReturn = useRef<HTMLElement | null>(null);
  /** Remember what had focus (the search button, or wherever "/" was pressed) so closing search returns there. */
  const openSearch = () => {
    searchReturn.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    setSearchOpen(true);
  };
  if (searchOpen && !searchUsed) setSearchUsed(true);
  if (bagOpen && !bagUsed) setBagUsed(true);
  const router = useRouter();
  const header = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const bagLink = useRef<HTMLAnchorElement>(null);
  const pathname = usePathname();
  const count = cartCount(useCart((s) => s.lines));
  const hydrated = useHydrated();
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on navigation (adjust state during render — no effect needed)
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
    setBagOpen(false);
  }

  // Keyboard: "/" or Ctrl/⌘+K opens search (ignored while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        setOpen(false);
        openSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // "View bag" in the add-to-bag toast → sheet on small screens, /cart on desktop.
  useEffect(() => {
    const onOpenBag = () => {
      if (isCompactViewport()) {
        setOpen(false);
        setBagOpen(true);
      } else router.push("/cart");
    };
    window.addEventListener("sw:open-bag", onOpenBag);
    return () => window.removeEventListener("sw:open-bag", onOpenBag);
  }, [router]);

  // Entrance animation
  useGSAP(
    () => {
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.from("[data-nav-item]", { y: -14, autoAlpha: 0, stagger: 0.06, duration: 0.7, delay: 0.15 });
      });
    },
    { scope: header },
  );

  // Mobile menu animation
  useGSAP(
    () => {
      if (!open) return;
      gsap.matchMedia().add(MOTION_OK, () => {
        gsap.from(panel.current, { yPercent: -6, autoAlpha: 0, duration: 0.45, ease: "power2.out" });
        gsap.from("[data-menu-item]", { y: 24, autoAlpha: 0, stagger: 0.07, duration: 0.6, delay: 0.1 });
      });
    },
    { dependencies: [open], scope: header },
  );

  return (
    <header
      ref={header}
      className={cn(
        "sticky top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500",
        scrolled ? "bg-ivory/85 shadow-[0_1px_0_var(--sw-line)] backdrop-blur-md" : "bg-transparent",
      )}
    >
      <nav className="container-sw flex h-[72px] items-center justify-between gap-4" aria-label="Main">
        <Link href="/" data-nav-item aria-label="Seamwell Tailoring home">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href} data-nav-item>
              <Link href={l.href} className="group relative py-2 text-[0.92rem] text-ink/80 transition-colors hover:text-ink">
                {l.label}
                <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-brass transition-transform duration-500 ease-[var(--ease-tailor)] group-hover:scale-x-100" />
              </Link>
            </li>
          ))}
          <li data-nav-item>
            <TryOnButton size="sm" label="Virtual Try-On" />
          </li>
        </ul>

        <div className="flex items-center gap-1 sm:gap-2" data-nav-item>
          <button
            type="button"
            aria-label="Search the shop"
            aria-haspopup="dialog"
            aria-keyshortcuts="/ Control+K"
            onPointerEnter={() => void loadSearch()}
            onFocus={() => void loadSearch()}
            onClick={() => {
              setOpen(false);
              openSearch();
            }}
            className="grid size-11 place-items-center rounded-full text-ink/80 transition-colors hover:bg-linen hover:text-ink"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <AccountMenu />
          <Link
            ref={bagLink}
            href="/cart"
            aria-label={`Shopping bag${hydrated && count ? `, ${count} items` : ""}`}
            aria-haspopup={hydrated ? "dialog" : undefined}
            onPointerEnter={() => void loadBag()}
            onFocus={() => void loadBag()}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || !isCompactViewport()) return;
              e.preventDefault();
              setOpen(false);
              setBagOpen(true);
            }}
            className="relative grid size-11 place-items-center rounded-full text-ink/80 transition-colors hover:bg-linen hover:text-ink">
            <ShoppingBag className="h-[18px] w-[18px]" />
            {hydrated && count > 0 && (
              <span className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brass px-1 text-[0.62rem] font-semibold text-ink">{count}</span>
            )}
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-linen lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div ref={panel} id="mobile-menu" className="fixed inset-x-0 top-[72px] h-[calc(100dvh-72px)] overflow-y-auto bg-ivory lg:hidden">
          <div className="container-sw flex flex-col gap-2 py-8">
            <div data-menu-item className="mb-4">
              <TryOnButton />
            </div>
            {[...LINKS, user ? { href: "/account", label: "Your account" } : { href: "/login", label: "Sign in" }].map((l) => (
              <Link key={l.href} href={l.href} data-menu-item className="border-b border-line py-4 font-display text-3xl text-ink">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      {searchUsed && <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} returnFocusRef={searchReturn} />}
      {bagUsed && <BagSheet open={bagOpen} onOpenChange={setBagOpen} returnFocusRef={bagLink} />}
    </header>
  );
}
