import { ARCHETYPES, matrixCode, type ArchetypeId, type MatrixCode } from "./archetypes";
import { PICK_ROUNDS, SINGLE_ROUNDS, SWIPE_ROUND, TILE_ACTIVITY } from "./rounds";
import { optionLabel, resultFor, type Answers, type CrowdStats, MIN_CROWD, type Sliders } from "./score";

/**
 * Two people's Wavelength: how alike they are, how well they complement
 * each other, and which of five relationships that adds up to.
 *
 * The two scores measure different things and must never be confused:
 *
 *   Same wavelength (similarity) — overlap of answers, weighted so that a
 *     shared *rare* answer counts for more than a shared common one.
 *   Compatibility — how the differences fit: ideas meeting execution, a
 *     starter meeting a finisher, compatible social styles, and (when both
 *     have an OpenNetworks profile) one person's needs meeting the other's
 *     offers.
 *
 * The scores decide the outcome; the archetype matrix only breaks ties in
 * the middle band, so the story and the numbers rarely contradict.
 */

export type Person = {
  name: string;
  answers: Answers;
  /** From the OpenNetworks profile, when filled in — never asked by the game. */
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
  a: { name: string; archetype: ArchetypeId; streak: ArchetypeId; sliders: Sliders };
  b: { name: string; archetype: ArchetypeId; streak: ArchetypeId; sliders: Sliders };
  similarity: number;
  compatibility: number;
  /** Per-layer similarity, 0–100, for the breakdown bars. */
  layers: { label: string; value: number }[];
  /** Null when either person hasn't said what they need and offer. */
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
  /** Colleague view: how to work with each other. */
  workWith: { aToB: string; bToA: string };
  /** Every round side by side, for the replay. */
  replay: { title: string; a: string; b: string; same: boolean }[];
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const jaccard = (x: string[] = [], y: string[] = []) => {
  const a = new Set(x);
  const b = new Set(y);
  const inter = [...a].filter((v) => b.has(v)).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 0;
};

/**
 * Display scale. Raw scores bunch in the middle (everyone shares *some*
 * answers), so each is stretched across 32–98 from its observed range.
 * Nobody sees below 32: a low number is a different story, never a
 * rejection.
 */
const display = (raw: number, lo: number, span: number) => Math.round(32 + 66 * clamp01((raw - lo) / span));

const MATRIX_FIT: Record<MatrixCode, number> = { PD: 1, GC: 0.6, BM: 0.55, BC: 0.5, FF: 0.45 };

function rarity(key: string, k: number, stats: CrowdStats | null): number {
  // How much a shared answer is worth relative to an evenly-split one.
  if (!stats || stats.n < MIN_CROWD) return 1;
  const p = (stats.share[key] ?? 1 / k) * 0.9 + 0.1 / k;
  return Math.max(0.6, Math.min(1.6, -Math.log(p) / Math.log(k)));
}

function first(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function compare(pa: Person, pb: Person, stats: CrowdStats | null = null): Comparison {
  const ra = resultFor(pa.answers);
  const rb = resultFor(pb.answers);
  const A = ARCHETYPES[ra.archetype];
  const B = ARCHETYPES[rb.archetype];
  const an = first(pa.name);
  const bn = first(pb.name);

  // ------------------------------------------------------ similarity
  let agree = 0;
  let rarest: { key: string; w: number } | null = null;
  for (const r of SINGLE_ROUNDS) {
    const x = pa.answers[r.id];
    if (x && x === pb.answers[r.id]) {
      const key = `${r.id}:${x}`;
      const w = rarity(key, r.options.length, stats);
      agree += w;
      if (!rarest || w > rarest.w) rarest = { key, w };
    }
  }
  const agreePart = clamp01(agree / SINGLE_ROUNDS.length);
  const swipesSame = SWIPE_ROUND.cards.filter((c) => pa.answers.r5?.[c.id] === pb.answers.r5?.[c.id]).length;
  const swipePart = swipesSame / SWIPE_ROUND.cards.length;
  const valuesPart = jaccard(pa.answers.r8, pb.answers.r8);
  const tilesPart = jaccard(pa.answers.r9, pb.answers.r9);
  const s1 = ra.sliders;
  const s2 = rb.sliders;
  const sliderPart =
    1 - (Math.abs(s1.think - s2.think) + Math.abs(s1.connect - s2.connect) + Math.abs(s1.work - s2.work) + Math.abs(s1.pace - s2.pace)) / 8;
  const simRaw = 0.35 * agreePart + 0.15 * swipePart + 0.1 * valuesPart + 0.15 * tilesPart + 0.25 * sliderPart;
  const similarity = display(simRaw, 0.18, 0.52);

  const pct = (x: number) => Math.round(clamp01(x) * 100);
  const layers = [
    { label: "Think", value: pct(1 - Math.abs(s1.think - s2.think) / 2) },
    { label: "Drive", value: pct(valuesPart * 0.7 + (pa.answers.r6 === pb.answers.r6 ? 0.3 : 0)) },
    { label: "Connect", value: pct(1 - Math.abs(s1.connect - s2.connect) / 2) },
    { label: "Work", value: pct(1 - (Math.abs(s1.work - s2.work) + Math.abs(s1.pace - s2.pace)) / 4) },
    { label: "Play", value: pct(tilesPart) },
  ];

  // --------------------------------------------------- compatibility
  const workComp = Math.abs(s1.work - s2.work) / 2;
  const paceComp = Math.abs(s1.pace - s2.pace) / 2;
  const social = 1 - Math.abs(s1.connect - s2.connect) / 2;
  const code = matrixCode(A.id, B.id);
  let compRaw = 0.3 * workComp + 0.2 * paceComp + 0.15 * social + 0.25 * MATRIX_FIT[code] + 0.1 * valuesPart;

  const intentKnown = Boolean(
    pa.lookingFor?.length && pa.canHelpWith?.length && pb.lookingFor?.length && pb.canHelpWith?.length
  );
  let missing: { needer: string; giver: string } | null = null;
  if (intentKnown) {
    const aGets = pa.lookingFor!.filter((t) => pb.canHelpWith!.includes(t)).length;
    const bGets = pb.lookingFor!.filter((t) => pa.canHelpWith!.includes(t)).length;
    const intent = clamp01((aGets + bGets) / 2);
    compRaw = 0.75 * compRaw + 0.25 * intent;
    if (pb.canHelpWith!.includes(pa.lookingFor![0])) missing = { needer: an, giver: bn };
    else if (pa.canHelpWith!.includes(pb.lookingFor![0])) missing = { needer: bn, giver: an };
  }
  const compatibility = display(compRaw, 0.17, 0.5);

  // --------------------------------------------------------- outcome
  const near = (x: number, edges: number[]) => edges.some((e) => Math.abs(x - e) < 5);
  let outcome: Outcome;
  if (missing && compatibility >= 65) outcome = "missing_piece";
  else if (similarity >= 70 && compatibility <= similarity) outcome = "mind_twins";
  else if (compatibility >= 75 && compatibility > similarity) outcome = "power_duo";
  else if (similarity < 50 && compatibility >= 50) outcome = "friendly_friction";
  else if (similarity < 50 && compatibility < 50) outcome = "beautiful_chaos";
  else outcome = fromMatrix(code, similarity, compatibility);
  // Close to a boundary, a specific matrix story wins over a coin-flip.
  if (outcome !== "missing_piece" && code !== "GC" && near(similarity, [50, 70]) && near(compatibility, [50, 75]))
    outcome = fromMatrix(code, similarity, compatibility);

  // -------------------------------------------------------- insights
  const sliderGaps: { k: keyof Sliders; gap: number }[] = (["think", "connect", "work", "pace"] as const)
    .map((k) => ({ k, gap: Math.abs(s1[k] - s2[k]) }))
    .sort((x, y) => y.gap - x.gap);
  const widest = sliderGaps[0];
  const side = (k: keyof Sliders) => (s1[k] < s2[k] ? [an, bn] : [bn, an]);

  const OPP: Record<keyof Sliders, (lo: string, hi: string) => string> = {
    think: (lo, hi) => `${lo} goes with the gut; ${hi} wants the evidence.`,
    connect: (lo, hi) => `${lo} wants one proper conversation; ${hi} wants the whole room.`,
    work: (lo, hi) => `${lo} lives in ideas; ${hi} lives in execution.`,
    pace: (lo, hi) => `${lo} starts things; ${hi} finishes them.`,
  };
  const WATCH: Record<keyof Sliders, [string, string]> = {
    think: ["You'll argue about how sure is sure enough.", "Agree a deadline for deciding, then decide together."],
    connect: ["One of you wants a crowd, the other wants a corner.", "Take turns choosing where you meet."],
    work: ["Ideas can outrun delivery — or delivery can kill an idea too early.", "One picks the idea, the other sets the deadline."],
    pace: ["One of you wants the next thing while the other is finishing this one.", "Finish one thing together before starting the next."],
  };

  let opposites: string;
  let watchOut: string;
  let tryThis: string;
  if (widest.gap < 0.35) {
    opposites = `Hardly anywhere — your answers line up almost all the way down.`;
    watchOut = "You'll agree too quickly.";
    tryThis = "Bring in a third person to tell you when you're both wrong.";
  } else {
    const [lo, hi] = side(widest.k);
    opposites = OPP[widest.k](lo, hi);
    [watchOut, tryThis] = WATCH[widest.k];
  }

  const twins = rarest
    ? `Both of you: “${optionLabel(rarest.key)}”.` +
      (stats && stats.n >= MIN_CROWD && stats.share[rarest.key] !== undefined
        ? ` Only ${Math.max(1, Math.round(stats.share[rarest.key] * 100))}% of people pick that.`
        : "")
    : (sharedPick(pa.answers, pb.answers) ??
      (swipesSame >= 4
        ? `Your gut: you swiped the same way ${swipesSame} times out of ${SWIPE_ROUND.cards.length} in the lightning round.`
        : "Not one answer the same. That's rarer than a perfect match."));

  const sharedTile = (pa.answers.r9 ?? []).find((t) => pb.answers.r9?.includes(t));
  const activity = sharedTile
    ? TILE_ACTIVITY[sharedTile]
    : (s1.connect + s2.connect) / 2 < 0
      ? "A long one-to-one coffee. Phones away."
      : "A meetup together — then compare notes on who you met.";

  const dynamic =
    outcome === "mind_twins"
      ? `${an} and ${bn} ${A.id === B.id ? `are both ${A.name.replace("The ", "")}s` : "think alike"}. You finish each other's sentences.`
      : outcome === "missing_piece" && missing
        ? `${missing.needer} is looking for exactly what ${missing.giver} has done.`
        : `${an} ${A.does}. ${bn} ${B.does}.`;

  return {
    a: { name: an, archetype: A.id, streak: ra.streak, sliders: s1 },
    b: { name: bn, archetype: B.id, streak: rb.streak, sliders: s2 },
    similarity,
    compatibility,
    layers,
    intentKnown,
    outcome,
    dynamic,
    roles: A.id === B.id ? `In a team: you're both ${A.role}. Decide who leads.` : `In a team: ${an} = ${A.role} · ${bn} = ${B.role}`,
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

function fromMatrix(code: MatrixCode, sim: number, comp: number): Outcome {
  if (code === "PD") return "power_duo";
  if (code === "BM") return "mind_twins";
  if (code === "FF") return "friendly_friction";
  if (code === "BC") return "beautiful_chaos";
  return comp >= sim ? "power_duo" : "mind_twins";
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function sharedPick(a: Answers, b: Answers): string | null {
  for (const r of PICK_ROUNDS) {
    const shared = (a[r.id] ?? []).find((x) => b[r.id]?.includes(x));
    if (shared) {
      const o = r.options.find((x) => x.id === shared)!;
      return r.id === "r8" ? `You both packed “${o.label}”.` : `You'd both lose a weekend to ${o.label.toLowerCase()}.`;
    }
  }
  return null;
}

function replay(a: Answers, b: Answers): Comparison["replay"] {
  const rows: Comparison["replay"] = [];
  for (const r of SINGLE_ROUNDS) {
    const la = r.options.find((o) => o.id === a[r.id])?.label ?? "—";
    const lb = r.options.find((o) => o.id === b[r.id])?.label ?? "—";
    rows.push({ title: r.title, a: la, b: lb, same: a[r.id] === b[r.id] });
  }
  const swA = SWIPE_ROUND.cards.map((c) => (a.r5?.[c.id] === c.left.id ? c.left.label : c.right.label));
  const swB = SWIPE_ROUND.cards.map((c) => (b.r5?.[c.id] === c.left.id ? c.left.label : c.right.label));
  rows.splice(4, 0, {
    title: SWIPE_ROUND.title,
    a: swA.join(" · "),
    b: swB.join(" · "),
    same: swA.every((x, i) => x === swB[i]),
  });
  for (const r of PICK_ROUNDS) {
    const lab = (ids: string[] = []) => ids.map((id) => r.options.find((o) => o.id === id)?.label ?? id).join(", ");
    rows.push({ title: r.title, a: lab(a[r.id]), b: lab(b[r.id]), same: jaccard(a[r.id], b[r.id]) === 1 });
  }
  return rows;
}
