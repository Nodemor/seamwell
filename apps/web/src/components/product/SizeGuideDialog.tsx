"use client";

import { Ruler } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SIZE_CHARTS, type SizeChartKey } from "@/lib/sizes";

/** "Size guide" link that opens the charts in a dialog, starting on the chart for this product. */
export function SizeGuideDialog({ initial }: { initial: SizeChartKey }) {
  return (
    <Dialog>
      <DialogTrigger className="inline-flex min-h-11 items-center gap-1.5 text-xs text-stone underline underline-offset-4 hover:text-ink">
        <Ruler className="size-3.5" aria-hidden /> Size guide
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Size guide</DialogTitle>
          <DialogDescription>Body measurements in centimetres. Between sizes? Choose the larger — alterations are free.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={initial}>
          <TabsList>
            {(Object.keys(SIZE_CHARTS) as SizeChartKey[]).map((k) => (
              <TabsTrigger key={k} value={k}>{SIZE_CHARTS[k].label}</TabsTrigger>
            ))}
          </TabsList>
          {(Object.keys(SIZE_CHARTS) as SizeChartKey[]).map((k) => {
            const c = SIZE_CHARTS[k];
            return (
              <TabsContent key={k} value={k}>
                <p className="text-sm text-stone">{c.note}</p>
                <div className="mt-4 overflow-x-auto rounded-[var(--radius)] border border-line">
                  <table className="w-full min-w-[22rem] text-sm">
                    <caption className="sr-only">{c.label} size chart (cm)</caption>
                    <thead className="bg-linen text-left">
                      <tr>{c.columns.map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {c.rows.map((r) => (
                        <tr key={r[0]} className="border-t border-line">
                          {r.map((cell, i) => (i === 0 ? <th key={i} scope="row" className="px-4 py-3 text-left font-medium">{cell}</th> : <td key={i} className="px-4 py-3 text-stone">{cell}</td>))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
        <p className="text-sm">
          Want a perfect fit? <Link href="/help/sizes" className="font-medium text-midnight underline underline-offset-4">How to measure yourself</Link> or visit the atelier for a free fitting.
        </p>
      </DialogContent>
    </Dialog>
  );
}
