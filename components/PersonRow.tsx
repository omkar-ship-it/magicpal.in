"use client";

import type { ShellPerson } from "@/lib/shell";
import { sectorById } from "@/lib/intents";
import Avatar from "./Avatar";
import VerifiedBadge from "./VerifiedBadge";
import { Ask, askLines } from "./Asks";
import { IconCity, IconHidden, IconPin } from "./Icons";

/**
 * One person, as a card you could act on.
 *
 * This was a line: face, name, headline, and the two intents crushed into
 * grey eight-point text underneath. It read as a phone book, which is the
 * wrong object — a phone book is for finding a name you already know, and
 * nobody opens this knowing the name. They open it asking "who here is
 * worth an hour", and the answer to that is what somebody needs and what
 * they can give, which were the two least legible things on the row.
 *
 * So the two asks get the space, the labels and the colours they get
 * everywhere else (see Asks.tsx), and the sectors underneath say what
 * world the person is in. The whole card opens the profile; the button
 * says what the next move actually is, which depends on whether you have
 * already made it.
 */
export default function PersonRow({
  person,
  onOpen,
}: {
  person: ShellPerson;
  onOpen: () => void;
}) {
  const needs = askLines(person.lookingFor, person.customLookingFor, "need");
  const offers = askLines(person.canHelpWith, person.customCanHelpWith, "offer");

  /**
   * What world they're in, which is the question the asks don't answer.
   *
   * Sectors first because they are a closed vocabulary two people can
   * actually share; free-text skills fill the rest of the row for somebody
   * who never picked one.
   */
  const tags = [
    ...person.interests.map((id) => sectorById(id)?.label).filter(Boolean),
    ...person.customInterests,
    ...person.skills,
  ]
    .filter(Boolean)
    .slice(0, 4) as string[];

  // Where they are *allowed* to be, not where they are — a pin for an
  // exact position, a building for city-only, a struck-out eye for
  // somebody off the map, so a member invisible on the map is still
  // visibly here.
  const placed = person.unplaced ? "off" : person.placed;
  const placeIcon =
    placed === "off" ? <IconHidden size={11} /> : placed === "base" ? <IconCity size={11} /> : <IconPin size={11} />;
  const placeText =
    placed === "off"
      ? "Not on the map"
      : `${person.locationLabel ?? "Somewhere"}${placed === "base" ? " · city only" : ""}`;

  const action =
    person.connectionStatus === "connected"
      ? "Message"
      : person.connectionStatus === "pending"
        ? "Request sent"
        : "Connect";

  return (
    <div
      className="card @container flex flex-col gap-2.5 p-3"
      style={{ borderColor: "var(--line)" }}
    >
      {/* The head is the clickable part. A whole card that is one button
          cannot hold a button of its own, and the action below has to be
          separately reachable by a keyboard. */}
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-2.5 text-left tap">
        <Avatar name={person.name} photoUrl={person.photoUrl} size={38} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 truncate text-[13px] font-semibold">{person.name}</span>
            {person.verified && <VerifiedBadge size={13} label="Verified by this community" />}
            {person.self && (
              <span
                className="pill flex-none"
                style={{ background: "color-mix(in srgb, var(--brand) 14%, transparent)", color: "var(--brand)" }}
              >
                You
              </span>
            )}
            {person.hereNow && (
              <span
                className="pill flex-none"
                style={{ background: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good)" }}
              >
                Here now
              </span>
            )}
          </span>
          {(person.headline || person.company) && (
            <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">
              {person.headline}
              {person.company ? ` · ${person.company}` : ""}
            </span>
          )}
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--ink-soft)]">
            <span className="flex-none">{placeIcon}</span>
            <span className="truncate">{placeText}</span>
          </span>
        </span>
      </button>

      {/* Side by side once the card is wide enough to hold two columns
          without breaking every line — a container query, because the
          panel is resizable and the viewport says nothing about how much
          room this particular card has. */}
      {(needs.length > 0 || offers.length > 0) && (
        <div className="grid grid-cols-1 gap-1.5 @[300px]:grid-cols-2">
          <Ask side="need" lines={needs} compact />
          <Ask side="offer" lines={offers} compact />
        </div>
      )}

      {needs.length === 0 && offers.length === 0 && (
        // Said rather than left blank: a thin card otherwise looks like a
        // rendering fault, and this is the one fact about them that would
        // change whether you bothered.
        <p className="text-[11.5px] italic text-[var(--ink-soft)]">
          Hasn&rsquo;t said what they&rsquo;re looking for yet.
        </p>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <span key={t} className="pill" style={{ background: "var(--sunk)", color: "var(--ink-soft)" }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Your own row says how finished you are, and what to do next.
          The directory is where somebody checks how they read to the
          room, so it is the right place to be told the room cannot see
          half of you yet. Nobody else's row carries this — their
          completeness is not your business. */}
      {person.self && person.completion && (
        <button type="button" onClick={onOpen} className="block w-full text-left tap">
          <span className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-semibold" style={{ color: "var(--brand)" }}>
              {person.completion.next} →
            </span>
            <span className="text-[11.5px] font-semibold tabular-nums text-[var(--ink-soft)]">
              {person.completion.percent}%
            </span>
          </span>
          <span
            className="mt-1 block h-1.5 overflow-hidden rounded-full"
            style={{ background: "var(--line)" }}
          >
            <span
              className="block h-full rounded-full"
              style={{
                width: `${person.completion.percent}%`,
                background: "linear-gradient(90deg, var(--brand), var(--brand-deep))",
              }}
            />
          </span>
        </button>
      )}

      {!person.self && (
        <button
          type="button"
          onClick={onOpen}
          className={`btn btn-sm w-full ${person.connectionStatus === "pending" ? "btn-ghost" : "btn-primary"}`}
        >
          {action}
        </button>
      )}
    </div>
  );
}
