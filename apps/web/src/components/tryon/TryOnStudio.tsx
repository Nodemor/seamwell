"use client";

import { ArrowLeft, ArrowRight, Check, ImagePlus, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { chartForSlot, type TryOnSlot } from "@seamwell/shared";
import { CompleteLookDialog, type LookChoice } from "@/components/tryon/CompleteLookDialog";
import { type CategoryId, type Gender, type KeepOwn, OutfitStep, type Picked } from "@/components/tryon/OutfitStep";
import { OutfitToBag } from "@/components/tryon/OutfitToBag";
import { type CheckState, PhotoStep } from "@/components/tryon/PhotoStep";
import { type Mode, type PassResult, ResultStep, type RunState } from "@/components/tryon/ResultStep";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { ProductCard } from "@/lib/catalog";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { friendlyTryOnError, normaliseImage, planPasses, runTryOn, TRYON_SPACES, type TryOnEvent, type TryOnGarment } from "@/lib/tryon/engine";
import { FREE_PASSES_PER_DAY, passCounter, photoMemory, SECONDS_PER_PASS } from "@/lib/tryon/memory";
import { checkPhoto } from "@/lib/tryon/photo-check";
import { cn } from "@/lib/utils";

const STEPS = ["Your photo", "Your outfit", "See it on you"] as const;
type Step = 0 | 1 | 2;
type Runner = typeof runTryOn;

/**
 * The guided virtual try-on: 1 photo → 2 outfit → 3 result.
 * Everything runs in the customer's browser; the photo stays in memory (lib/tryon/memory.ts) and goes only to
 * the Hugging Face Space (lib/tryon/engine.ts — tested defaults, no token).
 */
export function TryOnStudio({ initialProductSlug, fake }: { initialProductSlug?: string; fake?: "ok" | "error" | "partial" }) {
  const remembered = useRef(photoMemory.get());
  const [step, setStep] = useState<Step>(0);
  const [person, setPerson] = useState<{ blob: Blob; url: string } | null>(() => (remembered.current ? { blob: remembered.current.blob, url: URL.createObjectURL(remembered.current.blob) } : null));
  const [check, setCheck] = useState<CheckState>(() => remembered.current?.check ?? null);
  const [useAnyway, setUseAnyway] = useState(() => remembered.current?.useAnyway ?? false);
  const [photoError, setPhotoError] = useState("");

  const [products, setProducts] = useState<ProductCard[] | null>(null);
  const [gender, setGender] = useState<Gender>("men");
  const [category, setCategory] = useState<CategoryId>("all");
  const [picked, setPicked] = useState<Picked>({});
  const [keepOwn, setKeepOwn] = useState<KeepOwn>({});
  const [lookOpen, setLookOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  /** The pieces of the last run — "Add this outfit to bag" adds these, even if the picks changed since. */
  const [tried, setTried] = useState<ProductCard[]>([]);
  const startAfterLook = useRef(false);

  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const [passesUsed, setPassesUsed] = useState(() => passCounter.get());
  const abortRef = useRef<AbortController | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // Try-on items for both genders (the shop is small: one page each).
  useEffect(() => {
    let alive = true;
    Promise.all((["men", "women"] as const).map((g) => api<{ items: ProductCard[] }>(`/products?gender=${g}&pageSize=48`).then((d) => d.items).catch(() => [] as ProductCard[])))
      .then(([men, women]) => {
        if (!alive) return;
        const all = [...men!, ...women!].filter((p) => p.tryonEnabled);
        setProducts(all);
        // "Try this on me" from a product page pre-selects it (/try-on?product=slug)
        const p = initialProductSlug ? all.find((x) => x.slug === initialProductSlug) : undefined;
        if (p?.tryonImageUrl) {
          setGender(p.gender === "women" ? "women" : "men");
          setPicked({ [p.tryonSlot]: p.id });
        }
      });
    return () => {
      alive = false;
    };
  }, [initialProductSlug]);

  // Revoke blob URLs we no longer show
  useEffect(() => () => {
    if (person) URL.revokeObjectURL(person.url);
  }, [person]);

  // Step transition (GSAP; none for reduced motion) + move focus to the new step's heading
  useGSAP(
    () => {
      if (firstRender.current) {
        firstRender.current = false;
        return;
      }
      panel.current?.querySelector<HTMLElement>("[data-step-title]")?.focus({ preventScroll: true });
      const top = root.current!.getBoundingClientRect().top;
      if (top < 0) root.current!.scrollIntoView({ block: "start" });
      gsap.matchMedia().add(MOTION_OK, () => {
        // fromTo + revertOnUpdate: an interrupted transition can never leave the panel half-faded
        gsap.fromTo(panel.current, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out", clearProps: "opacity,visibility,transform" });
      });
    },
    { scope: root, dependencies: [step], revertOnUpdate: true },
  );

  const genderProducts = useMemo(() => (products ? products.filter((p) => p.gender === gender || (p.gender as string) === "unisex") : null), [products, gender]);
  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const chosen = (Object.values(picked).map((id) => byId.get(id!)).filter(Boolean) as ProductCard[]).filter((p) => p.tryonImageUrl);
  const missingLook = (["shirt", "trousers"] as const).filter((s) => !picked[s] && !keepOwn[s]);
  const needsLook = !!picked.blazer && missingLook.length > 0;
  const photoReady = !!person && !!check && check !== "checking" && (check.blocking.length === 0 || useAnyway);
  const garments: TryOnGarment[] = chosen.map((p) => ({ id: p.id, name: p.name, slot: p.tryonSlot, photoType: "flat-lay", image: p.tryonImageUrl! }));
  const passCount = planPasses(garments, { layerShirtUnderBlazer: true }).length;
  const maxStep: Step = !photoReady ? 0 : run.kind === "idle" ? 1 : 2;

  function remember(next: Partial<{ check: CheckState; useAnyway: boolean }> = {}, blob = person?.blob) {
    const c = next.check ?? check;
    if (blob && c && c !== "checking") photoMemory.set({ blob, check: c, useAnyway: next.useAnyway ?? useAnyway });
  }

  async function onFile(file: File) {
    setPhotoError("");
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setPhotoError("Please use a JPG, PNG or WebP photo (iPhone HEIC photos: share or export them as JPG first).");
      return;
    }
    let blob: Blob;
    try {
      blob = await normaliseImage(file);
    } catch {
      setPhotoError("We couldn't read that photo. Please try another JPG or PNG.");
      return;
    }
    setPerson({ blob, url: URL.createObjectURL(blob) });
    setUseAnyway(false);
    setRun({ kind: "idle" });
    setCheck("checking");
    const result = await checkPhoto(blob);
    setCheck(result);
    photoMemory.set({ blob, check: result, useAnyway: false });
  }

  async function onSample() {
    try {
      const blob = await (await fetch("/tryon/sample-model.jpg")).blob();
      await onFile(new File([blob], "sample-model.jpg", { type: "image/jpeg" }));
    } catch {
      setPhotoError("Couldn't load the sample photo. Please upload your own.");
    }
  }

  function forget() {
    photoMemory.set(null);
    setPerson(null);
    setCheck(null);
    setUseAnyway(false);
    setRun({ kind: "idle" });
  }

  function toggle(p: ProductCard) {
    setPicked((s) => {
      const next = { ...s };
      if (next[p.tryonSlot] === p.id) delete next[p.tryonSlot];
      else {
        next[p.tryonSlot] = p.id;
        if (p.tryonSlot === "kit") (["blazer", "shirt", "trousers"] as const).forEach((k) => delete next[k]);
        else delete next.kit;
      }
      return next;
    });
    if (p.tryonSlot === "shirt" || p.tryonSlot === "trousers") setKeepOwn((k) => ({ ...k, [p.tryonSlot]: false }));
    if (p.tryonSlot === "kit") setKeepOwn({});
  }

  function remove(slot: TryOnSlot) {
    setPicked((s) => {
      const next = { ...s };
      delete next[slot];
      return next;
    });
  }

  function applyLook(c: LookChoice) {
    const nextPicked: Picked = { ...picked };
    const nextOwn: KeepOwn = { ...keepOwn };
    for (const s of ["shirt", "trousers"] as const) {
      if (c[s] === "own") nextOwn[s] = true;
      else if (c[s]) nextPicked[s] = c[s];
    }
    setPicked(nextPicked);
    setKeepOwn(nextOwn);
    setLookOpen(false);
    if (startAfterLook.current) {
      startAfterLook.current = false;
      const list = (Object.values(nextPicked).map((id) => byId.get(id!)).filter(Boolean) as ProductCard[]).filter((p) => p.tryonImageUrl);
      void start("volume", list);
    }
  }

  function tryItOn() {
    if (needsLook) {
      startAfterLook.current = true;
      setLookOpen(true);
      return;
    }
    void start("volume");
  }

  async function start(mode: Mode, items: ProductCard[] = chosen, avoidSpaces: string[] = []) {
    if (!person || !items.length) return;
    const gs: TryOnGarment[] = items.map((p) => ({ id: p.id, name: p.name, slot: p.tryonSlot, photoType: "flat-lay", image: p.tryonImageUrl! }));
    const plan = planPasses(gs, { layerShirtUnderBlazer: true }).map((g) => g.name);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStep(2);
    setTried(items);
    setRun({ kind: "running", mode, plan, pass: 1, phase: "connecting", passStartedAt: Date.now() });
    const passes: PassResult[] = [];
    const onEvent = (e: TryOnEvent) => {
      if (ctrl.signal.aborted) return;
      if (e.type === "connecting" && e.space) setRun((r) => (r.kind === "running" ? { ...r, space: e.space } : r));
      if (e.type === "queue") setRun((r) => (r.kind === "running" ? { ...r, pass: e.pass, phase: "queue", position: e.position ?? r.position, eta: e.etaSeconds ?? r.eta, step: undefined, steps: undefined,
                // a status without a position isn't movement — only a real change of place counts
                queueMovedAt: r.phase !== "queue" || r.pass !== e.pass || (e.position != null && e.position !== r.position) ? Date.now() : r.queueMovedAt } : r));
      if (e.type === "generating")
        setRun((r) => (r.kind === "running" ? { ...r, pass: e.pass, phase: "generating", step: e.step, steps: e.steps, passStartedAt: r.phase === "generating" && r.pass === e.pass ? r.passStartedAt : Date.now() } : r));
      if (e.type === "pass-done") {
        passes.push({ garment: e.garment, blob: e.image, url: URL.createObjectURL(e.image) });
        setPassesUsed(passCounter.add(1));
      }
    };
    try {
      const runner: Runner = fake && process.env.NODE_ENV !== "production" ? (await import("@/lib/tryon/fake-engine")).makeFakeRunner(fake) : runTryOn;
      await runner(person.blob, gs, { volumeMode: mode === "volume", layerShirtUnderBlazer: true, avoidSpaces }, onEvent, ctrl.signal);
      if (!ctrl.signal.aborted) setRun({ kind: "done", mode, passes });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const message = friendlyTryOnError(err);
      setRun(passes.length ? { kind: "done", mode, passes, error: message } : { kind: "error", mode, message });
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setRun({ kind: "idle" });
    setStep(1);
  }

  const goTo = (s: Step) => s <= maxStep && setStep(s);
  const chartSlot = chartForSlot((picked.kit && "kit") || (picked.blazer && "blazer") || (picked.shirt && "shirt") || (picked.trousers && "trousers") || "blazer");

  return (
    <div ref={root} className="scroll-mt-24">
      {/* Step bar */}
      <nav aria-label="Try-on steps">
        <ol className="flex items-center gap-2 sm:gap-4">
          {STEPS.map((label, i) => {
            const state = i === step ? "current" : i < step || i <= maxStep ? "reachable" : "locked";
            return (
              <li key={label} className="flex flex-1 items-center gap-2 sm:gap-4 last:flex-none">
                <button
                  type="button"
                  disabled={state === "locked"}
                  aria-current={i === step ? "step" : undefined}
                  onClick={() => goTo(i as Step)}
                  className="group flex min-h-11 items-center gap-2 rounded-full pr-2 text-left outline-none focus-visible:ring-4 focus-visible:ring-brass/35 disabled:cursor-default"
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border text-sm font-medium transition-colors", i === step ? "border-midnight bg-midnight text-ivory" : i < step ? "border-brass bg-brass text-ink" : "border-line bg-paper text-stone")}>
                    {i < step ? <Check className="size-4" aria-hidden /> : i + 1}
                  </span>
                  <span className={cn("text-sm", i === step ? "font-medium text-ink" : "text-stone", i !== step && "hidden sm:inline")}>{label}</span>
                </button>
                {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden><span className={cn("block h-px bg-brass transition-[width] duration-500", i < step ? "w-full" : "w-0")} /></span>}
              </li>
            );
          })}
        </ol>
      </nav>

      <div ref={panel} className="mt-8">
        <h2 data-step-title tabIndex={-1} className="text-[clamp(1.8rem,3.5vw,2.4rem)] leading-tight outline-none">
          {step === 0 ? "Start with a photo of you" : step === 1 ? "Choose your outfit" : run.kind === "done" ? "Your try-on" : run.kind === "error" ? "That didn't work" : "Dressing you now…"}
        </h2>
        <div className="mt-6">
          {step === 0 && <PhotoStep photoUrl={person?.url ?? null} check={check} useAnyway={useAnyway} error={photoError} onFile={(f) => void onFile(f)} onSample={() => void onSample()} onUseAnyway={() => (setUseAnyway(true), remember({ useAnyway: true }))} onForget={forget} />}
          {step === 1 && (
            <OutfitStep
              products={genderProducts}
              gender={gender}
              onGender={(g) => (setGender(g), setPicked({}), setKeepOwn({}))}
              category={category}
              onCategory={setCategory}
              picked={picked}
              keepOwn={keepOwn}
              onToggle={toggle}
              onRemove={remove}
              onKeepOwn={(s, keep) => setKeepOwn((k) => ({ ...k, [s]: keep }))}
              onCompleteLook={() => ((startAfterLook.current = false), setLookOpen(true))}
              needsLook={needsLook}
              budgetNote={
                passCount > Math.max(0, FREE_PASSES_PER_DAY - passesUsed)
                  ? `This look needs ${passCount} AI passes, but the free allowance is about ${FREE_PASSES_PER_DAY} a day per connection${passesUsed ? ` (you've used ${passesUsed})` : ""}. It may stop part-way — keep your own shirt or trousers to save passes, or try a full suit.`
                  : undefined
              }
            />
          )}
          {step === 2 && person && <ResultStep run={run} photoUrl={person.url} passesUsed={passesUsed} chartSlot={chartSlot} onCancel={cancel} onSwitchServer={TRYON_SPACES.length > 1 ? () => run.kind === "running" && run.space && void start(run.mode, tried, [run.space]) : undefined} onRetry={(m) => void start(m)} onChangeOutfit={() => setStep(1)} />}
        </div>
      </div>

      {/* Sticky action bar — thumb-reachable on phones */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-10 border-t border-line bg-ivory/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-ivory/80 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-t-2xl lg:border-x">
        <div className="flex items-center gap-3">
          {step > 0 && !(step === 2 && run.kind === "running") && (
            <Button variant="ghost" onClick={() => setStep((step - 1) as Step)} aria-label={step === 1 ? "Back to your photo" : "Back to your outfit"}>
              <ArrowLeft aria-hidden /> <span className="hidden sm:inline">Back</span>
            </Button>
          )}
          <p className="min-w-0 flex-1 truncate text-xs text-stone sm:text-sm" aria-live="polite">
            {step === 0 && (check === "checking" ? "Checking your photo…" : photoReady ? "Photo ready" : person ? "Choose another photo, or use this one anyway" : "Add a photo to begin")}
            {step === 1 && (chosen.length ? `${chosen.length} ${chosen.length === 1 ? "piece" : "pieces"} · ${passCount} AI ${passCount === 1 ? "pass" : "passes"} · about ${passCount * SECONDS_PER_PASS} s` : "Pick at least one piece")}
            {step === 2 && (run.kind === "running" ? "Working… keep this tab open" : run.kind === "done" ? "Love it? Add the outfit to your bag" : "")}
          </p>
          {step === 0 && (
            <Button onClick={() => setStep(1)} disabled={!photoReady}>
              Choose outfit <ArrowRight aria-hidden />
            </Button>
          )}
          {step === 1 && (
            <Button onClick={tryItOn} disabled={!chosen.length || !photoReady}>
              <ImagePlus aria-hidden /> Try it on
            </Button>
          )}
          {step === 2 && run.kind === "done" && (
            <Button onClick={() => setBagOpen(true)}>
              <ShoppingBag aria-hidden /> <span className="sm:hidden">Add to bag</span><span className="hidden sm:inline">Add this outfit to bag</span>
            </Button>
          )}
        </div>
      </div>

      <CompleteLookDialog
        open={lookOpen}
        onOpenChange={(o) => (setLookOpen(o), o || (startAfterLook.current = false))}
        blazer={picked.blazer ? byId.get(picked.blazer) : undefined}
        products={genderProducts ?? []}
        missing={missingLook as ("shirt" | "trousers")[]}
        onApply={applyLook}
      />
      <OutfitToBag open={bagOpen} onOpenChange={setBagOpen} items={tried} />
    </div>
  );
}
