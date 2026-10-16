"use client";

import { useState } from "react";
import { IconX } from "./Icons";

/**
 * Deleting an event you host.
 *
 * Quiet at rest and last on the page, like leaving a community — the two
 * irreversible things in this product should look like each other and
 * neither should look like an alarm.
 *
 * The confirmation names the number of people who said they're coming,
 * because that is the fact that decides whether this is a tidy-up or a
 * cancellation. And it says plainly that nobody is told: there are no
 * notifications yet, so somebody with this in their calendar will turn up
 * to an empty room unless the host goes and says so. Hiding that would be
 * letting the product look more capable than it is at somebody else's
 * expense.
 */
export default function DeleteEvent({
  slug,
  name,
  going,
  onDeleted,
}: {
  slug: string;
  name: string;
  going: number;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/boards/${slug}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't delete that.");
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <div className="reveal border-t pt-3.5" style={{ borderColor: "var(--line)" }}>
        <button
          type="button"
          className="text-[12.5px] font-semibold tap"
          style={{ color: "var(--ink-soft)" }}
          onClick={() => setConfirming(true)}
        >
          Delete this event
        </button>
      </div>
    );
  }

  return (
    <div className="reveal rounded-2xl border p-3.5" style={{ borderColor: "var(--warn)" }}>
      <p className="text-[13px] font-semibold leading-tight">Delete {name}?</p>
      <p className="mt-1.5 text-[12.5px] leading-[1.45] text-[var(--ink-soft)]">
        It disappears from the map, the events list and your community&rsquo;s page.
        {going > 0 ? (
          <>
            {" "}
            <span className="font-semibold text-[var(--warn)]">
              {going} {going === 1 ? "person has" : "people have"} said they&rsquo;re coming
            </span>{" "}
            and won&rsquo;t be told — tell them yourself before you do this.
          </>
        ) : (
          " Nobody has said they're coming, so nobody will notice."
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={remove}>
          <IconX size={12} /> {busy ? "Deleting…" : "Delete event"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirming(false)}>
          Keep it
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] font-medium text-[var(--warn)]">{error}</p>}
    </div>
  );
}
