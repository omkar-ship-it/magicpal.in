import { ARCHETYPES, TRAITS, matrixCode, type ArchetypeId, type MatrixCode, type Trait } from "./archetypes";
import { SCENARIOS, STATEMENTS, TILE_ACTIVITY, TILE_BY_ID, VALUE_BY_ID } from "./rounds";
import { MIN_CROWD, agreeWord, resultFor, scenarioLabel, type Answers, type CrowdStats, type Traits } from "./score";

/**
 * Two people's Wavelength, built on their eight trait scores.
 *
 * SAME WAVELENGTH (similarity) — 50% trait similarity (imagination, inquiry,
 *   social energy, warmth and harmony weighted most: similarity there is
 *   what predicts friendship), 30% shared values (similarity-attraction,
 *   Byrne), 20% shared interests.
 *
 * COMPATIBILITY — how the differences fit, from interpersonal theory
 *   (Kiesler: dominance works best complementary, warmth works best
 *   similar) and team-conflict research:
 *     30% complementary roles (ideas ↔ execution)
 *     20% one leads, one supports
 *     20% similar warmth
 *     15% similar structure (big conscientiousness gaps breed conflict)
 *     15% not two strong challengers together
 *   plus, when both have an OpenNetworks profile, 25% needs ↔ offers.
 *
 * Both are shown as where the pair ranks among all pairs (32–98), so a
 * number means the same thing whoever you compare with. Scales fitted by
 * simulation — refit from real pairs once there are enough.
 */

export type Person = {
  name: string;
  answers: Answers;
  lookingFor?: string[];
  canHelpWith?: string[];
};

export type Outcome = "mind_twins" | "power_duo" | "missing_piece" | "friendly_friction" | "beautiful_chaos";

export const OUTCOMES: Record<Outcome, { label: string; stamp: string; color: string }> = {
  mind_twins: { label: "Mind Twins", stamp: "Same brain, different body.", color: "#7B4DFF" },
  power_duo: { label: "Power Duo", stamp: "Different strengths, one direction.", color: "#FF6B4A" },
  missing_piece: { label: "Missing Piece", stamp: "They have what you've been looking for.", color: "#0E7C93" },
  friendly_friction: { label: "Friendly Friction", stamp: "You'll argue — and both be better for it.", color: "#E07A00" },
  beautiful_chaos: { label: "Beautiful Chaos", stamp: "Makes no sense. Works anyway.", color: "#E0266B" },
};

export type Comparison = {
  a: { name: string; archetype: ArchetypeId; streak: ArchetypeId; traits: Traits };
  b: { name: string; archetype: ArchetypeId; streak: ArchetypeId; traits: Traits };
  similarity: number;
  compatibility: number;
  layers: { label: string; value: number }[];
  /** The five compatibility parts, 0–100, for the breakdown. */
  fit: { label: string; value: number }[];
  intentKnown: boolean;
  outcome: Outcome;
  dynamic: string;
  roles: string;
  twins: string;
  opposites: string;
  watchOut: string;
  tryThis: string;
  activity: string;
  opener: string;
  workWith: { aToB: string; bToA: string };
  replay: { title: string; a: string; b: string; same: boolean }[];
};

const clip = (x: number) => Math.max(0, Math.min(1, x));
const jaccard = (x: string[] = [], y: string[] = []) => {
  const a = new Set(x);
  const b = new Set(y);
  const inter = [...a].filter((v) => b.has(v)).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 0;
};

const SIM_W: Record<Trait, number> = { O: 1.5, I: 1, D: 0.5, S: 0.5, E: 1, A: 0.5, C: 1, H: 1 };

export function traitSimilarity(a: Traits, b: Traits): number {
  let s = 0;
  let w = 0;
  for (const k of TRAITS) {
    s += SIM_W[k] * Math.abs(a[k] - b[k]);
    w += SIM_W[k];
  }
  return clip(1 - s / w / 2.5);
}

export function fitParts(a: Traits, b: Traits) {
  const orient = (z: Traits) => (z.O + z.I) / 2 - (z.D + z.S) / 2;
  return {
    role: clip(Math.abs(orient(a) - orient(b)) / 2.5),
    lead: clip(0.55 + 0.22 * Math.abs(a.A - b.A) - 0.3 * Math.max(0, a.A + b.A - 1)),
    warmth: clip(1 - Math.abs(a.C - b.C) / 3 + 0.1 * Math.max(0, Math.min(a.C, b.C))),
    structure: clip(1 - Math.abs(a.S - b.S) / 3),
    challenge: clip(1 - 0.6 * Math.max(0, -a.H - 0.3) * Math.max(0, -b.H - 0.3)),
  };
}

// Where a raw score sits among simulated pairs — 21 quantiles each.
const SIM_Q = [0.037, 0.1872, 0.2202, 0.2447, 0.2646, 0.2831, 0.2998, 0.3165, 0.3327, 0.3475, 0.3629, 0.3788, 0.3943, 0.4106, 0.4293, 0.4487, 0.4708, 0.4981, 0.5369, 0.6064, 0.9709];
const COMP_Q = [0.2069, 0.4567, 0.4979, 0.527, 0.5512, 0.5708, 0.5889, 0.6064, 0.6225, 0.6384, 0.6541, 0.6696, 0.6861, 0.703, 0.7205, 0.7402, 0.7613, 0.7858, 0.8138, 0.8518, 1];

function percentile(x: number, q: number[]): number {
  if (x <= q[0]) return 0;
  for (let i = 1; i < q.length; i++) {
    if (x <= q[i]) return (i - 1 + (x - q[i - 1]) / (q[i] - q[i - 1] || 1)) / (q.length - 1);
  }
  return 1;
}
const display = (x: number, q: number[]) => Math.round(32 + 66 * percentile(x, q));

const first = (name: string) => name.trim().split(/\s+/)[0] || name;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const OPPOSITE: Record<Trait, (lo: string, hi: string) => string> = {
  O: (lo, hi) => `${hi} chases new possibilities; ${lo} perfects what works.`,
  I: (lo, hi) => `${hi} needs the why; ${lo} just wants it working.`,
  D: (lo, hi) => `${hi} sees it through; ${lo} moves on once it's figured out.`,
  S: (lo, hi) => `${hi} wants a plan; ${lo} wants it open.`,
  E: (lo, hi) => `${hi} wants the whole room; ${lo} wants one good conversation.`,
  A: (lo, hi) => `${hi} takes the lead; ${lo} backs it.`,
  C: (lo, hi) => `${hi} looks after the people; ${lo} looks after the problem.`,
  H: (lo, hi) => `${hi} keeps it together; ${lo} says the hard thing.`,
};

export function compare(pa: Person, pb: Person, stats: CrowdStats | null = null): Comparison {
  const ra = resultFor(pa.answers);
  const rb = resultFor(pb.answers);
  const za = ra.traits;
  const zb = rb.traits;
  const A = ARCHETYPES[ra.archetype];
  const B = ARCHETYPES[rb.archetype];
  const an = first(pa.name);
  const bn = first(pb.name);

  // ------------------------------------------------------- similarity
  const tSim = traitSimilarity(za, zb);
  const vSim = jaccard(pa.answers.values, pb.answers.values);
  const iSim = jaccard(pa.answers.tiles, pb.answers.tiles);
  const similarity = display(0.5 * tSim + 0.3 * vSim + 0.2 * iSim, SIM_Q);

  const near = (keys: Trait[]) => clip(1 - keys.reduce((s, k) => s + Math.abs(za[k] - zb[k]), 0) / keys.length / 2.5);
  const pct = (x: number) => Math.round(clip(x) * 100);
  const layers = [
    { label: "Think", value: pct(near(["O", "I"])) },
    { label: "Drive", value: pct(0.5 * near(["D"]) + 0.5 * vSim) },
    { label: "Connect", value: pct(near(["E", "C"])) },
    { label: "Work", value: pct(near(["S", "A", "H"])) },
    { label: "Play", value: pct(iSim) },
  ];

  // ---------------------------------------------------- compatibility
  const p = fitParts(za, zb);
  let compRaw = 0.3 * p.role + 0.2 * p.lead + 0.2 * p.warmth + 0.15 * p.structure + 0.15 * p.challenge;
  const intentKnown = Boolean(pa.lookingFor?.length && pa.canHelpWith?.length && pb.lookingFor?.length && pb.canHelpWith?.length);
  let missing: { needer: string; giver: string } | null = null;
  if (intentKnown) {
    const aGets = pa.lookingFor!.filter((t) => pb.canHelpWith!.includes(t)).length;
    const bGets = pb.lookingFor!.filter((t) => pa.canHelpWith!.includes(t)).length;
    compRaw = 0.75 * compRaw + 0.25 * clip((aGets + bGets) / 2);
    if (pb.canHelpWith!.includes(pa.lookingFor![0])) missing = { needer: an, giver: bn };
    else if (pa.canHelpWith!.includes(pb.lookingFor![0])) missing = { needer: bn, giver: an };
  }
  const compatibility = display(compRaw, COMP_Q);
  const fit = [
    { label: "Roles fit (ideas ↔ execution)", value: pct(p.role) },
    { label: "Lead ↔ support", value: pct(p.lead) },
    { label: "Warmth in sync", value: pct(p.warmth) },
    { label: "Structure in sync", value: pct(p.structure) },
    { label: "Challenge balance", value: pct(p.challenge) },
  ];

  // ---------------------------------------------------------- outcome
  const peopleClash = p.lead < 0.45 || p.challenge < 0.6;
  const code: MatrixCode = matrixCode(A.id, B.id);
  let outcome: Outcome;
  if (missing && compatibility >= 65) outcome = "missing_piece";
  else if (similarity >= 84 && !peopleClash) outcome = "mind_twins";
  else if (peopleClash && compatibility < 72) outcome = "friendly_friction";
  else if (compatibility >= 80 && compatibility > similarity) outcome = "power_duo";
  else if (similarity < 45 && compatibility < 50) outcome = "beautiful_chaos";
  else if (similarity < 52 && compatibility >= 50 && compatibility < 80) outcome = "friendly_friction";
  else if (code !== "GC") outcome = fromCode(code);
  else outcome = compatibility >= similarity ? "power_duo" : similarity >= 70 ? "mind_twins" : "friendly_friction";

  // --------------------------------------------------------- insights
  const gaps = TRAITS.map((k) => ({ k, gap: Math.abs(za[k] - zb[k]) })).sort((x, y) => y.gap - x.gap);
  const widest = gaps[0];
  const opposites =
    widest.gap < 0.6
      ? "Hardly anywhere — your profiles line up almost trait for trait."
      : za[widest.k] < zb[widest.k]
        ? OPPOSITE[widest.k](an, bn)
        : OPPOSITE[widest.k](bn, an);

  const weakest = (Object.entries(p) as [keyof typeof p, number][]).sort((x, y) => x[1] - y[1])[0][0];
  const bothLead = za.A + zb.A > 0;
  const WATCH: Record<keyof typeof p, [string, string]> = {
    role: ["You see things the same way, so your blind spots stack up.", "Bring in a third opinion before big calls."],
    lead: bothLead
      ? ["You'll both want the wheel.", "Split the turf: one owns the what, the other owns the how."]
      : ["Neither of you wants to call it.", "Decide up front who makes the final call."],
    warmth: ["One of you reads the room, the other reads the brief.", "Start with how you're both doing, then get to the task."],
    structure: ["One plans, one improvises — deadlines will get tense.", "Agree the deadline; leave the route open."],
    challenge: ["Two challengers: every idea turns into a debate.", "Set a time limit on the argument, then commit."],
  };
  const [watchOut, tryThis] = WATCH[weakest];

  const twins = sharedThing(pa.answers, pb.answers, stats) ?? "Not one answer the same. That's rarer than a perfect match.";

  const sharedTile = pa.answers.tiles.find((t) => pb.answers.tiles.includes(t));
  const activity = sharedTile
    ? TILE_ACTIVITY[sharedTile]
    : (za.E + zb.E) / 2 < 0
      ? "A long one-to-one coffee. Phones away."
      : "A meetup together — then compare notes on who you met.";

  const leadGap = za.A - zb.A;
  const orientA = (za.O + za.I) / 2 - (za.D + za.S) / 2;
  const orientB = (zb.O + zb.I) / 2 - (zb.D + zb.S) / 2;
  const roleWord = (o: number) => (o > 0.3 ? "the ideas" : o < -0.3 ? "the execution" : "a bit of both");
  const roles =
    Math.abs(orientA - orientB) > 0.6
      ? `In a team: ${an} = ${roleWord(orientA)} · ${bn} = ${roleWord(orientB)}` +
        (Math.abs(leadGap) > 0.8 ? `. ${leadGap > 0 ? an : bn} leads.` : "")
      : Math.abs(leadGap) > 0.8
        ? `In a team: ${leadGap > 0 ? an : bn} leads, ${leadGap > 0 ? bn : an} sharpens.`
        : `In a team: ${an} = ${A.role} · ${bn} = ${B.role}`;

  const dynamic =
    outcome === "mind_twins"
      ? `${an} and ${bn} think alike. You finish each other's sentences.`
      : outcome === "missing_piece" && missing
        ? `${missing.needer} is looking for exactly what ${missing.giver} has done.`
        : A.id === B.id
          ? `Two ${A.name.replace("The ", "")}s: you both ${lower(A.does)}.`
          : `${an} ${A.does}. ${bn} ${B.does}.`;

  return {
    a: { name: an, archetype: A.id, streak: ra.streak, traits: za },
    b: { name: bn, archetype: B.id, streak: rb.streak, traits: zb },
    similarity,
    compatibility,
    layers,
    fit,
    intentKnown,
    outcome,
    dynamic,
    roles,
    twins,
    opposites,
    watchOut,
    tryThis,
    activity,
    opener: `Ask ${bn}: “${B.askMe}”`,
    workWith: {
      aToB: `With ${bn}: ${lower(B.give)} ${B.dont}`,
      bToA: `With ${an}: ${lower(A.give)} ${A.dont}`,
    },
    replay: replay(pa.answers, pb.answers),
  };
}

function fromCode(code: MatrixCode): Outcome {
  if (code === "PD") return "power_duo";
  if (code === "BM") return "mind_twins";
  if (code === "FF") return "friendly_friction";
  return "beautiful_chaos";
}

/** The most telling thing two people share: a rare scenario answer, a value, a strong opinion, a passion. */
function sharedThing(a: Answers, b: Answers, stats: CrowdStats | null): string | null {
  const crowd = stats && stats.n >= MIN_CROWD ? stats : null;
  let rarest: { key: string; share: number } | null = null;
  for (const sc of SCENARIOS) {
    if (a.s[sc.id] && a.s[sc.id] === b.s[sc.id]) {
      const key = `${sc.id}:${a.s[sc.id]}`;
      const share = crowd?.share[key] ?? 1 / sc.options.length;
      if (!rarest || share < rarest.share) rarest = { key, share };
    }
  }
  if (rarest && crowd && rarest.share < 0.2)
    return `Both of you: “${scenarioLabel(rarest.key)}”. Only ${Math.max(1, Math.round(rarest.share * 100))}% of people pick that.`;
  const value = a.values.find((v) => b.values.includes(v));
  if (value) return `You both packed ${VALUE_BY_ID.get(value)?.label.toLowerCase()}.`;
  const strong = STATEMENTS.find((s) => (a.t[s.id] === 3 && b.t[s.id] === 3) || (a.t[s.id] === 0 && b.t[s.id] === 0));
  if (strong) return `You both said “${a.t[strong.id] === 3 ? "Totally" : "Nope"}” to “${strong.text}”`;
  if (rarest) return `Both of you: “${scenarioLabel(rarest.key)}”.`;
  const tile = a.tiles.find((t) => b.tiles.includes(t));
  if (tile) return `You'd both lose a weekend to ${TILE_BY_ID.get(tile)?.label.toLowerCase()}.`;
  return null;
}

function replay(a: Answers, b: Answers): Comparison["replay"] {
  const rows: Comparison["replay"] = SCENARIOS.map((sc) => ({
    title: sc.title,
    a: sc.options.find((o) => o.id === a.s[sc.id])?.label ?? "—",
    b: sc.options.find((o) => o.id === b.s[sc.id])?.label ?? "—",
    same: a.s[sc.id] === b.s[sc.id],
  }));
  // The statements you disagreed on most — the "you said WHAT?" ones.
  const split = STATEMENTS.map((s) => ({ s, gap: Math.abs((a.t[s.id] ?? 0) - (b.t[s.id] ?? 0)) }))
    .filter((x) => x.gap >= 2)
    .sort((x, y) => y.gap - x.gap)
    .slice(0, 3);
  for (const { s } of split) rows.push({ title: `“${s.text}”`, a: agreeWord(a.t[s.id]), b: agreeWord(b.t[s.id]), same: false });
  const lab = (ids: string[], m: Map<string, { label: string }>) => ids.map((id) => m.get(id)?.label ?? id).join(", ");
  rows.push({ title: "Pack your bag", a: lab(a.values, VALUE_BY_ID), b: lab(b.values, VALUE_BY_ID), same: jaccard(a.values, b.values) === 1 });
  rows.push({ title: "Your weekend", a: lab(a.tiles, TILE_BY_ID), b: lab(b.tiles, TILE_BY_ID), same: jaccard(a.tiles, b.tiles) === 1 });
  return rows;
}
