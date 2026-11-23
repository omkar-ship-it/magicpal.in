"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VIEW_SLIDERS } from "@/lib/brainMate/rounds";
import { buzz, tone } from "./feel";

/**
 * "How does Eswari come across?" — nine quick sliders, given once per
 * finished link. A second person's view is the one thing that makes a
 * profile more accurate than anyone's answers about themselves can, and
 * the gap between how you see yourself and how others see you is often
 * the most interesting line on the card.
 */
export default function ViewForm({ slug, other }: { slug: string; other: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const all = VIEW_SLIDERS.every((s) => values[s.trait] !== undefined);
  if (done)
    return (
      <p className="text-center text-[15px] font-bold">
        Thanks — {other} will see how they come across to you (only as part of everyone&apos;s view).
      </p>
    );
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">HOW DOES {other.toUpperCase()} COME ACROSS?</p>
        <p className="mt-1 text-[14px] text-[var(--bm-soft)]">
          Nine quick slides, 20 seconds. It sharpens {other}&apos;s profile — people are often seen differently than they see themselves.
        </p>
      </div>
      {VIEW_SLIDERS.map((s) => {
        const v = values[s.trait];
        return (
          <div key={s.trait}>
            <div className="flex justify-between text-[13px] font-bold">
              <span>{s.left}</span>
              <span className="text-right">{s.right}</span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              step={5}
              value={v === undefined ? 0 : Math.round(v * 100)}
              onChange={(e) => {
                const next = Number(e.target.value) / 100;
                if (Math.round(next * 4) !== Math.round((v ?? 0) * 4)) buzz(4);
                setValues((cur) => ({ ...cur, [s.trait]: next }));
              }}
              onPointerDown={() => values[s.trait] === undefined && setValues((cur) => ({ ...cur, [s.trait]: 0 }))}
              className="mt-1 w-full accent-[#FF6B4A]"
              style={{ opacity: v === undefined ? 0.45 : 1 }}
              aria-label={`${s.left} to ${s.right}`}
            />
          </div>
        );
      })}
      {error && <p className="text-[13px] font-semibold text-[var(--warn)]">{error}</p>}
      <button
        className="bm-btn bm-btn-brand"
        disabled={!all || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          const res = await fetch(`/api/brain-mate/links/${slug}/view`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ view: values }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            buzz([15, 30, 15]);
            tone(12, 0.3);
            setDone(true);
            router.refresh();
          } else {
            setError(data.error ?? "Couldn't save that.");
            setBusy(false);
          }
        }}
      >
        {all ? `Share my view of ${other}` : `Move all ${VIEW_SLIDERS.length} (${Object.keys(values).length}/${VIEW_SLIDERS.length})`}
      </button>
    </div>
  );
}
