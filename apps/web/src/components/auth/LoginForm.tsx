"use client";

import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { loginSchema } from "@seamwell/shared";
import { FormMessage } from "@/components/auth/AuthShell";
import { OtpInput } from "@/components/auth/OtpInput";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/FormField";
import { api, ApiError } from "@/lib/api";
import { afterSignInPath, useAuth } from "@/lib/auth";
import { fieldErrors, focusFirstInvalid } from "@/lib/forms";
import type { SessionUser } from "@/lib/session";

type LoginResponse = { mfaRequired: true; mfaToken: string } | { mfaRequired: false; user: SessionUser };

/**
 * Step 1: email + password. Step 2 (if two-factor is on): 6-digit code, or a one-time recovery code.
 * The short-lived MFA ticket lives only in this component's memory — never in storage or the URL.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [step, setStep] = useState<"password" | "mfa">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const mfaHeading = useRef<HTMLHeadingElement>(null);

  // Already signed in (e.g. opened /login in a second tab) → straight on.
  useEffect(() => {
    if (user && !busy) router.replace(afterSignInPath(user, next));
  }, [user, busy, next, router]);

  function done(u: SessionUser) {
    setUser(u);
    toast.success(`Welcome back, ${u.name.split(" ")[0]}`);
    router.replace(afterSignInPath(u, next));
  }

  async function submitPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    setMessage("");
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      focusFirstInvalid(form.current);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const r = await api<LoginResponse>("/auth/login", { method: "POST", json: parsed.data });
      if (r.mfaRequired) {
        setMfaToken(r.mfaToken);
        setStep("mfa");
        setPassword("");
        setBusy(false);
        requestAnimationFrame(() => mfaHeading.current?.focus());
        return;
      }
      done(r.user);
    } catch (err) {
      setBusy(false);
      setMessage(err instanceof ApiError ? err.message : "We couldn't reach the shop. Check your connection and try again.");
    }
  }

  async function submitCode(value: string) {
    if (busy) return;
    const trimmed = value.trim();
    if (recovery ? trimmed.replace(/[^A-Za-z0-9]/g, "").length < 8 : !/^\d{6}$/.test(trimmed)) {
      setMessage(recovery ? "Enter one of your recovery codes, like 7KQ2-M9XD" : "Enter the 6-digit code from your authenticator app");
      setShake((n) => n + 1);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const r = await api<{ user: SessionUser }>("/auth/mfa/verify", { method: "POST", json: { mfaToken, code: trimmed } });
      if (recovery) toast.info("You used a recovery code. Each code works once — turn two-factor off and on again for a fresh set if you're running low.");
      done(r.user);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && /expired/i.test(err.message)) {
        backToPassword("Your sign-in took too long. Please enter your password again.");
        return;
      }
      setMessage(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setCode("");
      setShake((n) => n + 1);
    }
  }

  function backToPassword(msg = "") {
    setStep("password");
    setMfaToken("");
    setCode("");
    setRecoveryCode("");
    setRecovery(false);
    setMessage(msg);
  }

  if (step === "mfa") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitCode(recovery ? recoveryCode : code);
        }}
        className="space-y-6"
        noValidate
      >
        <div>
          <h2 ref={mfaHeading} tabIndex={-1} className="flex items-center gap-2 font-sans text-lg font-medium outline-none">
            <KeyRound className="size-5 text-brass" aria-hidden /> Two-factor check
          </h2>
          <p id="otp-label" className="mt-1 text-sm text-stone">
            {recovery ? "Enter one of the recovery codes you saved when you turned on two-factor." : "Enter the 6-digit code from your authenticator app."}
          </p>
        </div>

        {recovery ? (
          <FormField
            label="Recovery code"
            name="recoveryCode"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXX-XXXX"
            className="font-mono uppercase tracking-widest"
            autoFocus
            error={message || undefined}
          />
        ) : (
          <>
            <OtpInput value={code} onChange={setCode} onComplete={(v) => void submitCode(v)} labelledBy="otp-label" describedBy={message ? "login-error" : undefined} invalid={!!message} shake={shake} disabled={busy} autoFocus />
            {message && <FormMessage id="login-error">{message}</FormMessage>}
          </>
        )}

        <Button type="submit" size="lg" block loading={busy}>
          Verify and sign in
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button type="button" onClick={() => backToPassword()} className="inline-flex min-h-11 items-center gap-1.5 rounded-full text-stone transition-colors hover:text-ink focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none">
            <ArrowLeft className="size-4" aria-hidden /> Back
          </button>
          <button
            type="button"
            onClick={() => {
              setRecovery((v) => !v);
              setMessage("");
              setCode("");
              setRecoveryCode("");
            }}
            className="min-h-11 rounded-full font-medium text-midnight underline-offset-4 hover:underline focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none"
          >
            {recovery ? "Use my authenticator app" : "Use a recovery code instead"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form ref={form} onSubmit={submitPassword} className="space-y-5" noValidate>
      <FormField label="Email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
      <PasswordField label="Password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password ? "Enter your password" : undefined} required />
      <div className="-mt-2 text-right">
        <Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="inline-block py-2 text-sm text-midnight underline-offset-4 hover:underline">
          Forgot your password?
        </Link>
      </div>
      {message && <FormMessage>{message}</FormMessage>}
      <Button type="submit" size="lg" block loading={busy}>
        Sign in
      </Button>
    </form>
  );
}
