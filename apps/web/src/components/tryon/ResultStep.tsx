"use client";

import { AlertTriangle, Download, Info, RefreshCw, Share2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SizeGuideDialog } from "@/components/product/SizeGuideDialog";
import { CompareSlider } from "@/components/tryon/CompareSlider";
import { StitchLoader } from "@/components/tryon/StitchLoader";
import { Button } from "@/components/ui/button";
import { FREE_PASSES_PER_DAY, SECONDS_PER_PASS } from "@/lib/tryon/memory";
import { cn } from "@/lib/utils";

export type Mode = "volume" | "clean";
export type PassResult = { garment: string; blob: Blob; url: string };
export type RunState =
  | { kind: "idle" }
  | {
      kind: "running";
      mode: Mode;
      plan: string[];
      pass: number;
      phase: "connecting" | "queue" | "generating";
      position?: number;
      eta?: number;
      step?: number;
      steps?: number;
      passStartedAt: number;
      /** When the queue position last changed (to spot a queue that isn't moving). */
      queueMovedAt?: number;
      /** The Hugging Face Space handling this run. */
      space?: string;
    }
  | { kind: "done"; mode: Mode; passes: PassResult[]; error?: string }
  | { kind: "error"; mode: Mode; message: string };

type Props = {
  run: RunState;
  photoUrl: string;
  passesUsed: number;
  chartSlot: "jackets" | "shirts" | "trousers";
  onCancel: () => void;
  /** Only when more than one Space is configured. */
  onSwitchServer?: () => void;
  onRetry: (mode: Mode) => void;
  onChangeOutfit: () => void;
};

const STUCK_MS = 3 * 60_000;
const fileName = (b: Blob) => `seamwell-try-on.${b.type.includes("png") ? "png" : b.type.includes("webp") ? "webp" : "jpg"}`;

/** Step 3: progress per pass (stitching loader), then before/after, per-pass thumbnails, save / share / retry. */
export function ResultStep({ run, photoUrl, passesUsed, chartSlot, onCancel, onSwitchServer, onRetry, onChangeOutfit }: Props) {
  if (run.kind === "running") return <Progress run={run} onCancel={onCancel} onSwitchServer={onSwitchServer} />;
  if (run.kind === "error") {
    return (
      <div className="mx-auto max-w-lg py-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-wine" aria-hidden />
        <p className="mt-3 text-lg" role="alert">{run.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => onRetry(run.mode)}><RefreshCw aria-hidden /> Try again</Button>
          <Button variant="secondary" onClick={onChangeOutfit}>Change outfit</Button>
        </div>
        <QuotaHint used={passesUsed} className="mt-6" />
      </div>
    );
  }
  if (run.kind !== "done") return null;
  return <Done run={run} photoUrl={photoUrl} passesUsed={passesUsed} chartSlot={chartSlot} onRetry={onRetry} />;
}

function Progress({ run, onCancel, onSwitchServer }: { run: Extract<RunState, { kind: "running" }>; onCancel: () => void; onSwitchServer?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const total = run.plan.length;
  // Within-pass progress: the Space's own step count when it sends one, else an estimate from elapsed time.
  const within =
    run.phase !== "generating" ? 0
    : run.step && run.steps ? run.step / run.steps
    : Math.min(0.95, (now - run.passStartedAt) / 1000 / SECONDS_PER_PASS);
  const pct = Math.round(((run.pass - 1 + within) / total) * 100);
  const garment = run.plan[run.pass - 1] ?? "";
  const line =
    run.phase === "connecting" ? "Connecting to the free AI try-on…"
    : run.phase === "queue" ? `Waiting in line${run.position != null ? ` — you're number ${run.position + 1}` : ""}${run.eta ? ` (about ${run.eta > 90 ? `${Math.round(run.eta / 60)} min` : `${Math.max(1, Math.round(run.eta))} s`})` : ""}`
    : run.step && run.steps ? `Tailoring the ${garment} — step ${run.step} of ${run.steps}`
    : `Tailoring the ${garment}…`;

  return (
    <div className="mx-auto max-w-lg py-6 text-center">
      <StitchLoader className="mx-auto" />
      <p className="mt-4 text-xs uppercase tracking-[0.18em] text-brass-ink">Pass {run.pass} of {total}{garment ? ` · ${garment}` : ""}</p>
      <p className="mt-2 text-lg" aria-live="polite">{line}</p>
      <div className="mx-auto mt-5 h-1.5 max-w-sm overflow-hidden rounded-full bg-linen" role="progressbar" aria-label="Try-on progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-brass transition-[width] duration-500" style={{ width: `${Math.max(3, pct)}%` }} />
      </div>
      <ol className="mx-auto mt-5 flex max-w-sm flex-wrap justify-center gap-2 text-xs">
        {run.plan.map((g, i) => (
          <li key={g + i} className={cn("rounded-full border px-3 py-1", i + 1 < run.pass ? "border-sage/40 bg-sage/10 text-sage" : i + 1 === run.pass ? "border-brass bg-brass/10 text-ink" : "border-line text-stone")}>
            {i + 1 < run.pass ? "✓ " : ""}{g}
          </li>
        ))}
      </ol>
      {run.phase === "queue" && run.queueMovedAt && now - run.queueMovedAt > STUCK_MS && (
        <p className="mx-auto mt-5 max-w-sm rounded-xl bg-brass/10 p-3 text-sm" role="status">
          The line hasn&apos;t moved for a few minutes — the free AI service may be overloaded. {onSwitchServer ? "Try a less busy server, keep waiting, or cancel and try later." : "You can keep waiting, or cancel and try again later."}
          {onSwitchServer && (
            <Button size="sm" variant="secondary" className="mt-3 flex mx-auto" onClick={onSwitchServer}>
              <RefreshCw aria-hidden /> Try a less busy server
            </Button>
          )}
        </p>
      )}
      <p className="mt-5 text-xs text-stone">About {SECONDS_PER_PASS} s per piece once it&apos;s your turn. The free AI is shared, so at busy times there&apos;s a queue — keep this tab open; you can keep browsing in another tab.</p>
      <Button variant="ghost" className="mt-3" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

function Done({ run, photoUrl, passesUsed, chartSlot, onRetry }: { run: Extract<RunState, { kind: "done" }>; photoUrl: string; passesUsed: number; chartSlot: Props["chartSlot"]; onRetry: (m: Mode) => void }) {
  const [view, setView] = useState(run.passes.length - 1);
  const [canShare] = useState(() => typeof navigator !== "undefined" && typeof navigator.canShare === "function");
  const shown = run.passes[Math.min(view, run.passes.length - 1)]!;
  const final = run.passes.at(-1)!;

  async function share() {
    const file = new File([final.blob], fileName(final.blob), { type: final.blob.type || "image/jpeg" });
    try {
      if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: "My Seamwell try-on", text: "What do you think? Tried on with Seamwell's virtual try-on." });
      else await navigator.share({ title: "Seamwell virtual try-on", url: `${location.origin}/try-on` });
    } catch {
      /* the customer closed the share sheet */
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,30rem)_1fr] lg:gap-12">
      <div>
        <CompareSlider before={photoUrl} after={shown.url} afterAlt={`You wearing the ${shown.garment}`} className="mx-auto max-w-md lg:max-w-none" />
        {run.passes.length > 1 && (
          <ul className="mx-auto mt-3 flex max-w-md gap-2 lg:max-w-none" aria-label="Each AI pass">
            {run.passes.map((p, i) => (
              <li key={p.url}>
                <button type="button" aria-pressed={i === view} onClick={() => setView(i)} className={cn("block overflow-hidden rounded-xl border-2 outline-none transition-colors focus-visible:ring-4 focus-visible:ring-brass/35", i === view ? "border-brass" : "border-transparent hover:border-line")}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- generated pass (blob URL) */}
                  <img src={p.url} alt="" className="h-20 w-14 object-cover" />
                  <span className="block bg-paper px-1 py-0.5 text-[0.62rem] text-stone">{i + 1}. {p.garment.split(" ").slice(-1)[0]}</span>
                  <span className="sr-only">Show the result after pass {i + 1}: {p.garment}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-3xl">Here&apos;s how it looks on you</h3>
        {run.error && <p className="mt-3 rounded-xl bg-brass/10 p-3 text-sm" role="alert">{run.error} The pieces finished so far are shown.</p>}
        <p className="mt-3 flex gap-2 rounded-xl bg-linen/70 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-brass-ink" aria-hidden />
          <span>Shows how it looks, not the exact fit — see the size guide or visit us for a free fitting.</span>
        </p>
        <div className="mt-1"><SizeGuideDialog initial={chartSlot} /></div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <a href={final.url} download={fileName(final.blob)}><Download aria-hidden /> Save image</a>
          </Button>
          {canShare && <Button variant="secondary" onClick={() => void share()}><Share2 aria-hidden /> Share</Button>}
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-paper p-4 text-sm">
          {run.mode === "volume" ? (
            <>
              <p className="font-medium">Can you see your old clothes through the new ones?</p>
              <p className="mt-1 text-stone">Clean mode removes the clothes in your photo first. It works best with a clear head-to-feet photo.</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => onRetry("clean")}><Wand2 aria-hidden /> Try again in clean mode</Button>
            </>
          ) : (
            <>
              <p className="font-medium">This was clean mode.</p>
              <p className="mt-1 text-stone">If your body or pose looks wrong, volume mode keeps them from your photo.</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => onRetry("volume")}><RefreshCw aria-hidden /> Try again in volume mode</Button>
            </>
          )}
        </div>
        <QuotaHint used={passesUsed} className="mt-4" />
      </div>
    </div>
  );
}

/** Hugging Face doesn't expose the remaining quota, so this is an honest estimate. */
export function QuotaHint({ used, className }: { used: number; className?: string }) {
  const left = Math.max(0, FREE_PASSES_PER_DAY - used);
  return (
    <p className={cn("text-xs leading-relaxed text-stone", className)}>
      The try-on uses free AI time on Hugging Face — about {FREE_PASSES_PER_DAY} pieces a day per connection{used > 0 ? `; you've used ${used} in this visit${left ? ` (roughly ${left} left)` : ""}` : ""}. Each piece is one pass; a full suit photo is one pass for the whole look.
    </p>
  );
}
