"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronLeft } from "./Icons";
import Avatar from "./Avatar";
import { Ask } from "./Asks";

/**
 * Signing in without leaving the map.
 *
 * The map is the product's whole argument — real people are already here —
 * and bouncing somebody to a blank form the moment they're persuaded throws
 * that argument away at exactly the wrong second. So this is an overlay: the
 * city they were looking at stays behind it the entire time.
 *
 * On success it refreshes in place rather than navigating, so they land back
 * on the same view with their own recommendations filled in.
 */
export default function SignInPanel({
  preview = [],
  onDone,
}: {
  /**
   * Real members — see `previewFrom` in lib/shell.
   *
   * They live here rather than on the home panel because this is the
   * screen that asks for something. "Sign in" is a cost with no stated
   * benefit; the same button under three people you can see is a trade.
   */
  preview?: Array<{
    name: string;
    photoUrl: string | null;
    headline: string | null;
    need: string | null;
    offer: string | null;
    where: string | null;
  }>;
  onDone: (onboarded: boolean) => void;
}) {
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
      setNotice(`Code sent to ${email}.`);
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
      // Refresh rather than navigate: the server components re-run with the
      // new session and the map stays exactly where it was.
      router.refresh();
      onDone(Boolean(data.onboarded));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {step === "email" ? (
        <form onSubmit={requestCode} className="flex flex-col gap-3">
          <div>
            {preview.length > 0 ? (
              <>
                {/* The headline is the whole pitch, so it says the thing
                    the product does rather than naming the control. The
                    two halves are coloured because they are the two
                    halves everywhere else on the map. */}
                <h2 className="text-[26px] font-bold leading-[1.1] tracking-[-0.02em]">
                  See who&rsquo;s{" "}
                  <span style={{ color: "var(--brand)" }}>around you.</span>
                </h2>
                <p className="mt-2 text-[13.5px] leading-[1.5] text-[var(--ink-soft)]">
                  Founders, builders and investors near you, with what they&rsquo;re{" "}
                  <strong style={{ color: "var(--need)" }}>looking for</strong> and what they{" "}
                  <strong style={{ color: "var(--offer)" }}>can help with</strong>.
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {preview.map((m) => (
                    <li
                      key={m.name}
                      className="rounded-2xl border p-2.5"
                      style={{ borderColor: "var(--line)", background: "var(--card)" }}
                    >
                      <span className="flex items-center gap-2">
                        <Avatar name={m.name} photoUrl={m.photoUrl} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold">{m.name}</span>
                          <span className="block truncate text-[11px] text-[var(--ink-soft)]">
                            {[m.headline, m.where].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </span>
                      {(m.need || m.offer) && (
                        <span className="mt-1.5 flex flex-col gap-1">
                          {m.need && <Ask side="need" lines={[m.need]} compact />}
                          {m.offer && <Ask side="offer" lines={[m.offer]} compact />}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h2 className="text-[16px] font-semibold">Sign in</h2>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
                  No password &mdash; we&rsquo;ll email you a one-time code. The map stays where it is.
                </p>
              </>
            )}
          </div>
          <div>
            <label className="label" htmlFor="signin-email">
              Email address
            </label>
            <input
              id="signin-email"
              type="email"
              required
              autoFocus
              className="input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? "Sending…" : "Send me a code"}
          </button>
          {/* The two objections somebody has at this exact moment: how
              long is this going to take, and what are you about to do
              with where I am. */}
          {preview.length > 0 && (
            <p className="text-center text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
              Free · takes a minute · your city is shown, never your exact location
            </p>
          )}
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setStep("email");
                setCode("");
                setNotice("");
                setError("");
              }}
              aria-label="Use a different email"
            >
              <IconChevronLeft size={13} />
            </button>
            <h2 className="text-[15px] font-semibold">Enter the code</h2>
          </div>
          {notice && <p className="text-[12.5px] text-[var(--ink-soft)]">{notice}</p>}
          <input
            id="signin-code"
            inputMode="numeric"
            required
            autoFocus
            className="input mono text-center text-lg tracking-[0.3em]"
            placeholder="••••••"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          {error && <p className="text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? "Checking…" : "Verify & continue"}
          </button>
        </form>
      )}
    </div>
  );
}
