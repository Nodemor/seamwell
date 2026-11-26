"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { registerSchema } from "@seamwell/shared";
import { FormMessage } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { SuccessCheck } from "@/components/auth/SuccessCheck";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/FormField";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { apiErrors, fieldErrors, focusFirstInvalid } from "@/lib/forms";
import type { SessionUser } from "@/lib/session";

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<SessionUser | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (user && !created && !busy) router.replace(next);
  }, [user, created, busy, next, router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    const parsed = registerSchema.safeParse({ ...form, phone: form.phone.replace(/[\s-]/g, "") || undefined });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      focusFirstInvalid(ref.current);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const r = await api<{ user: SessionUser }>("/auth/register", { method: "POST", json: parsed.data });
      setCreated(r.user);
      setUser(r.user);
      requestAnimationFrame(() => doneHeading.current?.focus());
    } catch (err) {
      const { fields, message: msg } = apiErrors(err);
      setErrors(fields);
      setMessage(msg);
      focusFirstInvalid(ref.current);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="rounded-2xl border border-line bg-paper p-6 text-center sm:p-8">
        <SuccessCheck className="mx-auto" />
        <h2 ref={doneHeading} tabIndex={-1} className="mt-4 font-display text-3xl outline-none">Welcome, {created.name.split(" ")[0]}</h2>
        <p className="mt-3 flex items-start justify-center gap-2 text-sm text-stone">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-brass" aria-hidden />
          <span>
            We sent a confirmation link to <strong className="font-medium text-ink">{created.email}</strong>. Confirm it to link any earlier orders placed with this email.
          </span>
        </p>
        <Button size="lg" block className="mt-6" onClick={() => router.replace(next)}>
          Continue
        </Button>
      </div>
    );
  }

  return (
    <form ref={ref} onSubmit={submit} className="space-y-5" noValidate>
      <FormField label="Full name" name="name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} required />
      <FormField label="Email" name="email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} required />
      <FormField label="Mobile (optional)" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="071 234 5678" value={form.phone} onChange={set("phone")} error={errors.phone} hint="For delivery updates. You can add it at checkout instead." />
      <PasswordField label="Password" name="password" autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint="At least 10 characters, with a letter and a number." required />
      {message && <FormMessage>{message}</FormMessage>}
      <Button type="submit" size="lg" block loading={busy}>
        Create account
      </Button>
      <p className="text-xs text-stone">
        By creating an account you agree to our <Link href="/terms" className="underline underline-offset-2">terms</Link> and{" "}
        <Link href="/privacy" className="underline underline-offset-2">privacy policy</Link>.
      </p>
    </form>
  );
}
