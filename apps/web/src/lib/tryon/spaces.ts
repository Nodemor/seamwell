/**
 * Which Hugging Face Spaces run the virtual try-on (all copies of the same FASHN model with the same /try_on inputs).
 * No "use client": the privacy page reads this list too, so it always names the services in use.
 *
 * Order matters: the first Space is preferred whenever its queue is short; the backups are used only while it's
 * busy or stuck — so when the official Space recovers, try-ons go back to it automatically (see pickSpace in engine.ts).
 *
 *  - NEXT_PUBLIC_TRYON_SPACE           preferred Space(s), comma-separated (default: the official FASHN Space)
 *  - NEXT_PUBLIC_TRYON_BACKUP_SPACES   backups, comma-separated; unset → DEFAULT_BACKUP_SPACES, "" → no backups
 *
 * Backups are public copies run by other Hugging Face users: the customer's photo goes to whichever Space is used,
 * so only list ones you trust, and keep the privacy page in sync (it lists TRYON_SPACES automatically).
 */
export const OFFICIAL_SPACE = "fashn-ai/fashn-vton-1.5";

/** Public copies checked on 25 Nov 2026 (identical /try_on, ZeroGPU, returned results in ~40–50 s). */
export const DEFAULT_BACKUP_SPACES = ["merve/fashn-vton-1.5", "Nymbo/fashn-vton-1.5"];

/** A queue this short (or shorter) counts as healthy, so the preferred Space is used. */
export const HEALTHY_QUEUE = 2;

const SPACE_ID = /^[\w.-]+\/[\w.-]+$/;
const parse = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => SPACE_ID.test(s));

const preferred = parse(process.env.NEXT_PUBLIC_TRYON_SPACE);
const backups = process.env.NEXT_PUBLIC_TRYON_BACKUP_SPACES === undefined ? DEFAULT_BACKUP_SPACES : parse(process.env.NEXT_PUBLIC_TRYON_BACKUP_SPACES);

/** All Spaces in order of preference (duplicates removed). */
export const TRYON_SPACES: string[] = [...new Set([...(preferred.length ? preferred : [OFFICIAL_SPACE]), ...backups])];

/** owner/name → https://owner-name.hf.space (Hugging Face's subdomain rule). */
export const spaceHost = (id: string) => `https://${id.toLowerCase().replace(/[/._]/g, "-")}.hf.space`;

/** The Space's public page, for the privacy policy. */
export const spacePage = (id: string) => `https://huggingface.co/spaces/${id}`;
