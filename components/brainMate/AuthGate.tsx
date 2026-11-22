"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Sign in without leaving the game's screen. Same email-code routes as the
 * rest of OpenNetworks — a Brain-Mate account *is* an OpenNetworks account —
 * but the page stays where it is, so an invitation is still on screen while
 * the code arrives.
 */
export default function AuthGate({ cta = "Send me a code" }: { cta?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function post(path: string, body: object) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
    return data;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (step === "email") {
        await post("/api/auth/request-otp", { email });
        setStep("code");
      } else {
        await post("/api/auth/verify-otp", { email, code });
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {step === "email" ? (
        <input
          className="bm-input"
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
        />
      ) : (
        <>
          <p className="text-[14px] text-[var(--bm-soft)]">
            Code sent to <b className="text-[var(--bm-ink)]">{email}</b>.{" "}
            <button type="button" className="underline" onClick={() => setStep("email")}>
              Change
            </button>
          </p>
          <input
            className="bm-input text-center text-[1.5rem] tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            autoFocus
            placeholder="······"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            aria-label="Code"
          />
        </>
      )}
      {error && <p className="text-[13px] font-semibold text-[#c2410c]">{error}</p>}
      <button className="bm-btn bm-btn-brand" disabled={busy}>
        {busy ? "One moment…" : step === "email" ? cta : "Let's play"}
      </button>
      <p className="text-center text-[12px] text-[var(--bm-soft)]">No password. Free. Takes 15 seconds.</p>
    </form>
  );
}
