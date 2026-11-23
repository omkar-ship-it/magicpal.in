"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ARCHETYPES, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { ArchetypeMark } from "@/lib/brainMate/symbols";

/**
 * Brain-Mate on the home map — only for members who haven't played the
 * current version. A proper invitation card above the dock; "Later"
 * collapses it to a chip under the top bar for the rest of the day, so the
 * way in never disappears. Members who have played see nothing here: their
 * Brain-Mate lives in their profile instead (ProfileBrainMate below).
 *
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

  if (status.state === "played") return null;

  if (!full) {
    return (
      <Link
        href="/brain-mate/play"
        className="pointer-events-auto absolute left-2.5 top-[108px] z-20 lg:left-auto lg:right-3 lg:top-[76px] flex items-center gap-2 rounded-full bg-[var(--brand)] py-2 pl-3 pr-4 text-[12.5px] font-bold text-white shadow-[0_10px_24px_-12px_var(--brand)]"
      >
        🎲 {status.state === "retake" ? "Ready for a rematch?" : "Ready for a small game?"}
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
          {status.state === "retake" ? "BRAIN-MATE GOT SHARPER" : "READY FOR A SMALL GAME? 🎲"}
        </p>
        <p className="mt-0.5 text-[21px] font-extrabold leading-tight tracking-[-0.01em]">
          {status.state === "retake" ? "Ready for a rematch?" : "Which of 12 minds are you?"}
        </p>
        <p className="mt-1 text-[13px] leading-[1.45] text-white/90">
          {status.state === "retake"
            ? `Last time you were ${ARCHETYPES[status.archetype].name}. New questions, a sharper read — see if it holds.`
            : "3 minutes, no right answers. Then see who you click with — friends, colleagues, people nearby."}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Link href="/brain-mate/play" className="rounded-full bg-white px-4 py-2 text-[14px] font-extrabold text-[#E0266B]">
            {status.state === "retake" ? "Rematch · 3 min" : "Let's play"}
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
export function ProfileBrainMate({ status, onOpen }: { status: BrainMateStatus; onOpen?: () => void }) {
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
  return (
    <div className="mb-4 overflow-hidden rounded-2xl" style={{ background: a.color, color: a.ink }}>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 p-3.5 text-left">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: "rgba(255,255,255,0.18)" }}>
          <ArchetypeMark id={a.id} size={30} color={a.ink} stroke={7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10.5px] font-extrabold tracking-[0.16em] opacity-80">YOUR BRAIN-MATE</span>
          <span className="block text-[17px] font-extrabold leading-tight">{a.name}</span>
          <span className="block text-[12px] opacity-85">{status.mix}</span>
        </span>
        <span className="text-[20px] font-extrabold" aria-hidden="true">
          ›
        </span>
      </button>
      <div className="px-3.5 pb-3.5">
        <p className="rounded-xl px-3 py-2 text-[13px] font-semibold leading-snug" style={{ background: "rgba(255,255,255,0.16)" }}>
          ✦ {a.superpower}
        </p>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="flex-1 rounded-full py-2 text-center text-[13px] font-extrabold"
            style={{ background: a.ink, color: a.color }}
          >
            Open my card
          </button>
          <button
            type="button"
            onClick={onOpen}
            className="flex-1 rounded-full py-2 text-center text-[13px] font-extrabold"
            style={{ border: `1.5px solid ${a.ink}`, color: a.ink }}
          >
            Find my Wavelength
          </button>
        </div>
      </div>
    </div>
  );
}
