/**
 * API helpers.
 * - Browser: calls the same-origin /api/* (cookies are httpOnly; JS never sees tokens).
 * - Server components: call the API directly via API_INTERNAL_URL.
 * Every state-changing request sends the CSRF header the API requires.
 */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: { path: string; message: string }[]) {
    super(message);
  }
}

const isServer = typeof window === "undefined";
const base = () => (isServer ? (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000") : "");

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin", headers: { "X-Seamwell-CSRF": "1" } })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown; retry?: boolean } = {}): Promise<T> {
  const { json, retry = true, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set("Content-Type", "application/json");
  if (rest.method && rest.method !== "GET") headers.set("X-Seamwell-CSRF", "1");

  const res = await fetch(`${base()}/api${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });

  // Access token expired → refresh once (browser only) and retry
  if (res.status === 401 && retry && !isServer && !path.startsWith("/auth/")) {
    if (await tryRefresh()) return api<T>(path, { ...init, retry: false });
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.code ?? "error", e.message ?? "Something went wrong", e.details);
  }
  return data as T;
}
