"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { adminVariantSchema, SIZES } from "@seamwell/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type AdminProduct, type AdminVariant, centsToRupees, rupeesToCents } from "@/lib/admin";
import { api, ApiError } from "@/lib/api";
import { fieldErrors } from "@/lib/forms";
import { cn } from "@/lib/utils";

type Row = { stock: string; rent: string; price: string };

/**
 * Sizes, SKUs, stock for sale and rental pieces. Counts are only ever shown here (admins) — the shop just sees
 * in stock / low / sold out, and whether a size can be rented for a date.
 */
export function ProductSizes({ product, onChange }: { product: AdminProduct; onChange: (v: AdminVariant[]) => void }) {
  const [edits, setEdits] = useState<Record<string, Row>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const free = SIZES.filter((s) => !product.variants.some((v) => v.size === s));
  const [draft, setDraft] = useState({ size: "", sku: "", stock: "0", rent: "0", price: "" });
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});

  const rowOf = (v: AdminVariant): Row => edits[v.id] ?? { stock: String(v.stock), rent: String(v.rentStock), price: centsToRupees(v.priceOverrideCents) };
  const dirty = (v: AdminVariant) => {
    const r = rowOf(v);
    return r.stock !== String(v.stock) || r.rent !== String(v.rentStock) || r.price !== centsToRupees(v.priceOverrideCents);
  };

  async function save(v: AdminVariant) {
    const r = rowOf(v);
    const stock = Number(r.stock);
    if (!Number.isInteger(stock) || stock < 0) return void toast.error(`Size ${v.size}: stock must be a whole number`);
    const rentStock = Number(r.rent);
    if (!Number.isInteger(rentStock) || rentStock < 0) return void toast.error(`Size ${v.size}: rental pieces must be a whole number`);
    const priceOverrideCents = r.price.trim() ? rupeesToCents(r.price) : null;
    if (r.price.trim() && !priceOverrideCents) return void toast.error(`Size ${v.size}: enter a valid price or leave it empty`);
    setBusy(v.id);
    try {
      await api(`/admin/products/${product.id}/variants/${v.id}`, { method: "PATCH", json: { stock, rentStock, priceOverrideCents } });
      onChange(product.variants.map((x) => (x.id === v.id ? { ...x, stock, rentStock, priceOverrideCents: priceOverrideCents ?? null } : x)));
      setEdits((all) => {
        const rest = { ...all };
        delete rest[v.id];
        return rest;
      });
      toast.success(`Size ${v.size} saved`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't save");
    } finally {
      setBusy(null);
    }
  }

  async function remove(v: AdminVariant) {
    setBusy(v.id);
    try {
      await api(`/admin/products/${product.id}/variants/${v.id}`, { method: "DELETE" });
      onChange(product.variants.filter((x) => x.id !== v.id));
      setConfirmDelete(null);
      toast.success(`Size ${v.size} removed`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't remove");
    } finally {
      setBusy(null);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      size: draft.size,
      sku: draft.sku || `${product.slug.slice(0, 40)}-${draft.size}`.toUpperCase(),
      stock: Number(draft.stock),
      rentStock: Number(draft.rent),
      priceOverrideCents: draft.price.trim() ? (rupeesToCents(draft.price) ?? -1) : null,
    };
    const parsed = adminVariantSchema.safeParse(body);
    if (!parsed.success) return setDraftErrors(fieldErrors(parsed.error));
    setDraftErrors({});
    setBusy("new");
    try {
      const r = await api<{ variant: { id: string } }>(`/admin/products/${product.id}/variants`, { method: "POST", json: parsed.data });
      onChange([...product.variants, { id: r.variant.id, size: parsed.data.size, sku: parsed.data.sku, stock: parsed.data.stock, rentStock: parsed.data.rentStock ?? 0, priceOverrideCents: parsed.data.priceOverrideCents ?? null }]);
      setDraft({ size: "", sku: "", stock: "0", rent: "0", price: "" });
      toast.success(`Size ${parsed.data.size} added`);
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) setDraftErrors(Object.fromEntries(err.details.map((d) => [d.path, d.message])));
      else toast.error(err instanceof ApiError ? err.message : "Couldn't add the size");
    } finally {
      setBusy(null);
    }
  }

  const sorted = [...product.variants].sort((a, b) => SIZES.indexOf(a.size as never) - SIZES.indexOf(b.size as never));

  return (
    <section id="sizes" aria-labelledby="sizes-h" className="mt-8 scroll-mt-24 rounded-2xl border border-line bg-paper p-5 sm:p-6">
      <h2 id="sizes-h" className="font-sans text-lg font-medium">Sizes &amp; stock</h2>
      <p className="mt-1 text-sm text-stone">Customers see “in stock”, “only a few left” (3 or fewer) or “sold out” — never the number.{product.rentEnabled ? " Rental pieces are separate from stock for sale; a size can be rented for a date while a piece is free." : ""}</p>

      <div className="relative mt-5 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-stone">
            <tr>
              <th scope="col" className="py-2 pr-3 font-medium">Size</th>
              <th scope="col" className="py-2 pr-3 font-medium">SKU</th>
              <th scope="col" className="py-2 pr-3 font-medium">Stock</th>
              <th scope="col" className="py-2 pr-3 font-medium">Rental pieces</th>
              <th scope="col" className="py-2 pr-3 font-medium">Own price (LKR)</th>
              <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((v) => {
              const r = rowOf(v);
              const set = (k: keyof Row) => (e: React.ChangeEvent<HTMLInputElement>) => setEdits((all) => ({ ...all, [v.id]: { ...r, [k]: e.target.value } }));
              return (
                <tr key={v.id}>
                  <th scope="row" className="py-2 pr-3 font-medium">{v.size}</th>
                  <td className="py-2 pr-3 font-mono text-xs text-stone">{v.sku}</td>
                  <td className="py-2 pr-3">
                    <Input type="number" min={0} inputMode="numeric" value={r.stock} onChange={set("stock")} aria-label={`Stock for size ${v.size}`} className={cn("h-10 w-24", Number(r.stock) <= 3 && "border-brass")} />
                  </td>
                  <td className="py-2 pr-3">
                    <Input type="number" min={0} inputMode="numeric" value={r.rent} onChange={set("rent")} aria-label={`Rental pieces for size ${v.size}`} className={cn("h-10 w-24", !product.rentEnabled && "opacity-60")} />
                  </td>
                  <td className="py-2 pr-3">
                    <Input inputMode="decimal" value={r.price} onChange={set("price")} placeholder="—" aria-label={`Own price for size ${v.size} (optional)`} className="h-10 w-32" />
                  </td>
                  <td className="py-2 text-right">
                    {confirmDelete === v.id ? (
                      <span className="inline-flex gap-1">
                        <Button size="sm" variant="destructive" loading={busy === v.id} onClick={() => void remove(v)}>Remove</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Keep</Button>
                      </span>
                    ) : (
                      <span className="inline-flex gap-1">
                        {dirty(v) && <Button size="sm" loading={busy === v.id} onClick={() => void save(v)}>Save</Button>}
                        <Button size="icon-sm" variant="ghost" onClick={() => setConfirmDelete(v.id)} aria-label={`Remove size ${v.size}`} className="text-wine hover:bg-wine/10"><Trash2 aria-hidden /></Button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-stone">No sizes yet — the product can&apos;t be bought until you add one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={add} className="mt-5 grid gap-3 rounded-xl bg-linen/60 p-4 sm:grid-cols-[110px_1fr_100px_100px_130px_auto] sm:items-end" noValidate>
        <label className="flex flex-col gap-1 text-xs text-stone">
          Size
          <select value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })} className="h-11 rounded-[var(--radius)] border border-line bg-paper px-3 text-sm text-ink" aria-invalid={draftErrors.size ? true : undefined}>
            <option value="">Choose</option>
            {free.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone">
          SKU (optional)
          <Input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} placeholder={draft.size ? `${product.slug.slice(0, 40)}-${draft.size}`.toUpperCase() : "Made from the name"} className="h-11 font-mono text-xs" aria-invalid={draftErrors.sku ? true : undefined} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone">
          Stock
          <Input type="number" min={0} inputMode="numeric" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} className="h-11" aria-invalid={draftErrors.stock ? true : undefined} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone">
          Rental pieces
          <Input type="number" min={0} inputMode="numeric" value={draft.rent} onChange={(e) => setDraft({ ...draft, rent: e.target.value })} className="h-11" aria-invalid={draftErrors.rentStock ? true : undefined} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone">
          Own price (optional)
          <Input inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className="h-11" aria-invalid={draftErrors.priceOverrideCents ? true : undefined} />
        </label>
        <Button type="submit" loading={busy === "new"} className="h-11"><Plus aria-hidden /> Add size</Button>
        {Object.keys(draftErrors).length > 0 && (
          <p role="alert" className="text-sm text-wine sm:col-span-6">{Object.values(draftErrors)[0]}</p>
        )}
      </form>
    </section>
  );
}
