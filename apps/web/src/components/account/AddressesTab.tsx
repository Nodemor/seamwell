"use client";

import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { savedAddressSchema, SL_DISTRICTS } from "@seamwell/shared";
import { FormMessage } from "@/components/auth/AuthShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { apiErrors, fieldErrors, focusFirstInvalid } from "@/lib/forms";

export type SavedAddress = { id: string; label: string; line1: string; line2: string | null; city: string; district: string; postalCode: string | null; isDefault: boolean };
type Draft = { label: string; line1: string; line2: string; city: string; district: string; postalCode: string; isDefault: boolean };
const EMPTY: Draft = { label: "", line1: "", line2: "", city: "", district: "", postalCode: "", isDefault: false };
const MAX = 10;

export function AddressesTab() {
  const [list, setList] = useState<SavedAddress[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);
  useEffect(() => {
    let alive = true;
    api<{ addresses: SavedAddress[] }>("/account/addresses", { cache: "no-store" })
      .then((r) => alive && setList(r.addresses))
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : "We couldn't load your addresses."));
    return () => {
      alive = false;
    };
  }, [version]);

  async function remove(a: SavedAddress) {
    try {
      await api(`/account/addresses/${a.id}`, { method: "DELETE" });
      toast.success(`Removed “${a.label}”`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't remove the address.");
    }
  }

  async function makeDefault(a: SavedAddress) {
    try {
      await api(`/account/addresses/${a.id}`, { method: "PATCH", json: { isDefault: true } });
      toast.success(`“${a.label}” is now your default address`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update the address.");
    }
  }

  if (error) return <p role="alert" className="rounded-xl bg-wine/10 p-3 text-sm text-wine">{error}</p>;
  if (!list) {
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
        {[0, 1].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        <span className="sr-only">Loading your addresses…</span>
      </div>
    );
  }

  return (
    <>
      {list.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Save your home or office address and checkout fills it in for you."
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus aria-hidden /> Add an address
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone">{list.length} of {MAX} saved</p>
            <Button size="sm" onClick={() => setEditing("new")} disabled={list.length >= MAX}>
              <Plus aria-hidden /> Add address
            </Button>
          </div>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {list.map((a) => (
              <li key={a.id} className="flex flex-col rounded-2xl border border-line bg-paper p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-sans text-base font-medium">{a.label}</h3>
                  {a.isDefault && <Badge variant="accent">Default</Badge>}
                </div>
                <address className="mt-2 flex-1 text-sm not-italic leading-relaxed text-stone">
                  {a.line1}
                  {a.line2 && <><br />{a.line2}</>}
                  <br />
                  {a.city}, {a.district}
                  {a.postalCode && ` ${a.postalCode}`}
                </address>
                <div className="mt-4 flex flex-wrap gap-1">
                  {confirmDelete === a.id ? (
                    <>
                      <Button size="sm" variant="destructive" onClick={() => void remove(a)}>
                        Yes, remove
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                        Keep
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(a)} aria-label={`Edit ${a.label}`}>
                        <Pencil aria-hidden /> Edit
                      </Button>
                      {!a.isDefault && (
                        <Button size="sm" variant="ghost" onClick={() => void makeDefault(a)} aria-label={`Make ${a.label} the default address`}>
                          <Star aria-hidden /> Make default
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(a.id)} aria-label={`Remove ${a.label}`} className="text-wine hover:bg-wine/10">
                        <Trash2 aria-hidden /> Remove
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <AddressDialog
        editing={editing}
        isFirst={list.length === 0}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    </>
  );
}

function AddressDialog({ editing, isFirst, onClose, onSaved }: { editing: SavedAddress | "new" | null; isFirst: boolean; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  // Reset the form whenever a different address (or "new") is opened — adjust state during render.
  const [openedFor, setOpenedFor] = useState<typeof editing>(null);
  if (editing !== openedFor) {
    setOpenedFor(editing);
    setErrors({});
    setMessage("");
    if (editing && editing !== "new") {
      setDraft({ label: editing.label, line1: editing.line1, line2: editing.line2 ?? "", city: editing.city, district: editing.district, postalCode: editing.postalCode ?? "", isDefault: editing.isDefault });
    } else if (editing === "new") setDraft({ ...EMPTY, isDefault: isFirst });
  }

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: k === "isDefault" ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = (s: string) => s.trim() || undefined;
    const parsed = savedAddressSchema.safeParse({ label: v(draft.label), line1: v(draft.line1), line2: v(draft.line2), city: v(draft.city), district: v(draft.district), postalCode: v(draft.postalCode), isDefault: draft.isDefault });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      focusFirstInvalid(form.current);
      return;
    }
    setErrors({});
    setMessage("");
    setBusy(true);
    try {
      if (editing === "new") await api("/account/addresses", { method: "POST", json: parsed.data });
      else if (editing) await api(`/account/addresses/${editing.id}`, { method: "PATCH", json: parsed.data });
      toast.success(editing === "new" ? "Address saved" : "Address updated");
      onSaved();
    } catch (err) {
      const r = apiErrors(err);
      setErrors(r.fields);
      setMessage(r.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={editing !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing === "new" ? "Add an address" : "Edit address"}</DialogTitle>
          <DialogDescription>We deliver island-wide. Checkout can fill this in for you.</DialogDescription>
        </DialogHeader>
        <form ref={form} onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Name for this address" placeholder="Home, Office…" value={draft.label} onChange={set("label")} error={errors.label} wrapperClassName="sm:col-span-2" autoComplete="off" />
          <FormField label="Street address" value={draft.line1} onChange={set("line1")} error={errors.line1} wrapperClassName="sm:col-span-2" autoComplete="address-line1" />
          <FormField label="Apartment, floor (optional)" value={draft.line2} onChange={set("line2")} error={errors.line2} wrapperClassName="sm:col-span-2" autoComplete="address-line2" />
          <FormField label="City / town" value={draft.city} onChange={set("city")} error={errors.city} autoComplete="address-level2" />
          <FormField as="select" label="District" value={draft.district} onChange={set("district")} error={errors.district} autoComplete="address-level1">
            <option value="">Choose…</option>
            {SL_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </FormField>
          <FormField label="Postal code (optional)" inputMode="numeric" value={draft.postalCode} onChange={set("postalCode")} error={errors.postalCode} autoComplete="postal-code" />
          <label className="flex min-h-11 items-center gap-3 self-end text-sm">
            <input type="checkbox" checked={draft.isDefault} onChange={set("isDefault")} className="size-5 accent-[var(--sw-midnight)]" />
            Use as my default address
          </label>
          {message && <div className="sm:col-span-2"><FormMessage>{message}</FormMessage></div>}
          <DialogFooter className="sm:col-span-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={busy}>Save address</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
