"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminHeading } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type Entry = { id: string; action: string; entity: string | null; entityId: string | null; meta: Record<string, unknown> | null; ip: string | null; createdAt: string; actorEmail: string | null; actorName: string | null };
type Page = { entries: Entry[]; total: number; page: number; pageSize: number };
const FILTERS = [
  { id: "", label: "Everything" },
  { id: "auth.", label: "Sign-ins & security" },
  { id: "order.", label: "Orders" },
  { id: "product.", label: "Products" },
  { id: "variant.", label: "Stock" },
  { id: "review.", label: "Reviews" },
  { id: "settings.", label: "Settings" },
];
const alarming = (a: string) => /failed|locked|reuse|disabled/.test(a);

/** Read-only, newest first. Security events and every admin change. */
export function AuditLog() {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const sp = new URLSearchParams({ page: String(page) });
    if (filter) sp.set("action", filter);
    api<Page>(`/admin/audit?${sp}`, { cache: "no-store" })
      .then((r) => alive && (setData(r), setError("")))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Couldn't load the audit log"));
    return () => {
      alive = false;
    };
  }, [filter, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const summary = (m: Record<string, unknown> | null) =>
    m ? Object.entries(m).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ") : "";

  return (
    <div>
      <AdminHeading title="Audit log" description="Read-only record of sign-ins, security events and every change made in the admin." />
      <div className="mt-6 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => (setFilter(f.id), setPage(1))}
            className={cn("h-11 shrink-0 rounded-full border px-4 text-sm transition-colors focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none sm:h-9", filter === f.id ? "border-midnight bg-midnight text-ivory" : "border-line bg-paper text-stone hover:text-ink")}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-6 rounded-xl bg-wine/10 p-3 text-sm text-wine">{error}</p>}
      {!data ? (
        <Skeleton className="mt-6 h-96 rounded-2xl" />
      ) : (
        <ol className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper text-sm">
          {data.entries.map((e) => (
            <li key={e.id} className="grid gap-1 p-4 md:grid-cols-[170px_1fr_1.4fr] md:gap-4">
              <time className="text-stone">{new Date(e.createdAt).toLocaleString("en-LK")}</time>
              <span>
                <span className={cn("font-mono text-xs font-medium", alarming(e.action) ? "text-wine" : "text-midnight")}>{e.action}</span>
                <span className="block text-xs text-stone">{e.actorName ? `${e.actorName} (${e.actorEmail})` : "System / guest"}{e.ip ? ` · ${e.ip}` : ""}</span>
              </span>
              <span className="break-words text-xs text-stone">{summary(e.meta)}</span>
            </li>
          ))}
          {data.entries.length === 0 && <li className="p-6 text-center text-stone">Nothing recorded yet.</li>}
        </ol>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3 text-sm">
          <Button variant="secondary" size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Newer entries"><ChevronLeft aria-hidden /></Button>
          <span>Page {page} of {pages}</span>
          <Button variant="secondary" size="icon-sm" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Older entries"><ChevronRight aria-hidden /></Button>
        </nav>
      )}
    </div>
  );
}
