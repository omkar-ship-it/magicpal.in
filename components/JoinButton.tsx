"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Joining is one tap and no approval queue.
 *
 * The slug is the authorisation — the host decided who to show the code
 * to — and anything stricter puts a wait between scanning a poster and
 * seeing the room. In a venue, that wait is the end of the product.
 */
export default function JoinButton({ slug, label = "Join this board" }: { slug: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/boards/${slug}/join`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't join that board.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={join} disabled={busy} className="btn btn-primary w-full">
        {busy ? "Joining…" : label}
      </button>
      {error && <p className="mt-2 text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}
    </>
  );
}
