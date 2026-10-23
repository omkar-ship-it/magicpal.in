/**
 * The vocabulary every match is made of.
 *
 * Why a fixed list and not free text: the thing that decides whether
 * somebody actually walks across a room is not how clever the ranking was,
 * it's whether the one-line reason is *checkable*. "You're raising; she
 * writes angel cheques" is checkable. "92% match" is not, and neither is a
 * cosine distance over two bios. An enumerated vocabulary gives an exact
 * overlap, and an exact overlap writes its own sentence.
 *
 * Why topics have two sides: the useful pairings are complementary, not
 * similar. Two people both looking for funding are not a match; one looking
 * for funding and one who invests is the entire point. So a topic carries
 * a `need` label and an `offer` label, and matching crosses them — my needs
 * against your offers. The handful of genuinely mutual topics (a co-founder,
 * or simply wanting to meet good people) are marked `symmetric` and match
 * need-to-need instead.
 *
 * Keep this list short. Every entry is a checkbox a stranger taps on their
 * phone in a noisy room, and the twelfth one is where people stop reading.
 */

export type Topic = {
  id: string;
  /** Checkbox label under "I'm looking for". */
  need: string;
  /** Checkbox label under "I can help with". */
  offer: string;
  /**
   * The same two things again, in sentence form.
   *
   * A checkbox and a sentence want opposite grammar — "Investing or angel
   * intros" is the right label to tick and the wrong words to put after
   * "they". Carrying both is four extra strings per topic and it is the
   * difference between a reason that reads like a person wrote it and one
   * that reads like a database row, so it is worth every one of them.
   *
   * `needGerund` completes "You're ___". `offerVerb` completes "they ___".
   */
  needGerund: string;
  offerVerb: string;
  /**
   * True when wanting the thing is itself what the other person wants —
   * need matches need, and `offer` is never used for the pairing.
   */
  symmetric?: boolean;
};

export const TOPICS: Topic[] = [
  {
    id: "funding",
    need: "Funding",
    needGerund: "raising",
    offer: "Investing or angel intros",
    offerVerb: "invest and make intros",
  },
  {
    id: "role",
    need: "A new role",
    needGerund: "looking for a role",
    offer: "Hiring right now",
    offerVerb: "are hiring right now",
  },
  {
    id: "hiring",
    need: "Help hiring",
    needGerund: "hiring",
    offer: "Recruiting and talent",
    offerVerb: "know the talent market",
  },
  {
    id: "cofounder",
    need: "A co-founder",
    needGerund: "looking for a co-founder",
    offer: "A co-founder",
    offerVerb: "are looking too",
    symmetric: true,
  },
  {
    id: "technical",
    need: "Technical help",
    needGerund: "after technical help",
    offer: "Engineering depth",
    offerVerb: "go deep on engineering",
  },
  {
    id: "product",
    need: "Product feedback",
    needGerund: "after product feedback",
    offer: "Product and design craft",
    offerVerb: "do product and design",
  },
  {
    id: "gtm",
    need: "First customers",
    needGerund: "hunting first customers",
    offer: "Sales and go-to-market",
    offerVerb: "have done go-to-market",
  },
  {
    id: "growth",
    need: "Growth help",
    needGerund: "working on growth",
    offer: "Marketing and growth",
    offerVerb: "run growth",
  },
  {
    id: "market",
    need: "A way into a new market",
    needGerund: "entering a new market",
    offer: "Local market knowledge",
    offerVerb: "know this market",
  },
  {
    id: "advice",
    need: "Career advice",
    needGerund: "after career advice",
    offer: "Mentoring and career advice",
    offerVerb: "mentor",
  },
  {
    id: "peers",
    need: "Good people in my field",
    needGerund: "here to meet good people",
    offer: "Good people in my field",
    offerVerb: "are too",
    symmetric: true,
  },
];

/**
 * What somebody is *into*, as opposed to what they need.
 *
 * Deliberately sectors rather than skills: "fintech" is something two
 * strangers can talk about for an hour, "React" is something they can
 * compare CVs about. Kept to twelve for the same reason TOPICS is short —
 * every entry is a chip somebody taps on a phone in a noisy room.
 */
export type Sector = { id: string; label: string };

export const SECTORS: Sector[] = [
  { id: "fintech", label: "Fintech" },
  { id: "ai", label: "AI & data" },
  { id: "climate", label: "Climate & energy" },
  { id: "health", label: "Health" },
  { id: "consumer", label: "Consumer & retail" },
  { id: "saas", label: "B2B & SaaS" },
  { id: "design", label: "Design & brand" },
  { id: "education", label: "Education" },
  { id: "media", label: "Media & creator" },
  { id: "deeptech", label: "Hardware & deeptech" },
  { id: "social", label: "Social impact" },
  { id: "gaming", label: "Gaming" },
];

export const SECTOR_BY_ID = new Map(SECTORS.map((s) => [s.id, s]));
export const sectorById = (id: string): Sector | undefined => SECTOR_BY_ID.get(id);

export function validSectors(ids: readonly string[] | null | undefined): string[] {
  return (ids ?? []).filter((id) => SECTOR_BY_ID.has(id));
}

/** Shared sectors, strongest-first by nothing in particular — order is input order. */
export function sharedInterests(a: readonly string[], b: readonly string[]): Sector[] {
  const theirs = new Set(validSectors(b));
  return validSectors(a)
    .filter((id) => theirs.has(id))
    .map((id) => SECTOR_BY_ID.get(id)!)
    .filter(Boolean);
}

/**
 * Where somebody is standing right now. One value, context not score.
 *
 * It is what makes a card legible at a glance and it is the filter people
 * actually reach for — "who here is an investor" is the single most common
 * question asked of any room.
 */
export type Stage = { id: string; label: string };

export const STAGES: Stage[] = [
  { id: "founder", label: "Founder" },
  { id: "operator", label: "Operator" },
  { id: "investor", label: "Investor" },
  { id: "freelance", label: "Freelance / independent" },
  { id: "exec", label: "Exec / leadership" },
  { id: "student", label: "Student / early career" },
  { id: "researcher", label: "Researcher / academic" },
  { id: "exploring", label: "Between things" },
];

export const STAGE_BY_ID = new Map(STAGES.map((s) => [s.id, s]));
export const stageById = (id: string | null | undefined): Stage | undefined =>
  id ? STAGE_BY_ID.get(id) : undefined;

export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

export const topicById = (id: string): Topic | undefined => TOPIC_BY_ID.get(id);

/** Drop ids that are no longer in the vocabulary, so a stale row can't crash a render. */
export function validTopics(ids: readonly string[] | null | undefined): string[] {
  return (ids ?? []).filter((id) => TOPIC_BY_ID.has(id));
}

export type Overlap = {
  topic: Topic;
  /**
   * mine-wants-theirs — I need it, they offer it. The strongest signal, and
   * the one that makes the ask obvious.
   * theirs-wants-mine — they need it, I offer it. Equally valuable, but it
   * is framed as what *I* can do, which reads very differently in the UI.
   * mutual — a symmetric topic both of us picked.
   */
  direction: "mine-wants-theirs" | "theirs-wants-mine" | "mutual";
};

/**
 * Every way two people are useful to each other, strongest first.
 *
 * Pure, synchronous and free — which is what lets the matcher run on every
 * request instead of behind a job queue, and lets the UI explain a ranking
 * without a second round trip.
 */
export function overlaps(
  a: { lookingFor: readonly string[]; canHelpWith: readonly string[] },
  b: { lookingFor: readonly string[]; canHelpWith: readonly string[] }
): Overlap[] {
  const aNeeds = new Set(validTopics(a.lookingFor));
  const aOffers = new Set(validTopics(a.canHelpWith));
  const bNeeds = new Set(validTopics(b.lookingFor));
  const bOffers = new Set(validTopics(b.canHelpWith));

  const out: Overlap[] = [];
  for (const topic of TOPICS) {
    if (topic.symmetric) {
      if (aNeeds.has(topic.id) && bNeeds.has(topic.id)) out.push({ topic, direction: "mutual" });
      continue;
    }
    if (aNeeds.has(topic.id) && bOffers.has(topic.id)) out.push({ topic, direction: "mine-wants-theirs" });
    if (bNeeds.has(topic.id) && aOffers.has(topic.id)) out.push({ topic, direction: "theirs-wants-mine" });
  }

  // A pair who each have something the other wants outranks a pair with one
  // useful direction, so a two-way overlap has to sort above a one-way one.
  const rank = (d: Overlap["direction"]) => (d === "mutual" ? 0 : d === "mine-wants-theirs" ? 1 : 2);
  return out.sort((x, y) => rank(x.direction) - rank(y.direction));
}

/** True when each person has something the other asked for. */
export function isTwoWay(list: Overlap[]): boolean {
  return list.some((o) => o.direction === "mine-wants-theirs") && list.some((o) => o.direction === "theirs-wants-mine");
}

/**
 * The reason, written from the overlap alone — no model, no network call.
 *
 * This is the default that ships, and it is deliberately good enough to
 * ship on its own: every sentence it produces is literally true and
 * verifiable against the other person's profile, which is the property that
 * matters. `lib/reasons.ts` can later replace it with a warmer sentence for
 * pairs worth the model call, and falls back to exactly this when it
 * hasn't, so no surface ever has to handle a missing reason.
 *
 * `firstName` rather than the full name: at the point this is read, the
 * person's name and face are already on the card above it.
 */
export function describeOverlap(
  list: Overlap[],
  firstName: string,
  /**
   * Only read when there is no overlap at all. An event board still
   * surfaces people who are simply in the room, and "no stated overlap
   * yet" is a true sentence that gives the reader nothing to act on —
   * so the fallback reaches for the most concrete thing on their profile
   * instead, in descending order of how specific it is.
   */
  other?: { canHelpWith: readonly string[]; workingOn?: string | null },
  /** Sectors both people picked. The symmetric signal, used in two places. */
  shared: Sector[] = []
): string {
  if (list.length === 0) {
    // Never restates `workingOn`: the card renders that line directly
    // underneath, and a reason that repeats the sentence below it reads as
    // padding and makes the whole panel look automated.
    if (shared.length > 0) return `You're both into ${joinWords(shared.map((s) => s.label.toLowerCase()))}.`;
    const offer = validTopics(other?.canHelpWith)[0];
    if (offer) return `No overlap with what you asked for, but they offer ${TOPIC_BY_ID.get(offer)!.offer.toLowerCase()}.`;
    return `In the room. ${firstName} hasn't said what they're after yet.`;
  }

  const two = isTwoWay(list);
  const mine = list.find((o) => o.direction === "mine-wants-theirs");
  const theirs = list.find((o) => o.direction === "theirs-wants-mine");

  // The best case, and the one worth its own sentence shape: a genuine
  // trade. Naming both directions is what turns a recommendation into a
  // reason to introduce yourself rather than a reason to keep scrolling.
  if (two && mine && theirs) {
    return `You're ${mine.topic.needGerund} and they ${mine.topic.offerVerb}. They're ${theirs.topic.needGerund} — you can help.`;
  }
  if (mine) return `You're ${mine.topic.needGerund}. They ${mine.topic.offerVerb}.`;
  if (theirs) return `${firstName} is ${theirs.topic.needGerund} — that's your ${theirs.topic.offer.toLowerCase()}.`;

  const mutual = list.find((o) => o.direction === "mutual");
  if (mutual) return `You're both ${mutual.topic.needGerund}.`;
  return `In the room.`;
}

/* ------------------------------------------------------ your own words */

/**
 * The fixed lists will never cover everybody, and shouldn't try.
 *
 * "A distribution partner in the Gulf" is not a checkbox. Adding it to
 * TOPICS would make the vocabulary longer for everyone to serve one person,
 * and the twelfth checkbox is where people stop reading — so each question
 * also takes a few entries in somebody's own words.
 *
 * What makes this safe for the matcher is that custom entries only ever
 * match *each other*, by exact wording. That is a real overlap, as
 * checkable as an enumerated one and more specific: two people who both
 * typed "climate finance" have told you something a dropdown couldn't. What
 * is deliberately NOT attempted is matching free text against the
 * vocabulary, or one person's phrase against another's — "fintech" against
 * "financial technology" needs a model to judge, and a reason the reader
 * can't verify is worse than no reason at all.
 *
 * The comparison key, therefore, is doing real work: it has to be loose
 * enough that two people typing the same thing match (case, spacing,
 * trailing punctuation, "&" for "and") and tight enough that it never
 * claims a match nobody would agree with.
 */
export function customKey(s: string): string {
  return s
    .toLowerCase()
    // Everything that isn't a letter or digit becomes a separator, and the
    // joining words go — so "R&D", "R and D", "climate & finance" and
    // "climate finance" all land on the same key. Dropping "and" can't
    // invent a match anybody would dispute; keeping it meant two spellings
    // of one claim failed to meet.
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && w !== "and")
    .join(" ");
}

/**
 * Clean a submitted list: trimmed, length-capped, de-duplicated by key,
 * empties dropped, count-capped. The first spelling of a key wins, because
 * it is the one the person typed first.
 */
export function cleanCustom(
  values: unknown,
  opts: { max: number; maxLength: number }
): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    // Collapse internal whitespace too: "climate   finance" and
    // "climate finance" are the same claim and should render identically.
    const label = v.trim().replace(/\s+/g, " ").slice(0, opts.maxLength);
    const key = customKey(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= opts.max) break;
  }
  return out;
}

export type CustomOverlap = {
  /** The reader's own spelling — what they typed, not what the other did. */
  label: string;
  direction: Overlap["direction"];
};

/**
 * Custom need against custom offer, both ways, plus the symmetric case.
 *
 * `kind: "intent"` crosses needs with offers the way TOPICS does.
 * `kind: "interest"` matches like-for-like, the way SECTORS does — being
 * into the same thing is the overlap, there is nothing to exchange.
 */
export function customOverlaps(
  a: { customLookingFor?: readonly string[] | null; customCanHelpWith?: readonly string[] | null },
  b: { customLookingFor?: readonly string[] | null; customCanHelpWith?: readonly string[] | null }
): CustomOverlap[] {
  const key = (xs: readonly string[] | null | undefined) =>
    new Map((xs ?? []).map((s) => [customKey(s), s]));
  const aNeeds = key(a.customLookingFor);
  const aOffers = key(a.customCanHelpWith);
  const bNeeds = key(b.customLookingFor);
  const bOffers = key(b.customCanHelpWith);

  const out: CustomOverlap[] = [];
  for (const [k, label] of aNeeds) {
    // Both needing the same thing is mutual — the "we're both looking for a
    // co-founder" case, which the vocabulary models with `symmetric`.
    if (bOffers.has(k)) out.push({ label, direction: "mine-wants-theirs" });
    else if (bNeeds.has(k)) out.push({ label, direction: "mutual" });
  }
  for (const [k, label] of aOffers) {
    if (bNeeds.has(k)) out.push({ label, direction: "theirs-wants-mine" });
  }
  const rank = (d: Overlap["direction"]) =>
    d === "mine-wants-theirs" ? 0 : d === "theirs-wants-mine" ? 1 : 2;
  return out.sort((x, y) => rank(x.direction) - rank(y.direction));
}

/** Shared free-text interests, in the reader's own spelling. */
export function sharedCustomInterests(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined
): string[] {
  const theirs = new Set((b ?? []).map(customKey));
  return (a ?? []).filter((s) => theirs.has(customKey(s)));
}

/**
 * The one sentence every card shows, from both vocabularies at once.
 *
 * Precedence, and the whole argument for this order: a genuine two-way
 * trade is the rarest and most compelling thing there is, so it leads even
 * when it comes from the fixed list. After that, *specificity* wins — a
 * phrase somebody typed by hand beats a checkbox they ticked, because
 * "you asked for warehouse automation and that's what they do" is a better
 * reason to cross a room than "you're after technical help".
 */
export function describeMatch(opts: {
  list: Overlap[];
  custom: CustomOverlap[];
  firstName: string;
  other?: { canHelpWith: readonly string[]; workingOn?: string | null };
  shared?: Sector[];
  sharedCustom?: string[];
}): string {
  const { list, custom, firstName, other } = opts;
  const shared = opts.shared ?? [];
  const sharedCustom = opts.sharedCustom ?? [];

  // A fixed-vocabulary trade: the richest sentence the product can write,
  // and it names both directions.
  if (isTwoWay(list)) return describeOverlap(list, firstName, other, shared);

  const mine = custom.find((c) => c.direction === "mine-wants-theirs");
  if (mine) return `You asked for “${mine.label}” — that's exactly what they offer.`;

  if (list.some((o) => o.direction === "mine-wants-theirs")) {
    return describeOverlap(list, firstName, other, shared);
  }

  const theirs = custom.find((c) => c.direction === "theirs-wants-mine");
  if (theirs) return `${firstName} asked for “${theirs.label}” — that's one of yours to give.`;

  if (list.length > 0) return describeOverlap(list, firstName, other, shared);

  const mutual = custom.find((c) => c.direction === "mutual");
  if (mutual) return `You're both after “${mutual.label}”.`;

  if (sharedCustom.length > 0) {
    return `You both put down ${joinWords(sharedCustom.map((s) => `“${s}”`))}.`;
  }

  // Nothing custom either — back to the fixed-vocabulary fallbacks, which
  // already handle shared sectors and the bare "in the room" case.
  return describeOverlap(list, firstName, other, shared);
}

/** "a, b and c" — an Oxford-comma-free list, because these are at most three. */
function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

