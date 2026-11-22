import {
  ARCHETYPES,
  GRID,
  MODES,
  REALMS,
  REALM_COLOR,
  isArchetypeId,
  type ArchetypeId,
  type Mode,
  type Realm,
} from "./archetypes";
import { PICK_ROUNDS, ROUNDS, SINGLE_ROUNDS, SWIPE_ROUND, type Effect } from "./rounds";

/**
 * Brain-Mate scoring: answers in, archetype out.
 *
 * Deterministic and pure. The same answers always give the same result, the
 * server recomputes everything from the raw answers (a client cannot post an
 * archetype), and the game runs the same code live to drive the narrowing
 * ring — so what the player watches shrink is exactly what decides them.
 */

export type Answers = {
  r1?: string;
  r2?: string;
  r3?: string;
  r4?: string;
  /** Lightning round: card id → chosen option id. */
  r5?: Record<string, string>;
  r6?: string;
  r7?: string;
  r8?: string[];
  r9?: string[];
  /** The archetype picked in the final duel. */
  duel?: ArchetypeId;
  /** How long the lightning round took, for the "gut speed" line. */
  lightningMs?: number;
};

export type Points = Record<Realm | Mode, number>;

const zero = (): Points => ({
  imagine: 0,
  reason: 0,
  act: 0,
  relate: 0,
  ignite: 0,
  seek: 0,
  steady: 0,
});

function add(p: Points, e: Effect | undefined) {
  if (!e) return;
  for (const [k, v] of Object.entries(e)) p[k as keyof Points] += v ?? 0;
}

/** Raw axis points from everything answered so far (the duel excluded). */
export function pointsFor(a: Answers): Points {
  const p = zero();
  for (const r of SINGLE_ROUNDS) {
    const chosen = a[r.id];
    add(p, r.options.find((o) => o.id === chosen)?.effect);
  }
  for (const c of SWIPE_ROUND.cards) {
    const chosen = a.r5?.[c.id];
    if (chosen === c.left.id) add(p, c.left.effect);
    if (chosen === c.right.id) add(p, c.right.effect);
  }
  for (const r of PICK_ROUNDS) {
    for (const id of a[r.id] ?? []) add(p, r.options.find((o) => o.id === id)?.effect);
  }
  return p;
}

const DUEL_BONUS = 4;

/** Every archetype ranked, best first. Ties break on grid order, so it is stable. */
export function ranking(a: Answers, withDuel = true): { id: ArchetypeId; score: number }[] {
  const p = pointsFor(a);
  const out: { id: ArchetypeId; score: number }[] = [];
  for (const r of REALMS)
    for (const m of MODES) {
      const id = GRID[r][m];
      out.push({ id, score: p[r] + p[m] + (withDuel && a.duel === id ? DUEL_BONUS : 0) });
    }
  return out
    .map((x, i) => ({ ...x, i }))
    .sort((x, y) => y.score - x.score || x.i - y.i)
    .map(({ id, score }) => ({ id, score }));
}

/** How many silhouettes stay lit after each round — the narrowing ring. */
export const ALIVE_AFTER = [12, 10, 8, 7, 6, 5, 4, 3, 3, 2];

export function aliveAfter(a: Answers, roundsDone: number): ArchetypeId[] {
  const k = ALIVE_AFTER[Math.min(roundsDone, ALIVE_AFTER.length - 1)];
  return ranking(a, false)
    .slice(0, k)
    .map((x) => x.id);
}

// ---------------------------------------------------------------- duel
export type Duel = {
  kind: "mode" | "realm" | "superpower";
  prompt: string;
  a: ArchetypeId;
  b: ArchetypeId;
  lineA: string;
  lineB: string;
};

const DUEL_STEM: Record<Mode, string> = {
  ignite: "You leave a great evening having…",
  seek: "Your perfect afternoon:",
  steady: "What you're quietly proudest of:",
};

/** The final round, built from the two archetypes this player is closest to. */
export function duelFor(a: Answers): Duel {
  const [first, second] = ranking(a, false);
  const A = ARCHETYPES[first.id];
  const B = ARCHETYPES[second.id];
  if (A.realm === B.realm)
    return { kind: "mode", prompt: "Last one. Which is more you?", a: A.id, b: B.id, lineA: A.modeLine, lineB: B.modeLine };
  if (A.mode === B.mode)
    return { kind: "realm", prompt: DUEL_STEM[A.mode], a: A.id, b: B.id, lineA: A.realmLine, lineB: B.realmLine };
  return {
    kind: "superpower",
    prompt: "Which would your friends say about you?",
    a: A.id,
    b: B.id,
    lineA: A.superpower,
    lineB: B.superpower,
  };
}

// ------------------------------------------------------------ validation
/**
 * Accepts only answers the game could have produced: every round answered
 * with a real option, picks of the right size, and a duel between the two
 * archetypes those answers actually lead to. Anything else is refused, so
 * the stored record is always a real play.
 */
export function cleanAnswers(raw: unknown): Answers | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: Answers = {};
  for (const round of SINGLE_ROUNDS) {
    const v = r[round.id];
    if (typeof v !== "string" || !round.options.some((o) => o.id === v)) return null;
    out[round.id] = v;
  }
  const swipes = r.r5 as Record<string, unknown> | undefined;
  if (!swipes || typeof swipes !== "object") return null;
  out.r5 = {};
  for (const c of SWIPE_ROUND.cards) {
    const v = swipes[c.id];
    if (v !== c.left.id && v !== c.right.id) return null;
    out.r5[c.id] = v;
  }
  for (const round of PICK_ROUNDS) {
    const v = r[round.id];
    if (!Array.isArray(v)) return null;
    const ids = [...new Set(v.filter((x): x is string => typeof x === "string"))];
    if (ids.length !== round.count || !ids.every((id) => round.options.some((o) => o.id === id))) return null;
    out[round.id] = ids;
  }
  const duel = duelFor(out);
  if (!isArchetypeId(r.duel) || (r.duel !== duel.a && r.duel !== duel.b)) return null;
  out.duel = r.duel;
  const ms = Number(r.lightningMs);
  if (Number.isFinite(ms) && ms > 0 && ms < 600_000) out.lightningMs = Math.round(ms);
  return out;
}

// ---------------------------------------------------------------- result
export type Sliders = {
  /** -1 gut / intuition … +1 evidence */
  think: number;
  /** -1 one-to-one … +1 crowd */
  connect: number;
  /** -1 ideas … +1 execution */
  work: number;
  /** -1 starter … +1 finisher */
  pace: number;
};

export type Result = {
  archetype: ArchetypeId;
  streak: ArchetypeId;
  /** Top three archetypes as percentages summing to 100. */
  mix: { id: ArchetypeId; pct: number }[];
  sliders: Sliders;
  values: string[];
  tiles: string[];
};

const ratio = (plus: number, minus: number) => (plus + minus === 0 ? 0 : (plus - minus) / (plus + minus));

export function slidersFor(a: Answers): Sliders {
  const p = pointsFor(a);
  const room = a.r4 === "ignite" ? 1 : a.r4 === "seek" ? 0.15 : -1;
  return {
    think: ratio(p.reason, p.imagine),
    connect: Math.max(-1, Math.min(1, room * 0.75 + ratio(p.relate, p.reason) * 0.25)),
    work: ratio(p.act, (p.imagine + p.reason) / 2),
    pace: ratio(p.steady, p.ignite),
  };
}

export function resultFor(a: Answers): Result {
  const ranked = ranking(a, true);
  const top = ranked.slice(0, 3);
  // Squared so the winner reads as a winner: three near-equal thirds would
  // say "you are nothing in particular", which is untrue and unshareable.
  const weights = top.map((x) => Math.max(0.5, x.score) ** 2);
  const total = weights.reduce((s, w) => s + w, 0);
  const pcts = weights.map((w) => Math.round((w / total) * 100));
  pcts[0] += 100 - pcts.reduce((s, x) => s + x, 0);
  return {
    archetype: ranked[0].id,
    streak: ranked[1].id,
    mix: top.map((x, i) => ({ id: x.id, pct: pcts[i] })),
    sliders: slidersFor(a),
    values: a.r8 ?? [],
    tiles: a.r9 ?? [],
  };
}

// ------------------------------------------------------ "how did it know"
export type CrowdStats = {
  /** Players counted. Below MIN_CROWD the split lines stay hidden. */
  n: number;
  /** "r1:imagine" → share of players who picked it, 0–1. */
  share: Record<string, number>;
  /** archetype → share of players, 0–1. */
  archetypes: Record<string, number>;
};

export const MIN_CROWD = 20;

const OPTION_LABEL = new Map<string, string>();
for (const r of SINGLE_ROUNDS) for (const o of r.options) OPTION_LABEL.set(`${r.id}:${o.id}`, o.label);
for (const c of SWIPE_ROUND.cards) {
  OPTION_LABEL.set(`r5:${c.id}:${c.left.id}`, c.left.label);
  OPTION_LABEL.set(`r5:${c.id}:${c.right.id}`, c.right.label);
}
export const optionLabel = (key: string) => OPTION_LABEL.get(key) ?? "";

/** Row × a mode answer that pulls the other way → one personal line. */
const MIXED: { realm: Realm; key: string; line: string }[] = [
  { realm: "reason", key: "r2:ignite", line: "Careful thinker. Reckless with domains." },
  { realm: "reason", key: "r4:ignite", line: "You think like a detective but walk into a room like a spark. Nobody sees the questions coming." },
  { realm: "reason", key: "r4:steady", line: "You don't small-talk. You cross-examine, kindly." },
  { realm: "imagine", key: "r7:ignite", line: "You don't just imagine the future. You'll fight for it." },
  { realm: "imagine", key: "r7:steady", line: "Big dreams, and no need to win the argument about them." },
  { realm: "imagine", key: "r5:s4:follow", line: "A dreamer with a route planned. Rare, and a little dangerous." },
  { realm: "act", key: "r2:seek", line: "You research like a detective, then build anyway." },
  { realm: "act", key: "r4:steady", line: "Quiet in the room, loud in the work." },
  { realm: "relate", key: "r4:ignite", line: "You don't find your people. You assemble them." },
  { realm: "relate", key: "r3:act", line: "A people person with a toolbox." },
  { realm: "relate", key: "r4:steady", line: "You don't work the room. You change one person's night." },
];

function picked(a: Answers): string[] {
  const keys: string[] = [];
  for (const r of SINGLE_ROUNDS) if (a[r.id]) keys.push(`${r.id}:${a[r.id]}`);
  for (const c of SWIPE_ROUND.cards) if (a.r5?.[c.id]) keys.push(`r5:${c.id}:${a.r5[c.id]}`);
  return keys;
}

/**
 * One line that proves the result came from *your* answers. Facts are
 * picked by rule, in a fixed priority order; nothing here is invented.
 */
export function howDidItKnow(a: Answers, stats: CrowdStats | null): string {
  const res = resultFor(a);
  const me = ARCHETYPES[res.archetype];
  const keys = new Set(picked(a));

  const mixed = MIXED.find((m) => m.realm === me.realm && keys.has(m.key));
  if (mixed) return mixed.line;

  const realmRounds = [a.r1, a.r3, a.r6];
  if (realmRounds.every((x) => x && x === realmRounds[0])) {
    const word = { imagine: "Imagination", reason: "The puzzle", act: "Building", relate: "People" }[realmRounds[0] as Realm];
    return `${word}, three times out of three. You don't do it sometimes — it's who you are.`;
  }

  if (stats && stats.n >= MIN_CROWD) {
    let rare: { key: string; share: number } | null = null;
    for (const k of keys) {
      const s = stats.share[k];
      if (s !== undefined && s < 0.12 && (!rare || s < rare.share)) rare = { key: k, share: s };
    }
    if (rare)
      return `You picked “${optionLabel(rare.key)}”. Only ${Math.max(1, Math.round(rare.share * 100))}% of people do.`;
  }

  if (a.lightningMs && a.lightningMs < 8_000)
    return `${Math.max(1, Math.round(a.lightningMs / 1000))} seconds for the lightning round. You trust your gut, and it trusts you back.`;
  if (a.lightningMs && a.lightningMs > 20_000) return "You thought about every single swipe. Of course you did.";

  const other = ARCHETYPES[res.streak];
  return `It came down to ${me.name.replace("The ", "")} vs ${other.name.replace("The ", "")}. You chose ${me.name.replace("The ", "")} — and the ${other.name.replace("The ", "")} in you is why it was close.`;
}

/** Keywords flashed in the recap montage, in the order they were answered. */
export { MONTAGE } from "./rounds";

// ------------------------------------------------------------ the strands
/**
 * The generative art behind every card: one strand per answer, coloured by
 * the row it pointed at and shaped by the column. Deterministic from the
 * answers, so two Dreamers never share a card and the same person always
 * gets the same one.
 */
export type Strand = { d: string; color: string; width: number; opacity: number };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function effectColor(e: Effect | undefined): string {
  if (!e) return "#999";
  for (const r of REALMS) if (e[r]) return REALM_COLOR[r];
  if (e.ignite) return "#FF6B4A";
  if (e.seek) return "#0EA5B8";
  return "#8D7B72";
}

/** Strands on a 400×400 canvas centred at 200,200. */
export function strandsFor(a: Answers, seed = ""): Strand[] {
  const out: Strand[] = [];
  const push = (key: string, e: Effect | undefined, weight: number) => {
    const h = hash(seed + key);
    const angle = ((h % 360) * Math.PI) / 180;
    const sweep = 0.9 + ((h >>> 9) % 100) / 60;
    const r1 = 60 + ((h >>> 3) % 70);
    const r2 = 120 + ((h >>> 13) % 70);
    const p = (r: number, t: number) => `${(200 + r * Math.cos(t)).toFixed(1)} ${(200 + r * Math.sin(t)).toFixed(1)}`;
    const isSteady = e?.steady !== undefined;
    const isIgnite = e?.ignite !== undefined;
    const d = isIgnite
      ? `M ${p(30, angle)} Q ${p(r2, angle + 0.25)} ${p(r2 + 40, angle + 0.05)}`
      : isSteady
        ? `M ${p(r1, angle)} A ${r1} ${r1} 0 0 1 ${p(r1, angle + sweep)}`
        : `M ${p(r1, angle)} C ${p(r2, angle + sweep / 3)} ${p(r1 * 0.6, angle + (sweep * 2) / 3)} ${p(r2, angle + sweep)}`;
    out.push({ d, color: effectColor(e), width: 2 + weight * 2.5, opacity: 0.35 + weight * 0.2 });
  };
  for (const round of ROUNDS) {
    if (round.kind === "cards") {
      const o = round.options.find((x) => x.id === a[round.id]);
      if (o) push(`${round.id}:${o.id}`, o.effect, 1.4);
    } else if (round.kind === "swipe") {
      for (const c of round.cards) {
        const v = a.r5?.[c.id];
        const o = v === c.left.id ? c.left : v === c.right.id ? c.right : null;
        if (o) push(`r5:${c.id}:${o.id}`, o.effect, 0.6);
      }
    } else {
      for (const id of a[round.id] ?? []) push(`${round.id}:${id}`, round.options.find((x) => x.id === id)?.effect, 0.4);
    }
  }
  return out;
}
