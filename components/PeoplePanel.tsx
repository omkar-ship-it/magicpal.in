"use client";

import { useState } from "react";
import type { ShellPerson } from "@/lib/shell";
import { cityLabel } from "@/lib/cityLabel";
import DirectoryPanel from "./DirectoryPanel";
import PersonRow from "./PersonRow";
import PanelNote from "./PanelNote";

/**
 * Everybody here, as something you can actually search.
 *
 * A community of two hundred was a stack of two hundred cards, which is
 * not a directory — it's a scroll. The question people open this to answer
 * is "is so-and-so in here" or "who's in Bengaluru", and both of those are
 * a search box and a row of cities, not a filter sheet somewhere else.
 *
 * Cities are derived from the people actually present rather than from a
 * fixed list: a chip that returns nothing is worse than no chip, and only
 * the data knows which cities this group is in.
 */
export default function PeoplePanel({
  people,
  scopeName,
  isOpenNet,
  filtering,
  unverifiedCount,
  showUnverified,
  onOpenPerson,
}: {
  people: ShellPerson[];
  scopeName: string;
  isOpenNet: boolean;
  /** Whether the top bar's facets are already narrowing this list. */
  filtering: boolean;
  unverifiedCount: number;
  /** Owner-only nudge about who still needs vouching for. */
  showUnverified: boolean;
  onOpenPerson: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");

  const cityOf = (p: ShellPerson) => cityLabel(p.locationLabel);

  const tally = new Map<string, number>();
  for (const p of people) {
    const c = cityOf(p);
    if (c) tally.set(c, (tally.get(c) ?? 0) + 1);
  }
  const filters = [
    { id: "all", label: "Everywhere" },
    ...[...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([c, n]) => ({ id: c, label: c, count: n })),
  ];

  const q = query.trim().toLowerCase();
  const shown = people.filter((p) => {
    if (city !== "all" && cityOf(p) !== city) return false;
    if (!q) return true;
    return [p.name, p.headline, p.company, p.locationLabel]
      .filter(Boolean)
      .some((f) => f!.toLowerCase().includes(q));
  });

  const offMap = people.filter((p) => p.unplaced).length;

  return (
    <DirectoryPanel
      query={query}
      onQuery={setQuery}
      placeholder={`Search ${people.length} ${people.length === 1 ? "person" : "people"} by name, role or city…`}
      filters={filters}
      activeFilter={city}
      onFilter={setCity}
      note={
        showUnverified && unverifiedCount > 0 ? (
          <>
            <span className="font-semibold text-[var(--ink)]">{unverifiedCount}</span>{" "}
            {unverifiedCount === 1 ? "person hasn't" : "people haven't"} been verified yet. Open anyone to vouch for
            them.
          </>
        ) : offMap > 0 ? (
          // Said out loud so the list never reads as the whole group when
          // it isn't: these people are here, they're just not on the map.
          <>
            {offMap} of these {people.length} keep themselves off the map. They&rsquo;re still here, and you can still
            message them.
          </>
        ) : null
      }
    >
      {shown.length === 0 ? (
        <PanelNote
          title={q || city !== "all" || filtering ? "Nothing matches that" : `Nobody on ${scopeName} yet`}
        >
          {q || city !== "all" || filtering
            ? "Try a different search, or widen the filters."
            : isOpenNet
              ? "Most people arrive through a board first and opt into the public map afterwards."
              : "Share the board's QR code and it fills as people scan it."}
        </PanelNote>
      ) : (
        <ul className="stagger flex flex-col">
          {shown.map((p) => (
            <li key={p.id}>
              <PersonRow person={p} onOpen={() => onOpenPerson(p.id)} />
            </li>
          ))}
        </ul>
      )}
    </DirectoryPanel>
  );
}
