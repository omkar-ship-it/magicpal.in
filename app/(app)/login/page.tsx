"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't send that code.");
      setStep("code");
      setNotice(`Code sent to ${email}. Check the console log if email isn't configured yet.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That code didn't work.");
      // Someone who got here from a QR code is mid-journey: they scanned a
      // poster to see a room, and dropping them on the generic map instead
      // would make them find the board again by hand. A new account still
      // goes to the profile first — there is nothing to match them on until
      // they've answered the two questions — and `next` is carried through
      // so they land where they were headed once it's filled in.
      const next = new URLSearchParams(window.location.search).get("next");
      const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      if (!data.onboarded) {
        router.push(safe ? `/you?next=${encodeURIComponent(safe)}` : "/you");
      } else {
        router.push(safe ?? "/");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm pt-10">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-[13.5px] text-[var(--ink-soft)]">
        No password — we&apos;ll email you a one-time code.
      </p>

      {step === "email" ? (
        <form onSubmit={requestCode} className="card mt-6 flex flex-col gap-4 p-6">
          <div>
            <label className="label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-[13px] font-medium text-[var(--warn)]">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? "Sending…" : "Send me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="card mt-6 flex flex-col gap-4 p-6">
          {notice && <p className="text-[13px] text-[var(--ink-soft)]">{notice}</p>}
          <div>
            <label className="label" htmlFor="code">
              6-digit code
            </label>
            <input
              id="code"
              inputMode="numeric"
              required
              className="input mono text-center text-lg tracking-[0.3em]"
              placeholder="••••••"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
          </div>
          {error && <p className="text-[13px] font-medium text-[var(--warn)]">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? "Checking…" : "Verify & continue"}
          </button>
          <button
            type="button"
            className="text-[12.5px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]"
            onClick={() => {
              setStep("email");
              setCode("");
              setNotice("");
            }}
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}
