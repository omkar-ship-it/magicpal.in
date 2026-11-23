"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./brainmate.css";
import { ARCHETYPES, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { ArchetypeMark } from "@/lib/brainMate/symbols";

/**
 * Brain-Mate on the home map, for every signed-in member:
 *
 *   not played (or an old version)  a proper invitation card above the dock;
 *                                   "Later" collapses it to a chip under the
 *                                   top bar for the rest of the day
 *   played                          a chip: "Find your Brain-Mate" — the
 *                                   one-a-day Wavelength check, a tap away
 *
 * Everything opens Brain-Mate as a window over the map, never a new page.
 * The parent hides its own off-map nudge while the full card is up, so a
 * phone never shows two cards stacked over the map.
 */

export type BrainMateStatus =
  | { state: "new" }
  | { state: "retake"; archetype: ArchetypeId }
  | { state: "played"; archetype: ArchetypeId; mix: string };

const LATER_KEY = "bm_invite_later";
const today = () => new Date().toISOString().slice(0, 10);

const SHOWCASE: ArchetypeId[] = ["dreamer", "detective", "spark", "connector", "creator", "doer"];

export default function HomeInvite({
  status,
  onPlay,
  onFindMate,
  onFullChange,
  compact = false,
}: {
  status: BrainMateStatus;
  /** A panel is covering the map: phones get the chip instead of the card. */
  compact?: boolean;
  onPlay: () => void;
  onFindMate: () => void;
  onFullChange?: (full: boolean) => void;
}) {
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

  const chip = "pointer-events-auto absolute left-2.5 top-[108px] z-20 lg:left-auto lg:right-3 lg:top-[76px] bm-map-chip flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-[13px] font-bold shadow-[0_12px_26px_-12px_rgba(0,0,0,0.45)]";

  if (status.state === "played") {
    const a = ARCHETYPES[status.archetype];
    return (
      <button type="button" onClick={onFindMate} className={`${chip} bg-[var(--card)] text-[var(--ink)]`}>
        <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: a.color }}>
          <ArchetypeMark id={a.id} size={16} color={a.ink} stroke={8} />
        </span>
        <span>🌊 Find your Brain-Mate</span>
      </button>
    );
  }

  const smallChip = (extra = "") => (
    <button type="button" onClick={onPlay} className={`${chip} ${extra} pl-3 text-white`} style={{ background: "linear-gradient(120deg, #FF6B4A, #E0266B)" }}>
      🧠 {status.state === "retake" ? "Ready for a rematch?" : "Which of 12 minds are you? Play"}
    </button>
  );
  if (!full) return smallChip();

  return (
    <>
    {compact && smallChip("lg:hidden")}
    <div className={`bm-map-card pointer-events-auto absolute inset-x-3 bottom-[96px] z-20 lg:inset-x-auto lg:right-3 lg:max-w-[340px] ${compact ? "hidden lg:block" : ""}`}>
      <div
        className="relative overflow-hidden rounded-[22px] p-4 text-white shadow-[var(--shadow-lift)]"
        style={{ background: "linear-gradient(135deg, #FF6B4A 0%, #E0266B 55%, #7B4DFF 100%)" }}
      >
        <div className="flex -space-x-2">
          {SHOWCASE.map((id, i) => (
            <span
              key={id}
              className="bm-map-face grid h-8 w-8 place-items-center rounded-full ring-2 ring-white/70"
              style={{ background: ARCHETYPES[id].color, animationDelay: `${i * 0.18}s` }}
            >
              <ArchetypeMark id={id} size={18} color={ARCHETYPES[id].ink} stroke={8} />
            </span>
          ))}
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/25 text-[11px] font-extrabold ring-2 ring-white/70">+6</span>
        </div>
        <p className="mt-3 text-[11px] font-extrabold tracking-[0.18em] text-white/80">
          {status.state === "retake" ? "BRAIN-MATE GOT SHARPER" : "NEW · BRAIN-MATE 🧠"}
        </p>
        <p className="mt-0.5 text-[21px] font-extrabold leading-tight tracking-[-0.01em]">
          {status.state === "retake" ? "Ready for a rematch?" : "Which of 12 minds are you?"}
        </p>
        <p className="mt-1 text-[13px] leading-[1.45] text-white/90">
          {status.state === "retake"
            ? `Last time you were ${ARCHETYPES[status.archetype].name}. New questions, a sharper read — see if it holds.`
            : "3 minutes, no right answers. Get your archetype — then find your Brain-Mate."}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={onPlay} className="rounded-full bg-white px-4 py-2 text-[14px] font-extrabold text-[#E0266B] transition-transform active:scale-95">
            {status.state === "retake" ? "Rematch · 3 min" : "Play now · 3 min"}
          </button>
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
    </>
  );
}

/**
 * The same invitation, as a slim banner at the top of the Home panel —
 * which is what a member with setup left to do lands on, covering the map
 * (and the floating card) until they close it.
 */
export function HomePanelBanner({ status }: { status: BrainMateStatus }) {
  if (status.state === "played") return null;
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
          {status.state === "retake" ? "BRAIN-MATE GOT SHARPER" : "READY FOR A SMALL GAME? 🎲"}
        </span>
        <span className="block text-[15px] font-extrabold leading-tight">
          {status.state === "retake" ? "Ready for a rematch?" : "Which of 12 minds are you?"}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[13px] font-extrabold text-[#E0266B]">
        {status.state === "retake" ? "Rematch" : "Let's play"}
      </span>
    </Link>
  );
}

/**
 * Brain-Mate in the member's own profile ("You"). For players it's their
 * card in miniature; for everyone else, a quiet way in — the loud one is on
 * the home map.
 */
export function ProfileBrainMate({ status, onOpen, onFindMate }: { status: BrainMateStatus; onOpen?: () => void; onFindMate?: () => void }) {
  if (status.state !== "played") {
    return (
      <Link
        href="/brain-mate/play"
        className="mb-4 flex items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] p-3"
      >
        <span className="text-[24px]" aria-hidden="true">
          🎲
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold">
            {status.state === "retake" ? "Ready for a rematch?" : "Ready for a small game?"}
          </span>
          <span className="block text-[12px] text-[var(--ink-soft)]">
            {status.state === "retake" ? "Brain-Mate got sharper — retake for your new card." : "Find out which of 12 minds you are. 3 minutes."}
          </span>
        </span>
        <span className="text-[13px] font-semibold text-[var(--brand)]">Play ›</span>
      </Link>
    );
  }
  const a = ARCHETYPES[status.archetype];
  // One quiet block in the profile's own style: your archetype on top, and
  // the viral loop underneath — both open as windows over the map.
  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-[var(--sunk)]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: a.color }}>
          <ArchetypeMark id={a.id} size={26} color={a.ink} stroke={7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] text-[var(--ink-soft)]">Your Archetype</span>
          <span className="block truncate text-[14px] font-semibold">{a.name}</span>
          <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">{status.mix}</span>
        </span>
        <span className="text-[12.5px] font-semibold text-[var(--brand)]">Open ›</span>
      </button>
      <button
        type="button"
        onClick={onFindMate ?? onOpen}
        className="flex w-full items-center gap-3 border-t border-[var(--line)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--sunk)]"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center text-[20px]" aria-hidden="true">
          🌊
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">Find your Brain-Mate</span>
          <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">Send a Wavelength check · one a day</span>
        </span>
        <span className="rounded-full bg-[var(--brand)] px-3 py-1 text-[12px] font-semibold text-white">Send</span>
      </button>
    </div>
  );
}
