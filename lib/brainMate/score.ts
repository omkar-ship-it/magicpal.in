import { ARCHETYPES, ARCHETYPE_IDS, TRAITS, TRAIT_INFO, type ArchetypeId, type Trait } from "./archetypes";
import { AGREES, CHECKS, PAIRS, RANKS, SLIDERS, STORY, VALUES, type Loading } from "./rounds";

/**
 * Brain-Mate v3 scoring: five answer formats → eight trait scores →
 * nearest archetype, with double-checks where the formats disagree.
 *
 * Pure and deterministic. The server recomputes everything from the raw
 * answers (a client can't post an archetype); the game runs the same code
 * live for the narrowing ring, the constellation, the double-checks and
 * each duel card.
 *
 * Constants fitted by simulation (scripts/brain-mate-sim): 20,000 synthetic
 * players with known traits answering with realistic noise. There, trait
 * scores correlate 0.86–0.90 with the truth, clearly-high/low traits read
 * right 99% of the time, the true archetype sits in the top-3 mix 93%, and
 * clear types get their archetype 83% (74% on a retake). Refit NORMS and
 * BIAS from real answers once a few hundred people have played.
 */

export const VERSION = 3;

export type DuelAnswer = { a: ArchetypeId; b: ArchetypeId; pick: ArchetypeId };

export type Answers = {
  v: 3;
  /** story beat → option id */
  story: Record<string, string>;
  /** pair id → 1 if the high pole was chosen, 0 if the low one */
  pairs: Record<string, number>;
  /** rank round → card ids, top first */
  ranks: Record<string, string[]>;
  /** agree card → 1 agree, 0 don't */
  agree: Record<string, number>;
  /** slider → -1 (left) … +1 (right), two decimals */
  sliders: Record<string, number>;
  values: string[];
  /** double-check card → 1 agree, 0 don't (only the ones that were asked) */
  checks: Record<string, number>;
  duels: DuelAnswer[];
  ms?: number;
};

export type Traits = Record<Trait, number>;

// Norms from the simulation: all methods, choice-style only, strength-style only.
const NORM = { mu: [0.2432, 0.2993, 0.1164, 0.1713, 0.0954, 0.2272, 0.2039, 0.0543], sd: [0.5887, 0.551, 0.6615, 0.6595, 0.6313, 0.6495, 0.6077, 0.6974] };
const NORM_CHOICE = { mu: [0.277, 0.342, 0.1918, 0.2581, 0.1378, 0.2991, 0.2678, 0.0787], sd: [0.5874, 0.5441, 0.653, 0.6405, 0.6122, 0.6314, 0.5833, 0.6923] };
const NORM_LEVEL = { mu: [0.0065, 0.0003, -0.0013, 0.0084, 0.0027, -0.0018, 0.0009, 0.0085], sd: [1, 1, 0.814, 0.8325, 0.8153, 0.8904, 0.874, 0.8355] };
const BIAS: Record<ArchetypeId, number> = {
  dreamer: 0.105,
  explorer: 0.023,
  creator: 0.044,
  maverick: -0.033,
  detective: -0.01,
  strategist: -0.004,
  spark: -0.013,
  maker: 0.061,
  doer: -0.055,
  connector: 0.012,
  mentor: -0.012,
  peacemaker: -0.118,
};

/** A trait whose choice-style and strength-style scores differ by this much gets double-checked (≈1 player in 4). */
const CONTRADICTION = 1.8;
const MAX_CHECKED_TRAITS = 3;
export const DUEL_COUNT = 3;
const DUEL_STEP = 0.45;

const vec = (t: Partial<Record<Trait, number>>) => TRAITS.map((k) => t[k] ?? 0);
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a: number[]) => Math.sqrt(dot(a, a)) || 1;
const cos = (a: number[], b: number[]) => dot(a, b) / (norm(a) * norm(b));
const PROFILE: Record<ArchetypeId, number[]> = Object.fromEntries(
  ARCHETYPE_IDS.map((id) => [id, vec(ARCHETYPES[id].profile)])
) as Record<ArchetypeId, number[]>;

type Part = "all" | "choice" | "level";

function raw(a: Partial<Answers>, part: Part = "all", withChecks = true): number[] {
  const sum = TRAITS.map(() => 0);
  const n = TRAITS.map(() => 0);
  const add = (load: Loading, value: number, w = 1) =>
    TRAITS.forEach((k, i) => {
      const x = load[k];
      if (!x) return;
      n[i] += Math.abs(x) * w;
      sum[i] += x * value * w;
    });
  if (part !== "level") {
    for (const b of STORY) {
      const chosen = a.story?.[b.id];
      if (chosen === undefined) continue;
      for (const o of b.options) add(o.load, o.id === chosen ? 2 : 0);
    }
    for (const p of PAIRS) {
      const v = a.pairs?.[p.id];
      if (v !== undefined) add({ [p.trait]: 1 }, v ? 1 : -1);
    }
    for (const r of RANKS) {
      const order = a.ranks?.[r.id];
      if (!order) continue;
      const m = order.length;
      order.forEach((cid, pos) => {
        const card = r.cards.find((c) => c.id === cid);
        if (card) add({ [card.trait]: 1 }, 1.5 - (3 * pos) / (m - 1));
      });
    }
  }
  if (part !== "choice") {
    for (const g of AGREES) {
      const v = a.agree?.[g.id];
      if (v !== undefined) add({ [g.trait]: g.sign }, v ? 1 : -1);
    }
    for (const l of SLIDERS) {
      const v = a.sliders?.[l.id];
      if (v !== undefined) add({ [l.trait]: 1 }, v * 1.8, 1.2);
    }
  }
  if (part === "all" && withChecks) {
    for (const c of CHECKS) {
      const v = a.checks?.[c.id];
      if (v !== undefined) add({ [c.trait]: c.sign }, v ? 1 : -1, 1.5);
    }
  }
  return sum.map((x, i) => (n[i] ? x / n[i] : null) as number);
}

function standard(r: number[], nm: { mu: number[]; sd: number[] }): number[] {
  return r.map((x, i) => (x === null ? 0 : (x - nm.mu[i]) / nm.sd[i]));
}

/** Trait scores in standard units (0 = typical, ±1 = one spread away). */
export function traitVector(a: Partial<Answers>): number[] {
  return standard(raw(a), NORM);
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

// --------------------------------------------------------- double-checks
/**
 * The cards to ask when answers contradict: for each trait where the
 * choice-style answers (story, this-or-that, prioritise) and the
 * strength-style answers (agree, sliders) disagree by CONTRADICTION or more,
 * the two double-check cards for that trait — at most three traits, worst
 * first. Empty for consistent players, who skip the section.
 */
export function checksNeeded(a: Partial<Answers>): string[] {
  const zc = standard(raw(a, "choice"), NORM_CHOICE);
  const zl = standard(raw(a, "level"), NORM_LEVEL);
  return TRAITS.map((k, i) => ({ k, gap: Math.abs(zc[i] - zl[i]) }))
    .filter((x) => x.gap >= CONTRADICTION)
    .sort((x, y) => y.gap - x.gap)
    .slice(0, MAX_CHECKED_TRAITS)
    .flatMap((x) => CHECKS.filter((c) => c.trait === x.k).map((c) => c.id));
}

// ------------------------------------------------------------------ duels
export type DuelCard = { a: ArchetypeId; b: ArchetypeId; lineA: string; lineB: string };

/**
 * The next duel card: the current top two (or the next pair down if that
 * pair was already asked), contrasted on the two traits that split their
 * profiles most. Null once all duels are answered.
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
      .map((x) => ((x.d > 0) === positive ? TRAIT_INFO[x.k].hiLine : TRAIT_INFO[x.k].loLine))
      .join(" · ");
  const lineA = line(true);
  const lineB = line(false);
  if (!lineA || !lineB) return { a: A, b: B, lineA: ARCHETYPES[A].superpower, lineB: ARCHETYPES[B].superpower };
  return { a: A, b: B, lineA, lineB };
}

// ------------------------------------------------------------- validation
/**
 * Only answers the game could have produced: every question answered with
 * a real option, every ranking a full ordering, exactly the double-checks
 * the earlier answers call for, and each duel exactly the card those
 * answers lead to. Anything else is refused.
 */
export function cleanAnswers(input: unknown): Answers | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, Record<string, unknown> | unknown[] | number>;
  const obj = (k: string) => (r[k] && typeof r[k] === "object" && !Array.isArray(r[k]) ? (r[k] as Record<string, unknown>) : {});
  const out: Answers = { v: 3, story: {}, pairs: {}, ranks: {}, agree: {}, sliders: {}, values: [], checks: {}, duels: [] };
  const bit = (v: unknown) => (v === 0 || v === 1 ? v : null);

  for (const b of STORY) {
    const v = obj("story")[b.id];
    if (typeof v !== "string" || !b.options.some((o) => o.id === v)) return null;
    out.story[b.id] = v;
  }
  for (const p of PAIRS) {
    const v = bit(obj("pairs")[p.id]);
    if (v === null) return null;
    out.pairs[p.id] = v;
  }
  for (const rr of RANKS) {
    const v = obj("ranks")[rr.id];
    if (!Array.isArray(v) || v.length !== rr.cards.length) return null;
    const ids = v.filter((x): x is string => typeof x === "string");
    if (new Set(ids).size !== rr.cards.length || !rr.cards.every((c) => ids.includes(c.id))) return null;
    out.ranks[rr.id] = ids;
  }
  for (const g of AGREES) {
    const v = bit(obj("agree")[g.id]);
    if (v === null) return null;
    out.agree[g.id] = v;
  }
  for (const l of SLIDERS) {
    const v = Number(obj("sliders")[l.id]);
    if (!Number.isFinite(v) || v < -1 || v > 1) return null;
    out.sliders[l.id] = Math.round(v * 100) / 100;
  }
  const values = Array.isArray(r.values) ? [...new Set(r.values.filter((x): x is string => typeof x === "string"))] : [];
  if (values.length !== 2 || !values.every((id) => VALUES.some((o) => o.id === id))) return null;
  out.values = values;

  const need = checksNeeded(out);
  const given = obj("checks");
  if (Object.keys(given).length !== need.length) return null;
  for (const id of need) {
    const v = bit(given[id]);
    if (v === null) return null;
    out.checks[id] = v;
  }

  const duels = Array.isArray(r.duels) ? (r.duels as Record<string, unknown>[]) : [];
  if (duels.length !== DUEL_COUNT) return null;
  for (const d of duels) {
    const card = nextDuel(out);
    if (!card || d?.a !== card.a || d?.b !== card.b || (d.pick !== card.a && d.pick !== card.b)) return null;
    out.duels.push({ a: card.a, b: card.b, pick: d.pick as ArchetypeId });
  }
  const ms = Number(r.ms);
  if (Number.isFinite(ms) && ms > 0 && ms < 1_800_000) out.ms = Math.round(ms);
  return out;
}

export const isCurrent = (a: unknown): a is Answers => Boolean(a && typeof a === "object" && (a as { v?: number }).v === VERSION);

// ------------------------------------------------------------------ result
export type Result = {
  archetype: ArchetypeId;
  streak: ArchetypeId;
  cusp: boolean;
  /** Top three as percentages summing to 100 — the honest headline. */
  mix: { id: ArchetypeId; pct: number }[];
  traits: Traits;
};

export const toTraits = (z: number[]): Traits =>
  Object.fromEntries(TRAITS.map((k, i) => [k, Math.max(-2.5, Math.min(2.5, z[i]))])) as Traits;

export function resultFor(a: Answers): Result {
  return resultFromVector(withDuels(traitVector(a), a.duels));
}

export function resultFromVector(z: number[]): Result {
  const r = ranked(z);
  const top = r.slice(0, 3);
  const w = top.map((x) => Math.exp(x.c / 0.2));
  const total = w.reduce((s, x) => s + x, 0);
  const pct = w.map((x) => Math.round((x / total) * 100));
  pct[0] += 100 - pct.reduce((s, x) => s + x, 0);
  return {
    archetype: r[0].id,
    streak: r[1].id,
    cusp: r[0].c - r[1].c < 0.05,
    mix: top.map((x, i) => ({ id: x.id, pct: pct[i] })),
    traits: toTraits(z),
  };
}

/** Your traits with the duels applied — what comparisons blend friends' views into. */
export function selfVector(a: Answers): number[] {
  return withDuels(traitVector(a), a.duels);
}

// ------------------------------------------------------ "how did it know"
export type CrowdStats = {
  n: number;
  /** "b3:q", "p5:1" or "g7:1" → share of players who answered that, 0–1. */
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

export const storyLabel = (key: string) => {
  const [bid, oid] = key.split(":");
  return STORY.find((b) => b.id === bid)?.options.find((o) => o.id === oid)?.label ?? "";
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (id: ArchetypeId) => ARCHETYPES[id].name.replace("The ", "");

/**
 * One line that proves the result came from *your* answers. Picked by rule,
 * in a fixed priority order; nothing here is invented.
 */
export function howDidItKnow(a: Answers, stats: CrowdStats | null): string {
  const res = resultFor(a);
  const me = ARCHETYPES[res.archetype];

  // A trait you showed the same way in three different formats.
  const order = TRAITS.map((k) => ({ k, z: res.traits[k] })).sort((x, y) => Math.abs(y.z) - Math.abs(x.z));
  for (const { k, z } of order) {
    if (Math.abs(z) < 1) break;
    const high = z > 0;
    const story = STORY.some((b) => {
      const o = b.options.find((x) => x.id === a.story[b.id]);
      return o && (o.load[k] ?? 0) * (high ? 1 : -1) > 0;
    });
    const pair = PAIRS.some((p) => p.trait === k && a.pairs[p.id] === (high ? 1 : 0));
    const agreed = AGREES.some((g) => g.trait === k && a.agree[g.id] === 1 && g.sign === (high ? 1 : -1));
    const slid = SLIDERS.some((l) => l.trait === k && (a.sliders[l.id] ?? 0) * (high ? 1 : -1) > 0.4);
    const ways = [story, pair, agreed, slid].filter(Boolean).length;
    if (ways >= 3) return `${cap(high ? HIGH_PHRASE[k] : LOW_PHRASE[k])} — you said it ${ways} different ways, without being asked the same thing twice.`;
  }

  if (stats && stats.n >= MIN_CROWD) {
    let rare: { key: string; share: number } | null = null;
    for (const [bid, oid] of Object.entries(a.story)) {
      const share = stats.share[`${bid}:${oid}`];
      if (share !== undefined && share < 0.12 && (!rare || share < rare.share)) rare = { key: `${bid}:${oid}`, share };
    }
    if (rare) return `You chose “${storyLabel(rare.key)}”. Only ${Math.max(1, Math.round(rare.share * 100))}% of people do.`;
  }

  const sorted = TRAITS.map((k) => ({ k, z: res.traits[k] })).sort((x, y) => y.z - x.z);
  const hi = sorted[0];
  const lo = sorted[sorted.length - 1];
  if (hi.z > 0.8 && lo.z < -0.5) return `${cap(HIGH_PHRASE[hi.k])}, and ${LOW_PHRASE[lo.k]}. That mix is what makes ${me.name}.`;

  const last = a.duels[a.duels.length - 1];
  if (last) {
    const other = last.pick === last.a ? last.b : last.a;
    return `It came down to ${short(last.pick)} vs ${short(other)} — and the ${short(other)} in you is why it was close.`;
  }
  return `${cap(HIGH_PHRASE[hi.k])}. That's the heart of ${me.name}.`;
}

/** Words flashed in the recap montage, in the order the day was played. */
export function montageWords(a: Partial<Answers>): string[] {
  return STORY.map((b) => b.options.find((o) => o.id === a.story?.[b.id])?.word).filter((w): w is string => Boolean(w));
}

// ------------------------------------------------------- constellation
/** Fixed star positions for the eight traits, on a 100×100 sky. */
export const STAR_POS: Record<Trait, [number, number]> = {
  O: [50, 10],
  I: [80, 22],
  D: [90, 52],
  S: [76, 82],
  E: [48, 90],
  A: [20, 80],
  C: [10, 50],
  H: [22, 20],
};

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

/**
 * How lit each star is, 0–1: how much evidence there is for that trait so
 * far, scaled by how strongly it's showing. Unlabelled on purpose — the
 * player sees their sky taking shape without being told what it means.
 */
export function starLight(a: Partial<Answers>): Record<Trait, number> {
  const z = traitVector(a);
  const answered = TRAITS.map((k) => {
    let n = 0;
    for (const b of STORY) if (a.story?.[b.id] && b.options.some((o) => o.load[k])) n++;
    n += PAIRS.filter((p) => p.trait === k && a.pairs?.[p.id] !== undefined).length;
    n += RANKS.filter((r) => a.ranks?.[r.id] && r.cards.some((c) => c.trait === k)).length;
    n += AGREES.filter((g) => g.trait === k && a.agree?.[g.id] !== undefined).length;
    n += SLIDERS.filter((l) => l.trait === k && a.sliders?.[l.id] !== undefined).length;
    return Math.min(1, n / 7);
  });
  return Object.fromEntries(TRAITS.map((k, i) => [k, answered[i] * (0.45 + 0.55 * Math.min(1, Math.max(0, (z[i] + 1.5) / 3)))])) as Record<
    Trait,
    number
  >;
}

// ------------------------------------------------------------- the strands
/** The card art: one strand per answer, coloured by the trait it spoke to. */
export type Strand = { d: string; color: string; width: number; opacity: number };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function strandsFor(a: Partial<Answers>, seed = ""): Strand[] {
  const out: Strand[] = [];
  const push = (key: string, trait: Trait, weight: number) => {
    const h = hash(seed + key);
    const angle = ((h % 360) * Math.PI) / 180;
    const sweep = 0.9 + ((h >>> 9) % 100) / 60;
    const r1 = 60 + ((h >>> 3) % 70);
    const r2 = 120 + ((h >>> 13) % 70);
    const p = (r: number, t: number) => `${(200 + r * Math.cos(t)).toFixed(1)} ${(200 + r * Math.sin(t)).toFixed(1)}`;
    const shape = h % 3;
    const d =
      shape === 0
        ? `M ${p(30, angle)} Q ${p(r2, angle + 0.25)} ${p(r2 + 40, angle + 0.05)}`
        : shape === 1
          ? `M ${p(r1, angle)} A ${r1} ${r1} 0 0 1 ${p(r1, angle + sweep)}`
          : `M ${p(r1, angle)} C ${p(r2, angle + sweep / 3)} ${p(r1 * 0.6, angle + (sweep * 2) / 3)} ${p(r2, angle + sweep)}`;
    out.push({ d, color: TRAIT_COLOR[trait], width: 2 + weight * 2.5, opacity: 0.35 + weight * 0.2 });
  };
  for (const b of STORY) {
    const o = b.options.find((x) => x.id === a.story?.[b.id]);
    const k = o ? (Object.keys(o.load)[0] as Trait) : null;
    if (o && k) push(`${b.id}:${o.id}`, k, 1.4);
  }
  for (const p of PAIRS) if (a.pairs?.[p.id] !== undefined) push(`${p.id}:${a.pairs[p.id]}`, p.trait, 0.6);
  for (const r of RANKS) {
    const top = a.ranks?.[r.id]?.[0];
    const card = r.cards.find((c) => c.id === top);
    if (card) push(`${r.id}:${top}`, card.trait, 1);
  }
  for (const g of AGREES) if (a.agree?.[g.id] === 1) push(`${g.id}`, g.trait, 0.5);
  for (const l of SLIDERS) {
    const v = a.sliders?.[l.id];
    if (v !== undefined && Math.abs(v) > 0.4) push(`${l.id}:${Math.sign(v)}`, l.trait, 0.8);
  }
  return out;
}
