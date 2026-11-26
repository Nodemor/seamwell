"use client";
/**
 * Virtual try-on engine — runs in the CUSTOMER'S browser so each customer uses their own
 * free Hugging Face GPU quota (the shop server never calls the model and never holds a token).
 *
 * Ported from the tested prototype (docs/reference/tryon-prototype.html). Verified facts:
 *  - Space: fashn-ai/fashn-vton-1.5, endpoint "/try_on"
 *  - Inputs (in order): person_image, garment_image, category (tops|bottoms|one-pieces),
 *    garment_photo_type (model|flat-lay), num_timesteps (10-50), guidance_scale (1-3), seed, segmentation_free
 *  - segmentation_free=true ("volume mode") is the safer default: keeps the person's body/pose.
 *  - Steps=50 costs no extra quota (quota is charged per request, ~60 s), so use max quality.
 */
import type { TryOnSlot } from "@seamwell/shared";
import { HEALTHY_QUEUE, spaceHost, TRYON_SPACES } from "./spaces";

export { TRYON_SPACES };
export const TRYON_SPACE = TRYON_SPACES[0]!;

/** Jobs waiting in a Space's queue (Infinity when it can't be reached). */
async function queueSize(id: string): Promise<number> {
  try {
    const r = await fetch(`${spaceHost(id)}/gradio_api/queue/status`, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    const j = (await r.json()) as { queue_size?: unknown };
    return typeof j.queue_size === "number" ? j.queue_size : Infinity;
  } catch {
    return Infinity;
  }
}

/**
 * Which Space to use (skipping any in `avoid`): the first one, in order of preference, whose queue is healthy
 * (≤ HEALTHY_QUEUE) — so the official Space is used whenever it works — otherwise the shortest queue.
 * Only queue sizes are fetched here; no photo is sent. One Space → no network check.
 */
export async function pickSpace(avoid: string[] = []): Promise<string> {
  const list = TRYON_SPACES.filter((s) => !avoid.includes(s));
  if (list.length <= 1) return list[0] ?? TRYON_SPACE;
  const sizes = await Promise.all(list.map(queueSize));
  const healthy = sizes.findIndex((n) => n <= HEALTHY_QUEUE);
  if (healthy >= 0) return list[healthy]!;
  let best = 0;
  sizes.forEach((n, i) => {
    if (n < sizes[best]!) best = i;
  });
  return list[best]!;
}

export interface TryOnGarment {
  id: string;
  name: string;
  slot: TryOnSlot;
  photoType: "flat-lay" | "model";
  image: Blob | string; // Blob (uploaded/pasted) or absolute URL of a white-background garment photo
}

export interface TryOnOptions {
  volumeMode?: boolean; // segmentation_free
  /** Space to use; default: the configured one with the shortest queue. */
  space?: string;
  /** Spaces to skip when picking (e.g. one whose queue was stuck). */
  avoidSpaces?: string[];
  layerShirtUnderBlazer?: boolean;
  steps?: number;
  guidance?: number;
  seed?: number;
}

export type TryOnEvent =
  | { type: "connecting"; space?: string }
  | { type: "queue"; pass: number; total: number; garment: string; position?: number; etaSeconds?: number }
  | { type: "generating"; pass: number; total: number; garment: string; step?: number; steps?: number }
  | { type: "pass-done"; pass: number; total: number; garment: string; image: Blob };

const categoryOf = (slot: TryOnSlot) => (slot === "trousers" ? "bottoms" : slot === "kit" ? "one-pieces" : "tops");

/** Order: full kit alone; otherwise trousers → shirt (optional when a blazer is chosen) → blazer. */
export function planPasses(garments: TryOnGarment[], opts: TryOnOptions = {}): TryOnGarment[] {
  const kit = garments.find((g) => g.slot === "kit");
  if (kit) return [kit];
  const by = (s: TryOnSlot) => garments.find((g) => g.slot === s);
  const blazer = by("blazer");
  const shirt = by("shirt");
  const trousers = by("trousers");
  return [trousers, shirt && (!blazer || opts.layerShirtUnderBlazer !== false) ? shirt : undefined, blazer].filter(Boolean) as TryOnGarment[];
}

type GradioModule = typeof import("@gradio/client");
let gradio: Promise<GradioModule> | null = null;
const loadGradio = () => (gradio ??= import("@gradio/client"));

/** Downscale + flatten transparency to white; returns JPEG. Keeps uploads small and fast. */
export async function normaliseImage(blob: Blob, maxSide = 1280): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not read image"))), "image/jpeg", 0.92));
}

export function friendlyTryOnError(err: unknown): string {
  const m = String((err as Error)?.message ?? err ?? "");
  if (/quota/i.test(m)) return "Today's free try-on time is used up on this connection. Please try again tomorrow.";
  if (/no gpu|gpu.*(busy|available)/i.test(m)) return "All free AI machines are busy right now. Please try again in a minute.";
  if (/sleep|paused|building|starting/i.test(m)) return "The try-on service is waking up. Please try again in a minute or two.";
  if (/fetch|network|failed to/i.test(m)) return "We couldn't reach the try-on service. Check your internet connection and try again.";
  return "Something went wrong with the try-on. Please try again.";
}

/**
 * Dress `person` in the planned garments, one pass at a time (each result feeds the next).
 * Throws on error; partial results were already delivered through onEvent("pass-done").
 */
export async function runTryOn(person: Blob, garments: TryOnGarment[], opts: TryOnOptions, onEvent: (e: TryOnEvent) => void, signal?: AbortSignal): Promise<Blob> {
  const passes = planPasses(garments, opts);
  if (!passes.length) throw new Error("Pick at least one item");
  onEvent({ type: "connecting" });
  const space = opts.space ?? (await pickSpace(opts.avoidSpaces));
  onEvent({ type: "connecting", space });
  const { Client, handle_file } = await loadGradio();
  // No token: the visitor's own anonymous quota. events: the client only streams "data" by default — without
  // "status" we'd get no queue position / progress, and errors (e.g. quota used up) would never arrive (endless wait).
  const client = await Client.connect(space, { events: ["data", "status"] });

  let current = person;
  for (let i = 0; i < passes.length; i++) {
    if (signal?.aborted) throw new Error("Cancelled");
    const g = passes[i]!;
    // Fetch the garment photo in the browser and upload it (works for localhost/private URLs too);
    // fall back to letting the Space download a public URL.
    let garmentInput;
    if (typeof g.image === "string") {
      try {
        const r = await fetch(g.image);
        garmentInput = handle_file(await normaliseImage(await r.blob(), 1024));
      } catch {
        garmentInput = handle_file(g.image);
      }
    } else {
      garmentInput = handle_file(g.image);
    }
    const job = client.submit("/try_on", [
      handle_file(current),
      garmentInput,
      categoryOf(g.slot),
      g.photoType,
      opts.steps ?? 50,
      opts.guidance ?? 1.5,
      opts.seed ?? 42,
      opts.volumeMode ?? true,
    ]);
    signal?.addEventListener("abort", () => void job.cancel(), { once: true });

    let output: unknown = null;
    for await (const msg of job) {
      if (msg.type === "status") {
        if (msg.stage === "error") throw new Error(typeof msg.message === "string" ? msg.message : "Try-on failed");
        if (msg.stage === "pending") onEvent({ type: "queue", pass: i + 1, total: passes.length, garment: g.name, position: msg.position ?? undefined, etaSeconds: msg.eta ?? undefined });
        if (msg.stage === "generating") {
          // The Space reports diffusion progress (index/length) when it has it — shown as "step x of y".
          const p = msg.progress_data?.find((d) => d.length != null && d.index != null);
          onEvent({ type: "generating", pass: i + 1, total: passes.length, garment: g.name, step: p ? p.index! + 1 : undefined, steps: p?.length ?? undefined });
        }
      }
      if (msg.type === "data") {
        output = msg.data;
        break;
      }
    }
    const file = Array.isArray(output) ? output[0] : null;
    const url = typeof file === "string" ? file : (file as { url?: string } | null)?.url;
    if (!url) throw new Error("No image returned");
    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not download the result");
    current = await res.blob();
    onEvent({ type: "pass-done", pass: i + 1, total: passes.length, garment: g.name, image: current });
  }
  return current;
}
