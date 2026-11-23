import type { Trait } from "./archetypes";

/**
 * Brain-Mate v4 — the question bank.
 *
 * Built so the answer reflects the person, not their circumstances. A new
 * parent, a carer, a student in exam season and a founder in launch week
 * should all be able to answer as "the real you, when life gives you a
 * choice":
 *
 *  - Tendencies, never recent behaviour ("how often is this you?", not
 *    "last month did you…") — a busy season isn't a personality.
 *  - Preferences over logistics — what you'd choose, which circumstances
 *    constrain far less than what you did.
 *  - Settings everyone has: conversations, decisions, disagreements,
 *    someone close to you, any group. No parties, travel, free Saturdays
 *    or office life assumed; "any team — work, family or friends".
 *
 * Five ways of answering, each trait measured 6–8 times across them:
 *
 *   1. Would you rather   8 pairs — the two ends of ONE trait, both appealing
 *   2. Is this you?       8 tendencies — Rarely / Sometimes / Often / Almost always
 *   3. Tough calls        8 dilemmas — two traits pulled against each other
 *   4. Prioritise         3 rounds — push 5 cards up and down
 *   5. Where do you sit?  6 sliders
 *   + Pack your bag (values, similarity only), double-checks when answers
 *     contradict, and the adaptive final duel.
 *
 * Changing a loading changes what the scores mean: re-run
 * scripts/brain-mate-sim (final4 / export4) and refit score.ts.
 */

export type Loading = Partial<Record<Trait, number>>;
export type Side = { label: string; emoji: string };

/** Would you rather: `hi` is the end that scores high on the trait. Order on screen is shuffled. */
export type Rather = { id: string; trait: Trait; hi: Side; lo: Side };

export const RATHER: Rather[] = [
  { id: "w1", trait: "O", hi: { emoji: "🌶️", label: "Try the thing you've never had" }, lo: { emoji: "🍛", label: "Order your favourite" } },
  { id: "w2", trait: "I", hi: { emoji: "⚙️", label: "Know exactly how your phone works" }, lo: { emoji: "✨", label: "Never have to think about it" } },
  { id: "w3", trait: "D", hi: { emoji: "🏁", label: "Finish one thing properly" }, lo: { emoji: "🚀", label: "Start three things you're excited about" } },
  { id: "w4", trait: "S", hi: { emoji: "🗓️", label: "A day planned to the hour" }, lo: { emoji: "🌤️", label: "A day with nothing planned" } },
  { id: "w5", trait: "E", hi: { emoji: "🎉", label: "Be at the centre of a big gathering" }, lo: { emoji: "☕", label: "A long conversation with one person" } },
  { id: "w6", trait: "A", hi: { emoji: "🧭", label: "Be the captain who makes the call" }, lo: { emoji: "🗺️", label: "Be the navigator who makes the captain look good" } },
  { id: "w7", trait: "C", hi: { emoji: "💛", label: "Be known as the kindest person in the room" }, lo: { emoji: "🔭", label: "Be known as the sharpest" } },
  { id: "w8", trait: "H", hi: { emoji: "🕊️", label: "Be in a group that never argues" }, lo: { emoji: "🥊", label: "Be in a group that argues well" } },
];

/** Is this you? Tendencies in settings everyone has. Agreeing scores high. */
export type Tendency = { id: string; trait: Trait; text: string };

export const TENDENCIES: Tendency[] = [
  { id: "t1", trait: "O", text: "I suggest doing things a new way." },
  { id: "t2", trait: "I", text: "I keep digging until I understand why." },
  { id: "t3", trait: "D", text: "I finish what I start, even when it gets dull." },
  { id: "t4", trait: "S", text: "I like to know the plan before the day starts." },
  { id: "t5", trait: "E", text: "I start conversations with people I don't know — in a queue, a waiting room, at the school gate or an event." },
  { id: "t6", trait: "A", text: "When a group can't decide, I end up making the call." },
  { id: "t7", trait: "C", text: "I notice when someone close to me is off, before they say anything." },
  { id: "t8", trait: "H", text: "I let things go to keep the peace." },
];
export const TENDENCY_SCALE = ["Rarely", "Sometimes", "Often", "Almost always"] as const;
export const TENDENCY_VALUE = [-1.5, -0.5, 0.5, 1.5];

/** Tough calls: two choices, each scoring for a different trait, pulled against each other. */
export type Call = { id: string; prompt: string; a: Side & { trait: Trait }; b: Side & { trait: Trait } };

export const CALLS: Call[] = [
  {
    id: "c1",
    prompt: "A friend shows you an idea they love. It has a big flaw.",
    a: { trait: "A", emoji: "🎯", label: "Tell them straight, today" },
    b: { trait: "C", emoji: "🫶", label: "Ask questions until they see it themselves" },
  },
  {
    id: "c2",
    prompt: "Your group — at work, at home or with friends — picks a plan you think is wrong.",
    a: { trait: "H", emoji: "🤝", label: "Back it fully and make it work" },
    b: { trait: "A", emoji: "✋", label: "Push to change it before it's too late" },
  },
  {
    id: "c3",
    prompt: "Halfway through something, a better idea hits you.",
    a: { trait: "O", emoji: "💡", label: "Switch to the better idea" },
    b: { trait: "D", emoji: "🏁", label: "Finish this one first" },
  },
  {
    id: "c4",
    prompt: "You've got the next hour planned. Someone suggests something fun, right now.",
    a: { trait: "S", emoji: "🗓️", label: "Stick to the plan" },
    b: { trait: "E", emoji: "🎈", label: "Join in" },
  },
  {
    id: "c5",
    prompt: "Someone you care about is upset about a mistake that was clearly theirs.",
    a: { trait: "I", emoji: "🔍", label: "Work out together what went wrong" },
    b: { trait: "C", emoji: "💛", label: "Comfort them first, fix it later" },
  },
  {
    id: "c6",
    prompt: "Something's due soon and the person you're working with is struggling.",
    a: { trait: "D", emoji: "⚡", label: "Take over their part and get it done" },
    b: { trait: "H", emoji: "🌱", label: "Slow down and help them through it" },
  },
  {
    id: "c7",
    prompt: "If you had time for one big thing, you'd rather…",
    a: { trait: "D", emoji: "🛠️", label: "Build something that didn't exist before" },
    b: { trait: "I", emoji: "🔍", label: "Learn everything about something that fascinates you" },
  },
  {
    id: "c8",
    prompt: "Something new is starting. What pulls you in first?",
    a: { trait: "O", emoji: "🔭", label: "Picturing where it could be in five years" },
    b: { trait: "I", emoji: "⚙️", label: "Working out how it actually works" },
  },
];

/** Prioritise: five cards, pushed into order. Position 1 scores highest. */
export type RankCard = { id: string; label: string; emoji: string; trait: Trait };
export type RankRound = { id: string; prompt: string; cards: RankCard[] };

export const RANKS: RankRound[] = [
  {
    id: "r1",
    prompt: "A free day, all yours",
    cards: [
      { id: "d", emoji: "🔨", label: "Making or fixing something", trait: "D" },
      { id: "o", emoji: "🗺️", label: "Somewhere or something new", trait: "O" },
      { id: "c", emoji: "☕", label: "A long talk with someone close", trait: "C" },
      { id: "e", emoji: "🎉", label: "Getting a bunch of people together", trait: "E" },
      { id: "s", emoji: "🗂️", label: "Sorting out my space and my week", trait: "S" },
    ],
  },
  {
    id: "r2",
    prompt: "In any team — work, family or friends — what do you bring first?",
    cards: [
      { id: "o", emoji: "💡", label: "Fresh ideas", trait: "O" },
      { id: "i", emoji: "🔍", label: "The hard questions", trait: "I" },
      { id: "a", emoji: "🧭", label: "A clear call", trait: "A" },
      { id: "h", emoji: "🤝", label: "Keeping everyone together", trait: "H" },
      { id: "d", emoji: "🚀", label: "Getting it done", trait: "D" },
    ],
  },
  {
    id: "r3",
    prompt: "What makes a really good day?",
    cards: [
      { id: "s", emoji: "🗓️", label: "Everything went to plan", trait: "S" },
      { id: "e", emoji: "🎤", label: "Great time with lots of people", trait: "E" },
      { id: "a", emoji: "🏆", label: "I led something that worked", trait: "A" },
      { id: "c", emoji: "💛", label: "I helped someone", trait: "C" },
      { id: "h", emoji: "🕊️", label: "Nobody fell out", trait: "H" },
    ],
  },
];

/** Where do you sit? -1 is the left end, +1 the right; the right end scores high. */
export type Slider = { id: string; trait: Trait; prompt: string; left: string; right: string };

export const SLIDERS: Slider[] = [
  { id: "l1", trait: "D", prompt: "Things you start", left: "I start lots", right: "I finish what I start" },
  { id: "l2", trait: "S", prompt: "Plans", left: "Loose", right: "Detailed" },
  { id: "l3", trait: "H", prompt: "When there's tension", left: "I say it straight", right: "I smooth it over" },
  { id: "l4", trait: "A", prompt: "In a group", left: "I follow a good lead", right: "I end up leading" },
  { id: "l5", trait: "E", prompt: "After a busy, people-heavy day", left: "I need quiet", right: "I want more" },
  { id: "l6", trait: "C", prompt: "When someone vents to you", left: "I offer solutions", right: "I offer comfort" },
];

/** Double-check cards: two per trait, one each way. Agree / not me. */
export type CheckCard = { id: string; text: string; trait: Trait; sign: 1 | -1 };

export const CHECKS: CheckCard[] = [
  { id: "cO1", text: "I get restless doing things the same way.", trait: "O", sign: 1 },
  { id: "cO2", text: "If it isn't broken, I don't fix it.", trait: "O", sign: -1 },
  { id: "cI1", text: "I ask “why” more than most people.", trait: "I", sign: 1 },
  { id: "cI2", text: "I don't need the theory if it works.", trait: "I", sign: -1 },
  { id: "cD1", text: "Unfinished things nag at me until they're done.", trait: "D", sign: 1 },
  { id: "cD2", text: "I have more half-done things than finished ones.", trait: "D", sign: -1 },
  { id: "cS1", text: "I feel better when the plan is clear.", trait: "S", sign: 1 },
  { id: "cS2", text: "Too much planning takes the fun out of things.", trait: "S", sign: -1 },
  { id: "cE1", text: "Being around people gives me energy.", trait: "E", sign: 1 },
  { id: "cE2", text: "I'd rather one deep chat than ten quick ones.", trait: "E", sign: -1 },
  { id: "cA1", text: "I'd rather decide than wait for someone else to.", trait: "A", sign: 1 },
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

/**
 * Optional, after the reveal, never scored: what's taking most of your
 * energy these days. Not relationship status — a gentle signal that lets
 * the pilot check whether any life stage is being nudged toward particular
 * archetypes (and, later, family-friendly suggestions).
 */
export const ENERGY: PickOption[] = [
  { id: "work", emoji: "💼", label: "Work" },
  { id: "studies", emoji: "📚", label: "Studies" },
  { id: "family", emoji: "🏡", label: "Family & home" },
  { id: "building", emoji: "🛠️", label: "Building something" },
  { id: "next", emoji: "🧭", label: "Finding my next thing" },
  { id: "mix", emoji: "🌈", label: "A bit of everything" },
];

/** What two people's shared favourite free-day choice suggests they do together. */
export const FREE_DAY_ACTIVITY: Record<string, string> = {
  d: "Make or fix something together — an afternoon project.",
  o: "Try something neither of you has done — a new place, a new dish.",
  c: "A long walk and a longer chai. Phones away.",
  e: "Get a small group together and co-host it.",
  s: "Plan something together — one of you books, one of you improvises.",
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
