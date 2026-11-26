"use client";

import { Banknote, CreditCard, Landmark, MapPin, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { checkoutSchema, type PaymentMethod, SL_DISTRICTS } from "@seamwell/shared";
import { BagTotals } from "@/components/cart/BagTotals";
import { Stepper } from "@/components/checkout/Stepper";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Price } from "@/components/ui/Price";
import { api, ApiError } from "@/lib/api";
import { clearQuoteCache, useQuote } from "@/lib/quote";
import { getSession, type SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { rentalSummary } from "@/lib/rental";
import { useCart } from "@/store/cart";
import { type PlacedOrder, useLastOrder } from "@/store/last-order";

const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

const STEPS = ["Details", "Delivery", "Payment"] as const;
/** Which error paths belong to which step (used to validate one step at a time and to jump to errors). */
const STEP_OF = (path: string) => (path.startsWith("customer.") ? 0 : path.startsWith("shippingAddress.") || path === "notes" ? 1 : 2);

type SavedAddress = { id: string; label: string; line1: string; line2: string | null; city: string; district: string; postalCode: string | null; isDefault: boolean };
type Form = { name: string; email: string; phone: string; line1: string; line2: string; city: string; district: string; postalCode: string; notes: string };
const EMPTY: Form = { name: "", email: "", phone: "", line1: "", line2: "", city: "", district: "", postalCode: "", notes: "" };

/** Guest-friendly checkout: Cash on Delivery or Bank Transfer. Card gateway (e.g. PayHere) arrives in a later phase. */
export default function CheckoutPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { lines, clear } = useCart();
  const setLastOrder = useLastOrder((s) => s.set);
  const { quote, loading, error: quoteError, unavailable } = useQuote(lines, hydrated);

  const [form, setForm] = useState<Form>(EMPTY);
  const [method, setMethod] = useState<PaymentMethod>("cod");
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [addressChoice, setAddressChoice] = useState<string>("new");
  // One key per checkout attempt: a double-click / retry / refresh-resubmit returns the SAME order.
  const idempotencyKey = useRef<string>("");
  const stepHeading = useRef<HTMLHeadingElement>(null);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const fillAddress = (a: SavedAddress) => setForm((f) => ({ ...f, line1: a.line1, line2: a.line2 ?? "", city: a.city, district: a.district, postalCode: a.postalCode ?? "" }));

  // Signed-in customers: pre-fill contact details and offer saved addresses.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const u = await getSession();
      if (!alive || !u) return;
      setUser(u);
      setForm((f) => ({ ...f, name: f.name || u.name, email: f.email || u.email, phone: f.phone || (u.phone ?? "") }));
      try {
        const { addresses } = await api<{ addresses: SavedAddress[] }>("/account/addresses", { cache: "no-store" });
        if (!alive || !addresses.length) return;
        setSaved(addresses);
        const def = addresses.find((a) => a.isDefault) ?? addresses[0]!;
        setAddressChoice(def.id);
        setForm((f) => (f.line1 ? f : { ...f, line1: def.line1, line2: def.line2 ?? "", city: def.city, district: def.district, postalCode: def.postalCode ?? "" }));
      } catch {
        /* addresses are optional */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const payload = () => {
    const v = (s: string) => s.trim() || undefined;
    return {
      customer: { name: v(form.name), email: v(form.email), phone: v(form.phone)?.replace(/[\s-]/g, "") },
      shippingAddress: { line1: v(form.line1), line2: v(form.line2), city: v(form.city), district: v(form.district), postalCode: v(form.postalCode) },
      paymentMethod: method,
      notes: v(form.notes),
      items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, ...(l.mode === "rent" && { mode: "rent" as const, eventDate: l.eventDate }) })),
    };
  };

  /** Validate with the SAME schema the API uses. `only` = a single step; omitted = everything. */
  function validate(only?: number) {
    const r = checkoutSchema.safeParse(payload());
    const found: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) found[i.path.join(".")] ??= i.message;
    const inScope = (p: string) => only === undefined || STEP_OF(p) === only;
    setErrors((prev) => {
      const kept = Object.fromEntries(Object.entries(prev).filter(([p]) => !inScope(p)));
      return { ...kept, ...Object.fromEntries(Object.entries(found).filter(([p]) => inScope(p))) };
    });
    const relevant = Object.keys(found).filter(inScope);
    return { ok: relevant.length === 0, firstStep: relevant.length ? Math.min(...relevant.map(STEP_OF)) : -1, data: r.success ? r.data : null };
  }

  const focusFirstError = () => requestAnimationFrame(() => document.querySelector<HTMLElement>('form [aria-invalid="true"]')?.focus());
  const goTo = (i: number) => {
    setStep(i);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      stepHeading.current?.focus({ preventScroll: true });
    });
  };

  function next() {
    const { ok } = validate(step);
    if (ok) goTo(step + 1);
    else focusFirstError();
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || unavailable.length) return;
    const { ok, firstStep, data } = validate();
    if (!ok || !data) {
      if (firstStep >= 0 && firstStep !== step) setStep(firstStep);
      focusFirstError();
      return;
    }
    setFormError("");
    setBusy(true);
    idempotencyKey.current ||= crypto.randomUUID();
    try {
      const res = await api<PlacedOrder>("/orders", { method: "POST", json: data, headers: { "Idempotency-Key": idempotencyKey.current } });
      setLastOrder(res);
      clear();
      clearQuoteCache();
      router.push(`/order/${res.orderNumber}/thank-you`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          const found = Object.fromEntries(err.details.map((d) => [d.path, d.message]));
          setErrors(found);
          const first = Math.min(...Object.keys(found).map(STEP_OF));
          if (Number.isFinite(first) && first !== step) setStep(first);
          focusFirstError();
        }
        if (err.status === 409) clearQuoteCache();
        // The key was already used for another order (different details) → start a fresh attempt.
        if (err.status === 409 && /already used/i.test(err.message)) idempotencyKey.current = "";
        setFormError(err.message);
      } else {
        setFormError("We couldn't reach the shop. Check your connection and try again — you won't be charged twice.");
      }
      setBusy(false);
    }
  }

  if (!hydrated) return <div className="container-sw min-h-[50vh] py-12" />;

  if (!lines.length) {
    return (
      <div className="container-sw py-16">
        <EmptyState icon={ShoppingBag} title="Your bag is empty" description="Add something to your bag before checking out." action={<Button asChild><Link href="/shop">Continue shopping</Link></Button>} />
      </div>
    );
  }

  const blocked = unavailable.length > 0;
  const summary = (
    <>
      <ul className="space-y-2 text-sm">
        {lines.map((l) => (
          <li key={l.key} className="flex justify-between gap-3">
            <span>
              {l.quantity} × {l.name} <span className="text-stone">({l.size})</span>
              {l.mode === "rent" && <span className="block text-xs text-brass-ink">Rent · {rentalSummary(l)}</span>}
            </span>
            <Price size="sm" cents={l.unitPriceCents * l.quantity} className="shrink-0 [&>span]:font-normal" />
          </li>
        ))}
      </ul>
      <BagTotals className="mt-4 border-t border-line pt-4" lines={lines} quote={quote} loading={loading} error={quoteError} />
      {blocked && (
        <p role="alert" className="mt-4 rounded-xl bg-wine/10 p-3 text-sm text-wine">
          Some items are no longer available. <Link href="/cart" className="font-medium underline">Review your bag</Link> to continue.
        </p>
      )}
    </>
  );
  const placeButton = (extra?: string) => (
    <Button type="submit" size="lg" block loading={busy} disabled={blocked} className={extra}>
      Place order{quote ? ` · ` : ""}
      {quote && <Price cents={quote.totalCents} className="[&>span]:font-semibold" />}
    </Button>
  );

  return (
    <div className="container-sw py-10 md:py-12">
      <h1 className="text-[clamp(2.4rem,5vw,4rem)] leading-tight">Checkout</h1>
      <p className="mt-2 text-sm text-stone">
        {user ? (
          <>Signed in as <span className="font-medium text-ink">{user.email}</span> — this order will be saved to your account.</>
        ) : (
          <>Checking out as a guest. <Link href="/login?next=/checkout" className="underline">Sign in</Link> to use saved addresses.</>
        )}
      </p>

      <div className="mt-6 lg:hidden">
        <Stepper steps={STEPS} current={step} onStep={goTo} />
      </div>

      <form onSubmit={submit} noValidate className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10">
          {/* Step 1 — Details */}
          <fieldset className={cn("space-y-4", step !== 0 && "hidden lg:block")}>
            <legend className="mb-4 font-display text-2xl">
              <span ref={step === 0 ? stepHeading : undefined} tabIndex={-1} className="outline-none">1 · Your details</span>
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full name" name="name" autoComplete="name" value={form.name} onChange={set("name")} error={errors["customer.name"]} wrapperClassName="sm:col-span-2" />
              <FormField label="Email" name="email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} error={errors["customer.email"]} hint="For your confirmation and tracking." />
              <FormField label="Mobile number" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="07X XXX XXXX" value={form.phone} onChange={set("phone")} error={errors["customer.phone"]} hint="The courier calls before delivery." />
            </div>
            <div className="flex justify-end lg:hidden">
              <Button onClick={next}>Continue to delivery</Button>
            </div>
          </fieldset>

          {/* Step 2 — Delivery */}
          <fieldset className={cn("space-y-4", step !== 1 && "hidden lg:block")}>
            <legend className="mb-4 font-display text-2xl">
              <span ref={step === 1 ? stepHeading : undefined} tabIndex={-1} className="outline-none">2 · Delivery address</span>
            </legend>

            {saved.length > 0 && (
              <div role="radiogroup" aria-label="Saved addresses" className="grid gap-3 sm:grid-cols-2">
                {saved.map((a) => (
                  <label key={a.id} className={cn("flex cursor-pointer gap-3 rounded-2xl border bg-paper p-4 transition-[border-color,box-shadow] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brass/30", addressChoice === a.id ? "border-midnight ring-2 ring-midnight/15" : "border-line hover:border-ink/30")}>
                    <input type="radio" name="savedAddress" value={a.id} checked={addressChoice === a.id} onChange={() => { setAddressChoice(a.id); fillAddress(a); }} className="sr-only" />
                    <MapPin className="mt-0.5 size-4 shrink-0 text-brass-ink" aria-hidden />
                    <span className="text-sm">
                      <span className="font-medium">{a.label}{a.isDefault && <span className="ml-2 text-xs text-stone">Default</span>}</span>
                      <span className="block text-stone">{[a.line1, a.line2, a.city, a.district].filter(Boolean).join(", ")}</span>
                    </span>
                  </label>
                ))}
                <label className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed bg-paper p-4 text-sm transition-[border-color,box-shadow] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brass/30", addressChoice === "new" ? "border-midnight" : "border-line hover:border-ink/30")}>
                  <input type="radio" name="savedAddress" value="new" checked={addressChoice === "new"} onChange={() => { setAddressChoice("new"); setForm((f) => ({ ...f, line1: "", line2: "", city: "", district: "", postalCode: "" })); }} className="sr-only" />
                  + Use a new address
                </label>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Address" name="line1" autoComplete="address-line1" value={form.line1} onChange={set("line1")} error={errors["shippingAddress.line1"]} wrapperClassName="sm:col-span-2" />
              <FormField label="Apartment, landmark (optional)" name="line2" autoComplete="address-line2" value={form.line2} onChange={set("line2")} error={errors["shippingAddress.line2"]} wrapperClassName="sm:col-span-2" />
              <FormField label="City / town" name="city" autoComplete="address-level2" value={form.city} onChange={set("city")} error={errors["shippingAddress.city"]} />
              <FormField as="select" label="District" name="district" autoComplete="address-level1" value={form.district} onChange={set("district")} error={errors["shippingAddress.district"]}>
                <option value="" disabled>Choose your district</option>
                {SL_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </FormField>
              <FormField label="Postal code (optional)" name="postalCode" autoComplete="postal-code" inputMode="numeric" maxLength={5} value={form.postalCode} onChange={set("postalCode")} error={errors["shippingAddress.postalCode"]} />
              <FormField as="textarea" label="Notes for the tailor (optional)" name="notes" rows={3} maxLength={500} value={form.notes} onChange={set("notes")} error={errors.notes} wrapperClassName="sm:col-span-2" hint="Measurements, alteration requests or delivery instructions." />
            </div>
            <div className="flex justify-between lg:hidden">
              <Button variant="ghost" onClick={() => goTo(0)}>Back</Button>
              <Button onClick={next}>Continue to payment</Button>
            </div>
          </fieldset>

          {/* Step 3 — Payment */}
          <fieldset className={cn(step !== 2 && "hidden lg:block")}>
            <legend className="mb-4 font-display text-2xl">
              <span ref={step === 2 ? stepHeading : undefined} tabIndex={-1} className="outline-none">3 · Payment</span>
            </legend>
            <div role="radiogroup" aria-label="Payment method" className="grid gap-3 sm:grid-cols-3">
              {[
                { id: "cod" as const, icon: Banknote, title: "Cash on delivery", note: "Pay the courier" },
                { id: "bank_transfer" as const, icon: Landmark, title: "Bank transfer", note: "Details after ordering" },
              ].map((m) => (
                <label key={m.id} className={cn("cursor-pointer rounded-2xl border bg-paper p-4 transition-[border-color,box-shadow] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brass/30", method === m.id ? "border-midnight ring-2 ring-midnight/15" : "border-line hover:border-ink/30")}>
                  <input type="radio" name="paymentMethod" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="sr-only" />
                  <m.icon className="h-5 w-5 text-brass-ink" aria-hidden />
                  <span className="mt-2 block font-medium">{m.title}</span>
                  <span className="block text-xs text-stone">{m.note}</span>
                </label>
              ))}
              <div className="rounded-2xl border border-dashed border-line p-4 opacity-60" aria-disabled>
                <CreditCard className="h-5 w-5 text-stone" aria-hidden />
                <span className="mt-2 block font-medium">Card / online</span>
                <span className="block text-xs text-stone">Coming soon</span>
              </div>
            </div>

            {/* Mobile: review + place order inside the last step */}
            <div className="mt-8 rounded-2xl border border-line bg-paper p-5 lg:hidden">
              <h2 className="font-display text-2xl">Order summary</h2>
              <div className="mt-4">{summary}</div>
              {formError && <p role="alert" className="mt-4 rounded-xl bg-wine/10 p-3 text-sm text-wine">{formError}</p>}
              {placeButton("mt-6")}
              <Button variant="ghost" block className="mt-2" onClick={() => goTo(1)}>Back</Button>
            </div>
          </fieldset>
        </div>

        <aside className="hidden h-fit rounded-2xl border border-line bg-paper p-6 lg:sticky lg:top-24 lg:block" aria-label="Order summary">
          <h2 className="font-display text-2xl">Order summary</h2>
          <div className="mt-4">{summary}</div>
          {formError && <p role="alert" className="mt-4 rounded-xl bg-wine/10 p-3 text-sm text-wine">{formError}</p>}
          {placeButton("mt-6")}
          <p className="mt-3 text-center text-xs text-stone">You won&apos;t be charged twice — pressing again just shows the same order.</p>
        </aside>
      </form>
    </div>
  );
}
