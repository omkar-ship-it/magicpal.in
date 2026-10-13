"use client";

import { useState } from "react";
import { IconCity, IconX } from "./Icons";

/**
 * The one-tap way onto the public map, offered where the decision actually
 * comes up: inside a network you've already joined.
 *
 * Joining a board is a narrow consent — you agreed to be visible to that
 * room. Appearing on the open map is a wider one, so it is asked
 * separately, in plain words, and it defaults to the safer of the two
 * options: a city circle rather than a street-level pin.
 */
export default function PublicOptIn({
  networkName,
  onDone,
}: {
  networkName: string;
  onDone: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (dismissed) return null;

  async function optIn() {
    setBusy(true);
    setError("");
    try {
      // Reads the saved profile first: the visibility write requires the
      // rest of the row to still be valid, and this panel doesn't have it.
      const current = await (await fetch("/api/profile")).json();
      if (!current.profile) throw new Error("Finish your profile first.");
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...current.profile, visibility: "base" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't update that.");
      setDismissed(true);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-auto absolute bottom-[96px] right-3 z-20 hidden max-w-[290px] lg:block">
      <div className="card p-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="label label-icon m-0">
            <IconCity size={12} /> Only {networkName} can see you
          </p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            style={{ color: "var(--ink-soft)" }}
          >
            <IconX size={12} />
          </button>
        </div>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
          Show your city on the public map too, and people outside this network can find you. Not your exact
          location — a circle over the city.
        </p>
        <div className="mt-2.5 flex gap-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={optIn}>
            {busy ? "Saving…" : "Show my city"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDismissed(true)}>
            Not now
          </button>
        </div>
        {error && <p className="mt-2 text-[12px] font-medium text-[var(--warn)]">{error}</p>}
      </div>
    </div>
  );
}
