"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ARCHETYPES, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { ArchetypeMark } from "@/lib/brainMate/symbols";

/**
 * Brain-Mate on the home map, for every signed-in member.
 *
 * Not played yet (or on an old version): a proper invitation card above
 * the dock. "Later" collapses it to a chip under the top bar for the rest
 * of the day — the way in never disappears entirely. Already played: just
 * the chip, wearing their archetype, which opens their card.
 *
 * The parent hides its own off-map nudge while the full card is up, so a
 * phone never shows two cards stacked over the map.
 */

export type BrainMateStatus =
  | { state: "new" }
  | { state: "retake"; archetype: ArchetypeId }
  | { state: "played"; archetype: ArchetypeId };

const LATER_KEY = "bm_invite_later";
const today = () => new Date().toISOString().slice(0, 10);

const SHOWCASE: ArchetypeId[] = ["dreamer", "detective", "spark", "connector", "creator", "doer"];

export default function HomeInvite({ status, onFullChange }: { status: BrainMateStatus; onFullChange?: (full: boolean) => void }) {
  const [later, setLater] = useState(() => {
    try {
      return localStorage.getItem(LATER_KEY) === today();
    } catch {
      return false;
    }
  });
  const full = status.state !== "played" && !later;

  useEffect(() => {
    onFullChange?.(full);
  }, [full, onFullChange]);

  if (status.state === "played") {
    const a = ARCHETYPES[status.archetype];
    return (
      <Link
        href="/brain-mate/me"
        className="pointer-events-auto absolute left-2.5 top-[108px] z-20 lg:left-auto lg:right-3 lg:top-[76px] flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[12.5px] font-bold shadow-[var(--shadow)]"
        style={{ background: a.color, color: a.ink }}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: "rgba(255,255,255,0.18)" }}>
          <ArchetypeMark id={a.id} size={18} color={a.ink} stroke={8} />
        </span>
        {a.name} · Brain-Mate ›
      </Link>
    );
  }

  if (!full) {
    return (
      <Link
        href="/brain-mate/play"
        className="pointer-events-auto absolute left-2.5 top-[108px] z-20 lg:left-auto lg:right-3 lg:top-[76px] flex items-center gap-2 rounded-full bg-[var(--brand)] py-2 pl-3 pr-4 text-[12.5px] font-bold text-white shadow-[0_10px_24px_-12px_var(--brand)]"
      >
        🧠 {status.state === "retake" ? "Retake Brain-Mate" : "Play Brain-Mate"} · 3 min
      </Link>
    );
  }

  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-[96px] z-20 lg:inset-x-auto lg:right-3 lg:max-w-[340px]">
      <div
        className="relative overflow-hidden rounded-[22px] p-4 text-white shadow-[var(--shadow-lift)]"
        style={{ background: "linear-gradient(135deg, #FF6B4A 0%, #E0266B 55%, #7B4DFF 100%)" }}
      >
        <div className="flex -space-x-2">
          {SHOWCASE.map((id) => (
            <span key={id} className="grid h-8 w-8 place-items-center rounded-full ring-2 ring-white/70" style={{ background: ARCHETYPES[id].color }}>
              <ArchetypeMark id={id} size={18} color={ARCHETYPES[id].ink} stroke={8} />
            </span>
          ))}
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/25 text-[11px] font-extrabold ring-2 ring-white/70">+6</span>
        </div>
        <p className="mt-3 text-[11px] font-extrabold tracking-[0.18em] text-white/80">
          {status.state === "retake" ? "BRAIN-MATE GOT SHARPER" : "NEW · A 3-MINUTE GAME"}
        </p>
        <p className="mt-0.5 text-[20px] font-extrabold leading-tight tracking-[-0.01em]">
          {status.state === "retake" ? "Retake for your new Brain-Mate card" : "Find your Brain-Mates"}
        </p>
        <p className="mt-1 text-[13px] leading-[1.45] text-white/90">
          {status.state === "retake"
            ? `Last time you were ${ARCHETYPES[status.archetype].name}. New questions, a sharper result — see if it holds.`
            : "Discover which of 12 minds you are, then see how you click with friends and colleagues."}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Link href="/brain-mate/play" className="rounded-full bg-white px-4 py-2 text-[14px] font-extrabold text-[#E0266B]">
            {status.state === "retake" ? "Retake · 3 min" : "Play now"}
          </Link>
          <button
            type="button"
            className="rounded-full px-3 py-2 text-[13px] font-bold text-white/85"
            onClick={() => {
              try {
                localStorage.setItem(LATER_KEY, today());
              } catch {
                /* private mode: it just comes back next time */
              }
              setLater(true);
            }}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The same invitation, as a slim banner at the top of the Home panel —
 * which is what a member with setup left to do lands on, covering the map
 * (and the floating card) until they close it.
 */
export function HomePanelBanner({ status }: { status: BrainMateStatus }) {
  if (status.state === "played") {
    const a = ARCHETYPES[status.archetype];
    return (
      <Link
        href="/brain-mate/me"
        className="mx-3 mt-3 flex shrink-0 items-center gap-3 rounded-[16px] p-3"
        style={{ background: a.color, color: a.ink }}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: "rgba(255,255,255,0.18)" }}>
          <ArchetypeMark id={a.id} size={24} color={a.ink} stroke={7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-extrabold tracking-[0.14em] opacity-80">YOUR BRAIN-MATE</span>
          <span className="block truncate text-[15px] font-extrabold">{a.name} — find who you click with</span>
        </span>
        <span className="text-[18px] font-extrabold">›</span>
      </Link>
    );
  }
  return (
    <Link
      href="/brain-mate/play"
      className="mx-3 mt-3 flex shrink-0 items-center gap-3 rounded-[16px] p-3 text-white"
      style={{ background: "linear-gradient(135deg, #FF6B4A 0%, #E0266B 55%, #7B4DFF 100%)" }}
    >
      <span className="text-[26px]" aria-hidden="true">
        🧠
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-extrabold tracking-[0.14em] text-white/80">
          {status.state === "retake" ? "BRAIN-MATE GOT SHARPER" : "NEW · 3-MINUTE GAME"}
        </span>
        <span className="block text-[15px] font-extrabold leading-tight">
          {status.state === "retake" ? "Retake for your new card" : "Find your Brain-Mates"}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[13px] font-extrabold text-[#E0266B]">
        {status.state === "retake" ? "Retake" : "Play"}
      </span>
    </Link>
  );
}
