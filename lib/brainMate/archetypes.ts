/**
 * Brain-Mate: the twelve archetypes, and everything a card says about them.
 *
 * Client-safe on purpose (no database import anywhere in lib/brainMate
 * except server.ts) — the game, the reveal and the image routes all read
 * this one table, so changing a line of copy changes it everywhere.
 *
 * Behind the twelve sits a 4 × 3 grid the player never sees:
 *
 *            Ignite      Seek        Steady
 *   Imagine  Dreamer     Explorer    Creator
 *   Reason   Maverick    Detective   Strategist
 *   Act      Spark       Maker       Doer
 *   Relate   Connector   Mentor      Peacemaker
 *
 * The row is *where your energy goes*; the column is *how you move*. Every
 * question measures one of the two, which is what keeps each question short
 * and gives every archetype the same number of ways in. Row sets the colour
 * family and column sets the shade, so related archetypes look related.
 */

export type Realm = "imagine" | "reason" | "act" | "relate";
export type Mode = "ignite" | "seek" | "steady";

export const REALMS: Realm[] = ["imagine", "reason", "act", "relate"];
export const MODES: Mode[] = ["ignite", "seek", "steady"];

export type ArchetypeId =
  | "dreamer"
  | "explorer"
  | "creator"
  | "maverick"
  | "detective"
  | "strategist"
  | "spark"
  | "maker"
  | "doer"
  | "connector"
  | "mentor"
  | "peacemaker";

export type Archetype = {
  id: ArchetypeId;
  name: string;
  tagline: string;
  realm: Realm;
  mode: Mode;
  /** The flood colour of every card, and the ink that sits on it. */
  color: string;
  ink: string;
  /** A lighter tint of `color` for surfaces on the cream app. */
  tint: string;
  traits: [string, string, string];
  superpower: string;
  /** The laugh — what gets screenshotted. Friend cards only. */
  roast: string;
  /** The same blind spot, safe for a colleague or LinkedIn. */
  blindSpot: string;
  bestWhen: string;
  give: string;
  dont: string;
  /** "Omkar imagines it. Sunil delivers it." */
  does: string;
  /** The role this person plays on a team, for "In a team: …". */
  role: string;
  /** A question someone could open with. */
  askMe: string;
  powerDuo: [ArchetypeId, ArchetypeId];
  friction: ArchetypeId;
  /** The two duel lines — see lib/brainMate/rounds DUEL_*. */
  modeLine: string;
  realmLine: string;
};

const A = (a: Archetype) => a;

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  dreamer: A({
    id: "dreamer",
    name: "The Dreamer",
    tagline: "Sees what could be.",
    realm: "imagine",
    mode: "ignite",
    color: "#7B4DFF",
    ink: "#ffffff",
    tint: "#EEE8FF",
    traits: ["Imaginative", "Ambitious", "Future-minded"],
    superpower: "Sees the door before anyone sees the wall.",
    roast: "14 ideas. 2 finished.",
    blindSpot: "Can chase the next idea before landing the last.",
    bestWhen: "handed a blank page and a big question",
    give: "Give me a blank page.",
    dont: "Don't ask for the plan in the first meeting.",
    does: "imagines it",
    role: "the direction",
    askMe: "What would you build if it couldn't fail?",
    powerDuo: ["doer", "strategist"],
    friction: "detective",
    modeLine: "Pitch the big vision tomorrow. Details later.",
    realmLine: "sketched a future nobody else could see",
  }),
  explorer: A({
    id: "explorer",
    name: "The Explorer",
    tagline: "Follows curiosity.",
    realm: "imagine",
    mode: "seek",
    color: "#5B5BD6",
    ink: "#ffffff",
    tint: "#E8E8FB",
    traits: ["Curious", "Adventurous", "Open-minded"],
    superpower: "Finds the answer in the field next door.",
    roast: "47 tabs open. Three are other trips.",
    blindSpot: "Breadth can come at the cost of depth.",
    bestWhen: "let loose on something nobody has mapped yet",
    give: "Let me go and look first.",
    dont: "Don't lock the scope on day one.",
    does: "finds where to go",
    role: "the scout",
    askMe: "What's the most interesting thing you've learned this month?",
    powerDuo: ["maker", "spark"],
    friction: "doer",
    modeLine: "Wander for a month before deciding what it is.",
    realmLine: "somewhere new, with no map",
  }),
  creator: A({
    id: "creator",
    name: "The Creator",
    tagline: "Makes something original.",
    realm: "imagine",
    mode: "steady",
    color: "#7A2E8E",
    ink: "#ffffff",
    tint: "#F3E6F6",
    traits: ["Creative", "Expressive", "Inventive"],
    superpower: "Makes people feel something about a product.",
    roast: "“Just one more tweak” — 9 drafts ago.",
    blindSpot: "Can polish past the point that matters.",
    bestWhen: "given the why and left alone to make it",
    give: "Give me the why, not the brief.",
    dont: "Don't say “make it pop.”",
    does: "makes it beautiful",
    role: "the craft",
    askMe: "What's something you made that still feels like you?",
    powerDuo: ["strategist", "doer"],
    friction: "detective",
    modeLine: "Disappear until the thing is beautiful.",
    realmLine: "something you made that still feels like you",
  }),
  maverick: A({
    id: "maverick",
    name: "The Maverick",
    tagline: "Questions the obvious.",
    realm: "reason",
    mode: "ignite",
    color: "#1E6BFF",
    ink: "#ffffff",
    tint: "#E3EDFF",
    traits: ["Independent", "Bold", "Unconventional"],
    superpower: "Spots what everyone agreed on too quickly.",
    roast: "Liked it before it was cool. Now doesn't.",
    blindSpot: "Can argue with a good idea for sport.",
    bestWhen: "the room is too sure of itself",
    give: "Let me push back.",
    dont: "Don't take it personally.",
    does: "questions it",
    role: "the stress test",
    askMe: "What does everyone in your field believe that's wrong?",
    powerDuo: ["maker", "connector"],
    friction: "strategist",
    modeLine: "Stand up and say the plan is wrong.",
    realmLine: "changed someone's mind",
  }),
  detective: A({
    id: "detective",
    name: "The Detective",
    tagline: "Always asks why.",
    realm: "reason",
    mode: "seek",
    color: "#0E7C93",
    ink: "#ffffff",
    tint: "#DFF2F5",
    traits: ["Analytical", "Observant", "Inquisitive"],
    superpower: "Finds the one thing that's actually wrong.",
    roast: "Has read the terms and conditions. All of them.",
    blindSpot: "Can wait for certainty that never arrives.",
    bestWhen: "there's a real mystery and room to dig",
    give: "Bring me evidence.",
    dont: "Don't say “trust me.”",
    does: "finds what's really wrong",
    role: "the truth",
    askMe: "What's a problem you couldn't stop thinking about?",
    powerDuo: ["maker", "doer"],
    friction: "spark",
    modeLine: "Quietly dig until you know why it's wrong.",
    realmLine: "a mystery you're finally cracking",
  }),
  strategist: A({
    id: "strategist",
    name: "The Strategist",
    tagline: "Thinks a few moves ahead.",
    realm: "reason",
    mode: "steady",
    color: "#1F3A8A",
    ink: "#ffffff",
    tint: "#E2E7F5",
    traits: ["Calculated", "Thoughtful", "Systematic"],
    superpower: "Turns chaos into a plan with owners and dates.",
    roast: "Has a contingency plan for the contingency plan.",
    blindSpot: "Plans can outrun reality.",
    bestWhen: "shown the goal and trusted with the path",
    give: "Show me the goal, then let me map the path.",
    dont: "Don't change direction without saying why.",
    does: "plans the path",
    role: "the plan",
    askMe: "What are you planning three moves from now?",
    powerDuo: ["dreamer", "creator"],
    friction: "maker",
    modeLine: "Redraw the plan so it can't go wrong.",
    realmLine: "a plan that worked exactly as drawn",
  }),
  spark: A({
    id: "spark",
    name: "The Spark",
    tagline: "Gets things moving.",
    realm: "act",
    mode: "ignite",
    color: "#F5B700",
    ink: "#2A1E00",
    tint: "#FFF4CC",
    traits: ["Energetic", "Spontaneous", "Enthusiastic"],
    superpower: "Turns “someday” into “this Saturday.”",
    roast: "Owns 14 domains. Renewed none.",
    blindSpot: "Starts faster than they finish.",
    bestWhen: "there's momentum to create and people to rally",
    give: "Give me momentum.",
    dont: "Don't put me in the 40-slide review.",
    does: "gets it moving",
    role: "the momentum",
    askMe: "What would you start this weekend if someone joined you?",
    powerDuo: ["doer", "maker"],
    friction: "detective",
    modeLine: "Get ten people moving by tonight.",
    realmLine: "got a Saturday plan — and everyone's in",
  }),
  maker: A({
    id: "maker",
    name: "The Maker",
    tagline: "Turns ideas into reality.",
    realm: "act",
    mode: "seek",
    color: "#E07A00",
    ink: "#ffffff",
    tint: "#FDEBD6",
    traits: ["Practical", "Experimental", "Hands-on"],
    superpower: "Has a working version before the meeting ends.",
    roast: "Built it before asking if anyone wanted it.",
    blindSpot: "Can build before the problem is clear.",
    bestWhen: "there's a real problem and permission to try",
    give: "Show me the problem, not the slides.",
    dont: "Don't make me wait for permission to try.",
    does: "builds it",
    role: "the prototype",
    askMe: "What are you building right now?",
    powerDuo: ["dreamer", "detective"],
    friction: "strategist",
    modeLine: "Have a rough version working by tonight.",
    realmLine: "something half-built on the table",
  }),
  doer: A({
    id: "doer",
    name: "The Doer",
    tagline: "Makes sure it gets done.",
    realm: "act",
    mode: "steady",
    color: "#8A4B14",
    ink: "#ffffff",
    tint: "#F3E5D8",
    traits: ["Focused", "Dependable", "Execution-minded"],
    superpower: "The reason things actually ship.",
    roast: "Ticked “relax” off a to-do list.",
    blindSpot: "Can finish the wrong thing well.",
    bestWhen: "given a clear goal and a real deadline",
    give: "Give me a clear goal and a deadline.",
    dont: "Don't change it on Friday.",
    does: "delivers it",
    role: "the finish line",
    askMe: "What's the last thing you shipped that you're proud of?",
    powerDuo: ["dreamer", "spark"],
    friction: "explorer",
    modeLine: "Finish what everyone else started.",
    realmLine: "the thing that shipped because you didn't let it slip",
  }),
  connector: A({
    id: "connector",
    name: "The Connector",
    tagline: "Brings the right people together.",
    realm: "relate",
    mode: "ignite",
    color: "#2FA84F",
    ink: "#ffffff",
    tint: "#E1F4E6",
    traits: ["Sociable", "Collaborative", "Relationship-minded"],
    superpower: "“You two should meet.” And they always should.",
    roast: "In 400 WhatsApp groups. Muted 390.",
    blindSpot: "Can spread their time across too many people.",
    bestWhen: "there's a room to bring together",
    give: "Tell me who you're looking for.",
    dont: "Don't sit me alone at a desk all day.",
    does: "brings in the right people",
    role: "the network",
    askMe: "Who's the most interesting person you met this year?",
    powerDuo: ["mentor", "maker"],
    friction: "detective",
    modeLine: "Introduce two people who'll change each other's year.",
    realmLine: "introduced half the room to the other half",
  }),
  mentor: A({
    id: "mentor",
    name: "The Mentor",
    tagline: "Helps others find their way.",
    realm: "relate",
    mode: "seek",
    color: "#4E8F6B",
    ink: "#ffffff",
    tint: "#E3F0E8",
    traits: ["Supportive", "Reflective", "Growth-minded"],
    superpower: "Asks the one question that unlocks you.",
    roast: "Gives great advice. Takes none of it.",
    blindSpot: "Can put others' growth ahead of their own.",
    bestWhen: "someone brings a real question",
    give: "Bring me a real question.",
    dont: "Don't ask for feedback you don't want.",
    does: "helps everyone grow",
    role: "the guide",
    askMe: "What's the best advice you've ever ignored?",
    powerDuo: ["connector", "spark"],
    friction: "maverick",
    modeLine: "Spend an hour helping one person see their next step.",
    realmLine: "a long talk where someone figures themselves out",
  }),
  peacemaker: A({
    id: "peacemaker",
    name: "The Peacemaker",
    tagline: "Finds common ground.",
    realm: "relate",
    mode: "steady",
    color: "#1D5C45",
    ink: "#ffffff",
    tint: "#DDEBE5",
    traits: ["Empathetic", "Diplomatic", "Cooperative"],
    superpower: "Gets two sides to yes without either feeling they lost.",
    roast: "“Either works for me” — about their own birthday.",
    blindSpot: "Can avoid the conflict a team needs.",
    bestWhen: "asked directly what they think",
    give: "Ask what I think, directly.",
    dont: "Don't take quiet for agreement.",
    does: "keeps everyone together",
    role: "the glue",
    askMe: "What's a disagreement you're glad you had?",
    powerDuo: ["doer", "strategist"],
    friction: "maverick",
    modeLine: "Get a divided room to agree.",
    realmLine: "a team that's still together because of you",
  }),
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

export const isArchetypeId = (v: unknown): v is ArchetypeId =>
  typeof v === "string" && v in ARCHETYPES;

/** The grid, row by row — lookups both ways. */
export const GRID: Record<Realm, Record<Mode, ArchetypeId>> = {
  imagine: { ignite: "dreamer", seek: "explorer", steady: "creator" },
  reason: { ignite: "maverick", seek: "detective", steady: "strategist" },
  act: { ignite: "spark", seek: "maker", steady: "doer" },
  relate: { ignite: "connector", seek: "mentor", steady: "peacemaker" },
};

export const REALM_LABEL: Record<Realm, string> = {
  imagine: "Imagine",
  reason: "Reason",
  act: "Act",
  relate: "Relate",
};

/** Colour families for the generative strands — one per row. */
export const REALM_COLOR: Record<Realm, string> = {
  imagine: "#7B4DFF",
  reason: "#1E6BFF",
  act: "#F0A500",
  relate: "#2FA84F",
};

// ------------------------------------------------------------ the matrix
/**
 * The default story for any two archetypes. A storytelling baseline, not
 * the result: the scores in lib/brainMate/compare decide the outcome, and
 * this only breaks ties in the middle band.
 *
 * Omkar's matrix, with the corrections agreed on 2026-11-23 so that every
 * archetype has at least two Power Duos and one Friendly Friction, and the
 * three people archetypes stop getting "Good Chemistry" with everyone.
 */
export type MatrixCode = "BM" | "PD" | "GC" | "FF" | "BC";

const ORDER: ArchetypeId[] = [
  "dreamer",
  "explorer",
  "creator",
  "detective",
  "strategist",
  "maverick",
  "maker",
  "spark",
  "doer",
  "connector",
  "mentor",
  "peacemaker",
];

const ROWS = [
  "BM BM BM FF PD FF PD PD PD GC GC GC",
  "BM BM BM GC BC BM PD PD FF GC GC GC",
  "BM BM BM FF PD BC PD PD PD GC GC GC",
  "FF GC FF BM BM FF PD FF PD FF GC GC",
  "PD BC PD BM BM FF FF FF PD GC GC PD",
  "FF BM BC FF FF BM PD FF FF PD FF FF",
  "PD PD PD PD FF PD BM PD PD PD GC GC",
  "PD PD PD FF FF FF PD BM PD GC PD GC",
  "PD FF PD PD PD FF PD PD BM GC GC PD",
  "GC GC GC FF GC PD PD GC GC BM PD BM",
  "GC GC GC GC GC FF GC PD GC PD BM GC",
  "GC GC GC GC PD FF GC GC PD BM GC BM",
].map((r) => r.split(" ") as MatrixCode[]);

export function matrixCode(a: ArchetypeId, b: ArchetypeId): MatrixCode {
  return ROWS[ORDER.indexOf(a)][ORDER.indexOf(b)];
}

/** Every archetype grouped by its relationship to `id`, for "Your Brain-Mates, by type". */
export function relationsOf(id: ArchetypeId): Record<MatrixCode, ArchetypeId[]> {
  const out: Record<MatrixCode, ArchetypeId[]> = { BM: [], PD: [], GC: [], FF: [], BC: [] };
  for (const other of ORDER) if (other !== id) out[matrixCode(id, other)].push(other);
  return out;
}

/** "with a Maker streak" / "with an Explorer streak". */
export function streakLine(id: ArchetypeId): string {
  const n = ARCHETYPES[id].name.replace("The ", "");
  return `with ${/^[AEIOU]/.test(n) ? "an" : "a"} ${n} streak`;
}
