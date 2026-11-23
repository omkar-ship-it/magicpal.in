import { ARCHETYPES, ARCHETYPE_IDS, TRAITS, TRAIT_INFO, type ArchetypeId, type Trait } from "./archetypes";
import { CALLS, CHECKS, ENERGY, RANKS, RATHER, SLIDERS, TENDENCIES, TENDENCY_VALUE, VALUES, type Loading } from "./rounds";

/**
 * Brain-Mate v4 scoring: five answer formats → eight trait scores →
 * nearest archetype, with double-checks where the formats disagree.
 *
 * Pure and deterministic. The server recomputes everything from the raw
 * answers; the game runs the same code live for the narrowing ring, the
 * constellation, the double-checks and each duel card.
 *
 * Constants fitted by simulation (scripts/brain-mate-sim: final4/export4).
 * Refit NORM and BIAS from real answers once a few hundred people have
 * played — and use the optional "energy" answer to check no life stage is
 * being nudged toward particular archetypes.
 */

export const VERSION = 4;

export type DuelAnswer = { a: ArchetypeId; b: ArchetypeId; pick: ArchetypeId };

export type Answers = {
  v: 4;
  /** would-you-rather id → 1 if the high end was chosen */
  rather: Record<string, number>;
  /** tendency id → 0..3 (Rarely … Almost always) */
  tend: Record<string, number>;
  /** tough call id → "a" | "b" */
  calls: Record<string, string>;
  /** rank round → card ids, top first */
  ranks: Record<string, string[]>;
  /** slider → -1 … +1 */
  sliders: Record<string, number>;
  values: string[];
  /** double-check card → 1 agree, 0 not me (only those asked) */
  checks: Record<string, number>;
  duels: DuelAnswer[];
  ms?: number;
  /** Optional, after the reveal, never scored. */
  energy?: string;
};

export type Traits = Record<Trait, number>;

const NORM = { mu: [-0.0009, -0.002, -0.0006, -0.002, 0.0051, 0.0004, 0.0016, -0.0069], sd: [0.7191, 0.6879, 0.6999, 0.8112, 0.7745, 0.7682, 0.7321, 0.7861] };
const NORM_CHOICE = { mu: [0.0008, -0.0008, -0.002, 0.0002, 0.0071, 0.0018, -0.0003, -0.0057], sd: [0.6946, 0.6538, 0.6684, 0.789, 0.7635, 0.7422, 0.7014, 0.7553] };
const NORM_LEVEL = { mu: [-0.0078, -0.0066, 0.0029, -0.0056, 0.0018, -0.0025, 0.0055, -0.0094], sd: [1.1315, 1.1371, 0.9576, 0.9981, 0.9584, 0.9796, 0.9609, 0.9998] };
const BIAS: Record<ArchetypeId, number> = {
  dreamer: 0.126,
  explorer: -0.021,
  creator: 0.139,
  maverick: -0.069,
  detective: -0.002,
  strategist: -0.011,
  spark: -0.027,
  maker: 0.051,
  doer: -0.094,
  connector: 0.014,
  mentor: 0.012,
  peacemaker: -0.118,
};

/** Choice-style vs strength-style disagreement that triggers double-checks (≈1 player in 4). */
const CONTRADICTION = 1.7;
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

function raw(a: Partial<Answers>, part: Part = "all"): (number | null)[] {
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
    for (const r of RATHER) {
      const v = a.rather?.[r.id];
      if (v !== undefined) add({ [r.trait]: 1 }, v ? 1 : -1, 1.2);
    }
    for (const c of CALLS) {
      const v = a.calls?.[c.id];
      if (v === undefined) continue;
      add({ [c.a.trait]: 1 }, v === "a" ? 1 : -1);
      add({ [c.b.trait]: 1 }, v === "b" ? 1 : -1);
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
    for (const t of TENDENCIES) {
      const v = a.tend?.[t.id];
      if (v !== undefined) add({ [t.trait]: 1 }, TENDENCY_VALUE[v], 1.3);
    }
    for (const l of SLIDERS) {
      const v = a.sliders?.[l.id];
      if (v !== undefined) add({ [l.trait]: 1 }, v * 1.8, 1.2);
    }
  }
  if (part === "all") {
    for (const c of CHECKS) {
      const v = a.checks?.[c.id];
      if (v !== undefined) add({ [c.trait]: c.sign }, v ? 1 : -1, 1.5);
    }
  }
  return sum.map((x, i) => (n[i] ? x / n[i] : null));
}

function standard(r: (number | null)[], nm: { mu: number[]; sd: number[] }): number[] {
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

export function stillInPlay(a: Partial<Answers>, fraction: number): ArchetypeId[] {
  const keep = Math.max(2, Math.round(12 - 10 * Math.min(1, fraction)));
  return ranked(withDuels(traitVector(a), a.duels ?? []))
    .slice(0, keep)
    .map((x) => x.id);
}

/**
 * Double-checks: for each trait where choice-style answers (would you
 * rather, tough calls, prioritise) and strength-style answers (is this you,
 * sliders) disagree sharply, the two check cards for it — at most three
 * traits, worst first. Empty for consistent players.
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

export type DuelCard = { a: ArchetypeId; b: ArchetypeId; lineA: string; lineB: string };

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

/** Only answers the game could have produced; anything else is refused. */
export function cleanAnswers(input: unknown): Answers | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const obj = (k: string) => (r[k] && typeof r[k] === "object" && !Array.isArray(r[k]) ? (r[k] as Record<string, unknown>) : {});
  const out: Answers = { v: 4, rather: {}, tend: {}, calls: {}, ranks: {}, sliders: {}, values: [], checks: {}, duels: [] };
  const bit = (v: unknown) => (v === 0 || v === 1 ? v : null);
  for (const x of RATHER) {
    const v = bit(obj("rather")[x.id]);
    if (v === null) return null;
    out.rather[x.id] = v;
  }
  for (const t of TENDENCIES) {
    const v = obj("tend")[t.id];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 3) return null;
    out.tend[t.id] = v;
  }
  for (const c of CALLS) {
    const v = obj("calls")[c.id];
    if (v !== "a" && v !== "b") return null;
    out.calls[c.id] = v;
  }
  for (const rr of RANKS) {
    const v = obj("ranks")[rr.id];
    if (!Array.isArray(v) || v.length !== rr.cards.length) return null;
    const ids = v.filter((x): x is string => typeof x === "string");
    if (new Set(ids).size !== rr.cards.length || !rr.cards.every((c) => ids.includes(c.id))) return null;
    out.ranks[rr.id] = ids;
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

export const isEnergy = (v: unknown): v is string => typeof v === "string" && ENERGY.some((e) => e.id === v);
export const isCurrent = (a: unknown): a is Answers => Boolean(a && typeof a === "object" && (a as { v?: number }).v === VERSION);

// ------------------------------------------------------------------ result
export type Result = {
  archetype: ArchetypeId;
  streak: ArchetypeId;
  cusp: boolean;
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
  return { archetype: r[0].id, streak: r[1].id, cusp: r[0].c - r[1].c < 0.05, mix: top.map((x, i) => ({ id: x.id, pct: pct[i] })), traits: toTraits(z) };
}

export function selfVector(a: Answers): number[] {
  return withDuels(traitVector(a), a.duels);
}

export const mixLine = (mix: Result["mix"]) => mix.map((m) => `${m.pct}% ${ARCHETYPES[m.id].name.replace("The ", "")}`).join(" · ");

// ------------------------------------------------------- how you show up
/**
 * Three practical lines built from the person's own trait scores — what
 * they're like in a team, in conversation and under pressure. Always
 * framed as how they help, never as a deficit.
 */
export function showUp(t: Traits): { team: string; talk: string; pressure: string } {
  const team =
    t.A >= 0.6 && t.D >= 0.4
      ? "You set the direction and see it through."
      : t.A >= 0.6
        ? "You're the one who makes the call when everyone's stuck."
        : t.D >= 0.6
          ? "You're the one who gets it over the line."
          : t.O >= 0.6
            ? "You bring the ideas nobody else thought of."
            : t.H >= 0.6
              ? "You're the glue — people work better with you around."
              : t.I >= 0.6
                ? "You ask the question that saves everyone a week."
                : t.S >= 0.6
                  ? "You turn a mess into a plan people can follow."
                  : "You fit the gap — whatever the team is missing, you lean into it.";
  const talk =
    t.E >= 0.6 && t.C >= 0.4
      ? "You light up a room and make everyone in it feel included."
      : t.E >= 0.6
        ? "You get conversations going — and keep them going."
        : t.E <= -0.6 && t.C >= 0.4
          ? "You go deep with one person rather than wide with ten — and they remember it."
          : t.E <= -0.6
            ? "You listen more than you talk, so when you speak, people lean in."
            : t.C >= 0.6
              ? "People open up to you — you notice what isn't being said."
              : t.I >= 0.6
                ? "Your questions make conversations better."
                : "You read the room and meet people where they are.";
  const pressure =
    t.H >= 0.6
      ? "You keep people together when it gets tense."
      : t.H <= -0.6
        ? "You say the hard thing early, so it doesn't become a bigger one."
        : t.S >= 0.6
          ? "You go back to the plan, and calm spreads from there."
          : t.D >= 0.6
            ? "You put your head down and get it done."
            : t.O >= 0.6
              ? "You find another way round when the obvious one is blocked."
              : t.C >= 0.6
                ? "You check everyone's okay before you check the deadline."
                : "You stay steady and adapt to what's in front of you.";
  return { team, talk, pressure };
}

// ------------------------------------------------------ "how did it know"
export type CrowdStats = {
  n: number;
  /** "w3:1", "t5:3", "c2:a" → share of players, 0–1. */
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

export const callLabel = (key: string) => {
  const [cid, side] = key.split(":");
  const c = CALLS.find((x) => x.id === cid);
  return c ? (side === "a" ? c.a.label : c.b.label) : "";
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (id: ArchetypeId) => ARCHETYPES[id].name.replace("The ", "");

export function howDidItKnow(a: Answers, stats: CrowdStats | null): string {
  const res = resultFor(a);
  const me = ARCHETYPES[res.archetype];
  const order = TRAITS.map((k) => ({ k, z: res.traits[k] })).sort((x, y) => Math.abs(y.z) - Math.abs(x.z));
  for (const { k, z } of order) {
    if (Math.abs(z) < 1) break;
    const high = z > 0;
    const rather = RATHER.some((x) => x.trait === k && a.rather[x.id] === (high ? 1 : 0));
    const tend = TENDENCIES.some((x) => x.trait === k && (high ? a.tend[x.id] >= 2 : a.tend[x.id] <= 1));
    const call = CALLS.some((c) => {
      const chosen = a.calls[c.id] === "a" ? c.a.trait : c.b.trait;
      const passed = a.calls[c.id] === "a" ? c.b.trait : c.a.trait;
      return high ? chosen === k : passed === k;
    });
    const slid = SLIDERS.some((l) => l.trait === k && (a.sliders[l.id] ?? 0) * (high ? 1 : -1) > 0.4);
    const ways = [rather, tend, call, slid].filter(Boolean).length;
    if (ways >= 3) return `${cap(high ? HIGH_PHRASE[k] : LOW_PHRASE[k])} — you said it ${ways} different ways, without being asked the same thing twice.`;
  }
  if (stats && stats.n >= MIN_CROWD) {
    let rare: { key: string; share: number } | null = null;
    for (const [cid, side] of Object.entries(a.calls)) {
      const share = stats.share[`${cid}:${side}`];
      if (share !== undefined && share < 0.2 && (!rare || share < rare.share)) rare = { key: `${cid}:${side}`, share };
    }
    if (rare) return `On a tough call you chose “${callLabel(rare.key)}”. Only ${Math.max(1, Math.round(rare.share * 100))}% of people do.`;
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

/** Words flashed in the recap montage — from the tough calls, in order. */
export function montageWords(a: Partial<Answers>): string[] {
  return CALLS.map((c) => {
    const side = a.calls?.[c.id];
    return side === "a" ? c.a.label : side === "b" ? c.b.label : null;
  })
    .filter((w): w is string => Boolean(w))
    .map((w) => (w.length > 26 ? `${w.split(" ").slice(0, 4).join(" ")}…` : w));
}

// ------------------------------------------------------- constellation
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

export function starLight(a: Partial<Answers>): Record<Trait, number> {
  const z = traitVector(a);
  const answered = TRAITS.map((k) => {
    let n = 0;
    n += RATHER.filter((x) => x.trait === k && a.rather?.[x.id] !== undefined).length;
    n += TENDENCIES.filter((x) => x.trait === k && a.tend?.[x.id] !== undefined).length;
    n += CALLS.filter((c) => a.calls?.[c.id] && (c.a.trait === k || c.b.trait === k)).length;
    n += RANKS.filter((r) => a.ranks?.[r.id] && r.cards.some((c) => c.trait === k)).length;
    n += SLIDERS.filter((l) => l.trait === k && a.sliders?.[l.id] !== undefined).length;
    return Math.min(1, n / 6);
  });
  return Object.fromEntries(TRAITS.map((k, i) => [k, answered[i] * (0.45 + 0.55 * Math.min(1, Math.max(0, (z[i] + 1.5) / 3)))])) as Record<Trait, number>;
}

// ------------------------------------------------------------- the strands
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
  for (const x of RATHER) if (a.rather?.[x.id] !== undefined) push(`${x.id}:${a.rather[x.id]}`, x.trait, a.rather[x.id] ? 1 : 0.5);
  for (const t of TENDENCIES) {
    const v = a.tend?.[t.id];
    if (v !== undefined && v >= 2) push(`${t.id}:${v}`, t.trait, v === 3 ? 1.2 : 0.7);
  }
  for (const c of CALLS) {
    const side = a.calls?.[c.id];
    if (side) push(`${c.id}:${side}`, side === "a" ? c.a.trait : c.b.trait, 1.4);
  }
  for (const r of RANKS) {
    const card = r.cards.find((c) => c.id === a.ranks?.[r.id]?.[0]);
    if (card) push(`${r.id}:${card.id}`, card.trait, 1);
  }
  for (const l of SLIDERS) {
    const v = a.sliders?.[l.id];
    if (v !== undefined && Math.abs(v) > 0.4) push(`${l.id}:${Math.sign(v)}`, l.trait, 0.8);
  }
  return out;
}
