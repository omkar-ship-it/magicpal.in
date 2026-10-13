"use client";

import { topicById } from "@/lib/intents";
import type { MapProfile } from "@/lib/profiles";
import Avatar from "./Avatar";
import { IconCity, IconPin, IconSparkle } from "./Icons";

/**
 * One person, everywhere.
 *
 * The ordering is the argument: face, name, what they do, then *why this
 * person* — and the reason sits above the topic chips, because the chips
 * are the evidence for it. A card that led with chips would make the
 * reader do the inference the matcher already did.
 */
export default function PersonCard({
  person,
  reason,
  twoWay,
  onOpen,
  compact = false,
}: {
  person: MapProfile & { hereNow?: boolean; unplaced?: boolean };
  /** The matcher's sentence. Omitted on surfaces that just list people. */
  reason?: string;
  twoWay?: boolean;
  onOpen?: () => void;
  compact?: boolean;
}) {
  const needs = person.lookingFor.map(topicById).filter(Boolean);
  const offers = person.canHelpWith.map(topicById).filter(Boolean);

  return (
    <article className="card p-3.5">
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 text-left tap">
        <Avatar name={person.name} photoUrl={person.photoUrl} size={compact ? 46 : 56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="min-w-0 truncate text-[14px] font-semibold">{person.name}</h3>
            {person.hereNow && (
              <span className="pill" style={{ background: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good)" }}>
                Here now
              </span>
            )}
          </div>
          <p className="truncate text-[12.5px] text-[var(--ink-soft)]">
            {person.headline}
            {person.company ? ` · ${person.company}` : ""}
          </p>
          <Placement person={person} />
        </div>
      </button>

      {reason && (
        <div className="mt-3 rounded-xl p-2.5" style={{ background: "var(--sunk)" }}>
          <p className="label label-icon mb-1">
            <IconSparkle size={12} />
            {twoWay ? "You can help each other" : "Why them"}
          </p>
          <p className="text-[12.5px] leading-[1.45]">{reason}</p>
        </div>
      )}

      {person.workingOn && (
        <p className="mt-2.5 text-[12.5px] leading-[1.45] text-[var(--ink-soft)]">
          <span className="font-semibold text-[var(--ink)]">Working on</span> — {person.workingOn}
        </p>
      )}

      {!compact && (needs.length > 0 || offers.length > 0) && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {needs.length > 0 && (
            <ChipRow label="Wants" items={needs.map((t) => t!.need)} tone="brand" />
          )}
          {offers.length > 0 && (
            <ChipRow label="Offers" items={offers.map((t) => t!.offer)} tone="good" />
          )}
        </div>
      )}
    </article>
  );
}

/**
 * Where they are, and — the part that matters — how precisely they agreed
 * to be placed. Naming it on every card means "city only" never looks like
 * a vague pin; it looks like a choice somebody made.
 */
function Placement({ person }: { person: MapProfile & { unplaced?: boolean } }) {
  if (person.unplaced) {
    return (
      <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-[var(--ink-soft)]">
        <IconCity size={11} /> Not on the map
      </p>
    );
  }
  const km = person.distanceKm;
  const near = km == null ? null : km < 1 ? "under 1 km" : `${Math.round(km)} km`;
  return (
    <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-[var(--ink-soft)]">
      {person.placed === "exact" ? <IconPin size={11} /> : <IconCity size={11} />}
      <span className="truncate">
        {person.locationLabel || "Somewhere"}
        {near ? ` · ${near}` : ""}
        {person.placed === "base" ? " · city only" : ""}
      </span>
    </p>
  );
}

function ChipRow({ label, items, tone }: { label: string; items: string[]; tone: "brand" | "good" }) {
  const color = tone === "brand" ? "var(--brand)" : "var(--good)";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">{label}</span>
      {items.map((t) => (
        <span
          key={t}
          className="pill"
          style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}
