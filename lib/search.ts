import { topicById, validTopics } from "./intents";
import type { MapProfile } from "./profiles";

/**
 * One matcher for the list and the map.
 *
 * Kept pure and shared because the prototype shipped two: the list matched
 * on stated intents and the map didn't, so searching "fundraising" produced
 * ten results floating over an empty map. Whatever filters the list has to
 * filter the pins, and the only way to guarantee that is for both to call
 * this.
 */

export type Facets = {
  /** Free text across name, role, company and what they're working on. */
  q: string;
  /** Topic ids. A person matches if the topic appears on *either* side. */
  topics: string[];
  /** Board surfaces only: in the room right now. */
  hereNow: boolean;
  /** Only people who agreed to a street-level pin. */
  exactOnly: boolean;
};

export const NO_FACETS: Facets = { q: "", topics: [], hereNow: false, exactOnly: false };

export function facetsActive(f: Facets): number {
  return (f.q.trim() ? 1 : 0) + f.topics.length + (f.hereNow ? 1 : 0) + (f.exactOnly ? 1 : 0);
}

/**
 * Matched against the topic's *words*, not just its id, so typing
 * "investor" finds the people offering "Investing or angel intros" even
 * though the id is `funding`. A search box that only matches ids is a
 * search box that only works for whoever wrote the vocabulary.
 */
function haystack(p: MapProfile): string {
  const topicWords = [...validTopics(p.lookingFor), ...validTopics(p.canHelpWith)]
    .map((id) => {
      const t = topicById(id);
      return t ? `${t.need} ${t.offer}` : "";
    })
    .join(" ");
  return [p.name, p.headline, p.company, p.workingOn, p.locationLabel, topicWords]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesFacets(p: MapProfile & { hereNow?: boolean }, f: Facets): boolean {
  const q = f.q.trim().toLowerCase();
  if (q) {
    const hay = haystack(p);
    // Every word must appear somewhere — "product berlin" should mean both,
    // which is what people expect from a search box and not what a single
    // substring test does.
    if (!q.split(/\s+/).every((word) => hay.includes(word))) return false;
  }

  if (f.topics.length > 0) {
    const theirs = new Set([...validTopics(p.lookingFor), ...validTopics(p.canHelpWith)]);
    if (!f.topics.some((t) => theirs.has(t))) return false;
  }

  if (f.hereNow && !p.hereNow) return false;
  if (f.exactOnly && p.placed !== "exact") return false;
  return true;
}

export function applyFacets<T extends MapProfile & { hereNow?: boolean }>(people: T[], f: Facets): T[] {
  return people.filter((p) => matchesFacets(p, f));
}
