/**
 * One icon set for the whole members-only experience.
 *
 * It replaced emoji. Emoji look like a decision nobody made: 🚫 and 🏙 sat
 * next to each other in the privacy picker as a flat glyph beside a
 * photo-realistic skyline, and every platform drew them differently — so the
 * product looked different on the phone you demoed it on than the one you
 * built it on. These are 24×24, 1.75 stroke, round caps and joins, and they
 * inherit `currentColor`, so they sit at whatever weight and colour the
 * surface around them asks for.
 *
 * Emoji still appear, but only as *content* — the badge an institution picked
 * for itself in lib/networks.ts. Chrome is drawn; data is not.
 */

type Props = { size?: number; className?: string; strokeWidth?: number; style?: React.CSSProperties };

function Svg({ size = 18, className, strokeWidth = 1.75, style, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconFeed(p: Props) {
  return (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M7.5 9.5h9M7.5 13h9M7.5 16.5h5" />
    </Svg>
  );
}

export function IconPeople(p: Props) {
  return (
    <Svg {...p}>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7" r="3.5" />
      <path d="M22 20v-1.5a4 4 0 0 0-3-3.87M16 3.3a4 4 0 0 1 0 7.4" />
    </Svg>
  );
}

export function IconCalendar(p: Props) {
  return (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  );
}

export function IconChat(p: Props) {
  return (
    <Svg {...p}>
      <path d="M21 11.5a8 8 0 0 1-11.6 7.1L3.5 20.5l1.9-5.9A8 8 0 1 1 21 11.5Z" />
    </Svg>
  );
}

export function IconPin(p: Props) {
  return (
    <Svg {...p}>
      <path d="M19.5 10.5c0 5.5-7.5 11-7.5 11s-7.5-5.5-7.5-11a7.5 7.5 0 0 1 15 0Z" />
      <circle cx="12" cy="10.3" r="2.7" />
    </Svg>
  );
}

/** Travel — a paper plane reads as "going somewhere" at 14px; a jet doesn't. */
export function IconPlane(p: Props) {
  return (
    <Svg {...p}>
      <path d="M21.5 2.5 10.8 13.2" />
      <path d="M21.5 2.5 14.8 21.5l-4-8.3-8.3-4Z" />
    </Svg>
  );
}

export function IconGlobe(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12h19" />
      <path d="M12 2.5a14.5 14.5 0 0 1 3.8 9.5 14.5 14.5 0 0 1-3.8 9.5 14.5 14.5 0 0 1-3.8-9.5A14.5 14.5 0 0 1 12 2.5Z" />
    </Svg>
  );
}

export function IconUser(p: Props) {
  return (
    <Svg {...p}>
      <path d="M19 20v-1.5a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4V20" />
      <circle cx="12" cy="7" r="3.8" />
    </Svg>
  );
}

/** Off the map — an eye struck through, not a prohibition sign. */
export function IconHidden(p: Props) {
  return (
    <Svg {...p}>
      <path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.8 3.7M6.3 6.8A17 17 0 0 0 2.5 12S6 19 12 19a9.4 9.4 0 0 0 4-.9" />
      <path d="M10 10a2.8 2.8 0 0 0 4 4" />
      <path d="M3 3l18 18" />
    </Svg>
  );
}

/** City-level location — blocks, not a skyline photo. */
export function IconCity(p: Props) {
  return (
    <Svg {...p}>
      <path d="M2.5 21h19" />
      <path d="M5 21V10.5l5-3v13.5" />
      <path d="M14 21V4.5l5 3V21" />
      <path d="M7.5 13.5h0M7.5 17h0M16.5 11h0M16.5 14.5h0M16.5 18h0" />
    </Svg>
  );
}

/** A beacon: something being actively broadcast, not just a position. */
export function IconBeacon(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="2.2" />
      <path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
      <path d="M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
    </Svg>
  );
}

/**
 * Dropping a pin: a marker, and the ground it lands on.
 *
 * It was two speech bubbles, which sat two slots away from Chats in the
 * dock and read as a second chat icon — the glyph was describing what
 * happens *after* somebody walks over rather than the thing you actually
 * do. A pin says it directly.
 *
 * The ellipse underneath is what keeps it from being `IconPin`, which means
 * "a location" wherever it appears. This one means "put one here".
 *
 * Used in exactly two places — the dock's Now slot and the map marker — so
 * the module and the thing it lists are visibly one feature.
 */
export function IconMeetup(p: Props) {
  return (
    <Svg {...p}>
      <path d="M17 8.8c0 4.2-5 8.5-5 8.5S7 13 7 8.8a5 5 0 0 1 10 0Z" />
      <circle cx="12" cy="8.8" r="1.9" />
      <path d="M8.3 16.6C5.7 17.1 4 18 4 19.1c0 1.4 3.6 2.4 8 2.4s8-1 8-2.4c0-1.1-1.7-2-4.3-2.5" />
    </Svg>
  );
}

/** A picture, for the chat composer's photo button. */
export function IconImage(p: Props) {
  return (
    <Svg {...p}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="m4 17 4.8-4.4a2 2 0 0 1 2.7 0L20 20" />
    </Svg>
  );
}

/** A document, for the chat composer's attach button. */
export function IconDoc(p: Props) {
  return (
    <Svg {...p}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </Svg>
  );
}

/** Alerts. The one place this product interrupts somebody. */
export function IconBell(p: Props) {
  return (
    <Svg {...p}>
      <path d="M18 8.5a6 6 0 0 0-12 0c0 6-2.2 7.5-2.2 7.5h16.4S18 14.5 18 8.5Z" />
      <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
    </Svg>
  );
}

export function IconCheck(p: Props) {
  return (
    <Svg {...p}>
      <path d="M20 6.5 9.2 17.3 4 12.1" />
    </Svg>
  );
}

export function IconX(p: Props) {
  return (
    <Svg {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function IconPlus(p: Props) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconLock(p: Props) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="10.5" width="17" height="10.5" rx="2.5" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </Svg>
  );
}

export function IconSearch(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </Svg>
  );
}

export function IconChevronLeft(p: Props) {
  return (
    <Svg {...p}>
      <path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

export function IconChevronDown(p: Props) {
  return (
    <Svg {...p}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function IconChevronRight(p: Props) {
  return (
    <Svg {...p}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function IconHeart(p: Props) {
  return (
    <Svg {...p}>
      <path d="M19 13.6c1.4-1.4 2.8-3 2.8-5.2A5.2 5.2 0 0 0 16.6 3C15 3 13.8 3.5 12 5.2 10.2 3.5 9 3 7.4 3A5.2 5.2 0 0 0 2.2 8.4c0 2.2 1.4 3.8 2.8 5.2L12 20.8Z" />
    </Svg>
  );
}

export function IconCopy(p: Props) {
  return (
    <Svg {...p}>
      <rect x="9" y="9" width="12.5" height="12.5" rx="2.5" />
      <path d="M5.5 15H4.5a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2H13a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

export function IconDownload(p: Props) {
  return (
    <Svg {...p}>
      <path d="M12 3v12" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 17.5v1A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-1" />
    </Svg>
  );
}

export function IconClock(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 6.5V12l3.5 2" />
    </Svg>
  );
}

export function IconSend(p: Props) {
  return (
    <Svg {...p}>
      <path d="M21.5 2.5 10.8 13.2" />
      <path d="M21.5 2.5 14.8 21.5l-4-8.3-8.3-4Z" />
    </Svg>
  );
}

export function IconBriefcase(p: Props) {
  return (
    <Svg {...p}>
      <rect x="2.5" y="7" width="19" height="13.5" rx="2.5" />
      <path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7" />
    </Svg>
  );
}

export function IconSparkle(p: Props) {
  return (
    <Svg {...p}>
      <path d="M12 3.5 13.9 9l5.6 2-5.6 2-1.9 5.5L10.1 13l-5.6-2 5.6-2Z" />
    </Svg>
  );
}

/** Hiring. Distinct from IconFeed, which the Feed tab already owns. */
export function IconMegaphone(p: Props) {
  return (
    <Svg {...p}>
      <path d="M3 11v2a2 2 0 0 0 2 2h2l9 5V4L7 9H5a2 2 0 0 0-2 2Z" />
      <path d="M19 9.5a3.5 3.5 0 0 1 0 5" />
    </Svg>
  );
}

/** An ask — a question mark reads at 13px where a raised hand turns to mush. */
export function IconAsk(p: Props) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.3-2.4 3.8" />
      <path d="M12 17.2h0" />
    </Svg>
  );
}
