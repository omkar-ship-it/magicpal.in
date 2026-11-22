import type { Trait } from "./archetypes";

/**
 * Brain-Mate v3 — "A Day in Your Mind". The question bank.
 *
 * Five ways of answering, so each trait is measured 7–10 times by at least
 * four different methods and one careless tap can't move a result much:
 *
 *   1. A day in your mind  — 7 story moments, 4 options, one trait each
 *   2. This or that        — 8 quick pairs, one trait each
 *   3. Prioritise          — 3 rounds, push 5 cards up and down
 *   4. Agree / don't       — 12 statements, 4 of them reverse-worded
 *   5. Where do you sit?   — 6 sliders
 *   + Pack your bag (values, similarity only)
 *   + Double-check (only when answers contradict) and the final duel.
 *
 * Every option in a moment or a round is written to be equally attractive,
 * so answers reflect habit rather than self-image. Changing a loading here
 * changes what the scores mean: re-run scripts/brain-mate-sim and refit the
 * norms in score.ts before shipping.
 */

export type Loading = Partial<Record<Trait, number>>;

export type StoryOption = { id: string; label: string; emoji: string; load: Loading; word: string };
export type StoryBeat = { id: string; time: string; sky: string; prompt: string; options: StoryOption[] };

export const STORY: StoryBeat[] = [
  {
    id: "b1",
    time: "7:00",
    sky: "dawn",
    prompt: "Your alarm goes off. First thought?",
    options: [
      { id: "o", emoji: "💡", label: "That idea from last night", load: { O: 1 }, word: "last night's idea" },
      { id: "s", emoji: "📋", label: "Today's list", load: { S: 1 }, word: "the list" },
      { id: "e", emoji: "👋", label: "Who I'm seeing today", load: { E: 1 }, word: "who I'm seeing" },
      { id: "i", emoji: "❓", label: "Something I need to figure out", load: { I: 1 }, word: "a puzzle" },
    ],
  },
  {
    id: "b2",
    time: "10:00",
    sky: "morning",
    prompt: "Your team's project is stuck.",
    options: [
      { id: "o", emoji: "🔄", label: "Reframe the whole problem", load: { O: 1 }, word: "reframed it" },
      { id: "i", emoji: "🔍", label: "Hunt down the real cause", load: { I: 1 }, word: "found the cause" },
      { id: "a", emoji: "🧭", label: "Take charge, reset the plan", load: { A: 1 }, word: "took charge" },
      { id: "c", emoji: "💬", label: "Check how everyone's doing", load: { C: 1 }, word: "checked in" },
    ],
  },
  {
    id: "b3",
    time: "1:00",
    sky: "noon",
    prompt: "Lunch with people you've never met.",
    options: [
      { id: "e", emoji: "😂", label: "Get the table laughing", load: { E: 1 }, word: "the laughs" },
      { id: "c", emoji: "🫶", label: "Ask one person something real", load: { C: 1 }, word: "something real" },
      { id: "q", emoji: "👀", label: "Listen and take it all in", load: { E: -1 }, word: "took it all in" },
      { id: "a", emoji: "📍", label: "Pick the place, lead the way", load: { A: 1 }, word: "led the way" },
    ],
  },
  {
    id: "b4",
    time: "3:30",
    sky: "afternoon",
    prompt: "Someone in a meeting says something you think is wrong.",
    options: [
      { id: "a", emoji: "🥊", label: "Push back, right there", load: { A: 1, H: -1 }, word: "pushed back" },
      { id: "i", emoji: "🎯", label: "Ask the question that exposes the gap", load: { I: 1 }, word: "the killer question" },
      { id: "c", emoji: "☕", label: "Talk it through with them after", load: { C: 1 }, word: "talked after" },
      { id: "h", emoji: "🧱", label: "Build on the part that's right", load: { H: 1 }, word: "built on it" },
    ],
  },
  {
    id: "b5",
    time: "6:00",
    sky: "dusk",
    prompt: "Surprise — a free evening.",
    options: [
      { id: "d", emoji: "✅", label: "Finish what you started", load: { D: 1 }, word: "finished it" },
      { id: "s", emoji: "🗓️", label: "Plan the rest of your week", load: { S: 1 }, word: "planned the week" },
      { id: "o", emoji: "🗺️", label: "Go somewhere you've never been", load: { O: 1 }, word: "somewhere new" },
      { id: "e", emoji: "📞", label: "Call people over", load: { E: 1 }, word: "called people over" },
    ],
  },
  {
    id: "b6",
    time: "8:30",
    sky: "evening",
    prompt: "Group dinner. Nobody can decide where.",
    options: [
      { id: "a", emoji: "👆", label: "Just pick", load: { A: 1 }, word: "just picked" },
      { id: "h", emoji: "🤝", label: "Find the place everyone's happy with", load: { H: 1 }, word: "found the middle" },
      { id: "o", emoji: "✨", label: "Suggest somewhere nobody's tried", load: { O: 1 }, word: "somewhere untried" },
      { id: "i", emoji: "⭐", label: "Check reviews, pick the best", load: { I: 1 }, word: "read the reviews" },
    ],
  },
  {
    id: "b7",
    time: "11:45",
    sky: "night",
    prompt: "Can't sleep.",
    options: [
      { id: "s", emoji: "🗂️", label: "Sort out tomorrow", load: { S: 1 }, word: "sorted tomorrow" },
      { id: "d", emoji: "🔨", label: "Finish one more thing", load: { D: 1 }, word: "one more thing" },
      { id: "c", emoji: "💛", label: "Message a friend who's had a rough week", load: { C: 1 }, word: "messaged a friend" },
      { id: "i", emoji: "📖", label: "Read until it makes sense", load: { I: 1 }, word: "read till it clicked" },
    ],
  },
];

/** This or that: `hi` is the pole that scores high on the trait. Sides are shuffled on screen. */
export type Pair = { id: string; trait: Trait; hi: { label: string; emoji: string }; lo: { label: string; emoji: string } };

export const PAIRS: Pair[] = [
  { id: "p1", trait: "O", hi: { emoji: "🍜", label: "Try the new dish" }, lo: { emoji: "🍛", label: "Order your favourite" } },
  { id: "p2", trait: "I", hi: { emoji: "⚙️", label: "How it works" }, lo: { emoji: "✅", label: "That it works" } },
  { id: "p3", trait: "D", hi: { emoji: "🏁", label: "Finish line" }, lo: { emoji: "🚦", label: "Starting line" } },
  { id: "p4", trait: "S", hi: { emoji: "🗓️", label: "Itinerary" }, lo: { emoji: "🎒", label: "Wing it" } },
  { id: "p5", trait: "E", hi: { emoji: "🎉", label: "House party" }, lo: { emoji: "☕", label: "Deep chat for two" } },
  { id: "p6", trait: "A", hi: { emoji: "🧭", label: "Captain" }, lo: { emoji: "🚣", label: "Crew" } },
  { id: "p7", trait: "C", hi: { emoji: "💛", label: "Feelings first" }, lo: { emoji: "📊", label: "Facts first" } },
  { id: "p8", trait: "H", hi: { emoji: "🕊️", label: "Keep the peace" }, lo: { emoji: "🥊", label: "Win the debate" } },
];

/** Prioritise: five cards, pushed into order. Position 1 scores highest. */
export type RankCard = { id: string; label: string; emoji: string; trait: Trait };
export type RankRound = { id: string; prompt: string; cards: RankCard[] };

export const RANKS: RankRound[] = [
  {
    id: "r1",
    prompt: "Your perfect Saturday",
    cards: [
      { id: "d", emoji: "🔨", label: "Making something", trait: "D" },
      { id: "o", emoji: "🗺️", label: "Somewhere new", trait: "O" },
      { id: "c", emoji: "☕", label: "A long talk with one friend", trait: "C" },
      { id: "e", emoji: "🎉", label: "A big group plan", trait: "E" },
      { id: "s", emoji: "🗂️", label: "Sorting out my space", trait: "S" },
    ],
  },
  {
    id: "r2",
    prompt: "At work, what do you bring first?",
    cards: [
      { id: "o", emoji: "💡", label: "Big ideas", trait: "O" },
      { id: "i", emoji: "🔍", label: "The hard questions", trait: "I" },
      { id: "a", emoji: "🧭", label: "A clear call", trait: "A" },
      { id: "h", emoji: "🤝", label: "Keeping the team together", trait: "H" },
      { id: "d", emoji: "🚀", label: "Getting it shipped", trait: "D" },
    ],
  },
  {
    id: "r3",
    prompt: "What makes a great day?",
    cards: [
      { id: "s", emoji: "🗓️", label: "Everything went to plan", trait: "S" },
      { id: "e", emoji: "🎤", label: "I got the room going", trait: "E" },
      { id: "a", emoji: "🏆", label: "I led something that worked", trait: "A" },
      { id: "c", emoji: "💛", label: "I helped someone", trait: "C" },
      { id: "h", emoji: "🕊️", label: "Nobody fell out", trait: "H" },
    ],
  },
];

/** Agree / don't. `sign` -1 means agreeing scores *low* on the trait. */
export type AgreeCard = { id: string; text: string; trait: Trait; sign: 1 | -1 };

export const AGREES: AgreeCard[] = [
  { id: "g1", text: "I get bored doing things the same way twice.", trait: "O", sign: 1 },
  { id: "g2", text: "I'll fall down a Wikipedia rabbit hole at 2am.", trait: "I", sign: 1 },
  { id: "g3", text: "Unfinished tasks bug me until they're done.", trait: "D", sign: 1 },
  { id: "g4", text: "I have a system for almost everything.", trait: "S", sign: 1 },
  { id: "g5", text: "I'll happily talk to strangers in a queue.", trait: "E", sign: 1 },
  { id: "g6", text: "I'm comfortable making the call for the group.", trait: "A", sign: 1 },
  { id: "g7", text: "Friends come to me when something's wrong.", trait: "C", sign: 1 },
  { id: "g8", text: "I'll bend so everyone gets along.", trait: "H", sign: 1 },
  { id: "g9", text: "I lose interest once the exciting part's done.", trait: "D", sign: -1 },
  { id: "g10", text: "Too much planning kills the fun.", trait: "S", sign: -1 },
  { id: "g11", text: "After a party, I need a full day alone.", trait: "E", sign: -1 },
  { id: "g12", text: "I enjoy a good argument, even about small things.", trait: "H", sign: -1 },
];

/** Shown interleaved so the two cards for one trait never sit together. */
export const AGREE_ORDER = ["g1", "g11", "g6", "g3", "g12", "g7", "g10", "g2", "g5", "g9", "g8", "g4"];

/** Where do you sit? -1 is the left end, +1 the right; the right end scores high. */
export type Slider = { id: string; trait: Trait; prompt: string; left: string; right: string };

export const SLIDERS: Slider[] = [
  { id: "l1", trait: "D", prompt: "Projects", left: "I start lots", right: "I finish what I start" },
  { id: "l2", trait: "S", prompt: "Plans", left: "Loose", right: "Detailed" },
  { id: "l3", trait: "H", prompt: "When there's tension", left: "I say it straight", right: "I smooth it over" },
  { id: "l4", trait: "A", prompt: "In a group", left: "I follow a good lead", right: "I end up leading" },
  { id: "l5", trait: "E", prompt: "After a big party", left: "I need a quiet day", right: "I want another one" },
  { id: "l6", trait: "C", prompt: "When a friend vents", left: "I offer solutions", right: "I offer comfort" },
];

/**
 * Double-check cards: two per trait, one each way, worded differently from
 * everything before. Only asked for traits where a player's choice-style
 * answers and strength-style answers disagree sharply (see score.ts).
 */
export const CHECKS: AgreeCard[] = [
  { id: "cO1", text: "I'd take a new route over the fastest one.", trait: "O", sign: 1 },
  { id: "cO2", text: "If it isn't broken, I don't fix it.", trait: "O", sign: -1 },
  { id: "cI1", text: "I ask “why” more than most people.", trait: "I", sign: 1 },
  { id: "cI2", text: "I don't need the theory if it works.", trait: "I", sign: -1 },
  { id: "cD1", text: "I finish books, even the slow ones.", trait: "D", sign: 1 },
  { id: "cD2", text: "I have more half-done projects than finished ones.", trait: "D", sign: -1 },
  { id: "cS1", text: "I pack the night before.", trait: "S", sign: 1 },
  { id: "cS2", text: "My plans usually change on the day.", trait: "S", sign: -1 },
  { id: "cE1", text: "Crowds give me energy.", trait: "E", sign: 1 },
  { id: "cE2", text: "I'd rather one deep chat than ten quick ones.", trait: "E", sign: -1 },
  { id: "cA1", text: "I'd rather decide than wait for someone else.", trait: "A", sign: 1 },
  { id: "cA2", text: "I'm happy letting others lead.", trait: "A", sign: -1 },
  { id: "cC1", text: "I notice when someone goes quiet.", trait: "C", sign: 1 },
  { id: "cC2", text: "I'd rather fix the problem than talk about feelings.", trait: "C", sign: -1 },
  { id: "cH1", text: "I let small things go to keep the peace.", trait: "H", sign: 1 },
  { id: "cH2", text: "I say what I think, even if it stings.", trait: "H", sign: -1 },
];

/** Schwartz's values, in plain words. Pick two. */
export type PickOption = { id: string; label: string; emoji: string };
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
export const VALUE_BY_ID = new Map(VALUES.map((v) => [v.id, v]));

/** What two people's shared Saturday favourite suggests they do together. */
export const SATURDAY_ACTIVITY: Record<string, string> = {
  d: "Build something small together in an afternoon.",
  o: "Explore a neighbourhood neither of you knows.",
  c: "A long walk and a longer chai. Phones away.",
  e: "Throw a small get-together and co-host it.",
  s: "Plan a weekend trip — one of you books, one of you improvises.",
};

/** The friend's view: eight quick sliders about the other person. */
export const VIEW_SLIDERS: { trait: Trait; left: string; right: string }[] = [
  { trait: "O", left: "Sticks with what works", right: "Always trying new things" },
  { trait: "I", left: "Just gets on with it", right: "Always asks why" },
  { trait: "D", left: "Starts lots of things", right: "Finishes what they start" },
  { trait: "S", left: "Spontaneous", right: "Organised" },
  { trait: "E", left: "Quiet in a crowd", right: "Lights up a room" },
  { trait: "A", left: "Backs the lead", right: "Takes the lead" },
  { trait: "C", left: "Problem-solver", right: "Big-hearted" },
  { trait: "H", left: "Says it straight", right: "Keeps the peace" },
];
