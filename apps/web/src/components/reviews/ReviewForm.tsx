"use client";

import { Camera, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { REVIEW_BODY_MAX, REVIEW_BODY_MIN, REVIEW_FIT_LABEL, REVIEW_FITS, type ReviewFit, reviewCreateSchema } from "@seamwell/shared";
import { FormMessage } from "@/components/auth/AuthShell";
import { SuccessCheck } from "@/components/auth/SuccessCheck";
import { StarInput } from "@/components/reviews/StarInput";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/FormField";
import { api } from "@/lib/api";
import { apiErrors, fieldErrors } from "@/lib/forms";
import { cn } from "@/lib/utils";

export type ReviewProduct = { id: string; name: string; imageUrl?: string | null };
/** Guests prove the purchase with order number + email; signed-in customers can leave it out. */
export type ReviewProof = { orderNumber: string; email: string };

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

/** The review form + its "thank you" state. Used in the dialog and on the /review page. */
export function ReviewForm({ product, proof, onDone, onCancel }: { product: ReviewProduct; proof?: ReviewProof; onDone?: () => void; onCancel?: () => void }) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [fit, setFit] = useState<ReviewFit | "">("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const len = body.trim().length;
  /** Editing a field clears its old error (it's re-checked on submit). */
  const clear = (k: string) =>
    setErrors((all) => {
      if (!(k in all)) return all;
      const rest = { ...all };
      delete rest[k];
      return rest;
    });

  function pickPhoto(f: File | undefined) {
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) return setErrors((e) => ({ ...e, photo: "Only JPEG, PNG or WebP photos" }));
    if (f.size > MAX_BYTES) return setErrors((e) => ({ ...e, photo: "That photo is larger than 5 MB" }));
    clear("photo");
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  }

  function clearPhoto() {
    setPhoto(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const data = { productId: product.id, rating, title: title.trim() || undefined, body, fit: fit || undefined, ...proof };
    const parsed = reviewCreateSchema.safeParse(data);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('fieldset[data-invalid] input, [aria-invalid="true"]')?.focus());
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (photo) {
        const fd = new FormData();
        fd.append("data", JSON.stringify(parsed.data));
        fd.append("file", photo);
        await api("/reviews", { method: "POST", body: fd });
      } else {
        await api("/reviews", { method: "POST", json: parsed.data });
      }
      setSent(true);
      onDone?.();
      requestAnimationFrame(() => doneHeading.current?.focus());
    } catch (err) {
      const r = apiErrors(err);
      setErrors(r.fields);
      setMessage(r.message || "Please check the form");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="py-4 text-center">
        <SuccessCheck className="mx-auto" />
        <h2 ref={doneHeading} tabIndex={-1} className="mt-4 font-display text-3xl outline-none">Thank you!</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-stone">Your review of {product.name} will appear on the product page after a quick check by our team — usually within a day.</p>
        {onCancel && (
          <Button className="mt-6" variant="secondary" onClick={onCancel}>
            Close
          </Button>
        )}
      </div>
    );
  }

  return (
    <form ref={form} onSubmit={submit} className="space-y-5" noValidate>
      <div className="flex items-center gap-3 rounded-xl bg-linen/60 p-3">
        {product.imageUrl && (
          <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-paper">
            <Image src={product.imageUrl} alt="" fill sizes="56px" className="object-contain p-1" />
          </span>
        )}
        <p className="text-sm font-medium">{product.name}</p>
      </div>

      <StarInput value={rating} onChange={(v) => (setRating(v), clear("rating"))} error={errors.rating} />

      <fieldset>
        <legend className="text-sm text-stone">How does it fit? <span className="text-stone/70">(optional)</span></legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {REVIEW_FITS.map((f) => (
            <label key={f} className={cn("flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-2 text-center text-sm transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brass/30", fit === f ? "border-midnight bg-midnight text-ivory" : "border-line bg-paper hover:border-ink/40")}>
              <input type="radio" name="fit" value={f} checked={fit === f} onChange={() => setFit(f)} className="sr-only" />
              {REVIEW_FIT_LABEL[f]}
            </label>
          ))}
        </div>
      </fieldset>

      <FormField label="Title (optional)" value={title} onChange={(e) => (setTitle(e.target.value), clear("title"))} maxLength={80} error={errors.title} placeholder="e.g. Perfect for the wedding" />
      <div>
        <FormField
          as="textarea"
          label="Your review"
          rows={5}
          value={body}
          onChange={(e) => (setBody(e.target.value), clear("body"))}
          maxLength={REVIEW_BODY_MAX}
          error={errors.body}
          placeholder="How's the cloth, the cut, the fit? Was anything altered?"
        />
        <p className={cn("mt-1 text-right text-xs", len > 0 && len < REVIEW_BODY_MIN ? "text-wine" : "text-stone")} aria-live="polite">
          {len < REVIEW_BODY_MIN ? `${REVIEW_BODY_MIN - len} more ${REVIEW_BODY_MIN - len === 1 ? "character" : "characters"} needed` : `${len} / ${REVIEW_BODY_MAX}`}
        </p>
      </div>

      <div>
        <p className="text-sm text-stone">Photo of you wearing it <span className="text-stone/70">(optional)</span></p>
        {preview ? (
          <div className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob: URL) */}
            <img src={preview} alt="Your photo" className="size-20 rounded-xl object-cover" />
            <Button variant="ghost" size="sm" onClick={clearPhoto}><X aria-hidden /> Remove</Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => fileInput.current?.click()} aria-describedby={errors.photo ? "photo-err" : undefined}>
            <Camera aria-hidden /> Add a photo
          </Button>
        )}
        <input ref={fileInput} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
        {errors.photo && <p id="photo-err" className="mt-1 text-xs text-wine">{errors.photo}</p>}
        <p className="mt-1 text-xs text-stone">Shown with your review once it&apos;s approved. JPEG, PNG or WebP, up to 5 MB.</p>
      </div>

      {message && <FormMessage>{message}</FormMessage>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy}>Send review</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
