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

/**
 * The eight traits Brain-Mate measures — seven aspects of the Big Five
 * (DeYoung's model) plus harmony vs challenge. Anxiety/emotional stability
 * is deliberately left out: unflattering, sensitive, and no use for
 * meeting people.
 */
export type Trait = "O" | "I" | "D" | "S" | "E" | "A" | "C" | "H";
export const TRAITS: Trait[] = ["O", "I", "D", "S", "E", "A", "C", "H"];

export const TRAIT_INFO: Record<Trait, { name: string; lo: string; hi: string; loLine: string; hiLine: string }> = {
  O: { name: "Imagination", lo: "Proven ways", hi: "New possibilities", loLine: "Perfect what already works", hiLine: "Imagine what could be" },
  I: { name: "Inquiry", lo: "Get it working", hi: "Find out why", loLine: "Get it working", hiLine: "Find out why" },
  D: { name: "Drive", lo: "Move on", hi: "See it through", loLine: "Move on once it's figured out", hiLine: "See it through to the end" },
  S: { name: "Structure", lo: "Keep it open", hi: "Have a plan", loLine: "Keep it open", hiLine: "Have a plan" },
  E: { name: "Social energy", lo: "One good conversation", hi: "The whole room", loLine: "Be in one good conversation", hiLine: "Be in the middle of the room" },
  A: { name: "Assertiveness", lo: "Back the lead", hi: "Take the lead", loLine: "Back the person leading", hiLine: "Take the lead" },
  C: { name: "Warmth", lo: "The problem", hi: "The people", loLine: "Look after the problem", hiLine: "Look after the people" },
  H: { name: "Harmony", lo: "Say the hard thing", hi: "Keep it together", loLine: "Say the uncomfortable thing", hiLine: "Keep the group together" },
};

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
  /** Best complements first, from the derived matrix. */
  powerDuo: ArchetypeId[];
  /**
   * The card's provocation. "clash" when the friction rules genuinely fire
   * for some archetype; four archetypes have no real friction with anyone,
   * and for them it's honestly "My opposite" — the most different profile.
   */
  edge: { kind: "clash" | "opposite"; id: ArchetypeId };
  /** Where this archetype sits on the eight traits, in standard units. */
  profile: Record<Trait, number>;
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
    powerDuo: ["maker", "doer", "strategist"],
    edge: { kind: "clash", id: "detective" },
    profile: { O: 2, I: 0, D: 0, S: -1, E: 1, A: 1, C: 0, H: 0 },
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
    powerDuo: ["maker", "doer", "spark"],
    edge: { kind: "opposite", id: "peacemaker" },
    profile: { O: 1.5, I: 1, D: -0.5, S: -1.5, E: 0.5, A: 0, C: 0, H: 0 },
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
    powerDuo: ["doer", "explorer"],
    edge: { kind: "opposite", id: "maverick" },
    profile: { O: 2, I: 0, D: 1, S: 0, E: -0.5, A: 0, C: 0, H: 0.5 },
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
    powerDuo: ["doer", "maker"],
    edge: { kind: "clash", id: "peacemaker" },
    profile: { O: 0.5, I: 1, D: 0, S: -1, E: 0, A: 1, C: -0.5, H: -2 },
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
    powerDuo: ["doer", "explorer"],
    edge: { kind: "clash", id: "spark" },
    profile: { O: 0, I: 2, D: 0.5, S: 0.5, E: -1, A: 0, C: 0, H: 0 },
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
    powerDuo: ["explorer", "dreamer"],
    edge: { kind: "clash", id: "maker" },
    profile: { O: 0, I: 1, D: 1, S: 2, E: 0, A: 0.5, C: 0, H: 0 },
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
    powerDuo: ["explorer", "doer"],
    edge: { kind: "clash", id: "detective" },
    profile: { O: 0.5, I: -0.5, D: 0, S: -1, E: 2, A: 1, C: 0, H: 0 },
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
    powerDuo: ["explorer", "dreamer", "maverick"],
    edge: { kind: "clash", id: "strategist" },
    profile: { O: 0.5, I: -0.5, D: 2, S: -1, E: 0, A: 0, C: 0, H: 0 },
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
    powerDuo: ["dreamer", "explorer", "detective"],
    edge: { kind: "opposite", id: "maverick" },
    profile: { O: -0.5, I: 0, D: 2, S: 1, E: 0, A: 0.5, C: 0, H: 0 },
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
    powerDuo: ["explorer", "doer"],
    edge: { kind: "clash", id: "detective" },
    profile: { O: 0, I: 0, D: 0, S: 0, E: 2, A: 0, C: 1, H: 0.5 },
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
    powerDuo: ["doer"],
    edge: { kind: "opposite", id: "dreamer" },
    profile: { O: 0, I: 1, D: 0, S: 0, E: -0.5, A: 0, C: 2, H: 0.5 },
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
    powerDuo: ["explorer", "dreamer", "doer"],
    edge: { kind: "clash", id: "maverick" },
    profile: { O: 0, I: 0, D: 0, S: 0.5, E: 0, A: -1, C: 1, H: 2 },
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
 * The default story for any two archetypes — a baseline the scores in
 * lib/brainMate/compare override. Derived from the archetype profiles by
 * the same rules the comparison uses (see scripts/brain-mate-sim), not
 * written by hand:
 *
 *   BM  profiles very similar, and no leadership or challenger clash
 *   FF  a research-backed friction source fires: both lead, two
 *       challengers, an evidence-first/reserved vs gut-first/social gap, a
 *       planner vs improviser whose roles don't complement, challenge vs harmony
 *   PD  complementary roles (ideas ↔ execution, lead ↔ support)
 *   BC  very different, with nothing clashing
 *   GC  no strong default — the two people's scores decide
 */
export type MatrixCode = "BM" | "PD" | "GC" | "FF" | "BC";

const ORDER: ArchetypeId[] = ["dreamer", "explorer", "creator", "maverick", "detective", "strategist", "spark", "maker", "doer", "connector", "mentor", "peacemaker"];

const ROWS = [
  "BM BM BM FF BC PD FF PD PD GC BC PD",
  "BM BM PD GC PD PD PD PD PD PD GC PD",
  "BM PD BM BC GC GC BC BM PD GC GC BC",
  "FF GC BC BM GC GC FF PD PD BC BC FF",
  "BC PD GC GC BM BM FF GC PD GC BM GC",
  "PD PD GC GC BM BM FF BM BM GC GC GC",
  "FF PD BC FF FF FF BM BM PD BM BC BC",
  "PD PD BM PD GC BM BM BM BM GC GC GC",
  "PD PD PD PD PD BM PD BM BM PD PD PD",
  "GC PD GC BC GC GC BM GC PD BM BM BM",
  "BC GC GC BC BM GC BC GC PD BM BM BM",
  "PD PD BC FF GC GC BC GC PD BM BM BM",
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
