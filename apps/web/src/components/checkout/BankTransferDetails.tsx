"use client";

import { Check, Copy, Landmark } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Price } from "@/components/ui/Price";

/** "Bank: X | Account name: Y | Account no: Z | Branch: W" → label/value rows. */
function parse(details: string) {
  return details
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf(":");
      return i === -1 ? { label: "", value: part } : { label: part.slice(0, i).trim(), value: part.slice(i + 1).trim() };
    });
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copied`);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          toast.error("Couldn't copy — please select the text instead");
        }
      }}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper px-3 text-xs font-medium transition-colors hover:border-ink/40 sm:min-h-9"
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="size-3.5 text-sage" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Bank-transfer instructions with one-tap copy for each detail and the order number as the reference. */
export function BankTransferDetails({ details, orderNumber, totalCents }: { details: string; orderNumber: string; totalCents: number }) {
  const rows = parse(details);
  return (
    <section aria-labelledby="bank-heading" className="rounded-[var(--radius-xl)] border border-brass/40 bg-brass-soft/30 p-5 text-left sm:p-6">
      <h2 id="bank-heading" className="flex items-center gap-2 font-sans text-base font-semibold">
        <Landmark className="size-5 text-brass-ink" aria-hidden /> Please complete your bank transfer
      </h2>
      <p className="mt-1 text-sm text-stone">We&apos;ll confirm your order as soon as the payment arrives.</p>
      <dl className="mt-4 divide-y divide-line rounded-[var(--radius)] border border-line bg-paper text-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <dt className="text-xs text-stone">Amount</dt>
            <dd><Price cents={totalCents} className="font-semibold" /></dd>
          </div>
        </div>
        {rows.map((r) => (
          <div key={r.label + r.value} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <dt className="text-xs text-stone">{r.label}</dt>
              <dd className="break-words font-medium">{r.value}</dd>
            </div>
            <CopyButton value={r.value} label={r.label || "detail"} />
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 bg-linen/60 px-4 py-3">
          <div>
            <dt className="text-xs text-stone">Payment reference (important)</dt>
            <dd className="font-mono text-base font-semibold text-midnight">{orderNumber}</dd>
          </div>
          <CopyButton value={orderNumber} label="Reference" />
        </div>
      </dl>
    </section>
  );
}
