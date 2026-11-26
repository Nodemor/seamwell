import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { CursorDot } from "@/components/motion/CursorDot";
import { MotionProvider, motionBootScript } from "@/components/motion/MotionProvider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Seamwell Tailoring — Suits, shirts & trousers with Virtual Try-On", template: "%s · Seamwell Tailoring" },
  description: "Made-to-measure suits, blazers, shirts and trousers from our Colombo atelier. Try any outfit on yourself with free Virtual Try-On. Cash on delivery island-wide.",
  openGraph: { type: "website", siteName: "Seamwell Tailoring" },
};

export const viewport: Viewport = { themeColor: "#faf7f2", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonce from src/proxy.ts (reading it renders pages per request; API data stays cached).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pre-paint: hide elements that GSAP will reveal (only when motion is allowed). */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: motionBootScript }} />
      </head>
      <body className="min-h-svh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-midnight focus:px-4 focus:py-2 focus:text-ivory">
          Skip to content
        </a>
        <AuthProvider>
          <Navbar />
          <main id="main">{children}</main>
          <Footer />
        </AuthProvider>
        <MotionProvider />
        <CursorDot />
        <Toaster />
      </body>
    </html>
  );
}
