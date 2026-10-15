"use client";

import { useState } from "react";
import { IconCheck, IconX } from "./Icons";

/**
 * Leaving, said out loud.
 *
 * Deliberately quiet at rest — a text link at the bottom of the page, not a
 * red button competing with the invite QR. Leaving is a normal thing to do
 * and shouldn't feel like an alarm, but it also shouldn't happen by
 * accident, so the confirmation step spells out exactly what changes.
 *
 * The three consequences are listed because each one is a question somebody
 * would otherwise have to guess at: do I disappear from their map (yes),
 * do my posts vanish (no), can I come back (yes, same link). Guessing wrong
 * on any of those is the difference between leaving and being afraid to.
 */
export default function LeaveCommunity({
  slug,
  name,
  onLeft,
}: {
  slug: string;
  name: string;
  onLeft: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function leave() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/boards/${slug}/leave`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't leave.");
      onLeft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <div className="border-t pt-3" style={{ borderColor: "var(--line)" }}>
        <button
          type="button"
          className="text-[12.5px] font-semibold tap"
          style={{ color: "var(--ink-soft)" }}
          onClick={() => setConfirming(true)}
        >
          Leave {name}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--warn)" }}>
      <p className="text-[13px] font-semibold leading-tight">Leave {name}?</p>

      <ul className="mt-2.5 flex flex-col gap-1.5">
        <Consequence tone="warn">You&rsquo;ll stop seeing its members, events and feed.</Consequence>
        <Consequence tone="warn">They&rsquo;ll stop seeing you here too.</Consequence>
        <Consequence tone="good">Anything you posted stays, and you can rejoin with the same link.</Consequence>
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={leave}>
          {busy ? "Leaving…" : "Leave"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirming(false)}>
          Stay
        </button>
      </div>

      {error && <p className="mt-2 text-[12px] font-medium text-[var(--warn)]">{error}</p>}
    </div>
  );
}

function Consequence({ tone, children }: { tone: "warn" | "good"; children: React.ReactNode }) {
  const color = tone === "good" ? "var(--good)" : "var(--ink-soft)";
  return (
    <li className="flex items-start gap-2 text-[12.5px] leading-[1.45]">
      <span className="mt-0.5 flex-none" style={{ color }}>
        {tone === "good" ? <IconCheck size={12} /> : <IconX size={12} />}
      </span>
      <span>{children}</span>
    </li>
  );
}
