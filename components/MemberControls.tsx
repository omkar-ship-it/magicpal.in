"use client";

import { useState } from "react";
import { IconCheck, IconLock, IconX } from "./Icons";

/**
 * What the owner can do to one member, shown only to the owner.
 *
 * Lives on the person's card in the People window rather than in a separate
 * admin screen, because the decision — is this really an alum? should this
 * person be here? — is made while looking at who they are. A moderation
 * console somewhere else would mean deciding about a row in a table.
 *
 * Removal asks twice. It's the one irreversible action here: the person
 * can't rejoin through the link afterwards, so a mis-tap on a phone has to
 * cost a second tap.
 */
export default function MemberControls({
  slug,
  person,
  onChanged,
}: {
  slug: string;
  person: { id: string; name: string; verifiedHere?: boolean };
  /** Told which action landed: a vouch leaves you on the profile, a removal
      has nothing left to show you. */
  onChanged: (action: "verify" | "unverify" | "remove") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function act(action: "verify" | "unverify" | "remove") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/boards/${slug}/members/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't do that.");
      setConfirming(false);
      onChanged(action);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const first = person.name.split(" ")[0];

  if (confirming) {
    return (
      <div className="mt-2.5 rounded-xl p-2.5" style={{ background: "var(--sunk)" }}>
        <p className="text-[12.5px] leading-[1.45]">
          Remove {first}? They lose access to this community and can&rsquo;t rejoin with the invite link.
        </p>
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => act("remove")}>
            {busy ? "Removing…" : `Yes, remove ${first}`}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirming(false)}>
            Keep them
          </button>
        </div>
        {error && <p className="mt-1.5 text-[12px] font-medium text-[var(--warn)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: "var(--line)" }}>
      <p className="label label-icon mb-1.5">
        <IconLock size={11} /> Only you can see this
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={person.verifiedHere ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}
          disabled={busy}
          onClick={() => act(person.verifiedHere ? "unverify" : "verify")}
        >
          {person.verifiedHere ? <IconX size={12} /> : <IconCheck size={12} />}
          {person.verifiedHere ? "Remove verification" : `Verify ${first}`}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirming(true)}>
          Remove from community
        </button>
      </div>
      {!person.verifiedHere && (
        <p className="mt-1.5 text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
          Verifying says you know {first} really is who they say. Everyone here sees the badge.
        </p>
      )}
      {error && <p className="mt-1.5 text-[12px] font-medium text-[var(--warn)]">{error}</p>}
    </div>
  );
}
