"use client";

import { Check, Copy, Download, KeyRound, Laptop, LogOut, MailCheck, MailWarning, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { changePasswordSchema, mfaDisableSchema } from "@seamwell/shared";
import { FormMessage } from "@/components/auth/AuthShell";
import { OtpInput } from "@/components/auth/OtpInput";
import { PasswordField } from "@/components/auth/PasswordField";
import { SuccessCheck } from "@/components/auth/SuccessCheck";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { apiErrors, fieldErrors, focusFirstInvalid } from "@/lib/forms";
import { cn } from "@/lib/utils";

export function SecurityTab() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TwoFactorCard />
      <div className="grid content-start gap-6">
        <Card icon={user.emailVerified ? MailCheck : MailWarning} title="Email">
          <p className="text-sm text-stone">
            {user.email} ·{" "}
            {user.emailVerified ? <span className="font-medium text-sage">confirmed</span> : <span className="font-medium text-wine">not confirmed yet</span>}
          </p>
        </Card>
        <ChangePasswordCard />
      </div>
      <SessionsCard />
    </div>
  );
}

function Card({ icon: Icon, title, badge, children, className }: { icon: typeof ShieldCheck; title: string; badge?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-paper p-5 sm:p-6", className)} aria-labelledby={`sec-${title.replace(/\W+/g, "-")}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={`sec-${title.replace(/\W+/g, "-")}`} className="flex items-center gap-2 font-sans text-lg font-medium">
          <Icon className="size-5 text-brass" aria-hidden /> {title}
        </h2>
        {badge}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* ---------- Two-factor ---------- */
type Setup = { otpauthUri: string; qrDataUrl: string };

function TwoFactorCard() {
  const router = useRouter();
  const { user, refresh, setUser } = useAuth();
  const [phase, setPhase] = useState<"idle" | "setup" | "codes" | "disable">("idle");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [password, setPassword] = useState("");
  const codesHeading = useRef<HTMLHeadingElement>(null);

  if (!user) return null;
  const secret = setup ? (new URL(setup.otpauthUri).searchParams.get("secret") ?? "") : "";

  async function start() {
    setBusy(true);
    setError("");
    try {
      setSetup(await api<Setup>("/auth/mfa/setup", { method: "POST" }));
      setPhase("setup");
      setCode("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't start the setup. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function enable(value = code) {
    if (busy) return;
    if (!/^\d{6}$/.test(value)) {
      setError("Enter the 6-digit code from your authenticator app");
      setShake((n) => n + 1);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api<{ recoveryCodes: string[] }>("/auth/mfa/enable", { method: "POST", json: { code: value } });
      setCodes(r.recoveryCodes);
      setSetup(null);
      setPhase("codes");
      requestAnimationFrame(() => codesHeading.current?.focus());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setCode("");
      setShake((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  async function disable(value = code) {
    const parsed = mfaDisableSchema.safeParse({ password, code: value });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).password ? "Enter your password" : "Enter the 6-digit code from your authenticator app");
      setShake((n) => n + 1);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/auth/mfa/disable", { method: "POST", json: parsed.data });
      setUser(null);
      toast.success("Two-factor authentication is off. Please sign in again.");
      router.replace("/login?next=%2Faccount%3Ftab%3Dsecurity");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setCode("");
      setShake((n) => n + 1);
      setBusy(false);
    }
  }

  const codesText = () => [`Seamwell Tailoring — two-factor recovery codes for ${user.email}`, "Each code works once.", "", ...codes].join("\n");

  return (
    <Card
      icon={ShieldCheck}
      title="Two-factor authentication"
      className="lg:row-span-2"
      badge={user.mfaEnabled || phase === "codes" ? <Badge variant="success">On</Badge> : <Badge variant="muted">Off</Badge>}
    >
      {phase === "codes" ? (
        <div>
          <SuccessCheck className="size-14" />
          <h3 ref={codesHeading} tabIndex={-1} className="mt-3 font-display text-2xl outline-none">Save your recovery codes</h3>
          <p className="mt-2 text-sm text-stone">
            If you lose your phone, each code signs you in <strong className="font-medium text-ink">once</strong>. We only show them now — store them somewhere safe, like a password manager.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-linen p-4 font-mono text-sm tracking-wider" aria-label="Recovery codes">
            {codes.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(codesText());
                  toast.success("Copied the recovery codes");
                } catch {
                  toast.error("Couldn't copy — please download them instead");
                }
              }}
            >
              <Copy aria-hidden /> Copy
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([codesText()], { type: "text/plain" }));
                const a = Object.assign(document.createElement("a"), { href: url, download: "seamwell-recovery-codes.txt" });
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download aria-hidden /> Download
            </Button>
          </div>
          <label className="mt-5 flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-5 accent-[var(--sw-midnight)]" />
            I&apos;ve saved my recovery codes
          </label>
          <Button
            className="mt-3"
            block
            disabled={!saved}
            onClick={() => {
              setCodes([]);
              setPhase("idle");
              void refresh();
            }}
          >
            Done
          </Button>
        </div>
      ) : user.mfaEnabled ? (
        phase === "disable" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void disable();
            }}
            className="space-y-4"
            noValidate
          >
            <p className="text-sm text-stone">Confirm with your password and a code from your app. You&apos;ll be signed out everywhere.</p>
            <PasswordField label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p id="disable-otp-label" className="text-sm text-stone">Authenticator code</p>
            <OtpInput value={code} onChange={setCode} labelledBy="disable-otp-label" describedBy={error ? "mfa-error" : undefined} invalid={!!error} shake={shake} disabled={busy} />
            {error && <FormMessage id="mfa-error">{error}</FormMessage>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="destructive" loading={busy}>
                <ShieldOff aria-hidden /> Turn off
              </Button>
              <Button variant="ghost" onClick={() => setPhase("idle")}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-stone">Signing in asks for a code from your authenticator app. Lost your phone? Use one of your recovery codes.</p>
            {user.role === "admin" ? (
              <p className="rounded-xl bg-linen p-3 text-sm text-stone">Admin accounts must keep two-factor on.</p>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setPhase("disable");
                  setCode("");
                  setPassword("");
                  setError("");
                }}
              >
                <ShieldOff aria-hidden /> Turn off two-factor
              </Button>
            )}
          </div>
        )
      ) : phase === "setup" && setup ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enable();
          }}
          className="space-y-5"
          noValidate
        >
          <ol className="space-y-5 text-sm">
            <li>
              <p className="font-medium">1. Scan this QR code with an authenticator app</p>
              <p className="text-stone">Google Authenticator, Microsoft Authenticator, 1Password or Authy.</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from our API, not optimisable */}
              <img src={setup.qrDataUrl} alt="QR code to add Seamwell to your authenticator app" width={180} height={180} className="mt-3 rounded-xl border border-line bg-white p-2" />
            </li>
            <li>
              <p className="font-medium">Can&apos;t scan? Enter this key instead</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-linen px-3 py-2 font-mono text-sm tracking-wider">{secret.replace(/(.{4})/g, "$1 ").trim()}</code>
                <CopyButton text={secret} label="Copy the setup key" />
              </div>
            </li>
            <li>
              <p id="enable-otp-label" className="font-medium">2. Enter the 6-digit code it shows</p>
            </li>
          </ol>
          <OtpInput value={code} onChange={setCode} onComplete={(v) => void enable(v)} labelledBy="enable-otp-label" describedBy={error ? "mfa-error" : undefined} invalid={!!error} shake={shake} disabled={busy} autoFocus />
          {error && <FormMessage id="mfa-error">{error}</FormMessage>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={busy}>Turn on</Button>
            <Button variant="ghost" onClick={() => setPhase("idle")}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-stone">
            Add a second step to signing in: a 6-digit code from an app on your phone. Even if someone learns your password, they can&apos;t get in without it.
          </p>
          <Button onClick={() => void start()} loading={busy}>
            <KeyRound aria-hidden /> Turn on two-factor
          </Button>
        </div>
      )}
    </Card>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          toast.error("Couldn't copy — select the key instead");
        }
      }}
      className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-ink transition-colors hover:bg-linen focus-visible:ring-4 focus-visible:ring-brass/30 focus-visible:outline-none"
    >
      {copied ? <Check className="size-4 text-sage" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
    </button>
  );
}

/* ---------- Change password ---------- */
function ChangePasswordCard() {
  const [f, setF] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    const parsed = changePasswordSchema.safeParse({ currentPassword: f.currentPassword, newPassword: f.newPassword });
    const found = fieldErrors(parsed.error);
    if (f.newPassword && f.confirm !== f.newPassword) found.confirm = "The passwords don't match";
    if (!parsed.success || found.confirm) {
      setErrors(found);
      focusFirstInvalid(form.current);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await api("/auth/password/change", { method: "POST", json: parsed.data });
      setF({ currentPassword: "", newPassword: "", confirm: "" });
      toast.success("Password changed. Your other devices were signed out.");
      window.dispatchEvent(new Event("sw:sessions-changed"));
    } catch (err) {
      const r = apiErrors(err);
      setErrors(r.fields);
      setMessage(r.message);
      focusFirstInvalid(form.current);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card icon={KeyRound} title="Password">
      <form ref={form} onSubmit={submit} className="space-y-4" noValidate>
        <PasswordField label="Current password" autoComplete="current-password" value={f.currentPassword} onChange={set("currentPassword")} error={errors.currentPassword} />
        <PasswordField label="New password" autoComplete="new-password" value={f.newPassword} onChange={set("newPassword")} error={errors.newPassword} hint="At least 10 characters, with a letter and a number." />
        <PasswordField label="Confirm new password" autoComplete="new-password" value={f.confirm} onChange={set("confirm")} error={errors.confirm} />
        {message && <FormMessage>{message}</FormMessage>}
        <Button type="submit" variant="secondary" loading={busy}>Change password</Button>
      </form>
    </Card>
  );
}

/* ---------- Sessions ---------- */
type Session = { id: string; lastActiveAt: string; userAgent: string | null; ip: string | null; mfaVerified: boolean; current: boolean };

function describeDevice(ua: string | null) {
  if (!ua) return { label: "Unknown device", mobile: false };
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return { label: os ? `${browser} on ${os}` : browser, mobile: /iPhone|Android|Mobile/.test(ua) };
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string) {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (mins > -1) return "just now";
  if (mins > -60) return rtf.format(mins, "minute");
  if (mins > -60 * 24) return rtf.format(Math.round(mins / 60), "hour");
  return rtf.format(Math.round(mins / 1440), "day");
}

function SessionsCard() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [version, setVersion] = useState(0);
  useEffect(() => {
    const onChange = () => setVersion((v) => v + 1);
    window.addEventListener("sw:sessions-changed", onChange);
    return () => window.removeEventListener("sw:sessions-changed", onChange);
  }, []);
  useEffect(() => {
    let alive = true;
    api<{ sessions: Session[] }>("/auth/sessions", { cache: "no-store" })
      .then((r) => alive && setSessions(r.sessions))
      .catch(() => alive && setSessions([]));
    return () => {
      alive = false;
    };
  }, [version]);

  async function signOutEverywhere() {
    setBusy(true);
    try {
      await api("/auth/sessions/revoke-all", { method: "POST" });
      setUser(null);
      toast.success("Signed out on every device");
      router.replace("/login");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't sign out everywhere. Try again.");
      setBusy(false);
    }
  }

  return (
    <Card icon={Laptop} title="Where you're signed in" className="lg:col-span-2">
      {!sessions ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {sessions.map((s) => {
            const d = describeDevice(s.userAgent);
            const Icon = d.mobile ? Smartphone : Laptop;
            return (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <Icon className="size-5 shrink-0 text-stone" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {d.label} {s.current && <Badge variant="accent" className="ml-1 align-middle">This device</Badge>}
                  </p>
                  <p className="truncate text-xs text-stone">
                    Active {ago(s.lastActiveAt)}
                    {s.ip ? ` · ${s.ip}` : ""}
                    {s.mfaVerified ? " · two-factor checked" : ""}
                  </p>
                </div>
              </li>
            );
          })}
          {sessions.length === 0 && <li className="py-3 text-sm text-stone">No other active sessions.</li>}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {confirm ? (
          <>
            <p className="w-full text-sm text-stone">This signs you out here too. Continue?</p>
            <Button variant="destructive" loading={busy} onClick={() => void signOutEverywhere()}>
              <LogOut aria-hidden /> Yes, sign out everywhere
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            <LogOut aria-hidden /> Sign out everywhere
          </Button>
        )}
      </div>
    </Card>
  );
}
