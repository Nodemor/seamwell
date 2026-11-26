"use client";
/**
 * DEVELOPMENT ONLY: a stand-in for runTryOn that never calls Hugging Face (so UI tests don't spend GPU quota).
 * Enabled with /try-on?fake=1 (or fake=error / fake=partial) and only when NODE_ENV !== "production"
 * (see app/try-on/page.tsx). Emits the same events as the real engine.
 */
import { planPasses, type TryOnEvent, type TryOnGarment, type TryOnOptions } from "./engine";

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), rej(new Error("Cancelled"))), { once: true });
  });

export function makeFakeRunner(kind: "ok" | "error" | "partial") {
  return async function fakeRunTryOn(_person: Blob, garments: TryOnGarment[], opts: TryOnOptions, onEvent: (e: TryOnEvent) => void, signal?: AbortSignal): Promise<Blob> {
    const passes = planPasses(garments, opts);
    onEvent({ type: "connecting" });
    await wait(500, signal);
    if (kind === "error") throw new Error("You have exceeded your free GPU quota");
    const result = await (await fetch("/tryon/demo-result.webp")).blob();
    for (let i = 0; i < passes.length; i++) {
      const g = passes[i]!;
      onEvent({ type: "queue", pass: i + 1, total: passes.length, garment: g.name, position: 1, etaSeconds: 4 });
      await wait(700, signal);
      for (let s = 1; s <= 50; s += 7) {
        onEvent({ type: "generating", pass: i + 1, total: passes.length, garment: g.name, step: s, steps: 50 });
        await wait(150, signal);
      }
      if (kind === "partial" && i === passes.length - 1 && passes.length > 1) throw new Error("No GPU available right now");
      onEvent({ type: "pass-done", pass: i + 1, total: passes.length, garment: g.name, image: result });
    }
    return result;
  };
}
