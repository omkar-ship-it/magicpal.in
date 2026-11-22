import { ARCHETYPES, ARCHETYPE_IDS, TRAITS, TRAIT_INFO, type ArchetypeId, type Trait } from "./archetypes";
import { AGREE, AGREE_VALUE, SCENARIOS, STATEMENTS, TILES, VALUES, type Loading } from "./rounds";

/**
 * Brain-Mate v2 scoring: answers → eight trait scores → nearest archetype.
 *
 * Pure and deterministic. The server recomputes everything from the raw
 * answers (a client can't post an archetype), and the game runs the same
 * code live to drive the narrowing ring and to build each duel card.
 *
 * The constants below were fitted by simulation (scripts/brain-mate-sim):
 * 20,000 synthetic players with known traits answering with realistic
 * noise. In that simulation trait scores correlate 0.82–0.85 with the true
 * traits, players who clearly fit one archetype get it 76% of the time and
 * the same one on a retake 63%, and every archetype lands on ~8.3% of
 * players. They are a starting point — refit NORM_* and BIAS from real
 * answers once a few hundred people have played.
 */

export const VERSION = 2;

export type DuelAnswer = { a: ArchetypeId; b: ArchetypeId; pick: ArchetypeId };

export type Answers = {
  v: 2;
  /** scenario id → option id */
  s: Record<string, string>;
  /** statement id → 0..3 (Nope, Not really, Kinda, Totally) */
  t: Record<string, number>;
  values: string[];
  tiles: string[];
  duels: DuelAnswer[];
  /** How long the statements took, for the "gut speed" line. */
  ms?: number;
};

export type Traits = Record<Trait, number>;

// Population norms for the raw trait scores (mean, sd) and the per-archetype
// offsets that keep the twelve evenly spread. From the simulation.
const NORM_MU = [0.3471, 0.3113, 0.292, 0.3139, 0.2233, 0.3765, 0.3125, 0.1634];
const NORM_SD = [0.5677, 0.6082, 0.6465, 0.6745, 0.5934, 0.6121, 0.6011, 0.6713];
const BIAS: Record<ArchetypeId, number> = {
  dreamer: 0.124,
  explorer: 0.037,
  creator: 0.042,
  maverick: -0.04,
  detective: -0.014,
  strategist: 0,
  spark: -0.02,
  maker: 0.049,
  doer: -0.046,
  connector: 0.013,
  mentor: -0.026,
  peacemaker: -0.119,
};

export const DUEL_COUNT = 3;
const DUEL_STEP = 0.45;

const vec = (t: Partial<Record<Trait, number>>) => TRAITS.map((k) => t[k] ?? 0);
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a: number[]) => Math.sqrt(dot(a, a)) || 1;
const cos = (a: number[], b: number[]) => dot(a, b) / (norm(a) * norm(b));
const PROFILE: Record<ArchetypeId, number[]> = Object.fromEntries(
  ARCHETYPE_IDS.map((id) => [id, vec(ARCHETYPES[id].profile)])
) as Record<ArchetypeId, number[]>;

/** Raw trait scores from whatever has been answered so far. */
function raw(a: Partial<Answers>): number[] {
  const sum = TRAITS.map(() => 0);
  const n = TRAITS.map(() => 0);
  const add = (load: Loading, value: number | null) =>
    TRAITS.forEach((k, i) => {
      const x = load[k];
      if (!x) return;
      n[i] += Math.abs(x);
      if (value !== null) sum[i] += x * value;
    });
  for (const sc of SCENARIOS) {
    const chosen = a.s?.[sc.id];
    if (chosen === undefined) continue;
    for (const o of sc.options) add(o.load, o.id === chosen ? 2 : 0);
  }
  for (const st of STATEMENTS) {
    const v = a.t?.[st.id];
    if (v === undefined) continue;
    add(st.load, AGREE_VALUE[v]);
  }
  return sum.map((x, i) => (n[i] ? x / n[i] : NORM_MU[i]));
}

/** Trait scores in standard units (0 = typical, ±1 = one spread away). */
export function traitVector(a: Partial<Answers>): number[] {
  return raw(a).map((x, i) => (x - NORM_MU[i]) / NORM_SD[i]);
}

function ranked(z: number[]): { id: ArchetypeId; c: number }[] {
  return ARCHETYPE_IDS.map((id) => ({ id, c: cos(z, PROFILE[id]) + BIAS[id] })).sort((x, y) => y.c - x.c);
}

function withDuels(z: number[], duels: DuelAnswer[]): number[] {
  const out = [...z];
  for (const d of duels) {
    const diff = PROFILE[d.a].map((x, i) => x - PROFILE[d.b][i]);
    const n = norm(diff);
    const sign = d.pick === d.a ? 1 : -1;
    diff.forEach((x, i) => (out[i] += (sign * DUEL_STEP * x) / n));
  }
  return out;
}

/** Silhouettes still lit on the ring, by how far the player has got. */
export function stillInPlay(a: Partial<Answers>, fraction: number): ArchetypeId[] {
  const keep = Math.max(2, Math.round(12 - 10 * Math.min(1, fraction)));
  return ranked(withDuels(traitVector(a), a.duels ?? []))
    .slice(0, keep)
    .map((x) => x.id);
}

// ------------------------------------------------------------------ duels
export type DuelCard = {
  a: ArchetypeId;
  b: ArchetypeId;
  lineA: string;
  lineB: string;
};

/**
 * The next duel card: the player's current top two (or the next pair down
 * if that pair was already asked), contrasted on the two traits where their
 * profiles differ most. Null once all duels are answered.
 */
export function nextDuel(a: Partial<Answers>): DuelCard | null {
  const done = a.duels ?? [];
  if (done.length >= DUEL_COUNT) return null;
  const r = ranked(withDuels(traitVector(a), done));
  const asked = new Set(done.map((d) => [d.a, d.b].sort().join("|")));
  const A = r[0].id;
  let B = r[1].id;
  if (asked.has([A, B].sort().join("|"))) B = r[2].id;
  const diff = TRAITS.map((k, i) => ({ k, d: PROFILE[A][i] - PROFILE[B][i] })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const line = (positive: boolean) =>
    diff
      .slice(0, 2)
      .filter((x) => Math.abs(x.d) >= 0.5)
      .map((x) => {
        const info = TRAIT_INFO[x.k];
        return (x.d > 0) === positive ? info.hiLine : info.loLine;
      })
      .join(" · ");
  const lineA = line(true);
  const lineB = line(false);
  // Two profiles that barely differ get their superpowers instead.
  if (!lineA || !lineB) return { a: A, b: B, lineA: ARCHETYPES[A].superpower, lineB: ARCHETYPES[B].superpower };
  return { a: A, b: B, lineA, lineB };
}

// ------------------------------------------------------------- validation
/**
 * Only answers the game could have produced: every question answered with
 * a real option, picks of the right size, and each duel exactly the card
 * the earlier answers lead to. Anything else is refused.
 */
export function cleanAnswers(input: unknown): Answers | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const s = (r.s ?? {}) as Record<string, unknown>;
  const t = (r.t ?? {}) as Record<string, unknown>;
  const out: Answers = { v: 2, s: {}, t: {}, values: [], tiles: [], duels: [] };
  for (const sc of SCENARIOS) {
    const v = s[sc.id];
    if (typeof v !== "string" || !sc.options.some((o) => o.id === v)) return null;
    out.s[sc.id] = v;
  }
  for (const st of STATEMENTS) {
    const v = t[st.id];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 3) return null;
    out.t[st.id] = v;
  }
  const pick = (v: unknown, from: { id: string }[], count: number) => {
    if (!Array.isArray(v)) return null;
    const ids = [...new Set(v.filter((x): x is string => typeof x === "string"))];
    return ids.length === count && ids.every((id) => from.some((o) => o.id === id)) ? ids : null;
  };
  const values = pick(r.values, VALUES, 2);
  const tiles = pick(r.tiles, TILES, 3);
  if (!values || !tiles) return null;
  out.values = values;
  out.tiles = tiles;
  const duels = Array.isArray(r.duels) ? r.duels : [];
  if (duels.length !== DUEL_COUNT) return null;
  for (const d of duels as Record<string, unknown>[]) {
    const card = nextDuel(out);
    if (!card || d?.a !== card.a || d?.b !== card.b || (d.pick !== card.a && d.pick !== card.b)) return null;
    out.duels.push({ a: card.a, b: card.b, pick: d.pick as ArchetypeId });
  }
  const ms = Number(r.ms);
  if (Number.isFinite(ms) && ms > 0 && ms < 900_000) out.ms = Math.round(ms);
  return out;
}

export const isV2 = (a: unknown): a is Answers => Boolean(a && typeof a === "object" && (a as { v?: number }).v === 2);

// ------------------------------------------------------------------ result
export type Result = {
  archetype: ArchetypeId;
  streak: ArchetypeId;
  /** The top two were nearly tied — say so rather than pretend. */
  cusp: boolean;
  /** Top three as percentages summing to 100. */
  mix: { id: ArchetypeId; pct: number }[];
  /** Trait scores in standard units, clipped to ±2.5. */
  traits: Traits;
};

export function resultFor(a: Answers): Result {
  const z = withDuels(traitVector(a), a.duels);
  const r = ranked(z);
  const top = r.slice(0, 3);
  // Soft enough to read as a blend: a clear type shows ~60/25/15, not 96/4/0.
  const w = top.map((x) => Math.exp(x.c / 0.2));
  const total = w.reduce((s, x) => s + x, 0);
  const pct = w.map((x) => Math.round((x / total) * 100));
  pct[0] += 100 - pct.reduce((s, x) => s + x, 0);
  const traits = Object.fromEntries(TRAITS.map((k, i) => [k, Math.max(-2.5, Math.min(2.5, z[i]))])) as Traits;
  return {
    archetype: r[0].id,
    streak: r[1].id,
    cusp: r[0].c - r[1].c < 0.05,
    mix: top.map((x, i) => ({ id: x.id, pct: pct[i] })),
    traits,
  };
}

// ------------------------------------------------------ "how did it know"
export type CrowdStats = {
  n: number;
  /** "s3:a" or "t5:3" → share of players who answered that, 0–1. */
  share: Record<string, number>;
  archetypes: Record<string, number>;
};

export const MIN_CROWD = 20;

export const HIGH_PHRASE: Record<Trait, string> = {
  O: "ideas everywhere",
  I: "always asking why",
  D: "the one who finishes",
  S: "a plan for everything",
  E: "charged up by people",
  A: "a natural lead",
  C: "reading the room",
  H: "keeping the peace",
};
export const LOW_PHRASE: Record<Trait, string> = {
  O: "loyal to what works",
  I: "happy without the why",
  D: "quick to move on",
  S: "plans optional",
  E: "a one-good-conversation person",
  A: "happy to back the lead",
  C: "problem first",
  H: "not afraid of the hard thing",
};

/** The pair of statements for each trait: [agree-means-high, agree-means-low]. */
const PAIR: Record<Trait, [string, string]> = {
  O: ["t1", "t9"],
  I: ["t2", "t10"],
  D: ["t3", "t11"],
  S: ["t4", "t12"],
  E: ["t5", "t13"],
  A: ["t6", "t14"],
  C: ["t7", "t15"],
  H: ["t8", "t16"],
};

export const scenarioLabel = (key: string) => {
  const [sid, oid] = key.split(":");
  return SCENARIOS.find((s) => s.id === sid)?.options.find((o) => o.id === oid)?.label ?? "";
};
export const statementText = (id: string) => STATEMENTS.find((s) => s.id === id)?.text ?? "";

/**
 * One line that proves the result came from *your* answers. Picked by
 * rule, in a fixed priority order; nothing here is invented.
 */
export function howDidItKnow(a: Answers, stats: CrowdStats | null): string {
  const res = resultFor(a);
  const me = ARCHETYPES[res.archetype];

  // A trait you answered the same way twice, at full strength, from both sides.
  for (const k of TRAITS) {
    const [hi, lo] = PAIR[k];
    if (a.t[hi] === 3 && a.t[lo] === 0)
      return `“${statementText(hi)}” Totally. “${statementText(lo)}” Nope. That's ${HIGH_PHRASE[k]}, both ways round.`;
    if (a.t[hi] === 0 && a.t[lo] === 3)
      return `“${statementText(lo)}” Totally — and you meant it both ways round. ${cap(LOW_PHRASE[k])}.`;
  }

  if (stats && stats.n >= MIN_CROWD) {
    let rare: { key: string; share: number } | null = null;
    for (const [sid, oid] of Object.entries(a.s)) {
      const share = stats.share[`${sid}:${oid}`];
      if (share !== undefined && share < 0.12 && (!rare || share < rare.share)) rare = { key: `${sid}:${oid}`, share };
    }
    if (rare) return `You picked “${scenarioLabel(rare.key)}”. Only ${Math.max(1, Math.round(rare.share * 100))}% of people do.`;
  }

  const order = TRAITS.map((k) => ({ k, z: res.traits[k] })).sort((x, y) => y.z - x.z);
  const hi = order[0];
  const lo = order[order.length - 1];
  if (hi.z > 0.8 && lo.z < -0.5) return `${cap(HIGH_PHRASE[hi.k])}, and ${LOW_PHRASE[lo.k]}. That mix is what makes ${me.name}.`;

  const last = a.duels[a.duels.length - 1];
  if (last) {
    const other = last.pick === last.a ? last.b : last.a;
    return `It came down to ${short(last.pick)} vs ${short(other)} — and the ${short(other)} in you is why it was close.`;
  }
  return `${cap(HIGH_PHRASE[hi.k])}. That's the heart of ${me.name}.`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (id: ArchetypeId) => ARCHETYPES[id].name.replace("The ", "");

/** Words flashed in the recap montage, in the order the scenarios were answered. */
export function montageWords(a: Partial<Answers>): string[] {
  return SCENARIOS.map((sc) => sc.options.find((o) => o.id === a.s?.[sc.id])?.word).filter((w): w is string => Boolean(w));
}

export const agreeWord = (v: number | undefined) => (v === undefined ? "—" : AGREE[v]);

// ------------------------------------------------------------- the strands
/**
 * The generative art behind every card: one strand per answer, coloured by
 * the trait it spoke to. Deterministic, so the same person always gets the
 * same art and no two cards are alike.
 */
export type Strand = { d: string; color: string; width: number; opacity: number };

export const TRAIT_COLOR: Record<Trait, string> = {
  O: "#7B4DFF",
  I: "#0E7C93",
  D: "#E07A00",
  S: "#1F3A8A",
  E: "#2FA84F",
  A: "#FF6B4A",
  C: "#4E8F6B",
  H: "#1D5C45",
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function traitOf(load: Loading): Trait {
  return (Object.entries(load).sort((x, y) => Math.abs(y[1] ?? 0) - Math.abs(x[1] ?? 0))[0]?.[0] ?? "O") as Trait;
}

/** Strands on a 400×400 canvas centred at 200,200. */
export function strandsFor(a: Partial<Answers>, seed = ""): Strand[] {
  const out: Strand[] = [];
  const push = (key: string, trait: Trait, weight: number, shape: number) => {
    const h = hash(seed + key);
    const angle = ((h % 360) * Math.PI) / 180;
    const sweep = 0.9 + ((h >>> 9) % 100) / 60;
    const r1 = 60 + ((h >>> 3) % 70);
    const r2 = 120 + ((h >>> 13) % 70);
    const p = (r: number, t: number) => `${(200 + r * Math.cos(t)).toFixed(1)} ${(200 + r * Math.sin(t)).toFixed(1)}`;
    const d =
      shape === 0
        ? `M ${p(30, angle)} Q ${p(r2, angle + 0.25)} ${p(r2 + 40, angle + 0.05)}`
        : shape === 1
          ? `M ${p(r1, angle)} A ${r1} ${r1} 0 0 1 ${p(r1, angle + sweep)}`
          : `M ${p(r1, angle)} C ${p(r2, angle + sweep / 3)} ${p(r1 * 0.6, angle + (sweep * 2) / 3)} ${p(r2, angle + sweep)}`;
    out.push({ d, color: TRAIT_COLOR[trait], width: 2 + weight * 2.5, opacity: 0.35 + weight * 0.2 });
  };
  for (const sc of SCENARIOS) {
    const o = sc.options.find((x) => x.id === a.s?.[sc.id]);
    if (o) push(`${sc.id}:${o.id}`, traitOf(o.load), 1.4, hash(o.id) % 3);
  }
  for (const st of STATEMENTS) {
    const v = a.t?.[st.id];
    if (v === undefined) continue;
    const strength = Math.abs(AGREE_VALUE[v]) / 1.5;
    push(`${st.id}:${v}`, traitOf(st.load), 0.3 + 0.5 * strength, v >= 2 ? 0 : 1);
  }
  for (const id of [...(a.values ?? []), ...(a.tiles ?? [])]) push(`p:${id}`, "C", 0.4, 2);
  return out;
}
