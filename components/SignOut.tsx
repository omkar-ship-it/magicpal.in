"use client";

import { useState } from "react";
import { IconLock } from "./Icons";

/**
 * Signing out, at the bottom of your own profile.
 *
 * Quiet at rest, like leaving a community: it's a normal thing to do and
 * shouldn't look like an alarm, but it also shouldn't happen on a mis-tap
 * next to the buttons that edit your profile — so it confirms.
 *
 * The line about live location is the one thing worth saying out loud. On
 * a product that can be broadcasting where you physically are, "am I still
 * on the map after this?" is a reasonable thing to wonder, and the answer
 * is no — the session is gone, so the position stops being served.
 */
export default function SignOut({ email, live }: { email: string; live: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Couldn't sign out.");
      // A full reload rather than a client-side navigation: every window in
      // the shell holds data fetched as this person — people, threads, the
      // feed — and the only honest way to drop all of it at once is to
      // start the page again.
      //
      // `replace`, so Back doesn't return to a URL that implies a session,
      // and the origin rather than "/" so any ?net= from before is gone too.
      window.location.replace(window.location.origin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <div className="mt-5 border-t pt-3.5" style={{ borderColor: "var(--line)" }}>
        <p className="text-[12px] text-[var(--ink-soft)]">Signed in as {email}</p>
        <button
          type="button"
          className="mt-1.5 text-[12.5px] font-semibold tap"
          style={{ color: "var(--ink-soft)" }}
          onClick={() => setConfirming(true)}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border p-3.5" style={{ borderColor: "var(--warn)" }}>
      <p className="text-[13px] font-semibold leading-tight">Sign out of MagicPal?</p>
      <p className="mt-1.5 text-[12.5px] leading-[1.45] text-[var(--ink-soft)]">
        {live
          ? "Your live location stops being shared straight away. "
          : ""}
        You&rsquo;ll need a new code emailed to {email} to get back in.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={go}>
          <IconLock size={12} /> {busy ? "Signing out…" : "Sign out"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirming(false)}>
          Stay signed in
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] font-medium text-[var(--warn)]">{error}</p>}
    </div>
  );
}
