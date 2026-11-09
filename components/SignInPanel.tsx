"use client";

import { useState } from "react";
import { useIsNarrow } from "@/lib/useIsNarrow";
import { useRouter } from "next/navigation";
import { IconChevronLeft, IconLinkedIn } from "./Icons";

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
  landing = false,
  linkedin = false,
  linkedinError = null,
  onDone,
}: {
  /** The LinkedIn app is configured — see lib/linkedin. */
  linkedin?: boolean;
  /** Why the last LinkedIn round-trip came back empty-handed, from ?li=. */
  linkedinError?: string | null;
  /**
   * This is the first thing a stranger sees, rather than a form they
   * opened on purpose. The map behind it is already carrying the
   * evidence — named chips saying what people are after — so the panel
   * states the invitation and gets out of the way.
   */
  landing?: boolean;
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

  /**
   * LinkedIn leads on a desktop and follows on a phone.
   *
   * Not a preference — a fact about where sessions live. LinkedIn
   * publishes thousands of universal-link rules and none of them covers
   * `/oauth`, so a mobile browser can never hand the flow to the app;
   * it stays in Safari or Chrome, where almost nobody is signed in,
   * and the button's reward for being prominent is a password prompt.
   * On a desktop the opposite holds: the session is usually live and
   * this genuinely is one tap that brings a name and a photo with it.
   *
   * Same two routes on both, and the email code is never hidden. What
   * changes is which one is asking for a tap first.
   */
  const narrow = useIsNarrow();
  const linkedinFirst = linkedin ? (
    <>
      {narrow && (
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="h-px flex-1" style={{ background: "var(--line)" }} />
          <span className="text-[11px] text-[var(--ink-soft)]">or</span>
          <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        </div>
      )}
      <a
        href="/api/auth/linkedin/start"
        className={`btn w-full ${narrow ? "btn-ghost" : "btn-primary"}`}
        style={narrow ? { color: "#0a66c2" } : { background: "#0a66c2", boxShadow: "0 10px 22px -12px #0a66c2" }}
      >
        <IconLinkedIn size={16} /> Continue with LinkedIn
      </a>
      {!narrow && (
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="h-px flex-1" style={{ background: "var(--line)" }} />
          <span className="text-[11px] text-[var(--ink-soft)]">or</span>
          <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        </div>
      )}
    </>
  ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {step === "email" ? (
        <form onSubmit={requestCode} className="flex flex-col gap-3">
          <div>
            {landing ? (
              <>
                <h2 className="text-[24px] font-bold leading-[1.12] tracking-[-0.02em]">
                  Join other professionals around you!
                </h2>
                <p className="mt-2 text-[13.5px] leading-[1.5] text-[var(--ink-soft)]">
                  Discover who&rsquo;s here, what they&rsquo;re exploring, and people you&rsquo;d like to meet!
                </p>
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
          {!narrow && linkedinFirst}

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
          {!error && linkedinError && (
            <p className="text-[12.5px] font-medium" style={{ color: "var(--warn)" }}>
              {linkedinError === "cancelled"
                ? "LinkedIn sign-in was cancelled. You can use your email instead."
                : linkedinError === "unavailable"
                  ? "LinkedIn sign-in isn't switched on yet — your email works."
                  : "LinkedIn couldn't sign you in. Your email will."}
            </p>
          )}
          {error && <p className="text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? "Sending…" : "Send me a code"}
          </button>
          {narrow && linkedinFirst}
          {/* The objections somebody has at this exact moment: how long
              is this going to take, and what are you about to do with
              where I am. The answer to the second is the honest one —
              a work address is the useful pin, and live location is
              there for the hours it actually helps. */}
          {landing && (
            <p className="text-center text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
              Free · takes a minute · your work location is preferred · use live location when needed
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
