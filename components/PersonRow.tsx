"use client";

import type { ShellPerson } from "@/lib/shell";
import Avatar from "./Avatar";
import VerifiedBadge from "./VerifiedBadge";
import { IconCity, IconHidden, IconPin } from "./Icons";
import { tagsOf } from "@/lib/directory";

/**
 * One person as a line, not a card.
 *
 * A card per person is right when there are six of them and you're being
 * asked to choose; it's wrong at two hundred, where the job is finding a
 * name you already half-remember. So the row carries only what you'd scan
 * for — face, name, what they do — and everything else waits behind a tap.
 *
 * The icon on the right is where they are *allowed* to be, not where they
 * are: a pin for an exact position, a building for city-only, a struck-out
 * eye for somebody off the map entirely. It means a member who is invisible
 * on the map is still visibly *here*, which is the difference between a
 * directory and a map with gaps in it.
 */
export default function PersonRow({
  person,
  showTags,
  onOpen,
}: {
  person: ShellPerson;
  /**
   * Inside a cluster, where the row has to carry a reason.
   *
   * Four hundred people in one building filtered by what they offer and
   * need is only useful if the rows say which of those they are. Without
   * the two lines a directory of four hundred is four hundred job titles,
   * and the chips above it have nothing to land on.
   */
  showTags?: boolean;
  onOpen: () => void;
}) {
  const tags = showTags ? tagsOf(person) : null;
  const placed = person.unplaced ? "off" : person.placed;
  const icon =
    placed === "off" ? (
      <IconHidden size={14} />
    ) : placed === "base" ? (
      <IconCity size={14} />
    ) : (
      <IconPin size={14} />
    );
  const placeTitle =
    placed === "off"
      ? "Keeps themselves off the map"
      : placed === "base"
        ? `${person.locationLabel ?? "City"} · city only`
        : (person.locationLabel ?? "On the map");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl px-1.5 py-2 text-left tap hover:bg-[var(--sunk)]"
    >
      <Avatar name={person.name} photoUrl={person.photoUrl} size={38} />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-[13px] font-semibold">{person.name}</span>
          {person.verified && <VerifiedBadge size={13} label="Verified by this community" />}
          {/* So a list of people you are scanning for strangers does not
              make you stop on your own face wondering who that is. */}
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
              Here
            </span>
          )}
        </span>
        <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">
          {person.headline}
          {person.company ? ` · ${person.company}` : ""}
        </span>
        {tags?.offers && (
          <span className="block truncate text-[11px] text-[var(--ink-soft)]">Offers {tags.offers}</span>
        )}
        {tags?.needs && (
          <span className="block truncate text-[11px]" style={{ color: "var(--brand)" }}>
            Needs {tags.needs}
          </span>
        )}
      </span>

      <span className="flex-none text-[var(--ink-soft)]" title={placeTitle} aria-label={placeTitle}>
        {icon}
      </span>
    </button>
  );
}
