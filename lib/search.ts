import { sectorById, stageById, topicById, validSectors, validTopics } from "./intents";
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
  /** Sector ids — what they're into, rather than what they need. */
  sectors: string[];
  /** A single stage id, or empty for any. */
  stage: string;
  /**
   * Narrow to people within this many km, or null for everybody.
   *
   * A *filter*, not a boundary on what exists. It used to be a server-side
   * radius, which meant the directory silently changed as the map moved and
   * somebody you had just been reading about vanished because you panned.
   * The map is a spatial question; the directory is a list of people. One
   * of them follows the viewport and the other does not.
   */
  withinKm: number | null;
  /**
   * Open network only: just the people you're actually connected to.
   *
   * The one view in this product that is about *you* rather than about who
   * happens to be nearby — your own network, on the map, wherever it has
   * got to. A filter rather than a scope, because everything else on the
   * surface has to keep meaning what it meant.
   */
  connectedOnly: boolean;
  /** Board surfaces only: in the room right now. */
  hereNow: boolean;
  /** Only people who agreed to a street-level pin. */
  exactOnly: boolean;
};

export const NO_FACETS: Facets = {
  q: "",
  topics: [],
  sectors: [],
  stage: "",
  withinKm: null,
  connectedOnly: false,
  hereNow: false,
  exactOnly: false,
};

export function facetsActive(f: Facets): number {
  return (
    (f.q.trim() ? 1 : 0) +
    f.topics.length +
    f.sectors.length +
    (f.stage ? 1 : 0) +
    (f.withinKm != null ? 1 : 0) +
    (f.connectedOnly ? 1 : 0) +
    (f.hereNow ? 1 : 0) +
    (f.exactOnly ? 1 : 0)
  );
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
  const sectorWords = validSectors(p.interests)
    .map((id) => sectorById(id)?.label ?? "")
    .join(" ");
  // Somebody's own words are the most specific thing on their profile, so
  // they're also the most useful thing to be able to search for.
  const ownWords = [...p.customLookingFor, ...p.customCanHelpWith, ...p.customInterests].join(" ");
  return [
    p.name,
    p.headline,
    p.company,
    p.workingOn,
    p.locationLabel,
    topicWords,
    sectorWords,
    ownWords,
    // Their own words when it isn't one of ours — otherwise a role
    // somebody typed would be the one thing on their profile search
    // could not find.
    stageById(p.stage)?.label ?? p.stage,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesFacets(
  p: MapProfile & { hereNow?: boolean; connectionStatus?: string | null },
  f: Facets
): boolean {
  // Checked first and cheaply: when it's on it removes most of the list,
  // and everything below it is a more expensive question about somebody
  // who is about to be dropped anyway.
  if (f.connectedOnly && p.connectionStatus !== "connected") return false;

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

  if (f.sectors.length > 0) {
    const theirs = new Set(validSectors(p.interests));
    if (!f.sectors.some((sec) => theirs.has(sec))) return false;
  }
  if (f.stage && p.stage !== f.stage) return false;

  if (f.hereNow && !p.hereNow) return false;
  if (f.withinKm != null) {
    // Somebody with no published position cannot answer a question about
    // distance — the same rule the recommendation ladder applies. Absent is
    // not "far away", it is unknown, so they drop out of a distance filter
    // rather than being guessed at.
    if (p.distanceKm == null) return false;
    if (p.distanceKm > f.withinKm) return false;
  }

  if (f.exactOnly && p.placed !== "exact") return false;
  return true;
}

export function applyFacets<T extends MapProfile & { hereNow?: boolean }>(people: T[], f: Facets): T[] {
  return people.filter((p) => matchesFacets(p, f));
}
