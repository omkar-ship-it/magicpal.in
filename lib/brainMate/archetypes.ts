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

/**
 * Every trait praised at both ends — a low score is a different strength,
 * never a deficit. Used for "your top strengths", which come from the
 * person's own scores rather than the archetype's.
 */
export const TRAIT_PRAISE: Record<Trait, { hi: [string, string]; lo: [string, string] }> = {
  O: { hi: ["Imagination", "You see what could be."], lo: ["Groundedness", "You know what actually works."] },
  I: { hi: ["Curiosity", "You get to the bottom of things."], lo: ["Practicality", "You get things working."] },
  D: { hi: ["Follow-through", "You finish what you start."], lo: ["Agility", "You move on the moment it's done."] },
  S: { hi: ["Organisation", "You make order out of chaos."], lo: ["Flexibility", "You adapt on the fly."] },
  E: { hi: ["Energy", "You light up a room."], lo: ["Depth", "Your conversations really matter."] },
  A: { hi: ["Leadership", "You make the call when it counts."], lo: ["Support", "You make every leader better."] },
  C: { hi: ["Warmth", "People feel looked after around you."], lo: ["Clarity", "You solve the real problem."] },
  H: { hi: ["Harmony", "You bring people together."], lo: ["Candour", "You say what needs saying."] },
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
  /** What makes this archetype brilliant — the card's heart. */
  strengths: [string, string, string];
  /** One line people would say about them. */
  lovedFor: string;
  /** The rooms and roles where this archetype comes alive. */
  shineIn: [string, string, string];
  /** The blind spot, reframed as the next level — never a criticism. */
  growthEdge: string;
  /** One small, concrete thing to do this week. */
  thisWeek: string;
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
    strengths: ["You see possibilities before anyone else", "You make people excited about what's next", "You aim high — and pull others up with you"],
    lovedFor: "Making the future feel close enough to touch.",
    shineIn: ["Brainstorms", "New ventures", "Big-picture strategy"],
    growthEdge: "Pick one idea and give it a finish line — your vision deserves to be real.",
    thisWeek: "Write down the idea you keep coming back to, and tell one person who could help build it.",
    powerDuo: ["doer", "strategist", "peacemaker"],
    edge: { kind: "opposite", id: "mentor" },
    profile: { O: 2, I: 0, D: 0.5, S: -0.5, E: 0.3, A: 0.5, C: 0, H: 0 },
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
    strengths: ["Endlessly curious — you learn faster than anyone", "You connect ideas from different worlds", "You're open to people and views others miss"],
    lovedFor: "Always arriving with something fascinating to share.",
    shineIn: ["Research & discovery", "New markets", "Learning anything fast"],
    growthEdge: "Go deep on one thing you love — breadth plus depth is rare.",
    thisWeek: "Spend an hour on the rabbit hole you've been saving, then share what you found.",
    powerDuo: ["maker", "doer", "spark"],
    edge: { kind: "opposite", id: "peacemaker" },
    profile: { O: 1.5, I: 1.2, D: -0.5, S: -1.5, E: 0.5, A: 0, C: 0, H: 0 },
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
    strengths: ["You make things that move people", "You notice details others overlook", "You turn the ordinary into the memorable"],
    lovedFor: "Making everything you touch a little more beautiful.",
    shineIn: ["Design & brand", "Storytelling", "Product craft"],
    growthEdge: "Ship it at 90% — the world needs to see your work.",
    thisWeek: "Share one thing you've made, unfinished, with someone you trust.",
    powerDuo: ["doer"],
    edge: { kind: "opposite", id: "maverick" },
    profile: { O: 2, I: 0, D: 0.8, S: 0, E: 0.3, A: 0, C: 0.3, H: 0.3 },
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
    strengths: ["You think for yourself, even when it's lonely", "You spot what everyone agreed on too fast", "You make the bold bets others won't"],
    lovedFor: "Saying what everyone was thinking — and being right.",
    shineIn: ["Strategy & positioning", "Turnarounds", "Rethinking how things are done"],
    growthEdge: "Pick your battles — your challenge lands hardest when it's rare.",
    thisWeek: "Write down the contrarian bet you believe in, and test it cheaply.",
    powerDuo: ["doer", "maker", "explorer"],
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
    strengths: ["You find the truth under the noise", "Your questions make everyone think sharper", "People trust you with the facts"],
    lovedFor: "Being the person who actually knows.",
    shineIn: ["Analysis & research", "Diagnosing problems", "Due diligence"],
    growthEdge: "Decide at 80% sure — your instincts are better than you think.",
    thisWeek: "Give the question you can't stop thinking about one focused hour.",
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
    strengths: ["You see the path before anyone starts walking", "You turn chaos into clarity", "You make big goals feel achievable"],
    lovedFor: "Making everyone feel there's a plan — because there is.",
    shineIn: ["Planning & operations", "Leading complex projects", "Long-term thinking"],
    growthEdge: "Leave room for surprises — the best plans bend.",
    thisWeek: "Map one goal three moves ahead, then make the first move today.",
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
    strengths: ["You turn ideas into action, fast", "Your energy is contagious", "You rally people around things that matter"],
    lovedFor: "Making things happen — and making them fun.",
    shineIn: ["Launches & events", "Sales & partnerships", "Getting teams moving"],
    growthEdge: "Pair your spark with a finisher — together you're unstoppable.",
    thisWeek: "Start the thing you've been talking about, and invite one person to do it with you.",
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
    strengths: ["You learn by building — and you build fast", "You make the abstract real", "You solve problems with your hands and your head"],
    lovedFor: "Showing up with a working version while others are still talking.",
    shineIn: ["Prototyping", "Engineering & craft", "Hands-on problem solving"],
    growthEdge: "Ask “who is this for?” before the first build — it makes your work land.",
    thisWeek: "Build a tiny version of an idea in a single sitting.",
    powerDuo: ["explorer", "maverick"],
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
    strengths: ["You deliver — every single time", "People trust you with what matters", "You make momentum feel calm"],
    lovedFor: "Being the reason things actually get done.",
    shineIn: ["Execution & delivery", "Operations", "Turning plans into results"],
    growthEdge: "Pause to ask “is this still the right thing?” — then finish it brilliantly.",
    thisWeek: "Finish one lingering thing, and celebrate it out loud.",
    powerDuo: ["explorer", "detective", "dreamer"],
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
    strengths: ["You make strangers feel like friends", "You know exactly who should meet whom", "You build communities without trying"],
    lovedFor: "Making every room warmer and every network bigger.",
    shineIn: ["Community & partnerships", "Hiring", "Events & business development"],
    growthEdge: "Go deep with a few — your best connections deserve your time.",
    thisWeek: "Introduce two people who should know each other.",
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
    strengths: ["You help people see their next step", "You listen in a way people remember", "You help others grow without making it about you"],
    lovedFor: "Leaving people better than you found them.",
    shineIn: ["Coaching & leadership", "Teaching", "Growing people"],
    growthEdge: "Take your own advice — you deserve the care you give.",
    thisWeek: "Ask someone you're helping what they'd love to learn next.",
    powerDuo: ["doer"],
    edge: { kind: "opposite", id: "spark" },
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
    strengths: ["You find common ground where others see walls", "You make people feel heard", "You hold teams together through hard moments"],
    lovedFor: "Making everyone feel safe enough to be honest.",
    shineIn: ["Leading teams", "Negotiation", "Culture & community"],
    growthEdge: "Say what you think — your view is part of the harmony.",
    thisWeek: "Share one honest opinion you've been holding back.",
    powerDuo: ["explorer", "doer", "dreamer"],
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
  "BM BM BM GC GC PD GC BM PD GC BC PD",
  "BM BM BM PD PD PD PD PD PD PD GC PD",
  "BM BM BM BC BC GC GC GC PD GC GC GC",
  "GC PD BC BM GC GC FF PD PD BC BC FF",
  "GC PD BC GC BM BM FF GC PD GC BM GC",
  "PD PD GC GC BM BM FF BM BM GC GC GC",
  "GC PD GC FF FF FF BM BM PD BM BC BC",
  "BM PD GC PD GC BM BM BM BM GC GC GC",
  "PD PD PD PD PD BM PD BM BM PD PD PD",
  "GC PD GC BC GC GC BM GC PD BM BM BM",
  "BC GC GC BC BM GC BC GC PD BM BM BM",
  "PD PD GC FF GC GC BC GC PD BM BM BM",
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
