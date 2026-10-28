import { topicById } from "./intents";
import type { ShellPerson } from "./shell";

/**
 * What to filter a directory by when everybody in it is in the same place.
 *
 * The People window filters by city, and that is the right control almost
 * everywhere: a board spread across forty cities is navigated by asking
 * which ones it is in. It stops being a control at all the moment the list
 * is one room — a co-working floor, a conference hall, a campus at lunchtime
 * — because then every chip reads the same city and the row of them narrows
 * nothing.
 *
 * That is the whole of the density problem, and it does not need a new
 * surface to solve. Position carries no information when everyone shares a
 * point, so the fix is to filter on the axis that still does: what people
 * will answer questions about, what they are stuck on, and who the viewer
 * already knows. Same window, same rows, different axis.
 *
 * The chips come from the people actually in the cluster, never a fixed
 * list — a filter that returns nothing is worse than no filter, and only
 * the data knows which topics this particular room is carrying.
 */

export type Facet = {
  id: string;
  label: string;
  count: number;
  /** Membership, precomputed: the list filters with a set lookup. */
  ids: Set<string>;
};

/**
 * Enough to be useful, few enough that the chips stay a couple of rows in
 * a narrow window rather than pushing every person below the fold.
 */
const PER_SIDE = 4;

export function clusterFacets(
  people: readonly ShellPerson[],
  opts: { matchIds?: ReadonlySet<string> } = {}
): Facet[] {
  const out: Facet[] = [
    { id: "all", label: "Everyone", count: people.length, ids: new Set(people.map((p) => p.id)) },
  ];

  /**
   * The matcher has already run for this viewer, server-side, and its
   * answer is on the payload. Recomputing it here would be a second answer
   * that can disagree with the one the For You window is showing.
   */
  if (opts.matchIds && opts.matchIds.size > 0) {
    const worth = people.filter((p) => opts.matchIds!.has(p.id));
    if (worth.length > 0) {
      out.push({ id: "worth", label: "Worth meeting", count: worth.length, ids: new Set(worth.map((p) => p.id)) });
    }
  }

  const known = people.filter((p) => p.connectionStatus === "connected");
  if (known.length > 0) {
    out.push({ id: "known", label: "People you know", count: known.length, ids: new Set(known.map((p) => p.id)) });
  }

  const byTopic = (pick: (p: ShellPerson) => readonly string[], side: "offer" | "need") => {
    const groups = new Map<string, Set<string>>();
    for (const p of people) {
      for (const id of pick(p)) {
        const set = groups.get(id) ?? new Set<string>();
        set.add(p.id);
        groups.set(id, set);
      }
    }
    return [...groups.entries()]
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, PER_SIDE)
      .map(([topicId, ids]) => {
        const t = topicById(topicId);
        return {
          id: `${side}-${topicId}`,
          // The vocabulary already carries both sides of every topic in the
          // right grammar, so the chip reads as a sentence fragment rather
          // than as a tag: "Offers hiring", "Needs funding".
          label: `${side === "offer" ? "Offers" : "Needs"} ${(t ? (side === "offer" ? t.offer : t.need) : topicId).toLowerCase()}`,
          count: ids.size,
          ids,
        };
      });
  };

  out.push(...byTopic((p) => p.canHelpWith, "offer"));
  out.push(...byTopic((p) => p.lookingFor, "need"));

  return out;
}

/** The two lines a row carries in a cluster, in the vocabulary's own words. */
export function tagsOf(p: ShellPerson): { offers: string | null; needs: string | null } {
  const label = (ids: readonly string[], custom: readonly string[], side: "offer" | "need") => {
    const named = ids
      .map((id) => topicById(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((t) => (side === "offer" ? t.offer : t.need));
    const all = [...named, ...custom];
    return all.length > 0 ? all.slice(0, 2).join(" · ") : null;
  };
  return {
    offers: label(p.canHelpWith, p.customCanHelpWith, "offer"),
    needs: label(p.lookingFor, p.customLookingFor, "need"),
  };
}
