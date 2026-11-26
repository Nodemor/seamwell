"use client";

import { Banknote, ExternalLink, Mail, MapPin, Phone, RotateCcw, Truck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { COURIERS, type CourierSettings, ORDER_STATUS_LABEL, ORDER_TRANSITIONS, type OrderStatus, trackingUrlFor } from "@seamwell/shared";
import { FormMessage } from "@/components/auth/AuthShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/FormField";
import { Price } from "@/components/ui/Price";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { type AdminOrder, dateTime } from "@/lib/admin";
import { api, ApiError } from "@/lib/api";
import { apiErrors } from "@/lib/forms";
import { DEPOSIT_LABEL, rentalSummary } from "@/lib/rental";
import { cn } from "@/lib/utils";

type Patch = { status: OrderStatus; note?: string; paymentStatus?: "paid"; courierName?: string; trackingNumber?: string; trackingUrl?: string; depositStatus?: "refunded" | "kept" };

/** Order detail drawer: customer, address, items, timeline — and only the status buttons that are allowed next. */
export function OrderDrawer({ orderNumber, onClose, onChanged }: { orderNumber: string | null; onClose: () => void; onChanged: () => void }) {
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [deposit, setDeposit] = useState<"refunded" | "kept">("refunded");

  // New order opened → reset (adjust state during render, no effect)
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (orderNumber !== shownFor) {
    setShownFor(orderNumber);
    setOrder(null);
    setError("");
    setNote("");
    setConfirmCancel(false);
    setReturnOpen(false);
  }

  useEffect(() => {
    if (!orderNumber) return;
    let alive = true;
    api<{ order: AdminOrder }>(`/admin/orders/${encodeURIComponent(orderNumber)}`, { cache: "no-store" })
      .then((r) => alive && setOrder(r.order))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Couldn't load the order"));
    return () => {
      alive = false;
    };
  }, [orderNumber]);

  async function change(patch: Patch) {
    if (!order) return false;
    setBusy(patch.status);
    try {
      await api(`/admin/orders/${order.orderNumber}/status`, { method: "PATCH", json: { ...patch, note: patch.note ?? (note.trim() || undefined) } });
      const fresh = await api<{ order: AdminOrder }>(`/admin/orders/${order.orderNumber}`, { cache: "no-store" });
      setOrder(fresh.order);
      setNote("");
      setConfirmCancel(false);
      setReturnOpen(false);
      toast.success(`${order.orderNumber}: ${ORDER_STATUS_LABEL[patch.status]}`);
      onChanged();
      return true;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't update the order");
      return false;
    } finally {
      setBusy(null);
    }
  }

  // "Returned" only applies to orders with rented pieces
  const next = order
    ? ORDER_TRANSITIONS[order.status].filter((s) => !(s === "awaiting_payment" && order.paymentMethod !== "bank_transfer") && !(s === "returned" && !order.hasRental))
    : [];

  return (
    <Sheet open={!!orderNumber} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[94%] max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-mono text-2xl">{orderNumber}</SheetTitle>
          <SheetDescription>{order ? `Placed ${dateTime(order.createdAt)}` : "Loading…"}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5">
          {error && <FormMessage>{error}</FormMessage>}
          {!order && !error && <Skeleton className="h-96 rounded-2xl" />}
          {order && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={order.status} />
                <span className="text-sm text-stone">
                  {order.paymentMethod === "cod" ? "Cash on delivery" : "Bank transfer"} ·{" "}
                  <span className={order.paymentStatus === "paid" ? "text-sage" : ""}>{order.paymentStatus.replace("_", " ")}</span>
                </span>
              </div>

              {/* Actions */}
              {next.length > 0 && (
                <section aria-label="Next steps" className="rounded-2xl border border-line bg-paper p-4">
                  <h3 className="font-sans text-sm font-medium">Next step</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {next.map((s) =>
                      s === "cancelled" ? null : s === "shipped" ? (
                        <Button key={s} onClick={() => setShipOpen(true)}>
                          <Truck aria-hidden /> Ship…
                        </Button>
                      ) : s === "returned" ? (
                        <Button key={s} onClick={() => setReturnOpen(true)}>
                          <RotateCcw aria-hidden /> Mark returned…
                        </Button>
                      ) : s === "confirmed" && order.status === "awaiting_payment" ? (
                        <Button key={s} loading={busy === s} onClick={() => void change({ status: "confirmed", paymentStatus: "paid", note: note.trim() || "Bank transfer received" })}>
                          <Banknote aria-hidden /> Mark paid & confirm
                        </Button>
                      ) : (
                        <Button key={s} variant={s === "delivered" ? "primary" : "secondary"} loading={busy === s} onClick={() => void change({ status: s })}>
                          {s === "confirmed" ? "Confirm order" : `Mark ${ORDER_STATUS_LABEL[s].toLowerCase()}`}
                        </Button>
                      ),
                    )}
                  </div>
                  <FormField label="Note for the history (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} wrapperClassName="mt-4" placeholder="e.g. Called customer to confirm size" />
                  {returnOpen && (
                    <div className="mt-4 rounded-xl bg-linen/70 p-3 text-sm">
                      <p className="font-medium">Are the rented pieces back?</p>
                      {order.depositCents > 0 ? (
                        <fieldset className="mt-2">
                          <legend className="text-stone">What happened to the deposit?</legend>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(["refunded", "kept"] as const).map((d) => (
                              <label
                                key={d}
                                className={cn(
                                  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brass/30 sm:min-h-9",
                                  deposit === d ? "border-midnight bg-midnight text-ivory" : "border-line bg-paper",
                                )}
                              >
                                <input type="radio" name="deposit" value={d} checked={deposit === d} onChange={() => setDeposit(d)} className="sr-only" />
                                {d === "refunded" ? "Refunded to the customer" : "Kept (damage or late)"}
                              </label>
                            ))}
                          </div>
                          {deposit === "kept" && <p className="mt-2 text-xs text-stone">Add a note above explaining why. The customer is emailed that we will be in touch.</p>}
                        </fieldset>
                      ) : (
                        <p className="mt-1 text-stone">There is no deposit on this order.</p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" loading={busy === "returned"} onClick={() => void change({ status: "returned", ...(order.depositCents > 0 && { depositStatus: deposit }) })}>
                          Confirm returned
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setReturnOpen(false)}>Not yet</Button>
                      </div>
                    </div>
                  )}
                  {next.includes("cancelled") &&
                    (confirmCancel ? (
                      <div className="mt-4 rounded-xl bg-wine/5 p-3 text-sm">
                        <p>Cancel this order? Its items go back into stock. This can&apos;t be undone.</p>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="destructive" loading={busy === "cancelled"} onClick={() => void change({ status: "cancelled" })}>Yes, cancel order</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)}>Keep it</Button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmCancel(true)} className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-wine underline-offset-4 hover:underline">
                        <XCircle className="size-4" aria-hidden /> Cancel order
                      </button>
                    ))}
                </section>
              )}

              {order.trackingNumber && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-ivory p-4 text-sm">
                  <span>
                    <span className="block text-stone">{order.courierName}</span>
                    <span className="font-mono font-medium">{order.trackingNumber}</span>
                  </span>
                  {order.trackingUrl && (
                    <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-midnight underline-offset-4 hover:underline">
                      Courier page <ExternalLink className="size-3.5" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
                    </a>
                  )}
                </div>
              )}

              <section aria-labelledby="cust-h" className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 id="cust-h" className="font-sans text-xs font-semibold uppercase tracking-wider text-stone">Customer</h3>
                  <p className="mt-2 font-medium">{order.customer.name}{order.customer.hasAccount && <span className="ml-1 text-xs font-normal text-stone">(account)</span>}</p>
                  <a href={`tel:${order.customer.phone}`} className="mt-1 flex min-h-9 items-center gap-2 text-sm text-midnight"><Phone className="size-4" aria-hidden /> {order.customer.phone}</a>
                  <a href={`mailto:${order.customer.email}`} className="flex min-h-9 items-center gap-2 break-all text-sm text-midnight"><Mail className="size-4 shrink-0" aria-hidden /> {order.customer.email}</a>
                </div>
                <div>
                  <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-stone">Deliver to</h3>
                  <address className="mt-2 flex gap-2 text-sm not-italic leading-relaxed">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-brass" aria-hidden />
                    <span>
                      {order.address.line1}
                      {order.address.line2 && <><br />{order.address.line2}</>}
                      <br />
                      {order.address.city}, {order.address.district} {order.address.postalCode}
                    </span>
                  </address>
                </div>
              </section>
              {order.notes && <p className="rounded-xl bg-brass/10 p-3 text-sm"><strong className="font-medium">Customer note:</strong> {order.notes}</p>}

              <section aria-labelledby="items-h">
                <h3 id="items-h" className="font-sans text-xs font-semibold uppercase tracking-wider text-stone">Items</h3>
                <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-paper text-sm">
                  {order.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-3 p-3">
                      <span>
                        {it.quantity} × {it.productName} <span className="text-stone">· size {it.size}</span>
                        {it.mode === "rent" && (
                          <span className="mt-1 block text-xs text-brass-ink">
                            <span className="mr-1.5 rounded-full bg-brass/15 px-1.5 py-0.5 font-medium">Rent</span>
                            {rentalSummary(it)}
                          </span>
                        )}
                      </span>
                      <Price size="sm" cents={it.unitPriceCents * it.quantity} />
                    </li>
                  ))}
                  <li className="flex justify-between p-3 text-stone"><span>Delivery</span>{order.shippingCents ? <Price size="sm" cents={order.shippingCents} /> : <span>Free</span>}</li>
                  {order.depositCents > 0 && (
                    <li className="flex justify-between gap-3 p-3 text-stone">
                      <span>
                        Refundable deposit{" "}
                        <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-xs", order.depositStatus === "refunded" ? "bg-sage/15 text-sage" : order.depositStatus === "kept" ? "bg-wine/10 text-wine" : "bg-brass/15 text-brass-ink")}>
                          {DEPOSIT_LABEL[order.depositStatus]}
                        </span>
                      </span>
                      <Price size="sm" cents={order.depositCents} />
                    </li>
                  )}
                  <li className="flex justify-between p-3 font-medium"><span>Total</span><Price size="sm" cents={order.totalCents} /></li>
                </ul>
              </section>

              <section aria-labelledby="hist-h">
                <h3 id="hist-h" className="font-sans text-xs font-semibold uppercase tracking-wider text-stone">History</h3>
                <ol className="relative mt-3 space-y-4 border-l border-line pl-5">
                  {order.history.map((h, i) => (
                    <li key={i} className="relative text-sm">
                      <span aria-hidden className={cn("absolute -left-[26px] top-1 size-3 rounded-full border-2 border-paper", i === order.history.length - 1 ? "bg-brass" : "bg-line")} />
                      <p className="font-medium">{ORDER_STATUS_LABEL[h.status]}</p>
                      <p className="text-xs text-stone">{dateTime(h.at)}{h.by ? ` · ${h.by}` : ""}</p>
                      {h.note && <p className="mt-0.5 text-stone">{h.note}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          )}
        </div>
      </SheetContent>
      {order && <ShipDialog open={shipOpen} onOpenChange={setShipOpen} onShip={(p) => change({ status: "shipped", ...p })} />}
    </Sheet>
  );
}

function ShipDialog({ open, onOpenChange, onShip }: { open: boolean; onOpenChange: (o: boolean) => void; onShip: (p: { courierName: string; trackingNumber: string; trackingUrl?: string; note?: string }) => Promise<boolean> }) {
  const [templates, setTemplates] = useState<CourierSettings["templates"]>({});
  const [courier, setCourier] = useState<string>(COURIERS[0].id);
  const [otherName, setOtherName] = useState("");
  const [tracking, setTracking] = useState("");
  const [url, setUrl] = useState("");
  const [urlEdited, setUrlEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api<CourierSettings>("/admin/settings/couriers", { cache: "no-store" })
      .then((r) => setTemplates(r.templates))
      .catch(() => setTemplates({}));
  }, [open]);

  const preset = COURIERS.find((c) => c.id === courier)!;
  const autoUrl = trackingUrlFor(templates[preset.id], tracking) ?? "";
  const shownUrl = urlEdited ? url : autoUrl;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = courier === "other" ? otherName.trim() : preset.name;
    const found: Record<string, string> = {};
    if (!name) found.courierName = "Enter the courier's name";
    if (!/^[A-Za-z0-9-]{1,60}$/.test(tracking.trim())) found.trackingNumber = "Letters, numbers and dashes only";
    if (shownUrl && !/^https:\/\//.test(shownUrl)) found.trackingUrl = "Use an https:// link";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const ok = await onShip({ courierName: name, trackingNumber: tracking.trim(), trackingUrl: shownUrl || undefined });
      if (ok) {
        onOpenChange(false);
        setTracking("");
        setUrl("");
        setUrlEdited(false);
      }
    } catch (err) {
      setErrors(apiErrors(err).fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ship order</DialogTitle>
          <DialogDescription>The customer gets an email with the courier and tracking number.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormField as="select" label="Courier" value={courier} onChange={(e) => setCourier(e.target.value)}>
            {COURIERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FormField>
          {courier === "other" && <FormField label="Courier name" value={otherName} onChange={(e) => setOtherName(e.target.value)} error={errors.courierName} maxLength={60} />}
          <FormField label="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} error={errors.trackingNumber} className="font-mono" autoComplete="off" />
          <FormField
            label="Tracking link (optional)"
            type="url"
            inputMode="url"
            value={shownUrl}
            onChange={(e) => {
              setUrl(e.target.value);
              setUrlEdited(true);
            }}
            error={errors.trackingUrl}
            hint={templates[preset.id] && !urlEdited ? "Filled in from your courier settings" : "Add a template in Settings to fill this in automatically"}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={busy}><Truck aria-hidden /> Mark shipped</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
