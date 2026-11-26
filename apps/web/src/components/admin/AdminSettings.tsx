"use client";

import { Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { COURIERS, type CourierSettings, courierSettingsSchema, trackingUrlFor } from "@seamwell/shared";
import { AdminHeading } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/FormField";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";

/** Courier tracking-link templates: the Ship dialog fills the customer's tracking link from these. */
export function AdminSettings() {
  const [templates, setTemplates] = useState<Record<string, string> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<CourierSettings>("/admin/settings/couriers", { cache: "no-store" })
      .then((r) => setTemplates(Object.fromEntries(COURIERS.map((c) => [c.id, r.templates[c.id] ?? ""]))))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Couldn't load settings"));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = courierSettingsSchema.safeParse({ templates });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[1]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await api("/admin/settings/couriers", { method: "PUT", json: parsed.data });
      toast.success("Courier links saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <AdminHeading title="Settings" />
      <section aria-labelledby="couriers-h" className="mt-8 max-w-3xl rounded-2xl border border-line bg-paper p-5 sm:p-6">
        <h2 id="couriers-h" className="flex items-center gap-2 font-sans text-lg font-medium"><Truck className="size-5 text-brass" aria-hidden /> Courier tracking links</h2>
        <p className="mt-1 text-sm text-stone">
          Paste each courier&apos;s tracking page link with <code className="rounded bg-linen px-1 font-mono">{"{tracking}"}</code> where the tracking number goes. When you ship an order, the customer&apos;s link is filled in for you. Leave empty if a courier has no tracking page.
        </p>
        {!templates ? (
          <Skeleton className="mt-6 h-72 rounded-xl" />
        ) : (
          <form onSubmit={save} className="mt-6 space-y-5" noValidate>
            {COURIERS.map((c) => {
              const example = trackingUrlFor(templates[c.id], "DX123456");
              return (
                <FormField
                  key={c.id}
                  label={c.name}
                  type="url"
                  inputMode="url"
                  placeholder="https://courier.lk/track?no={tracking}"
                  value={templates[c.id] ?? ""}
                  onChange={(e) => setTemplates({ ...templates, [c.id]: e.target.value })}
                  error={errors[c.id]}
                  hint={example ? `Example: ${example}` : undefined}
                />
              );
            })}
            <Button type="submit" loading={busy}>Save courier links</Button>
          </form>
        )}
      </section>
    </div>
  );
}
