"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { forgotPasswordSchema, resetPasswordSchema } from "@seamwell/shared";
import { FormMessage } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { SuccessCheck } from "@/components/auth/SuccessCheck";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/FormField";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { apiErrors, fieldErrors, focusFirstInvalid } from "@/lib/forms";

/**
 * The emailed token arrives in the URL once. Read it, then drop it from the address bar and history
 * (so it isn't left in history, screenshots or shared links).
 */
function useOneTimeToken(initial: string) {
  const [token] = useState(initial);
  useEffect(() => {
    if (initial) window.history.replaceState(null, "", window.location.pathname);
  }, [initial]);
  return token;
}

/* ---------- Forgot password ---------- */
export function ForgotPasswordForm({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).email ?? "Enter your email address");
      focusFirstInvalid(ref.current);
      return;
    }
    setError("");
    setBusy(true);
    try {
      await api("/auth/password/forgot", { method: "POST", json: parsed.data });
      setSent(parsed.data.email);
      requestAnimationFrame(() => doneHeading.current?.focus());
    } catch (err) {
      setError(apiErrors(err).message || "Please check your email address");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-line bg-paper p-6 text-center sm:p-8">
        <SuccessCheck className="mx-auto" />
        <h2 ref={doneHeading} tabIndex={-1} className="mt-4 font-display text-3xl outline-none">Check your inbox</h2>
        <p className="mt-3 text-sm text-stone">
          If an account exists for <strong className="font-medium text-ink">{sent}</strong>, we&apos;ve sent a link to choose a new password. It works once and expires in 30 minutes.
        </p>
        <p className="mt-4 flex items-start justify-center gap-2 text-xs text-stone">
          <MailCheck className="size-4 shrink-0 text-brass" aria-hidden /> Nothing after a few minutes? Check spam, or try again.
        </p>
        <Button variant="secondary" block className="mt-6" onClick={() => setSent("")}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form ref={ref} onSubmit={submit} className="space-y-5" noValidate>
      <FormField label="Email" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error || undefined} required />
      <Button type="submit" size="lg" block loading={busy}>
        Send reset link
      </Button>
    </form>
  );
}

/* ---------- Reset password ---------- */
export function ResetPasswordForm({ token: initialToken }: { token: string }) {
  const token = useOneTimeToken(initialToken);
  const { setUser } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);

  if (!token) {
    return (
      <div className="space-y-5">
        <FormMessage>This reset link is incomplete. Open the link from your email again, or ask for a new one.</FormMessage>
        <Button asChild size="lg" block>
          <Link href="/forgot-password">Send a new link</Link>
        </Button>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    const parsed = resetPasswordSchema.safeParse({ token, password });
    const found = fieldErrors(parsed.error);
    if (found.token) return setMessage(found.token);
    if (password && confirm !== password) found.confirm = "The passwords don't match";
    if (Object.keys(found).length) {
      setErrors(found);
      focusFirstInvalid(ref.current);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await api("/auth/password/reset", { method: "POST", json: parsed.data });
      setUser(null); // every session was signed out
      setDone(true);
      requestAnimationFrame(() => doneHeading.current?.focus());
    } catch (err) {
      const { fields, message: msg } = apiErrors(err);
      setErrors({ ...(fields.password && { password: fields.password }) });
      setMessage(fields.token ?? msg);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-line bg-paper p-6 text-center sm:p-8">
        <SuccessCheck className="mx-auto" />
        <h2 ref={doneHeading} tabIndex={-1} className="mt-4 font-display text-3xl outline-none">Password changed</h2>
        <p className="mt-3 text-sm text-stone">For your safety we signed you out on every device. Sign in with your new password.</p>
        <Button asChild size="lg" block className="mt-6">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form ref={ref} onSubmit={submit} className="space-y-5" noValidate>
      <PasswordField label="New password" name="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="At least 10 characters, with a letter and a number." required />
      <PasswordField label="Confirm new password" name="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} required />
      {message && (
        <FormMessage>
          {message}{" "}
          {/expired|invalid/i.test(message) && (
            <Link href="/forgot-password" className="font-medium underline underline-offset-2">
              Send a new link
            </Link>
          )}
        </FormMessage>
      )}
      <Button type="submit" size="lg" block loading={busy}>
        Save new password
      </Button>
    </form>
  );
}

/* ---------- Verify email ---------- */
export function VerifyEmail({ token: initialToken }: { token: string }) {
  const token = useOneTimeToken(initialToken);
  const { user, refresh } = useAuth();
  const [state, setState] = useState<{ kind: "working" } | { kind: "done"; attached: number } | { kind: "error"; message: string }>(
    initialToken ? { kind: "working" } : { kind: "error", message: "This confirmation link is incomplete. Open it from your email again." },
  );
  const started = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!token || started.current) return; // strict-mode double effect must not burn the one-time token twice
    started.current = true;
    void api<{ attachedOrders: number }>("/auth/email/verify", { method: "POST", json: { token } })
      .then((r) => {
        setState({ kind: "done", attached: r.attachedOrders });
        void refresh();
      })
      .catch((err) => setState({ kind: "error", message: apiErrors(err).message || "This link is invalid or has expired." }))
      .finally(() => requestAnimationFrame(() => heading.current?.focus()));
  }, [token, refresh]);

  if (state.kind === "working") {
    return (
      <p role="status" className="text-stone">
        Confirming your email…
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="space-y-5">
        <h2 ref={heading} tabIndex={-1} className="sr-only">Email not confirmed</h2>
        <FormMessage>{state.message}</FormMessage>
        {user ? (
          <p className="text-sm text-stone">You can send a fresh link from <Link href="/account?tab=security" className="font-medium text-midnight underline underline-offset-2">Account → Security</Link>.</p>
        ) : (
          <p className="text-sm text-stone"><Link href="/login?next=%2Faccount%3Ftab%3Dsecurity" className="font-medium text-midnight underline underline-offset-2">Sign in</Link> to send a fresh link.</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-6 text-center sm:p-8">
      <SuccessCheck className="mx-auto" />
      <h2 ref={heading} tabIndex={-1} className="mt-4 font-display text-3xl outline-none">Email confirmed</h2>
      <p className="mt-3 text-sm text-stone">
        {state.attached > 0
          ? `We found ${state.attached} earlier ${state.attached === 1 ? "order" : "orders"} placed with this email and added ${state.attached === 1 ? "it" : "them"} to your account.`
          : "Thank you — future orders placed with this email will show up in your account."}
      </p>
      <Button asChild size="lg" block className="mt-6">
        <Link href={user ? "/account" : "/login"}>{user ? "Go to your account" : "Sign in"}</Link>
      </Button>
    </div>
  );
}
