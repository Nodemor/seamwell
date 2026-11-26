"use client";

import { Archive, ArchiveRestore, ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { adminProductSchema, adminProductUpdateSchema, GENDERS, RENTAL } from "@seamwell/shared";
import { AdminHeading, useAdminBase } from "@/components/admin/AdminShell";
import { ProductPhotos, TryonPhoto } from "@/components/admin/ProductMedia";
import { ProductSizes } from "@/components/admin/ProductSizes";
import { FormMessage } from "@/components/auth/AuthShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/FormField";
import { Skeleton } from "@/components/ui/skeleton";
import { type AdminProduct, type Category, centsToRupees, colomboLocalToIso, isoToColomboLocal, rupeesToCents } from "@/lib/admin";
import { api, ApiError } from "@/lib/api";

type Values = {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  gender: "men" | "women" | "unisex";
  price: string;
  compareAt: string;
  fabric: string;
  fit: string;
  color: string;
  colorHex: string;
  tryonEnabled: boolean;
  tryonSlot: "kit" | "blazer" | "shirt" | "trousers";
  tryonPhotoType: "flat-lay" | "model";
  rentEnabled: boolean;
  rentPrice: string;
  rentDeposit: string;
  rentDays: string;
  salePrice: string;
  saleStarts: string;
  saleEnds: string;
};

const EMPTY: Values = {
  name: "", slug: "", description: "", categoryId: "", gender: "men", price: "", compareAt: "", fabric: "", fit: "", color: "", colorHex: "",
  tryonEnabled: true, tryonSlot: "kit", tryonPhotoType: "flat-lay",
  rentEnabled: false, rentPrice: "", rentDeposit: "", rentDays: String(RENTAL.defaultDays), salePrice: "", saleStarts: "", saleEnds: "",
};
const toValues = (p: AdminProduct): Values => ({
  name: p.name,
  slug: p.slug,
  description: p.description,
  categoryId: p.categoryId,
  gender: p.gender,
  price: centsToRupees(p.priceCents),
  compareAt: centsToRupees(p.compareAtCents),
  fabric: p.fabric ?? "",
  fit: p.fit ?? "",
  color: p.color ?? "",
  colorHex: p.colorHex ?? "",
  tryonEnabled: p.tryonEnabled,
  tryonSlot: p.tryonSlot,
  tryonPhotoType: p.tryonPhotoType,
  rentEnabled: p.rentEnabled,
  rentPrice: centsToRupees(p.rentPriceCents),
  rentDeposit: centsToRupees(p.rentDepositCents),
  rentDays: String(p.rentDays),
  salePrice: centsToRupees(p.salePriceCents),
  saleStarts: isoToColomboLocal(p.saleStartsAt),
  saleEnds: isoToColomboLocal(p.saleEndsAt),
});
/** API field → form field (prices are typed in rupees, stored in cents). */
const FIELD: Record<string, keyof Values> = {
  priceCents: "price",
  compareAtCents: "compareAt",
  rentPriceCents: "rentPrice",
  rentDepositCents: "rentDeposit",
  salePriceCents: "salePrice",
  saleStartsAt: "saleStarts",
  saleEndsAt: "saleEnds",
};
const SLOT_LABEL = { kit: "Full outfit (one pass)", blazer: "Jacket / blazer (top)", shirt: "Shirt (top)", trousers: "Trousers (bottom)" };

/** Plain-language state of the sale for the editor (uses what's typed, before saving). */
function saleStatus(sale: string, starts: string, ends: string, price: string) {
  if (!sale.trim()) return { label: "— none", tone: "text-xs font-normal text-stone" };
  if (Number(sale) >= Number(price)) return { label: "— must be lower than the price", tone: "text-xs font-normal text-wine" };
  const now = Date.now();
  const s = colomboLocalToIso(starts);
  const e = colomboLocalToIso(ends);
  if (e && Date.parse(e) <= now) return { label: "— ended", tone: "text-xs font-normal text-stone" };
  if (s && Date.parse(s) > now) return { label: "— scheduled", tone: "rounded-full bg-brass/15 px-2 py-0.5 text-xs font-medium text-brass-ink" };
  return { label: "— running now", tone: "rounded-full bg-sage/15 px-2 py-0.5 text-xs font-medium text-sage" };
}

export function ProductEditor({ id }: { id?: string }) {
  const router = useRouter();
  const base = useAdminBase();
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const form = useForm<Values>({ defaultValues: EMPTY });
  const { register, handleSubmit, setError, reset, control, formState } = form;
  const errors = formState.errors;
  const gender = useWatch({ control, name: "gender" });
  const [rentOn, rentDaysTyped, salePrice, saleStarts, saleEnds, price] = useWatch({ control, name: ["rentEnabled", "rentDays", "salePrice", "saleStarts", "saleEnds", "price"] });
  const saleState = saleStatus(salePrice, saleStarts, saleEnds, price);

  useEffect(() => {
    let alive = true;
    api<{ categories: Category[] }>("/products/categories")
      .then((r) => alive && setCategories(r.categories))
      .catch(() => {});
    if (id) {
      api<{ product: AdminProduct }>(`/admin/products/${id}`, { cache: "no-store" })
        .then((r) => {
          if (!alive) return;
          setProduct(r.product);
          reset(toValues(r.product));
        })
        .catch((e) => alive && setLoadError(e instanceof ApiError ? e.message : "Couldn't load the product"));
    }
    return () => {
      alive = false;
    };
  }, [id, reset]);

  const payload = (v: Values) => ({
    name: v.name,
    slug: v.slug.trim() || undefined,
    description: v.description,
    categoryId: v.categoryId,
    gender: v.gender,
    priceCents: rupeesToCents(v.price),
    compareAtCents: v.compareAt.trim() ? rupeesToCents(v.compareAt) : null,
    fabric: v.fabric,
    fit: v.fit,
    color: v.color,
    colorHex: v.colorHex.trim() || null,
    tryonEnabled: v.tryonEnabled,
    tryonSlot: v.tryonSlot,
    tryonPhotoType: v.tryonPhotoType,
    rentEnabled: v.rentEnabled,
    rentPriceCents: v.rentPrice.trim() ? rupeesToCents(v.rentPrice) : null,
    rentDepositCents: v.rentDeposit.trim() ? rupeesToCents(v.rentDeposit) : null,
    rentDays: Number(v.rentDays),
    salePriceCents: v.salePrice.trim() ? rupeesToCents(v.salePrice) : null,
    saleStartsAt: colomboLocalToIso(v.saleStarts),
    saleEndsAt: colomboLocalToIso(v.saleEnds),
  });

  const showIssues = (issues: { path: string; message: string }[]) => {
    for (const i of issues) {
      const field = FIELD[i.path] ?? (i.path as keyof Values);
      if (field in EMPTY) setError(field, { message: i.message }, { shouldFocus: true });
    }
  };

  const onSubmit = handleSubmit(async (v) => {
    setMessage("");
    const body = payload(v);
    const parsed = (product ? adminProductUpdateSchema : adminProductSchema).safeParse(body);
    if (!parsed.success) {
      showIssues(parsed.error.issues.map((i) => ({ path: String(i.path[0] ?? ""), message: i.message })));
      return;
    }
    try {
      if (product) {
        const r = await api<{ product: AdminProduct }>(`/admin/products/${product.id}`, { method: "PATCH", json: parsed.data });
        setProduct(r.product);
        reset(toValues(r.product));
        toast.success("Saved");
      } else {
        const r = await api<{ product: AdminProduct }>("/admin/products", { method: "POST", json: parsed.data });
        toast.success("Product created — now add photos and sizes");
        router.replace(`${base}/products/${r.product.id}`);
      }
    } catch (e) {
      if (e instanceof ApiError && e.details?.length) showIssues(e.details);
      else setMessage(e instanceof ApiError ? e.message : "Couldn't save");
    }
  });

  async function setActive(isActive: boolean) {
    if (!product) return;
    try {
      const r = await api<{ product: AdminProduct }>(`/admin/products/${product.id}`, { method: "PATCH", json: { isActive } });
      setProduct(r.product);
      toast.success(isActive ? "Back in the shop" : "Archived — hidden from the shop");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't update");
    }
  }

  if (id && !product) {
    return loadError ? (
      <FormMessage>{loadError}</FormMessage>
    ) : (
      <div aria-busy="true" className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  const cats = categories.filter((c) => gender === "unisex" || c.gender === gender || c.gender === "unisex");

  return (
    <div>
      <Link href={`${base}/products`} className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-stone hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All products
      </Link>
      <AdminHeading
        title={product ? product.name : "New product"}
        description={product ? <span className="inline-flex items-center gap-2">{product.isActive ? <Badge variant="success">In the shop</Badge> : <Badge variant="muted">Archived</Badge>} /product/{product.slug}</span> : "Details first — photos and sizes come next."}
        action={
          product && (
            <div className="flex flex-wrap gap-2">
              {product.isActive && (
                <Button asChild variant="ghost">
                  <a href={`/product/${product.slug}`} target="_blank" rel="noopener noreferrer">View in shop <ExternalLink aria-hidden /><span className="sr-only">(opens in a new tab)</span></a>
                </Button>
              )}
              <Button variant="secondary" onClick={() => void setActive(!product.isActive)}>
                {product.isActive ? <><Archive aria-hidden /> Archive</> : <><ArchiveRestore aria-hidden /> Restore</>}
              </Button>
            </div>
          )
        }
      />

      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-6 rounded-2xl border border-line bg-paper p-5 sm:p-6 lg:grid-cols-2">
        <FormField label="Name" {...register("name")} error={errors.name?.message} wrapperClassName="lg:col-span-2" />
        <FormField as="textarea" label="Description" rows={4} {...register("description")} error={errors.description?.message} wrapperClassName="lg:col-span-2" />
        <FormField as="select" label="For" {...register("gender")} error={errors.gender?.message}>
          {GENDERS.map((g) => <option key={g} value={g}>{g === "men" ? "Men" : g === "women" ? "Women" : "Everyone"}</option>)}
        </FormField>
        <FormField as="select" label="Category" {...register("categoryId")} error={errors.categoryId?.message}>
          <option value="">Choose…</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.gender})</option>)}
        </FormField>
        <FormField label="Price (LKR)" inputMode="decimal" placeholder="64500" {...register("price")} error={errors.price?.message} />
        <FormField label="Was price (LKR, optional)" inputMode="decimal" {...register("compareAt")} error={errors.compareAt?.message} hint="Shows the item as on sale" />
        <FormField label="Fabric" {...register("fabric")} error={errors.fabric?.message} placeholder="Super 120s wool" />
        <FormField label="Fit" {...register("fit")} error={errors.fit?.message} placeholder="Tailored" />
        <FormField label="Colour" {...register("color")} error={errors.color?.message} placeholder="Navy" />
        <FormField label="Colour swatch (hex)" {...register("colorHex")} error={errors.colorHex?.message} placeholder="#1F2A44" />
        <FormField label="Web address (optional)" {...register("slug")} error={errors.slug?.message} hint="Leave empty to make one from the name" wrapperClassName="lg:col-span-2" />

        <fieldset className="grid gap-4 rounded-xl bg-linen/60 p-4 lg:col-span-2 lg:grid-cols-3">
          <legend className="sr-only">Virtual try-on</legend>
          <label className="flex min-h-11 items-center gap-3 text-sm lg:col-span-3">
            <input type="checkbox" {...register("tryonEnabled")} className="size-5 accent-[var(--sw-midnight)]" />
            Customers can try this on (Virtual Try-On)
          </label>
          <FormField as="select" label="Tried on as" {...register("tryonSlot")} error={errors.tryonSlot?.message} wrapperClassName="lg:col-span-2">
            {Object.entries(SLOT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </FormField>
          <FormField as="select" label="Try-on photo is a…" {...register("tryonPhotoType")}>
            <option value="flat-lay">Flat lay / mannequin</option>
            <option value="model">Photo on a model</option>
          </FormField>
        </fieldset>

        <fieldset className="grid gap-4 rounded-xl bg-linen/60 p-4 lg:col-span-2 lg:grid-cols-3" aria-describedby="rent-help">
          <legend className="sr-only">Renting</legend>
          <label className="flex min-h-11 items-center gap-3 text-sm lg:col-span-3">
            <input type="checkbox" {...register("rentEnabled")} className="size-5 accent-[var(--sw-midnight)]" />
            Customers can rent this for an event (with a refundable deposit)
          </label>
          <FormField label="Rent price (LKR)" inputMode="decimal" placeholder="25000" {...register("rentPrice")} error={errors.rentPrice?.message} disabled={!rentOn} />
          <FormField label="Refundable deposit (LKR)" inputMode="decimal" placeholder="20000" {...register("rentDeposit")} error={errors.rentDeposit?.message} disabled={!rentOn} />
          <FormField label="Rental days" inputMode="numeric" {...register("rentDays")} error={errors.rentDays?.message} disabled={!rentOn} hint={`${RENTAL.minDays}–${RENTAL.maxDays} days in total`} />
          <p id="rent-help" className="text-xs leading-relaxed text-stone lg:col-span-3">
            Delivered {RENTAL.leadDays} days before the event and collected {Math.max(0, (Number(rentDaysTyped) || RENTAL.defaultDays) - RENTAL.leadDays - 1)} days after it, then {RENTAL.cleaningDays} cleaning days before it can be rented again.
            Set how many <strong>rental pieces</strong> you have of each size in <em>Sizes &amp; stock</em> below — they&apos;re kept separate from the stock for sale.
          </p>
        </fieldset>

        <fieldset className="grid gap-4 rounded-xl bg-linen/60 p-4 lg:col-span-2 lg:grid-cols-3" aria-describedby="sale-help">
          <legend className="sr-only">Sale price</legend>
          <p className="flex items-center gap-2 text-sm font-medium lg:col-span-3">
            Sale price <span className={saleState.tone}>{saleState.label}</span>
          </p>
          <FormField label="Sale price (LKR, optional)" inputMode="decimal" {...register("salePrice")} error={errors.salePrice?.message} />
          <FormField label="Starts (optional)" type="datetime-local" {...register("saleStarts")} error={errors.saleStarts?.message} />
          <FormField label="Ends (optional)" type="datetime-local" {...register("saleEnds")} error={errors.saleEnds?.message} />
          <p id="sale-help" className="text-xs leading-relaxed text-stone lg:col-span-3">
            While the sale runs, customers pay the sale price and see the normal price crossed out with a &ldquo;Sale&rdquo; badge. It switches back by itself when it ends. Times are Sri Lanka time. Sale prices apply to buying, not renting. Clear the sale price to end a sale now.
          </p>
        </fieldset>

        {message && <div className="lg:col-span-2"><FormMessage>{message}</FormMessage></div>}
        <div className="flex gap-2 lg:col-span-2">
          <Button type="submit" loading={formState.isSubmitting} disabled={!!product && !formState.isDirty}>
            {product ? "Save changes" : "Create product"}
          </Button>
          {product && formState.isDirty && <Button variant="ghost" onClick={() => reset(toValues(product))}>Discard changes</Button>}
        </div>
      </form>

      {product && (
        <>
          <ProductPhotos productId={product.id} productName={product.name} images={product.images} onChange={(images) => setProduct({ ...product, images })} />
          <TryonPhoto productId={product.id} url={product.tryonImageUrl} enabled={product.tryonEnabled} onChange={(tryonImageUrl) => setProduct({ ...product, tryonImageUrl })} />
          <ProductSizes product={product} onChange={(variants) => setProduct({ ...product, variants })} />
        </>
      )}
    </div>
  );
}
