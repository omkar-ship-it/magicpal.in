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
export function describeOverlap(list: Overlap[], firstName: string): string {
  if (list.length === 0) return `Also here. No stated overlap yet.`;

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
  return `Also here.`;
}
