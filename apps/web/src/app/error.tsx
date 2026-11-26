"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Any page that fails to render: a calm branded message, try again, or go home. No error details are shown. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error); // shows in the browser console only; the server logs its own copy
  }, [error]);
  return (
    <div className="container-sw max-w-xl py-24 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-3 text-[clamp(2.4rem,5vw,3.4rem)] leading-tight">A stitch came loose.</h1>
      <p className="mt-4 text-stone">This page didn&apos;t load properly. Please try again — if it keeps happening, message us and we&apos;ll help.</p>
      {error.digest && <p className="mt-2 text-xs text-stone">Reference: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}><RotateCcw aria-hidden /> Try again</Button>
        <Button asChild variant="secondary"><Link href="/">Back to home</Link></Button>
      </div>
    </div>
  );
}
