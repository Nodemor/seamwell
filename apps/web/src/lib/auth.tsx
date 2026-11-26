"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getSession, type SessionUser } from "@/lib/session";

type AuthState = {
  /** undefined while the first session check runs, null for guests. */
  user: SessionUser | null | undefined;
  /** Re-read the session (after verify-email, enabling MFA…). */
  refresh: () => Promise<SessionUser | null>;
  /** Set the user straight from a sign-in response (no extra request). */
  setUser: (u: SessionUser | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Who is signed in, for the whole app. Tokens stay in httpOnly cookies — this only holds the public user
 * object returned by the API (name, email, role, MFA flag), in memory.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    const u = await getSession();
    setUser(u);
    return u;
  }, []);

  useEffect(() => {
    let alive = true;
    void getSession().then((u) => alive && setUser(u));
    // Another tab signed in/out → re-check when this tab becomes visible again.
    const onVisible = () => document.visibilityState === "visible" && void getSession().then((u) => alive && setUser(u));
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, refresh, setUser, signOut }), [user, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Where to send someone right after they sign in. Admins without MFA must set it up first. */
export function afterSignInPath(user: SessionUser, next: string) {
  if (user.role === "admin" && !user.mfaEnabled) return "/account?tab=security&notice=admin-mfa";
  return next;
}
