"use client";

import Avatar from "./Avatar";
import {
  IconCalendar,
  IconChat,
  IconFeed,
  IconGlobe,
  IconMeetup,
  IconPeople,
  IconSparkle,
  IconUser,
} from "./Icons";

export type DockTab = "home" | "forYou" | "feed" | "people" | "pins" | "events" | "chats" | null;

const SLOTS: Array<{ id: Exclude<DockTab, null>; label: string; icon: React.ReactNode }> = [
  { id: "home", label: "Home", icon: <IconGlobe size={17} /> },
  { id: "forYou", label: "For you", icon: <IconSparkle size={17} /> },
  { id: "feed", label: "Feed", icon: <IconFeed size={17} /> },
  { id: "people", label: "People", icon: <IconPeople size={17} /> },
  { id: "pins", label: "Now", icon: <IconMeetup size={17} /> },
  { id: "events", label: "Events", icon: <IconCalendar size={17} /> },
  { id: "chats", label: "Chats", icon: <IconChat size={17} /> },
];

/**
 * The only chrome parked on the map.
 *
 * Dark in both themes (see --chrome): a white dock on a light Mapbox style
 * dissolves into the map, and navigation is the one piece of UI that must
 * stay findable.
 *
 * Each slot raises a panel over the map rather than navigating, so the map
 * never goes away underneath you — switching from the people list to the
 * feed should not feel like leaving. Tapping the open slot again lowers it,
 * which is the only way back to a clean map.
 */
export default function MapDock({
  active,
  counts,
  signedIn,
  me,
  onSelect,
  onProfile,
}: {
  active: DockTab;
  /** Shown inline in the label. Absent or zero renders nothing. */
  counts: Partial<Record<Exclude<DockTab, null>, number>>;
  signedIn: boolean;
  me: { name: string; photoUrl: string | null } | null;
  onSelect: (tab: Exclude<DockTab, null>) => void;
  /** Opens the profile overlay — or sign-in, when there's nobody yet. */
  onProfile: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-[max(10px,env(safe-area-inset-bottom))]">
      <div
        className="scroll-none pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[24px] border p-1.5"
        style={{
          background: "color-mix(in srgb, var(--chrome) 94%, transparent)",
          borderColor: "var(--chrome-line)",
          backdropFilter: "blur(14px)",
          boxShadow: "var(--shadow-lift)",
        }}
      >
        {SLOTS.map((s) => (
          <DockButton
            key={s.id}
            on={active === s.id}
            onClick={() => onSelect(s.id)}
            label={s.label}
            count={counts[s.id]}
            /* Chats is the one count that means somebody is waiting on you
               rather than simply how much there is to look at. */
            urgent={s.id === "chats"}
          >
            {s.icon}
          </DockButton>
        ))}

        {signedIn && me ? (
          <button
            type="button"
            onClick={onProfile}
            aria-label="Your profile"
            className="ml-0.5 flex w-[42px] sm:w-[60px] flex-none flex-col items-center justify-center gap-1 rounded-2xl py-2 tap"
            style={{ background: "color-mix(in srgb, var(--chrome-ink) 10%, transparent)" }}
          >
            <Avatar name={me.name} photoUrl={me.photoUrl} size={21} />
            <span className="text-[9px] sm:text-[10.5px] font-semibold" style={{ color: "var(--chrome-ink)" }}>
              You
            </span>
          </button>
        ) : (
          // Quiet, not filled: the panel above already carries the one
          // primary Sign in, and two filled buttons a thumb apart read as a
          // mistake rather than emphasis.
          <button type="button" onClick={onProfile} aria-label="Sign in" className={SLOT}>
            <span style={{ color: "var(--chrome-soft)" }}>
              <IconUser size={17} />
            </span>
            <span className="text-[9px] sm:text-[10.5px] font-semibold" style={{ color: "var(--chrome-ink)" }}>
              Sign in
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

const SLOT =
  "dock-slot flex w-[42px] sm:w-[60px] flex-none flex-col items-center justify-center gap-1 rounded-2xl py-2 tap";

function DockButton({
  on,
  onClick,
  label,
  count,
  urgent,
  children,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  urgent?: boolean;
  children: React.ReactNode;
}) {
  const tint = on ? "var(--brand)" : "var(--chrome-soft)";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={SLOT}
      style={
        on
          ? {
              background: "color-mix(in srgb, var(--brand) 13%, var(--chrome))",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--brand) 26%, transparent)",
            }
          : undefined
      }
    >
      <span className="relative" style={{ color: tint }}>
        {children}
        {/* Urgent counts get a dot on the icon as well as the number: a
            person scanning the dock for "is anything waiting on me" should
            not have to read. */}
        {urgent && count != null && count > 0 && (
          <span
            className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full"
            style={{ background: "var(--brand)", boxShadow: "0 0 0 2px var(--chrome)" }}
          />
        )}
      </span>
      <span
        className="whitespace-nowrap text-[9px] sm:text-[10.5px] font-semibold"
        style={{ color: on ? "var(--brand)" : "var(--chrome-ink)" }}
      >
        {label}
        {count != null && count > 0 && <span style={{ color: tint }}> {count}</span>}
      </span>
    </button>
  );
}
