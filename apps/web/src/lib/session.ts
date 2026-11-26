"use client";

import { api } from "@/lib/api";

export type SessionUser = { id: string; email: string; name: string; phone: string | null; role: "customer" | "admin"; mfaEnabled: boolean; emailVerified: boolean;
  /** Secret admin address — only sent by the API to an admin whose session passed two-factor. */
  adminPath?: string;
};

/**
 * Who is signed in (null for guests) without producing 401s: GET /auth/session always answers 200.
 * If the short-lived access cookie expired but a refresh cookie exists, refresh once.
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const s = await api<{ user: SessionUser | null; refreshable: boolean }>("/auth/session", { cache: "no-store" });
    if (s.user) return s.user;
    if (!s.refreshable) return null;
    return (await api<{ user: SessionUser }>("/auth/refresh", { method: "POST", retry: false })).user;
  } catch {
    return null;
  }
}
