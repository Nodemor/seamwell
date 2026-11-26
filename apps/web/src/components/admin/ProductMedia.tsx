"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Sparkles, Star, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type AdminImage, uploadFile } from "@/lib/admin";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";
/** Quick client check (the API checks the real file contents again). */
const checkFile = (f: File) => (!ACCEPT.split(",").includes(f.type) ? "Only JPEG, PNG or WebP photos" : f.size > MAX_BYTES ? "That photo is larger than 5 MB" : "");

function Section({ id, title, description, children }: { id: string; title: string; description: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mt-8 scroll-mt-24 rounded-2xl border border-line bg-paper p-5 sm:p-6">
      <h2 id={`${id}-h`} className="font-sans text-lg font-medium">{title}</h2>
      <div className="mt-1 text-sm text-stone">{description}</div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/* ---------- Gallery photos: upload, drag (or arrow buttons) to reorder, alt text, delete ---------- */
export function ProductPhotos({ productId, productName, images, onChange }: { productId: string; productName: string; images: AdminImage[]; onChange: (images: AdminImage[]) => void }) {
  const [uploading, setUploading] = useState(0);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const live = useRef<HTMLParagraphElement>(null);
  const announce = (t: string) => live.current && (live.current.textContent = t);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    let list = images;
    for (const f of Array.from(files)) {
      const problem = checkFile(f);
      if (problem) {
        toast.error(`${f.name}: ${problem}`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const r = await uploadFile<{ image: AdminImage }>(`/admin/products/${productId}/images`, f, { alt: `${productName}${list.length ? ` — view ${list.length + 1}` : ""}` });
        list = [...list, r.image];
        onChange(list);
      } catch (e) {
        toast.error(`${f.name}: ${e instanceof ApiError ? e.message : "upload failed"}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function move(from: number, to: number) {
    if (to < 0 || to >= images.length || from === to) return;
    const next = images.slice();
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m!);
    onChange(next); // optimistic
    try {
      await api(`/admin/products/${productId}/images/order`, { method: "PUT", json: { ids: next.map((i) => i.id) } });
      announce(`Moved photo to position ${to + 1} of ${next.length}`);
    } catch (e) {
      onChange(images);
      toast.error(e instanceof ApiError ? e.message : "Couldn't reorder");
    }
  }

  async function remove(img: AdminImage) {
    try {
      await api(`/admin/products/${productId}/images/${img.id}`, { method: "DELETE" });
      onChange(images.filter((i) => i.id !== img.id));
      toast.success("Photo removed");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't remove the photo");
    }
  }

  async function saveAlt(img: AdminImage, alt: string) {
    if (alt === img.alt) return;
    try {
      await api(`/admin/products/${productId}/images/${img.id}`, { method: "PATCH", json: { alt } });
      onChange(images.map((i) => (i.id === img.id ? { ...i, alt } : i)));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't save the description");
    }
  }

  return (
    <Section id="photos" title="Photos" description="The first photo is the main one in the shop. Drag to reorder (or use the arrows). JPEG, PNG or WebP up to 5 MB — they're resized and cleaned automatically.">
      <p ref={live} aria-live="polite" className="sr-only" />
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <li
            key={img.id}
            draggable
            onDragStart={(e) => {
              setDragFrom(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(i);
            }}
            onDragLeave={() => setDragOver((v) => (v === i ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom !== null) void move(dragFrom, i);
              setDragFrom(null);
              setDragOver(null);
            }}
            onDragEnd={() => (setDragFrom(null), setDragOver(null))}
            className={cn("flex cursor-grab flex-col rounded-xl border bg-ivory p-2 transition-colors active:cursor-grabbing", dragOver === i && dragFrom !== i ? "border-brass ring-2 ring-brass/30" : "border-line", dragFrom === i && "opacity-50")}
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a just-uploaded file */}
              <img src={img.url} alt={img.alt} className="h-full w-full object-contain" draggable={false} />
              {i === 0 && <Badge variant="default" className="absolute left-2 top-2"><Star aria-hidden /> Main</Badge>}
            </div>
            <label className="mt-2 text-xs text-stone">
              Description (for screen readers)
              <input defaultValue={img.alt} maxLength={160} onBlur={(e) => void saveAlt(img, e.target.value.trim())} className="mt-1 h-10 w-full rounded-lg border border-line bg-paper px-2 text-sm text-ink outline-none focus-visible:border-brass focus-visible:ring-2 focus-visible:ring-brass/20" />
            </label>
            <div className="mt-2 flex items-center justify-between">
              <span className="flex">
                <Button size="icon-sm" variant="ghost" onClick={() => void move(i, i - 1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`}><ArrowLeft aria-hidden /></Button>
                <Button size="icon-sm" variant="ghost" onClick={() => void move(i, i + 1)} disabled={i === images.length - 1} aria-label={`Move photo ${i + 1} later`}><ArrowRight aria-hidden /></Button>
              </span>
              <Button size="icon-sm" variant="ghost" onClick={() => void remove(img)} aria-label={`Remove photo ${i + 1}`} className="text-wine hover:bg-wine/10"><Trash2 aria-hidden /></Button>
            </div>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading > 0 || images.length >= 12}
            className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-ivory text-sm text-stone transition-colors hover:border-brass hover:text-ink focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none disabled:opacity-60"
          >
            {uploading ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <ImagePlus className="size-6 text-brass" aria-hidden />}
            {uploading ? `Uploading ${uploading}…` : images.length >= 12 ? "12 photos max" : "Add photos"}
          </button>
        </li>
      </ul>
      <input ref={fileInput} type="file" accept={ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void upload(e.target.files)} />
    </Section>
  );
}

/* ---------- Try-on garment photo ---------- */
export function TryonPhoto({ productId, url, enabled, onChange }: { productId: string; url: string | null; enabled: boolean; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(f: File | undefined) {
    if (!f) return;
    const problem = checkFile(f);
    if (problem) return void toast.error(problem);
    const local = URL.createObjectURL(f);
    setPreview(local);
    setBusy(true);
    try {
      const r = await uploadFile<{ tryonImageUrl: string; width: number; height: number }>(`/admin/products/${productId}/tryon-image`, f);
      onChange(r.tryonImageUrl);
      toast.success(r.width < 700 ? "Saved — but it's small; a larger photo gives better try-on results" : "Try-on photo saved");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      setPreview(null);
      URL.revokeObjectURL(local);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <Section
      id="tryon"
      title="Try-on photo"
      description={<span className="inline-flex flex-wrap items-center gap-2">The garment photo the Virtual Try-On puts on the customer. {!enabled && <Badge variant="muted">Try-on is off for this product</Badge>}</span>}
    >
      <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
        <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-xl border border-line bg-white">
          {preview || url ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview
            <img src={preview ?? url!} alt="Current try-on garment photo" className={cn("h-full w-full object-contain", busy && "opacity-50")} />
          ) : (
            <span className="flex flex-col items-center gap-2 p-4 text-center text-sm text-stone"><Sparkles className="size-6 text-brass" aria-hidden />No try-on photo yet</span>
          )}
          {busy && <Loader2 className="absolute size-8 animate-spin text-midnight" aria-hidden />}
        </div>
        <div>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-stone">
            <li><strong className="font-medium text-ink">Plain white background</strong>, nothing else in the picture.</li>
            <li>The garment <strong className="font-medium text-ink">from the front</strong>, laid flat or on a mannequin, fully in frame.</li>
            <li>Even light, no strong shadows. At least 768 px wide.</li>
            <li>One piece only (a jacket, a shirt or trousers) — unless it&apos;s tried on as a full outfit.</li>
          </ul>
          <Button className="mt-5" variant="secondary" loading={busy} onClick={() => input.current?.click()}>
            <Upload aria-hidden /> {url ? "Replace try-on photo" : "Upload try-on photo"}
          </Button>
          <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void upload(e.target.files?.[0])} />
        </div>
      </div>
    </Section>
  );
}
