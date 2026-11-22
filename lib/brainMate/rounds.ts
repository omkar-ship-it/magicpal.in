import type { Trait } from "./archetypes";

/**
 * Brain-Mate v2 — the question bank.
 *
 * Built on the eight traits in archetypes.ts. Two kinds of question, mixed
 * on purpose:
 *
 *  - Scenarios (8): four options, each pointing at ONE trait, written to be
 *    equally attractive so the answer reflects habit rather than who you'd
 *    like to be. Behaviour ("you…"), never self-image ("you are…").
 *  - Statements (16): Nope / Not really / Kinda / Totally. Two per trait,
 *    one of each pair reverse-worded, so agreeing with everything inflates
 *    nothing. These give a *level* on each trait rather than a choice
 *    between traits, which is what makes comparing two people fair.
 *
 * Every trait is measured by 4–6 questions across both kinds. Values and
 * interests feed similarity only, never the archetype. The final duel is
 * adaptive and built per player — see score.ts.
 *
 * Changing a loading here changes what the scores mean: re-run
 * scripts/brain-mate-sim and refit the norms in score.ts before shipping.
 */

export type Loading = Partial<Record<Trait, number>>;

export type ScenarioOption = { id: string; label: string; load: Loading; word: string };
export type Scenario = { id: string; title: string; prompt: string; options: ScenarioOption[] };
export type Statement = { id: string; text: string; load: Loading };
export type PickOption = { id: string; label: string; emoji: string };

export const SCENARIOS: Scenario[] = [
  {
    id: "s1",
    title: "Free Sunday",
    prompt: "No plans. What pulls you in first?",
    options: [
      { id: "o", label: "Dreaming up something that doesn't exist yet", load: { O: 1 }, word: "daydreams" },
      { id: "i", label: "A rabbit hole on how something works", load: { I: 1 }, word: "rabbit holes" },
      { id: "d", label: "Finally finishing that half-done project", load: { D: 1 }, word: "finished it" },
      { id: "e", label: "Getting people together for something", load: { E: 1 }, word: "rounded people up" },
    ],
  },
  {
    id: "s2",
    title: "Stuck team",
    prompt: "Your team's project is stuck. You…",
    options: [
      { id: "o", label: "Reframe the problem completely", load: { O: 1 }, word: "reframed it" },
      { id: "i", label: "Dig into the data for the real cause", load: { I: 1 }, word: "found the cause" },
      { id: "a", label: "Take charge and reset the plan", load: { A: 1 }, word: "took charge" },
      { id: "c", label: "Check how everyone's actually doing", load: { C: 1 }, word: "checked in" },
    ],
  },
  {
    id: "s3",
    title: "The meeting",
    prompt: "Someone in a meeting says something you think is wrong. You…",
    options: [
      { id: "a", label: "Push back, right there", load: { A: 1, H: -1 }, word: "pushed back" },
      { id: "i", label: "Ask the question that exposes the gap", load: { I: 1 }, word: "the killer question" },
      { id: "c", label: "Find them after and talk it through", load: { C: 1 }, word: "talked after" },
      { id: "h", label: "Find the part that's right and build on it", load: { H: 1 }, word: "built on it" },
    ],
  },
  {
    id: "s4",
    title: "New project",
    prompt: "A new project lands on you. First move?",
    options: [
      { id: "o", label: "Sketch what it could become", load: { O: 1 }, word: "what it could be" },
      { id: "s", label: "Break it into steps with dates", load: { S: 1 }, word: "steps and dates" },
      { id: "d", label: "Get a rough version working today", load: { D: 1 }, word: "working today" },
      { id: "e", label: "Work out who else should be in on it", load: { E: 1 }, word: "who's in" },
    ],
  },
  {
    id: "s5",
    title: "Room of strangers",
    prompt: "A room where you know nobody. You…",
    options: [
      { id: "e", label: "Walk up to the liveliest group", load: { E: 1 }, word: "liveliest group" },
      { id: "c", label: "Find one person and go deep", load: { C: 1 }, word: "one deep talk" },
      { id: "q", label: "Watch for a while before choosing someone", load: { E: -1 }, word: "watched first" },
      { id: "d", label: "Find something useful to do, like helping set up", load: { D: 1 }, word: "helped set up" },
    ],
  },
  {
    id: "s6",
    title: "Big decision",
    prompt: "A friend asks for help with a big decision. You…",
    options: [
      { id: "o", label: "Help them see options they missed", load: { O: 1 }, word: "new options" },
      { id: "s", label: "Lay out the trade-offs together", load: { S: 1 }, word: "the trade-offs" },
      { id: "a", label: "Tell them straight what you'd do", load: { A: 1 }, word: "told it straight" },
      { id: "c", label: "Mostly listen until they figure it out", load: { C: 1 }, word: "listened" },
    ],
  },
  {
    id: "s7",
    title: "Group trip",
    prompt: "Group trip. Your unofficial role?",
    options: [
      { id: "s", label: "The planner with the spreadsheet", load: { S: 1 }, word: "the spreadsheet" },
      { id: "a", label: "The one who decides when everyone dithers", load: { A: 1 }, word: "the decider" },
      { id: "e", label: "The DJ and the mood", load: { E: 1 }, word: "the DJ" },
      { id: "h", label: "The one keeping everyone happy", load: { H: 1 }, word: "kept the peace" },
    ],
  },
  {
    id: "s8",
    title: "Where to eat",
    prompt: "The group can't agree where to eat. You…",
    options: [
      { id: "a", label: "Just pick, and everyone follows", load: { A: 1 }, word: "just picked" },
      { id: "h", label: "Find the place everyone can live with", load: { H: 1 }, word: "found the middle" },
      { id: "o", label: "Suggest somewhere nobody's tried", load: { O: 1 }, word: "somewhere new" },
      { id: "i", label: "Check reviews and pick the best-rated", load: { I: 1 }, word: "read the reviews" },
    ],
  },
];

export const STATEMENTS: Statement[] = [
  { id: "t1", text: "I have more ideas than time.", load: { O: 1 } },
  { id: "t2", text: "I need to know why something works.", load: { I: 1 } },
  { id: "t3", text: "I finish what I start, even the boring part.", load: { D: 1 } },
  { id: "t4", text: "My calendar is my second brain.", load: { S: 1 } },
  { id: "t5", text: "A room full of people charges me up.", load: { E: 1 } },
  { id: "t6", text: "In a group, I usually end up leading.", load: { A: 1 } },
  { id: "t7", text: "I can tell when someone's having a bad day.", load: { C: 1 } },
  { id: "t8", text: "I'd rather keep the peace than win the argument.", load: { H: 1 } },
  { id: "t9", text: "I'd rather perfect what works than try something new.", load: { O: -1 } },
  { id: "t10", text: "If it works, I don't need to know why.", load: { I: -1 } },
  { id: "t11", text: "I lose interest once the exciting part is over.", load: { D: -1 } },
  { id: "t12", text: "I'm happiest when the plan stays loose.", load: { S: -1 } },
  { id: "t13", text: "Small talk drains me.", load: { E: -1 } },
  { id: "t14", text: "I'd rather back a good leader than be one.", load: { A: -1 } },
  { id: "t15", text: "I'd rather fix the problem than talk about feelings.", load: { C: -1 } },
  { id: "t16", text: "If everyone agrees too fast, I start arguing.", load: { H: -1 } },
];

/**
 * The order statements are shown in: interleaved so the two items for one
 * trait never sit together, which would make the reversal obvious.
 */
export const STATEMENT_ORDER = ["t1", "t13", "t6", "t10", "t3", "t16", "t7", "t12", "t2", "t9", "t5", "t14", "t4", "t11", "t8", "t15"];

/** Nope / Not really / Kinda / Totally — the four taps. */
export const AGREE = ["Nope", "Not really", "Kinda", "Totally"] as const;
export const AGREE_VALUE = [-1.5, -0.5, 0.5, 1.5];

/** Schwartz's values, in plain words. Pick two. */
export const VALUES: PickOption[] = [
  { id: "freedom", emoji: "🪁", label: "Freedom" },
  { id: "adventure", emoji: "🧭", label: "Adventure" },
  { id: "achievement", emoji: "🏆", label: "Achievement" },
  { id: "influence", emoji: "📣", label: "Influence" },
  { id: "stability", emoji: "🏛️", label: "Stability" },
  { id: "helping", emoji: "🤲", label: "Helping others" },
  { id: "fairness", emoji: "⚖️", label: "Fairness" },
  { id: "fun", emoji: "🎉", label: "Fun" },
];

export const TILES: PickOption[] = [
  { id: "places", emoji: "🗺️", label: "New places" },
  { id: "tinkering", emoji: "🔧", label: "Tinkering" },
  { id: "art", emoji: "🎨", label: "Art, music, content" },
  { id: "puzzles", emoji: "🧩", label: "Puzzles" },
  { id: "startups", emoji: "🚀", label: "Startup talk" },
  { id: "sports", emoji: "🏸", label: "Sports & outdoors" },
  { id: "people", emoji: "🎉", label: "Meeting people" },
  { id: "teaching", emoji: "🧑‍🏫", label: "Teaching & volunteering" },
  { id: "books", emoji: "📚", label: "Books, films, ideas" },
];

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

export const VALUE_BY_ID = new Map(VALUES.map((v) => [v.id, v]));
export const TILE_BY_ID = new Map(TILES.map((t) => [t.id, t]));
