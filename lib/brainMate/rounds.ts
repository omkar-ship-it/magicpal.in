import type { Mode, Realm } from "./archetypes";

/**
 * The ten rounds of Brain-Mate.
 *
 * Every single-choice round measures exactly one side of the hidden grid —
 * a 4-option round picks a row (realm), a 3-option round picks a column
 * (mode) — so options stay few and every archetype has the same number of
 * ways in. No option uses archetype vocabulary, and each option in a round
 * should be as attractive as the others: if one sounds like the "right"
 * answer, everybody picks it and the distribution collapses.
 *
 * Effects are points: single rounds score 3, a swipe 1, a packed value or a
 * weekend tile 0.5. The final duel (round 10) is not listed here; it is
 * built per player from their two closest archetypes — see score.ts.
 */

export type Effect = Partial<Record<Realm | Mode, number>>;

export type Option = { id: string; label: string; effect: Effect };

export type SingleRound = {
  kind: "cards";
  id: "r1" | "r2" | "r3" | "r4" | "r6" | "r7";
  title: string;
  prompt: string;
  /** "row" rounds have 4 options, "column" rounds 3. */
  axis: "realm" | "mode";
  options: Option[];
  /** How the cards are drawn — the variety is what makes it a game. */
  look?: "headline";
};

export type SwipeCard = { id: string; left: Option; right: Option };

export type SwipeRound = {
  kind: "swipe";
  id: "r5";
  title: string;
  prompt: string;
  cards: SwipeCard[];
};

export type PickRound = {
  kind: "pick";
  id: "r8" | "r9";
  title: string;
  prompt: string;
  /** Exactly this many must be chosen. */
  count: number;
  look: "bag" | "tiles";
  options: (Option & { emoji: string })[];
};

export type Round = SingleRound | SwipeRound | PickRound;

const realm = (r: Realm, n = 3): Effect => ({ [r]: n });
const mode = (m: Mode, n = 3): Effect => ({ [m]: n });

export const ROUNDS: Round[] = [
  {
    kind: "cards",
    id: "r1",
    title: "Free Sunday",
    prompt: "No plans. What pulls you in first?",
    axis: "realm",
    options: [
      { id: "imagine", label: "Daydreaming up something that doesn't exist yet", effect: realm("imagine") },
      { id: "reason", label: "A puzzle, or a rabbit hole I can't climb out of", effect: realm("reason") },
      { id: "act", label: "Building or fixing something with my hands", effect: realm("act") },
      { id: "relate", label: "Calling someone. Or five people.", effect: realm("relate") },
    ],
  },
  {
    kind: "cards",
    id: "r2",
    title: "Midnight idea",
    prompt: "An idea hits you at midnight. By morning you've…",
    axis: "mode",
    options: [
      { id: "ignite", label: "Told three people and bought the domain", effect: mode("ignite") },
      { id: "seek", label: "Opened 23 tabs about it", effect: mode("seek") },
      { id: "steady", label: "Slept on it and made a plan", effect: mode("steady") },
    ],
  },
  {
    kind: "cards",
    id: "r3",
    title: "Stuck team",
    prompt: "The group project is stuck. You…",
    axis: "realm",
    options: [
      { id: "imagine", label: "Pitch a wild new direction", effect: realm("imagine") },
      { id: "reason", label: "Dig into what's actually broken", effect: realm("reason") },
      { id: "act", label: "Hack together a quick version", effect: realm("act") },
      { id: "relate", label: "Get everyone back on the same page", effect: realm("relate") },
    ],
  },
  {
    kind: "cards",
    id: "r4",
    title: "Room of strangers",
    prompt: "You walk into a room where you know nobody. You…",
    axis: "mode",
    options: [
      { id: "ignite", label: "Walk straight up to the liveliest group", effect: mode("ignite") },
      { id: "seek", label: "Drift around and sample a few conversations", effect: mode("seek") },
      { id: "steady", label: "Find one person and go deep", effect: mode("steady") },
    ],
  },
  {
    kind: "swipe",
    id: "r5",
    title: "Lightning round",
    prompt: "Gut only. Don't think.",
    cards: [
      {
        id: "s1",
        left: { id: "start", label: "Start it", effect: { ignite: 1 } },
        right: { id: "finish", label: "Finish it", effect: { steady: 1 } },
      },
      {
        id: "s2",
        left: { id: "whatif", label: "What if?", effect: { imagine: 1 } },
        right: { id: "why", label: "Why?", effect: { reason: 1 } },
      },
      {
        id: "s3",
        left: { id: "make", label: "Make it", effect: { act: 1 } },
        right: { id: "talk", label: "Talk it through", effect: { relate: 1 } },
      },
      {
        id: "s4",
        left: { id: "wander", label: "Wander off the map", effect: { seek: 1 } },
        right: { id: "follow", label: "Follow the map", effect: { steady: 1 } },
      },
      {
        id: "s5",
        left: { id: "think", label: "Think it through", effect: { reason: 1 } },
        right: { id: "try", label: "Try it now", effect: { act: 1 } },
      },
      {
        id: "s6",
        left: { id: "idea", label: "A brilliant idea", effect: { imagine: 1 } },
        right: { id: "person", label: "A brilliant person", effect: { relate: 1 } },
      },
    ],
  },
  {
    kind: "cards",
    id: "r6",
    title: "Your headline",
    prompt: "Which headline about you would you frame?",
    axis: "realm",
    look: "headline",
    options: [
      { id: "imagine", label: "Saw it before anyone else did", effect: realm("imagine") },
      { id: "reason", label: "Cracked what nobody could", effect: realm("reason") },
      { id: "act", label: "Built it in a weekend", effect: realm("act") },
      { id: "relate", label: "Everyone they helped, rose", effect: realm("relate") },
    ],
  },
  {
    kind: "cards",
    id: "r7",
    title: "The disagreement",
    prompt: "Someone strongly disagrees with you. You…",
    axis: "mode",
    options: [
      { id: "ignite", label: "Game on. I'll argue it out.", effect: mode("ignite") },
      { id: "seek", label: "Ask questions until I get their side", effect: mode("seek") },
      { id: "steady", label: "Find what we agree on, and move on", effect: mode("steady") },
    ],
  },
  {
    kind: "pick",
    id: "r8",
    title: "Pack your bag",
    prompt: "You can only take two. What matters most right now?",
    count: 2,
    look: "bag",
    options: [
      { id: "freedom", emoji: "🪁", label: "Freedom", effect: { ignite: 0.5, imagine: 0.5 } },
      { id: "mastery", emoji: "🎯", label: "Mastery", effect: { seek: 0.5, reason: 0.5 } },
      { id: "recognition", emoji: "🏆", label: "Recognition", effect: { ignite: 0.5, act: 0.5 } },
      { id: "difference", emoji: "🌱", label: "Making a difference", effect: { relate: 0.5, seek: 0.5 } },
      { id: "belonging", emoji: "🏡", label: "Belonging", effect: { relate: 0.5, steady: 0.5 } },
      { id: "adventure", emoji: "🧭", label: "Adventure", effect: { seek: 0.5, imagine: 0.5 } },
      { id: "lasting", emoji: "🏛️", label: "Building something that lasts", effect: { steady: 0.5, act: 0.5 } },
    ],
  },
  {
    kind: "pick",
    id: "r9",
    title: "Your weekend",
    prompt: "Pick three you'd happily lose a weekend to.",
    count: 3,
    look: "tiles",
    options: [
      { id: "places", emoji: "🗺️", label: "New places", effect: { imagine: 0.5 } },
      { id: "tinkering", emoji: "🔧", label: "Tinkering", effect: { act: 0.5 } },
      { id: "art", emoji: "🎨", label: "Art, music, content", effect: { imagine: 0.5 } },
      { id: "puzzles", emoji: "🧩", label: "Puzzles", effect: { reason: 0.5 } },
      { id: "startups", emoji: "🚀", label: "Startup talk", effect: { act: 0.5 } },
      { id: "sports", emoji: "🏸", label: "Sports & outdoors", effect: { act: 0.5 } },
      { id: "people", emoji: "🎉", label: "Meeting people", effect: { relate: 0.5 } },
      { id: "teaching", emoji: "🧑‍🏫", label: "Teaching & volunteering", effect: { relate: 0.5 } },
      { id: "books", emoji: "📚", label: "Books, films, ideas", effect: { reason: 0.5 } },
    ],
  },
];

export const SINGLE_ROUNDS = ROUNDS.filter((r): r is SingleRound => r.kind === "cards");
export const SWIPE_ROUND = ROUNDS.find((r): r is SwipeRound => r.kind === "swipe")!;
export const PICK_ROUNDS = ROUNDS.filter((r): r is PickRound => r.kind === "pick");

/** What a shared weekend tile suggests two people do together. */
export const TILE_ACTIVITY: Record<string, string> = {
  places: "Explore a neighbourhood neither of you knows.",
  tinkering: "Build something small together in an afternoon.",
  art: "Go to a gig or a gallery and argue about it after.",
  puzzles: "A quiz night. Same team, obviously.",
  startups: "Pick a problem and sketch a startup over chai.",
  sports: "Play something. Talk afterwards.",
  people: "Go to a meetup together and split the room.",
  teaching: "Run a session together for people starting out.",
  books: "Swap one book each and meet when you've both finished.",
};

/** One-word labels for the recap montage before the reveal. */
export const MONTAGE: Record<string, string> = {
  "r1:imagine": "daydreams",
  "r1:reason": "rabbit holes",
  "r1:act": "hands-on",
  "r1:relate": "five calls",
  "r2:ignite": "bought the domain",
  "r2:seek": "23 tabs",
  "r2:steady": "slept on it",
  "r3:imagine": "wild direction",
  "r3:reason": "what's broken?",
  "r3:act": "quick version",
  "r3:relate": "same page",
  "r4:ignite": "liveliest group",
  "r4:seek": "sampling",
  "r4:steady": "going deep",
  "r6:imagine": "saw it first",
  "r6:reason": "cracked it",
  "r6:act": "built it",
  "r6:relate": "they rose",
  "r7:ignite": "game on",
  "r7:seek": "asked why",
  "r7:steady": "common ground",
};
