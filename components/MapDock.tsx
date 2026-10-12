"use client";

import Link from "next/link";
import { IconCalendar, IconPeople, IconUser } from "./Icons";

export type DockTab = "people" | null;

/**
 * The only chrome parked on the map.
 *
 * Three destinations, always visible rather than collapsed behind a single
 * icon. The prototype's dock hid five sections behind one ✦, which made
 * sense when there were five; with three it would cost a tap to discover
 * what the app even contains — and "where are my boards" is currently a
 * question the map cannot answer at all.
 *
 * People raises a sheet over the map instead of navigating, so the map
 * never goes away underneath it. Boards and You are real routes.
 */
export default function MapDock({
  active,
  peopleCount,
  signedIn,
  onPeople,
}: {
  active: DockTab;
  /** Badged on People, so the dock says whether opening it is worth it. */
  peopleCount: number;
  signedIn: boolean;
  onPeople: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-[22px] border border-[var(--line)] p-1.5"
        style={{
          background: "color-mix(in srgb, var(--card) 94%, transparent)",
          backdropFilter: "blur(14px)",
          boxShadow: "var(--shadow-lift)",
        }}
      >
        <DockButton on={active === "people"} onClick={onPeople} label="People" badge={peopleCount}>
          <IconPeople size={18} />
        </DockButton>

        <DockLink href="/boards" label="Boards">
          <IconCalendar size={18} />
        </DockLink>

        {/* Quiet, even signed out. The dock is navigation; the sheet above it
            already carries the one primary Sign in, and two filled buttons
            sixty pixels apart read as a mistake rather than emphasis. */}
        <DockLink href={signedIn ? "/you" : "/login"} label={signedIn ? "You" : "Sign in"}>
          <IconUser size={18} />
        </DockLink>
      </div>
    </div>
  );
}

const SLOT =
  "relative flex w-[72px] flex-none flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-colors tap";

function DockButton({
  on,
  onClick,
  label,
  badge,
  children,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={SLOT}
      style={on ? { background: "color-mix(in srgb, var(--brand) 14%, var(--card))" } : undefined}
    >
      <span style={{ color: on ? "var(--brand)" : "var(--ink-soft)" }}>{children}</span>
      <span className="text-[11px] font-semibold" style={{ color: on ? "var(--brand)" : "var(--ink-soft)" }}>
        {label}
      </span>
      {/* Zero is worth saying out loud on an empty map — it's the difference
          between "nothing here" and "we haven't looked yet". */}
      {badge != null && (
        <span
          className="absolute right-2 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold"
          style={{
            background: badge > 0 ? "var(--brand)" : "var(--sunk)",
            color: badge > 0 ? "#fff" : "var(--ink-soft)",
            boxShadow: "0 0 0 2px var(--card)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function DockLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={SLOT}>
      <span style={{ color: "var(--ink-soft)" }}>{children}</span>
      <span className="text-[11px] font-semibold" style={{ color: "var(--ink-soft)" }}>
        {label}
      </span>
    </Link>
  );
}
