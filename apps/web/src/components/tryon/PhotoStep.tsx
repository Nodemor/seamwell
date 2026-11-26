"use client";

import { AlertTriangle, Camera, CheckCircle2, Info, Loader2, Trash2, Upload, UserRound } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { PhotoExamples, PoseGuide } from "@/components/tryon/PoseFigure";
import { Button } from "@/components/ui/button";
import type { PhotoCheckResult } from "@/lib/tryon/photo-check";
import { cn } from "@/lib/utils";

export type CheckState = PhotoCheckResult | "checking" | null;

type Props = {
  photoUrl: string | null;
  check: CheckState;
  useAnyway: boolean;
  error: string;
  onFile: (f: File) => void;
  onSample: () => void;
  onUseAnyway: () => void;
  onForget: () => void;
};

const ACCEPT = "image/jpeg,image/png,image/webp";

/** Step 1: upload / take a photo, the animated pose guide, examples and the in-browser photo check. */
export function PhotoStep({ photoUrl, check, useAnyway, error, onFile, onSample, onUseAnyway, onForget }: Props) {
  const upload = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const pick = (f: File | undefined) => f && onFile(f);
  const blocked = check && check !== "checking" && check.blocking.length > 0 && !useAnyway;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-12">
      <div>
        <div
          className={cn(
            "relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-[var(--radius-xl)] border-2 bg-paper transition-colors lg:max-w-none",
            dragging ? "border-brass bg-brass/5" : photoUrl ? "border-line" : "border-dashed border-line",
          )}
          onDragOver={(e) => (e.preventDefault(), setDragging(true))}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files[0]);
          }}
        >
          {photoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, never uploaded to our server */}
              <img src={photoUrl} alt="Your photo" className="h-full w-full object-contain" />
              {check === "checking" && (
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-midnight/80 py-3 text-sm text-ivory">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Checking your photo…
                </span>
              )}
            </>
          ) : (
            <button type="button" onClick={() => upload.current?.click()} className="group absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brass/40">
              <PoseGuide className="h-[58%] w-auto" />
              <span className="flex items-center gap-2 text-sm font-medium text-ink"><Upload className="size-4 text-brass" aria-hidden /> Choose a full-body photo</span>
              <span className="text-xs text-stone">or drop it here · JPG, PNG or WebP</span>
            </button>
          )}
        </div>

        <div className="mx-auto mt-4 flex max-w-sm flex-wrap justify-center gap-2 lg:max-w-none">
          <Button variant={photoUrl ? "secondary" : "primary"} onClick={() => upload.current?.click()}>
            <Upload aria-hidden /> {photoUrl ? "Choose another photo" : "Upload a photo"}
          </Button>
          <Button variant="secondary" className="hidden pointer-coarse:inline-flex" onClick={() => camera.current?.click()}>
            <Camera aria-hidden /> Take a photo
          </Button>
          {photoUrl && (
            <Button variant="ghost" onClick={onForget}>
              <Trash2 aria-hidden /> Forget my photo
            </Button>
          )}
        </div>
        {!photoUrl && (
          <p className="mt-2 text-center">
            <Button variant="link" size="sm" onClick={onSample}>
              <UserRound aria-hidden /> No photo handy? Use our sample model
            </Button>
          </p>
        )}
        <input ref={upload} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
        <input ref={camera} type="file" accept={ACCEPT} capture="user" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
      </div>

      <div>
        <div aria-live="polite">
          {error && (
            <p className="flex gap-2 rounded-2xl bg-wine/10 p-4 text-sm text-wine" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
            </p>
          )}
          {check && check !== "checking" && (
            <div className={cn("rounded-2xl p-4 text-sm", blocked ? "bg-wine/10" : check.blocking.length || check.tips.length ? "bg-brass/10" : "bg-sage/10")}>
              {blocked ? (
                <p className="flex items-center gap-2 font-medium text-wine"><AlertTriangle className="size-4" aria-hidden /> This photo won&apos;t work well</p>
              ) : check.blocking.length ? (
                <p className="flex items-center gap-2 font-medium"><Info className="size-4 text-brass-ink" aria-hidden /> Using this photo anyway — the result may look odd</p>
              ) : (
                <p className="flex items-center gap-2 font-medium text-sage"><CheckCircle2 className="size-4" aria-hidden /> Great photo — one person, face and hands visible</p>
              )}
              {(check.blocking.length > 0 || check.tips.length > 0) && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-ink/90">
                  {check.blocking.map((m) => <li key={m}>{m}</li>)}
                  {check.tips.map((m) => <li key={m} className="text-stone">{m}</li>)}
                </ul>
              )}
              {blocked && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => upload.current?.click()}>Upload another photo</Button>
                  <Button size="sm" variant="ghost" className="text-wine hover:bg-wine/10" onClick={onUseAnyway}>Use this photo anyway</Button>
                </div>
              )}
            </div>
          )}
        </div>

        <h3 className={cn("font-sans text-sm font-medium uppercase tracking-wider text-stone", (error || (check && check !== "checking")) && "mt-6")}>For the best result</h3>
        <ul className="mt-3 space-y-1.5 text-sm text-ink/90">
          <li>· Head to feet in the photo, face showing, facing the camera</li>
          <li>· Arms relaxed by your sides — hands visible</li>
          <li>· Only you in the photo, plain background, good light</li>
          <li>· Fitted clothes (baggy clothes can show through)</li>
        </ul>
        <PhotoExamples className="mt-5 max-w-md" />
        <p className="mt-6 max-w-md text-xs leading-relaxed text-stone">
          Your photo is checked on your own device and sent only to the free AI model (FASHN on Hugging Face) when you press &ldquo;Try it on&rdquo;. Seamwell never uploads or stores it — it&apos;s forgotten when you close this tab. <Link href="/privacy#try-on" className="underline underline-offset-4 hover:text-ink">Privacy</Link>
        </p>
      </div>
    </div>
  );
}
