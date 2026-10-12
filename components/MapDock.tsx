"use client";

import Link from "next/link";
import Avatar from "./Avatar";
import { IconCalendar, IconPeople, IconUser } from "./Icons";

export type DockTab = "people" | null;

/**
 * The only chrome parked on the map.
 *
 * Dark in both themes (see --chrome): a white dock on a light Mapbox style
 * dissolves into the map, and navigation is the one thing that must always
 * be findable.
 *
 * Three destinations, always visible rather than collapsed behind a single
 * icon. The prototype hid five sections behind one ✦, which made sense when
 * there were five; with three it would cost a tap just to discover what the
 * app contains — and "where are my boards" is a question the map could not
 * answer at all.
 *
 * People raises a sheet over the map instead of navigating, so the map never
 * goes away underneath it. Boards and You are real routes.
 */
export default function MapDock({
  active,
  peopleCount,
  signedIn,
  me,
  onPeople,
}: {
  active: DockTab;
  /** Shown inline in the label, so the dock says whether opening it is worth it. */
  peopleCount: number;
  signedIn: boolean;
  /** Your own face, so the last slot is you rather than a generic silhouette. */
  me: { name: string; photoUrl: string | null } | null;
  onPeople: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-[24px] border p-1.5"
        style={{
          background: "color-mix(in srgb, var(--chrome) 94%, transparent)",
          borderColor: "var(--chrome-line)",
          backdropFilter: "blur(14px)",
          boxShadow: "var(--shadow-lift)",
        }}
      >
        <DockButton on={active === "people"} onClick={onPeople} label="People" count={peopleCount}>
          <IconPeople size={18} />
        </DockButton>

        <DockLink href="/boards" label="Boards">
          <IconCalendar size={18} />
        </DockLink>

        {signedIn && me ? (
          // Your own face, highlighted — the one slot that should feel like
          // it belongs to somebody rather than to the app.
          <Link
            href="/you"
            className="ml-0.5 flex w-[72px] flex-none flex-col items-center justify-center gap-1 rounded-2xl py-2 tap"
            style={{ background: "color-mix(in srgb, var(--chrome-ink) 10%, transparent)" }}
          >
            <Avatar name={me.name} photoUrl={me.photoUrl} size={22} />
            <span className="text-[11px] font-semibold" style={{ color: "var(--chrome-ink)" }}>
              You
            </span>
          </Link>
        ) : (
          // Quiet, not filled. The sheet above already carries the one
          // primary Sign in, and two filled buttons sixty pixels apart read
          // as a mistake rather than emphasis.
          <DockLink href="/login" label="Sign in">
            <IconUser size={18} />
          </DockLink>
        )}
      </div>
    </div>
  );
}

const SLOT =
  "flex w-[72px] flex-none flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-colors tap";

function DockButton({
  on,
  onClick,
  label,
  count,
  children,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  const tint = on ? "var(--brand)" : "var(--chrome-soft)";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={SLOT}
      style={on ? { background: "color-mix(in srgb, var(--brand) 20%, transparent)" } : undefined}
    >
      <span style={{ color: tint }}>{children}</span>
      <span className="text-[11px] font-semibold" style={{ color: on ? "var(--brand)" : "var(--chrome-ink)" }}>
        {/* Inline rather than a floating badge: at these sizes a badge
            crowds the icon, and the count reads as part of the name. */}
        {label}
        {count != null && count > 0 && <span style={{ color: tint }}> {count}</span>}
      </span>
    </button>
  );
}

function DockLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={SLOT}>
      <span style={{ color: "var(--chrome-soft)" }}>{children}</span>
      <span className="text-[11px] font-semibold" style={{ color: "var(--chrome-ink)" }}>
        {label}
      </span>
    </Link>
  );
}
