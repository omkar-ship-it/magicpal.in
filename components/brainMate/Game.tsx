"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ARCHETYPES, ARCHETYPE_IDS, TRAITS, type ArchetypeId, type Trait } from "@/lib/brainMate/archetypes";
import {
  CALLS,
  CHECKS,
  RANKS,
  RATHER,
  SLIDERS,
  TENDENCIES,
  TENDENCY_SCALE,
  VALUES,
  type Call,
  type CheckCard,
  type PickOption,
  type RankRound,
} from "@/lib/brainMate/rounds";
import {
  DUEL_COUNT,
  MIN_CROWD,
  STAR_POS,
  TRAIT_COLOR,
  checksNeeded,
  nextDuel,
  resultFor,
  starLight,
  stillInPlay,
  strandsFor,
  type Answers,
  type CrowdStats,
} from "@/lib/brainMate/score";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import { buzz, setSound, soundOn, tone } from "./feel";
import Reveal, { type RevealData } from "./Reveal";

/**
 * Brain-Mate v4. Seven sections, about three minutes, played in a window
 * over the map:
 *
 *   1  Would you rather   nine pairs — the two ends of one trait
 *   2  Is this you?       nine tendencies on a four-step meter
 *   3  Tough calls        six dilemmas — two traits pulled against each other
 *   4  Prioritise         push five cards up and down, three rounds
 *   5  Where do you sit?  drag your dot along six lines
 *   6  Pack your bag      two values
 *   ✋ Double-check        only when your answers pulled two ways
 *   7  The final duel     three cards built live from your closest two
 *
 * Progress is saved on the device as you go, so closing the window
 * mid-game loses nothing: reopening offers to pick up where you left off.
 */

type Props = {
  defaultName: string;
  needsTerms: boolean;
  link: { slug: string; sender: string } | null;
  stats: CrowdStats | null;
  /** Their archetype from an older version, when this is a retake. */
  previous: ArchetypeId | null;
  /** Called when a new section starts — the overlay drifts the map behind. */
  onSection?: (index: number) => void;
  /** The reveal's final button. */
  onDone: (result: { archetype: ArchetypeId; linkSlug: string | null }) => void;
};

type Section = "rather" | "tend" | "calls" | "ranks" | "sliders" | "values" | "checks" | "duel";
type Stage = "ready" | "title" | Section | "saving" | "reveal";

const ORDER: Section[] = ["rather", "tend", "calls", "ranks", "sliders", "values"];
const SECTION_TITLE: Record<Section, { n: string; title: string; hint: string }> = {
  rather: { n: "1", title: "Would You Rather", hint: "Both sides are good. Pick the real you." },
  tend: { n: "2", title: "Is This You?", hint: "The real you, when life gives you a choice. A busy season doesn't count." },
  calls: { n: "3", title: "Tough Calls", hint: "Nine small dilemmas. No right answers — just yours." },
  ranks: { n: "4", title: "Prioritise", hint: "Push what matters most to the top." },
  sliders: { n: "5", title: "Where Do You Sit?", hint: "Drag your dot to where you really are." },
  values: { n: "6", title: "Pack Your Bag", hint: "Room for two things. Choose well." },
  checks: { n: "✋", title: "Quick Double-Check", hint: "A couple of your answers pulled two ways. Two seconds each." },
  duel: { n: "7", title: "The Final Duel", hint: "Your two closest matches. Settle it." },
};
const TOTAL_STEPS = RATHER.length + TENDENCIES.length + CALLS.length + RANKS.length + SLIDERS.length + 1;
const STEP_TONE: Record<Trait, number> = { O: 0, I: 2, D: 4, S: 5, E: 7, A: 9, C: 11, H: 12, V: 14 };
const PROGRESS_KEY = "bm_progress_v5";

function seeded(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}
function shuffle<T>(xs: T[], seed: string): T[] {
  return xs
    .map((x, i) => ({ x, k: seeded(`${seed}:${i}`) }))
    .sort((a, b) => a.k - b.k)
    .map((p) => p.x);
}

const emptyAnswers = (): Answers => ({ v: 5, rather: {}, tend: {}, calls: {}, ranks: {}, sliders: {}, values: [], checks: {}, duels: [] });

type Saved = { answers: Answers; name: string; seed: string };
function loadSaved(): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "null") as Saved | null;
    return s && s.answers?.v === 5 ? s : null;
  } catch {
    return null;
  }
}

/** Where a saved game should resume. */
function resumeSection(a: Answers): Section {
  if (Object.keys(a.rather).length < RATHER.length) return "rather";
  if (Object.keys(a.tend).length < TENDENCIES.length) return "tend";
  if (Object.keys(a.calls).length < CALLS.length) return "calls";
  if (Object.keys(a.ranks).length < RANKS.length) return "ranks";
  if (Object.keys(a.sliders).length < SLIDERS.length) return "sliders";
  if (a.values.length < 2) return "values";
  return checksNeeded(a).some((id) => a.checks[id] === undefined) ? "checks" : "duel";
}

export default function Game({ defaultName, needsTerms, link, stats, previous, onSection, onDone }: Props) {
  const [saved] = useState(loadSaved);
  const [stage, setStage] = useState<Stage>("ready");
  const [next, setNext] = useState<Section>("rather");
  const [name, setName] = useState(saved?.name || defaultName);
  const [terms, setTerms] = useState(!needsTerms);
  const [sound, setSoundState] = useState(false);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [checkIds, setCheckIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const [seed, setSeed] = useState(() => saved?.seed ?? Math.random().toString(36).slice(2));
  const started = useRef(0);
  const skyRef = useRef<HTMLDivElement>(null);
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number; dx: number; dy: number; color: string }[]>([]);
  const sparkId = useRef(0);
  const [ping, setPing] = useState<{ k: Trait | null; n: number }>({ k: null, n: 0 });

  // Save as you go; clear once the result is in.
  useEffect(() => {
    if (stage === "ready" || stage === "reveal") return;
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ answers, name, seed } satisfies Saved));
    } catch {
      /* private mode */
    }
  }, [answers, name, seed, stage]);

  const answered =
    Object.keys(answers.rather).length +
    Object.keys(answers.tend).length +
    Object.keys(answers.calls).length +
    Object.keys(answers.ranks).length +
    Object.keys(answers.sliders).length +
    (answers.values.length ? 1 : 0);
  const fraction = stage === "duel" || stage === "saving" || next === "duel" ? 1 : answered / TOTAL_STEPS;
  const inPlay = stillInPlay(answers, fraction);
  const alive = new Set(inPlay);
  const leader = inPlay[0];
  const savedCount = saved
    ? Object.keys(saved.answers.rather).length + Object.keys(saved.answers.tend).length + Object.keys(saved.answers.calls).length
    : 0;

  function fly(e: { clientX: number; clientY: number }, color: string) {
    const target = skyRef.current?.getBoundingClientRect();
    if (!target) return;
    const id = ++sparkId.current;
    const x = e.clientX - 7;
    const y = e.clientY - 7;
    // Aim at the star of the trait this answer feeds, not just the middle.
    const trait = TRAITS.find((k) => TRAIT_COLOR[k] === color);
    const [px, py] = trait ? STAR_POS[trait] : [50, 50];
    const tx = target.left + (px / 100) * target.width;
    const ty = target.top + (py / 100) * target.height;
    setSparks((s) => [...s, { id, x, y, dx: tx - x - 7, dy: ty - y - 7, color }]);
    window.setTimeout(() => setSparks((s) => s.filter((p) => p.id !== id)), 650);
    if (trait) window.setTimeout(() => setPing((p) => ({ k: trait, n: p.n + 1 })), 560);
  }

  function goTo(section: Section) {
    setNext(section);
    setStage("title");
    tone(STEP_TONE.E, 0.25);
    tone(STEP_TONE.H, 0.35);
    onSection?.(["rather", "tend", "calls", "ranks", "sliders", "values", "checks", "duel"].indexOf(section));
  }

  function finished(current: Section, a: Answers) {
    const i = ORDER.indexOf(current);
    if (i >= 0 && i < ORDER.length - 1) return goTo(ORDER[i + 1]);
    if (current === "values") {
      const need = checksNeeded(a);
      setCheckIds(need);
      return goTo(need.length ? "checks" : "duel");
    }
    if (current === "checks") return goTo("duel");
  }

  function begin(resume: boolean) {
    setSoundState(soundOn());
    buzz(20);
    started.current = performance.now();
    if (resume && saved) {
      setAnswers(saved.answers);
      setCheckIds(checksNeeded(saved.answers));
      goTo(resumeSection(saved.answers));
    } else {
      try {
        localStorage.removeItem(PROGRESS_KEY);
      } catch {
        /* ignore */
      }
      setSeed(Math.random().toString(36).slice(2));
      setAnswers(emptyAnswers());
      goTo("rather");
    }
  }

  /**
   * No wait after the last duel: the result is computed right here (the
   * same pure scoring the server runs), so calibration starts the instant
   * the last pick lands, while the save happens behind it. The server's
   * answer fills in the rest (rarity, "how did it know", the next step).
   */
  function save(final: Answers) {
    setError("");
    const local = resultFor(final);
    setReveal({
      name,
      answers: final,
      archetype: local.archetype,
      streak: local.streak,
      cusp: local.cusp,
      mix: local.mix,
      rarity: 0,
      players: 0,
      know: "",
      next: { label: "Saving…", onClick: () => {} },
      note: null,
      pending: true,
    });
    setStage("reveal");
    void persist(final);
  }

  async function persist(final: Answers) {
    setReveal((r) => (r ? { ...r, pending: true, error: undefined, next: { label: "Saving…", onClick: () => {} } } : r));
    try {
      const res = await fetch("/api/brain-mate/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, answers: final, acceptTerms: terms, link: link?.slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save that.");
      try {
        localStorage.removeItem(PROGRESS_KEY);
      } catch {
        /* ignore */
      }
      const linkSlug = link && !data.linkError ? link.slug : null;
      setReveal({
        name,
        answers: final,
        archetype: data.archetype,
        streak: data.streak,
        cusp: data.cusp,
        mix: data.mix,
        rarity: data.rarity,
        players: data.players,
        know: data.know,
        next: {
          label: linkSlug ? `Now: your Wavelength with ${link!.sender}` : "See your archetype card",
          onClick: () => onDone({ archetype: data.archetype, linkSlug }),
        },
        note: data.linkError ?? null,
        pending: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't save that.";
      setReveal((r) => (r ? { ...r, pending: false, error: msg, next: { label: "Try saving again", onClick: () => void persist(final) } } : r));
    }
  }

  if (stage === "reveal" && reveal) return <Reveal data={reveal} />;

  if (stage === "ready") {
    return (
      <main className="bm-shell">
        <div className="flex flex-1 flex-col justify-center gap-5 py-6">
          <div className="bm-fade-up">
            <p className="text-[13px] font-bold tracking-[0.18em] text-[var(--bm-brand)]">
              {link ? `${link.sender.toUpperCase()} IS WAITING` : previous ? "READY FOR A REMATCH?" : "READY FOR A SMALL GAME? 🎲"}
            </p>
            <h1 className="bm-display mt-2 text-[2.3rem]">{previous ? "Brain-Mate got sharper." : "Which of 12 minds are you?"}</h1>
            <p className="mt-2 text-[15px] text-[var(--bm-soft)]">
              {previous
                ? `Last time you were ${ARCHETYPES[previous].name}. New questions, a sharper read — see if it holds.`
                : "Seven quick sections, about 3 minutes. Then see who you click with."}
            </p>
          </div>
          <label className="block">
            <span className="text-[13px] font-semibold text-[var(--bm-soft)]">What should your card call you?</span>
            <input
              className="bm-input mt-1.5 text-[1.2rem] font-bold"
              value={name}
              maxLength={40}
              placeholder="Your first name"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {needsTerms && (
            <label className="flex items-start gap-3 text-[13px] leading-[1.45] text-[var(--bm-soft)]">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#FF6B4A]" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="underline" target="_blank">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline" target="_blank">
                  Privacy Policy
                </Link>
                . Your answers stay private; only your result and your Wavelengths are shown.
              </span>
            </label>
          )}
          <div className="rounded-[1.1rem] bg-[var(--sunk)] p-3.5 text-[13.5px] leading-[1.5]">
            <b>Answer as the real you</b> — when life gives you a choice. A busy season (a new job, a little one, exams) doesn&apos;t change
            who you are.
          </div>
          <button
            type="button"
            className="flex items-center gap-3 self-start rounded-full border border-[var(--bm-line)] bg-[var(--bm-card)] px-4 py-2 text-[14px] font-semibold"
            onClick={() => {
              const on = !sound;
              setSound(on);
              setSoundState(on);
              if (on) tone(7);
            }}
            aria-pressed={sound}
          >
            <span aria-hidden="true">{sound ? "🔊" : "🔇"}</span>
            {sound ? "Sound on" : "Best with sound"}
          </button>
          {saved && savedCount > 0 ? (
            <div className="flex flex-col gap-2.5">
              <button className="bm-btn bm-btn-brand text-[1.05rem]" disabled={name.trim().length < 2 || !terms} onClick={() => begin(true)}>
                Pick up where you left off
              </button>
              <button className="bm-btn bm-btn-ghost" disabled={name.trim().length < 2 || !terms} onClick={() => begin(false)}>
                Start over
              </button>
            </div>
          ) : (
            <button className="bm-btn bm-btn-brand text-[1.1rem]" disabled={name.trim().length < 2 || !terms} onClick={() => begin(false)}>
              {previous ? "Rematch · 3 min" : "Let's play"}
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="bm-full">
      <div className="bm-shell">
        <Ring alive={alive} lead={leader} />
        <Sketch innerRef={skyRef} answers={answers} seed={name || seed} leader={leader} progress={fraction} ping={ping} />

        <div className="flex flex-1 flex-col">
          {stage === "title" && <TitleCard key={next} section={next} onDone={() => setStage(next)} />}

          {stage === "rather" && (
            <RatherView
              answers={answers}
              seed={seed}
              onUndo={(id) => {
                const r = { ...answers.rather };
                delete r[id];
                setAnswers({ ...answers, rather: r });
              }}
              onChoose={(id, hi, trait, e) => {
                buzz(10);
                tone(STEP_TONE[trait] + (hi ? 2 : 0), 0.08);
                fly(e, TRAIT_COLOR[trait]);
                const a = { ...answers, rather: { ...answers.rather, [id]: hi ? 1 : 0 } };
                setAnswers(a);
                if (Object.keys(a.rather).length === RATHER.length) window.setTimeout(() => finished("rather", a), 300);
              }}
            />
          )}

          {stage === "tend" && (
            <TendView
              answers={answers}
              seed={seed}
              onUndo={(id) => {
                const t = { ...answers.tend };
                delete t[id];
                setAnswers({ ...answers, tend: t });
              }}
              onAnswer={(id, v, trait, e) => {
                buzz(v === 0 || v === 3 ? 16 : 8);
                tone(STEP_TONE[trait] + v, 0.08);
                if (v >= 2) fly(e, TRAIT_COLOR[trait]);
                const a = { ...answers, tend: { ...answers.tend, [id]: v } };
                setAnswers(a);
                if (Object.keys(a.tend).length === TENDENCIES.length) window.setTimeout(() => finished("tend", a), 300);
              }}
            />
          )}

          {stage === "calls" && Object.keys(answers.calls).length < CALLS.length && (
            <CallView
              key={Object.keys(answers.calls).length}
              call={CALLS[Object.keys(answers.calls).length]}
              index={Object.keys(answers.calls).length}
              seed={seed}
              stats={stats}
              onUndo={
                Object.keys(answers.calls).length
                  ? () => {
                      const c = { ...answers.calls };
                      delete c[CALLS[Object.keys(answers.calls).length - 1].id];
                      setAnswers({ ...answers, calls: c });
                    }
                  : null
              }
              onChoose={(side, trait, e) => {
                buzz(12);
                tone(STEP_TONE[trait]);
                fly(e, TRAIT_COLOR[trait]);
                const call = CALLS[Object.keys(answers.calls).length];
                const a = { ...answers, calls: { ...answers.calls, [call.id]: side } };
                setAnswers(a);
                if (Object.keys(a.calls).length === CALLS.length) window.setTimeout(() => finished("calls", a), 250);
              }}
            />
          )}

          {stage === "ranks" && Object.keys(answers.ranks).length < RANKS.length && (
            <RankView
              key={Object.keys(answers.ranks).length}
              round={RANKS[Object.keys(answers.ranks).length]}
              index={Object.keys(answers.ranks).length}
              seed={seed}
              onUndo={
                Object.keys(answers.ranks).length
                  ? () => {
                      const r = { ...answers.ranks };
                      delete r[RANKS[Object.keys(answers.ranks).length - 1].id];
                      setAnswers({ ...answers, ranks: r });
                    }
                  : null
              }
              onLock={(order, e) => {
                buzz([15, 30, 15]);
                tone(12, 0.2);
                fly(e, "#FFB800");
                const id = RANKS[Object.keys(answers.ranks).length].id;
                const a = { ...answers, ranks: { ...answers.ranks, [id]: order } };
                setAnswers(a);
                if (Object.keys(a.ranks).length === RANKS.length) window.setTimeout(() => finished("ranks", a), 250);
              }}
            />
          )}

          {stage === "sliders" && (
            <SlidersView
              key={Object.keys(answers.sliders).length}
              index={Object.keys(answers.sliders).length}
              initial={name.trim().charAt(0).toUpperCase() || "•"}
              onUndo={
                Object.keys(answers.sliders).length
                  ? () => {
                      const l = { ...answers.sliders };
                      delete l[SLIDERS[Object.keys(answers.sliders).length - 1].id];
                      setAnswers({ ...answers, sliders: l });
                    }
                  : null
              }
              onSet={(value) => {
                const sl = SLIDERS[Object.keys(answers.sliders).length];
                if (!sl) return;
                tone(STEP_TONE[sl.trait] + Math.round((value + 1) * 3), 0.1);
                const a = { ...answers, sliders: { ...answers.sliders, [sl.id]: Math.round(value * 100) / 100 } };
                setAnswers(a);
                if (Object.keys(a.sliders).length === SLIDERS.length) window.setTimeout(() => finished("sliders", a), 250);
              }}
            />
          )}

          {stage === "values" && (
            <PickView
              prompt="Room for two things. What matters most to you right now?"
              options={VALUES}
              count={2}
              done="Zip it up"
              onConfirm={(ids, e) => {
                buzz(15);
                tone(7);
                fly(e, "#FF6B4A");
                const a = { ...answers, values: ids };
                setAnswers(a);
                finished("values", a);
              }}
            />
          )}

          {stage === "checks" && (
            <CheckView
              cards={checkIds.map((id) => CHECKS.find((c) => c.id === id)!)}
              given={answers.checks}
              onUndo={(id) => {
                const c = { ...answers.checks };
                delete c[id];
                setAnswers({ ...answers, checks: c });
              }}
              onAnswer={(card, yes) => {
                buzz(12);
                tone(STEP_TONE[card.trait] + (yes ? 4 : 0), 0.08);
                const a = { ...answers, checks: { ...answers.checks, [card.id]: yes ? 1 : 0 } };
                setAnswers(a);
                if (Object.keys(a.checks).length === checkIds.length) window.setTimeout(() => finished("checks", a), 350);
              }}
            />
          )}

          {(stage === "duel" || stage === "saving") && (
            <DuelStage
              answers={answers}
              saving={stage === "saving"}
              error={error}
              onChoose={(pick) => {
                const card = nextDuel(answers);
                if (!card) return;
                buzz([20, 40, 60]);
                tone(19, 0.4);
                const a = { ...answers, duels: [...answers.duels, { a: card.a, b: card.b, pick }] };
                setAnswers(a);
                if (a.duels.length === DUEL_COUNT) save({ ...a, ms: Math.round(performance.now() - started.current) });
              }}
            />
          )}
        </div>
      </div>

      {sparks.map((s) => (
        <span
          key={s.id}
          className="bm-spark"
          style={{ left: s.x, top: s.y, background: s.color, ["--dx" as string]: `${s.dx}px`, ["--dy" as string]: `${s.dy}px` }}
        />
      ))}
    </main>
  );
}

// ------------------------------------------------------------- chrome
function Ring({ alive, lead }: { alive: Set<ArchetypeId>; lead: ArchetypeId }) {
  return (
    <div className="flex items-center justify-between gap-1 pt-1" aria-label={`${alive.size} of 12 archetypes still possible`}>
      {ARCHETYPE_IDS.map((id) => (
        <span key={id} className="bm-ring-dot grid aspect-square w-full max-w-[26px] place-items-center rounded-full" data-alive={alive.has(id)} data-lead={alive.size < 12 && id === lead}>
          <ArchetypeMark id={id} size={20} stroke={7} color="currentColor" />
        </span>
      ))}
    </div>
  );
}

/**
 * The live sketch. Every answer draws one more line in its trait's colour,
 * the trait's star lights up and joins the others, and the archetype the
 * answers lean toward surfaces in the middle — faint at first, clearer as
 * the sketch fills in, swapping with a little spin when the lead changes.
 */
function Sketch({
  innerRef,
  answers,
  seed,
  leader,
  progress,
  ping,
}: {
  innerRef: React.RefObject<HTMLDivElement | null>;
  answers: Answers;
  seed: string;
  leader: ArchetypeId;
  progress: number;
  ping: { k: Trait | null; n: number };
}) {
  const light = starLight(answers);
  const lit = TRAITS.filter((k) => light[k] > 0.15);
  const strands = strandsFor(answers, seed);
  const L = ARCHETYPES[leader];
  return (
    <div className="flex justify-center pb-1 pt-2">
      <div ref={innerRef} className="relative h-[136px] w-[136px]">
        {/* soft halo in the leading archetype's colour */}
        <div
          className="absolute inset-3 rounded-full transition-[background,opacity] duration-700"
          style={{ background: `radial-gradient(circle, color-mix(in srgb, ${L.color} 22%, transparent), transparent 70%)`, opacity: 0.35 + progress * 0.65 }}
        />
        {/* the sketch: one line per answer, each drawn as it arrives */}
        <svg viewBox="0 0 400 400" className="bm-sketch-orbit absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {strands.map((st) => (
            <path key={st.key} d={st.d} stroke={st.color} strokeWidth={st.width * 0.9} strokeOpacity={0.42} fill="none" strokeLinecap="round" pathLength={1} className="bm-sketch-line" />
          ))}
        </svg>
        {/* the archetype, surfacing */}
        <span key={leader} className="bm-sketch-mark absolute inset-0 grid place-items-center" style={{ opacity: 0.1 + 0.6 * progress, color: L.color }}>
          <ArchetypeMark id={leader} size={58} stroke={6} color="currentColor" />
        </span>
        {/* the stars, joining up */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {lit.length > 1 &&
            lit.map((k, i) => {
              const nextK = lit[(i + 1) % lit.length];
              if (lit.length === 2 && i === 1) return null;
              const [x1, y1] = STAR_POS[k];
              const [x2, y2] = STAR_POS[nextK];
              return (
                <line key={`${k}-${nextK}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={TRAIT_COLOR[k]} strokeOpacity={0.45} strokeWidth={0.9} strokeLinecap="round" pathLength={1} className="bm-sketch-line" />
              );
            })}
          {ping.k && (
            <circle key={ping.n} cx={STAR_POS[ping.k][0]} cy={STAR_POS[ping.k][1]} r={4} fill="none" stroke={TRAIT_COLOR[ping.k]} strokeWidth={1.2} className="bm-sketch-ping" />
          )}
          {TRAITS.map((k) => {
            const [x, y] = STAR_POS[k];
            const l = light[k];
            const on = l > 0.15;
            return (
              <g key={k}>
                <circle cx={x} cy={y} r={2 + l * 7} fill={TRAIT_COLOR[k]} opacity={0.2 * l} style={{ transition: "all 0.6s" }} />
                <circle
                  key={ping.k === k ? `p${ping.n}` : k}
                  cx={x}
                  cy={y}
                  r={1.5 + l * 3.2}
                  fill={on ? TRAIT_COLOR[k] : "currentColor"}
                  opacity={on ? 0.45 + l * 0.55 : 0.18}
                  className="bm-sketch-star"
                  data-pop={ping.k === k}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function TitleCard({ section, onDone }: { section: Section; onDone: () => void }) {
  const t = SECTION_TITLE[section];
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const id = window.setTimeout(() => done.current(), 1500);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <button className="flex flex-1 flex-col items-center justify-center text-center" onClick={onDone} aria-label={`${t.title} — tap to start`}>
      <span className="bm-stamp grid h-14 w-14 place-items-center rounded-full bg-[var(--bm-brand)] text-[1.4rem] font-extrabold text-white">{t.n}</span>
      <h2 className="bm-display bm-fade-up mt-4 text-[2.2rem]">{t.title}</h2>
      <p className="bm-fade-up mt-2 max-w-[18rem] text-[15px] opacity-70" style={{ animationDelay: "0.15s" }}>
        {t.hint}
      </p>
    </button>
  );
}

function Undo({ onClick }: { onClick: (() => void) | null }) {
  return (
    <button onClick={onClick ?? undefined} disabled={!onClick} className="text-[13px] font-semibold text-[var(--bm-soft)] disabled:opacity-0">
      ↩ undo
    </button>
  );
}

function Head({ kicker, prompt, meta }: { kicker: string; prompt: string; meta?: string }) {
  return (
    <div className="bm-fade-up mb-4">
      <p className="flex justify-between text-[12px] font-extrabold tracking-[0.2em] text-[var(--bm-brand)]">
        <span>{kicker.toUpperCase()}</span>
        {meta && <span className="opacity-60">{meta}</span>}
      </p>
      <h2 className="bm-display mt-1 text-[1.65rem]">{prompt}</h2>
    </div>
  );
}

// ------------------------------------------------------ 1. would you rather
function RatherView({
  answers,
  seed,
  onUndo,
  onChoose,
}: {
  answers: Answers;
  seed: string;
  onUndo: (id: string) => void;
  onChoose: (id: string, hi: boolean, trait: Trait, e: React.MouseEvent) => void;
}) {
  const order = shuffle(RATHER, `${seed}:rather`);
  const done = order.filter((x) => answers.rather[x.id] !== undefined).length;
  const q = order[done];
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  if (!q) return <div className="flex flex-1 items-center justify-center text-[1.4rem] font-extrabold">⚡ Nice.</div>;
  const flip = seeded(`${seed}:${q.id}:side`) > 0.5;
  const first = flip ? { ...q.lo, hi: false } : { ...q.hi, hi: true };
  const second = flip ? { ...q.hi, hi: true } : { ...q.lo, hi: false };
  const card = (slot: "a" | "b", o: typeof first, cls: string) => (
    <button
      className={`bm-option ${cls} flex items-center gap-4 !p-5 text-left !text-[1.15rem]`}
      style={{ color: "var(--bm-ink)" }}
      data-state={picked ? (picked === slot ? "chosen" : "gone") : "idle"}
      onClick={(e) => {
        if (picked) return;
        setPicked(slot);
        const ev = { clientX: e.clientX, clientY: e.clientY } as React.MouseEvent;
        window.setTimeout(() => {
          setPicked(null);
          onChoose(q.id, o.hi, q.trait, ev);
        }, 300);
      }}
    >
      <span className="text-[2.2rem]" aria-hidden="true">
        {o.emoji}
      </span>
      <span className="font-extrabold leading-snug">{o.label}</span>
    </button>
  );
  return (
    <section key={q.id} className="flex flex-1 flex-col">
      <Head kicker="Would you rather…" prompt="Pick the real you." meta={`${done + 1} / ${RATHER.length}`} />
      <div className="flex flex-col gap-3">
        {card("a", first, "bm-duel-left")}
        <div className="text-center text-[13px] font-extrabold tracking-[0.25em] text-[var(--bm-soft)]">OR</div>
        {card("b", second, "bm-duel-right")}
      </div>
      <div className="mt-auto flex items-center justify-between pt-4 text-[13px]">
        <Undo onClick={done ? () => onUndo(order[done - 1].id) : null} />
        <span className="text-[var(--bm-soft)]">{done >= 3 ? `⚡ ×${done}` : "both are good"}</span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------- 2. is this you
function TendView({
  answers,
  seed,
  onUndo,
  onAnswer,
}: {
  answers: Answers;
  seed: string;
  onUndo: (id: string) => void;
  onAnswer: (id: string, v: number, trait: Trait, e: React.MouseEvent) => void;
}) {
  const order = shuffle(TENDENCIES, `${seed}:tend`);
  const done = order.filter((x) => answers.tend[x.id] !== undefined).length;
  const t = order[done];
  const [chosen, setChosen] = useState<number | null>(null);
  if (!t) return <div className="flex flex-1 items-center justify-center text-[1.4rem] font-extrabold">✔ Got it.</div>;
  const colours = ["#3B82F6", "#93C5FD", "#FDBA74", "#FF6B4A"];
  return (
    <section key={t.id} className="flex flex-1 flex-col">
      <Head kicker="Is this you?" prompt="How often is this you?" meta={`${done + 1} / ${TENDENCIES.length}`} />
      <div className="flex flex-1 items-center">
        <div className="bm-stamp w-full rounded-[1.4rem] border border-[var(--bm-line)] bg-[var(--bm-card)] px-6 py-9 shadow-[var(--shadow)] text-center text-[1.35rem] font-extrabold leading-snug text-[var(--bm-ink)]" style={{ animationDuration: "0.35s" }}>
          “{t.text}”
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-[var(--bm-line)]">
          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${chosen === null ? 0 : ((chosen + 1) / 4) * 100}%`, background: chosen === null ? "transparent" : colours[chosen] }} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {TENDENCY_SCALE.map((label, v) => (
            <button
              key={label}
              className="flex min-h-[60px] items-center justify-center rounded-[1rem] px-1 text-center text-[13px] font-extrabold leading-tight transition-transform active:scale-90"
              style={{ background: colours[v], color: v === 1 || v === 2 ? "#17110e" : "#fff", outline: chosen === v ? "3px solid var(--bm-ink)" : "none" }}
              onClick={(e) => {
                if (chosen !== null) return;
                setChosen(v);
                const ev = { clientX: e.clientX, clientY: e.clientY } as React.MouseEvent;
                window.setTimeout(() => {
                  setChosen(null);
                  onAnswer(t.id, v, t.trait, ev);
                }, 260);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex justify-between text-[12px] text-[var(--bm-soft)]">
        <Undo onClick={done ? () => onUndo(order[done - 1].id) : null} />
        <span>the real you, not this week</span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------- 3. tough calls
function CallView({
  call,
  index,
  seed,
  stats,
  onUndo,
  onChoose,
}: {
  call: Call;
  index: number;
  seed: string;
  stats: CrowdStats | null;
  onUndo: (() => void) | null;
  onChoose: (side: "a" | "b", trait: Trait, e: React.MouseEvent) => void;
}) {
  const [chosen, setChosen] = useState<"a" | "b" | null>(null);
  const [split, setSplit] = useState<string | null>(null);
  const sides = seeded(`${seed}:${call.id}`) > 0.5 ? (["b", "a"] as const) : (["a", "b"] as const);
  return (
    <section className="flex flex-1 flex-col">
      <Head kicker={`Tough call · ${index + 1} of ${CALLS.length}`} prompt={call.prompt} />
      <div className="flex flex-col gap-3">
        {sides.map((side, i) => {
          const o = call[side];
          return (
            <button
              key={side}
              className={`bm-option ${i ? "bm-duel-right" : "bm-duel-left"} flex items-center gap-3 !p-4 text-left`}
              style={{ color: "var(--bm-ink)" }}
              data-state={chosen ? (chosen === side ? "chosen" : "gone") : "idle"}
              onClick={(e) => {
                if (chosen) return;
                setChosen(side);
                const share = stats && stats.n >= MIN_CROWD ? stats.share[`${call.id}:${side}`] : undefined;
                if (share !== undefined) setSplit(`${Math.max(1, Math.round(share * 100))}% of people chose this too`);
                const ev = { clientX: e.clientX, clientY: e.clientY } as React.MouseEvent;
                window.setTimeout(() => onChoose(side, o.trait, ev), share !== undefined ? 1000 : 520);
              }}
            >
              <span className="text-[1.8rem]" aria-hidden="true">
                {o.emoji}
              </span>
              <span className="font-extrabold leading-snug">{o.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex min-h-[40px] justify-center">
        {split && <span className="bm-split rounded-full bg-[var(--bm-ink)] px-4 py-2 text-[14px] font-bold text-[var(--bm-cream)]">{split}</span>}
      </div>
      <div className="mt-auto pt-2">
        <Undo onClick={onUndo} />
      </div>
    </section>
  );
}

// ----------------------------------------------------------- 4. prioritise
function RankView({
  round,
  index,
  seed,
  onUndo,
  onLock,
}: {
  round: RankRound;
  index: number;
  seed: string;
  onUndo: (() => void) | null;
  onLock: (order: string[], e: React.MouseEvent) => void;
}) {
  const [order, setOrder] = useState(() => shuffle(round.cards, `${seed}:${round.id}`).map((c) => c.id));
  const [moved, setMoved] = useState(false);
  const ROW = 64;
  const medals = ["🥇", "🥈", "🥉", "4", "5"];
  function move(id: string, dir: -1 | 1) {
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const nextOrder = [...order];
    [nextOrder[i], nextOrder[j]] = [nextOrder[j], nextOrder[i]];
    setOrder(nextOrder);
    setMoved(true);
    buzz(8);
    tone(dir < 0 ? 9 : 4, 0.06);
  }
  return (
    <section className="flex flex-1 flex-col">
      <Head kicker={`Prioritise · round ${index + 1} of ${RANKS.length}`} prompt={round.prompt} />
      <p className="-mt-2 mb-3 text-[13px] text-[var(--bm-soft)]">Push the most “you” to the top.</p>
      <div className="relative" style={{ height: order.length * ROW }}>
        {round.cards.map((c) => {
          const pos = order.indexOf(c.id);
          return (
            <div
              key={c.id}
              className="absolute inset-x-0 flex items-center gap-3 rounded-[1.1rem] border border-[var(--bm-line)] bg-[var(--bm-card)] px-3 text-[var(--bm-ink)] shadow-[var(--shadow)]"
              style={{ top: pos * ROW, height: ROW - 8, transition: "top 0.35s cubic-bezier(0.34,1.56,0.64,1)", border: pos === 0 ? "2px solid #FFB800" : "2px solid transparent" }}
            >
              <span className="w-7 text-center text-[1.15rem] font-extrabold">{medals[pos]}</span>
              <span className="text-[1.35rem]" aria-hidden="true">
                {c.emoji}
              </span>
              <span className="flex-1 text-[14.5px] font-bold leading-tight">{c.label}</span>
              <span className="flex flex-col">
                <button
                  className="grid h-6 w-9 place-items-center rounded-t-lg bg-[var(--bm-line)] text-[13px] font-extrabold disabled:opacity-30"
                  disabled={pos === 0}
                  onClick={() => move(c.id, -1)}
                  aria-label={`Push ${c.label} up`}
                >
                  ▲
                </button>
                <button
                  className="mt-0.5 grid h-6 w-9 place-items-center rounded-b-lg bg-[var(--bm-line)] text-[13px] font-extrabold disabled:opacity-30"
                  disabled={pos === order.length - 1}
                  onClick={() => move(c.id, 1)}
                  aria-label={`Push ${c.label} down`}
                >
                  ▼
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <button className="bm-btn bm-btn-brand mt-5" onClick={(e) => onLock(order, e)}>
        {moved ? "Lock it in 🔒" : "Already perfect? Lock it in"}
      </button>
      <div className="mt-3">
        <Undo onClick={onUndo} />
      </div>
    </section>
  );
}

// ---------------------------------------------------- 5. where do you sit?
function SlidersView({
  index,
  initial,
  onUndo,
  onSet,
}: {
  index: number;
  initial: string;
  onUndo: (() => void) | null;
  onSet: (value: number) => void;
}) {
  const sl = SLIDERS[index];
  const [value, setValue] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const lastTick = useRef(0);
  const timer = useRef<number | null>(null);
  if (!sl) return null;
  function at(clientX: number) {
    const box = track.current?.getBoundingClientRect();
    if (!box) return;
    const v = Math.max(-1, Math.min(1, ((clientX - box.left) / box.width) * 2 - 1));
    const tick = Math.round(v * 5);
    if (tick !== lastTick.current) {
      lastTick.current = tick;
      buzz(4);
    }
    setValue(v);
  }
  const pct = value === null ? 50 : ((value + 1) / 2) * 100;
  return (
    <section className="flex flex-1 flex-col">
      <Head kicker={`Where do you sit? · ${index + 1} of ${SLIDERS.length}`} prompt={sl.prompt} />
      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-4 flex justify-between gap-4 text-[15px] font-extrabold">
          <span className="max-w-[45%]" style={{ opacity: value === null ? 0.9 : 0.5 + Math.max(0, -value) * 0.5 }}>
            {sl.left}
          </span>
          <span className="max-w-[45%] text-right" style={{ opacity: value === null ? 0.9 : 0.5 + Math.max(0, value) * 0.5 }}>
            {sl.right}
          </span>
        </div>
        <div
          ref={track}
          className="relative h-16 touch-none select-none"
          onPointerDown={(e) => {
            if (timer.current) window.clearTimeout(timer.current);
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setDragging(true);
            at(e.clientX);
          }}
          onPointerMove={(e) => dragging && at(e.clientX)}
          onPointerUp={() => {
            setDragging(false);
            timer.current = window.setTimeout(() => value !== null && onSet(value), 650);
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[var(--bm-line)]" />
          {[0, 25, 50, 75, 100].map((t) => (
            <span key={t} className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-[var(--bm-soft)] opacity-40" style={{ left: `${t}%` }} />
          ))}
          <span
            className={`absolute top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[1.1rem] font-extrabold text-white shadow-[0_10px_24px_-8px_rgba(255,107,74,0.9)] ${
              value === null ? "bm-heartbeat bg-[var(--bm-soft)] opacity-60" : "bg-[var(--bm-brand)]"
            }`}
            style={{ left: `${pct}%`, transition: dragging ? "none" : "left 0.25s" }}
          >
            {initial}
          </span>
        </div>
        <p className="mt-4 text-center text-[13px] text-[var(--bm-soft)]">{value === null ? "Tap or drag to place yourself" : "Let go to lock it in"}</p>
      </div>
      <div className="mt-3">
        <Undo onClick={onUndo} />
      </div>
    </section>
  );
}

// -------------------------------------------------------- 6. pack your bag
function PickView({
  prompt,
  options,
  count,
  done,
  onConfirm,
}: {
  prompt: string;
  options: PickOption[];
  count: number;
  done: string;
  onConfirm: (ids: string[], e: React.MouseEvent) => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const full = ids.length === count;
  return (
    <section className="flex flex-1 flex-col">
      <Head kicker="Pack your bag" prompt={prompt} />
      <div className="mb-3 flex min-h-[56px] items-center justify-center gap-3 rounded-[1.4rem] border-2 border-dashed border-[var(--bm-line)] p-3">
        {ids.length === 0 && <span className="text-[14px] text-[var(--bm-soft)]">🎒 Your bag is empty</span>}
        {ids.map((id) => {
          const o = options.find((x) => x.id === id)!;
          return (
            <span key={id} className="bm-stamp rounded-full bg-[var(--bm-ink)] px-3 py-1.5 text-[14px] font-bold text-[var(--bm-cream)]">
              {o.emoji} {o.label}
            </span>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((o, i) => {
          const on = ids.includes(o.id);
          return (
            <button
              key={o.id}
              onClick={() => {
                buzz(6);
                setIds((cur) => (cur.includes(o.id) ? cur.filter((x) => x !== o.id) : cur.length < count ? [...cur, o.id] : cur));
              }}
              className="bm-option flex flex-col items-center gap-1 !p-3 text-center !text-[14px]"
              style={{
                animationDelay: `${i * 40}ms`,
                borderColor: on ? "var(--bm-brand)" : undefined,
                background: on ? "var(--sunk)" : undefined,
                opacity: !on && full ? 0.45 : 1,
                color: "var(--bm-ink)",
              }}
              aria-pressed={on}
            >
              <span className="text-[1.6rem]" aria-hidden="true">
                {o.emoji}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1" />
      <button className="bm-btn bm-btn-brand mt-5" disabled={!full} onClick={(e) => onConfirm(ids, e)}>
        {full ? done : `Pick ${count - ids.length} more`}
      </button>
    </section>
  );
}

// ----------------------------------------------------------- double-check
function CheckView({
  cards,
  given,
  onUndo,
  onAnswer,
}: {
  cards: CheckCard[];
  given: Record<string, number>;
  onUndo: (id: string) => void;
  onAnswer: (card: CheckCard, yes: boolean) => void;
}) {
  const done = cards.filter((c) => given[c.id] !== undefined).length;
  const card = cards[done];
  const [stamp, setStamp] = useState<"yes" | "no" | null>(null);
  if (!card) return <div className="flex flex-1 items-center justify-center text-[1.4rem] font-extrabold">✔ Thanks.</div>;
  function answer(yes: boolean) {
    if (stamp) return;
    setStamp(yes ? "yes" : "no");
    window.setTimeout(() => {
      setStamp(null);
      onAnswer(card, yes);
    }, 280);
  }
  return (
    <section className="flex flex-1 flex-col">
      <Head kicker="Double-check" prompt="Is this you?" meta={`${done + 1} / ${cards.length}`} />
      <div className="flex flex-1 items-center">
        <div
          key={card.id}
          className="bm-fade-up w-full rounded-[1.4rem] border border-[var(--bm-line)] bg-[var(--bm-card)] px-6 py-10 shadow-[var(--shadow)] text-center text-[1.4rem] font-extrabold leading-tight text-[var(--bm-ink)]"
          style={{ transform: stamp ? `translateX(${stamp === "yes" ? 420 : -420}px)` : undefined, transition: "transform 0.28s" }}
        >
          “{card.text}”
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button className="bm-btn !bg-[#E0266B] !py-4" onClick={() => answer(false)}>
          ✕ Not me
        </button>
        <button className="bm-btn !bg-[#2FA84F] !py-4" onClick={() => answer(true)}>
          ✓ That&apos;s me
        </button>
      </div>
      <div className="mt-3">
        <Undo onClick={done ? () => onUndo(cards[done - 1].id) : null} />
      </div>
    </section>
  );
}

// ----------------------------------------------------------- the final duel
function DuelStage({
  answers,
  saving,
  error,
  onChoose,
}: {
  answers: Answers;
  saving: boolean;
  error: string;
  onChoose: (pick: ArchetypeId) => void;
}) {
  const card = nextDuel(answers);
  const round = answers.duels.length + 1;
  const [picked, setPicked] = useState<{ round: number; id: ArchetypeId } | null>(null);
  if (!card) return null;
  const chosen = picked?.round === round ? picked.id : null;
  const side = (id: ArchetypeId, line: string, cls: string) => (
    <button
      className={`bm-option ${cls} !p-5 text-center !text-[1.15rem]`}
      style={{ color: "var(--bm-ink)" }}
      data-state={chosen ? (chosen === id ? "chosen" : "gone") : "idle"}
      disabled={saving || Boolean(chosen)}
      onClick={() => {
        setPicked({ round, id });
        window.setTimeout(() => onChoose(id), 450);
      }}
    >
      <span className="mb-3 flex justify-center opacity-25">
        <ArchetypeMark id={id} size={40} color="currentColor" />
      </span>
      {line}
    </button>
  );
  return (
    <section key={round} className="flex flex-1 flex-col">
      <div className="bm-fade-up mb-5 text-center">
        <p className="text-[12px] font-extrabold tracking-[0.2em] text-[var(--bm-brand)]">
          THE FINAL DUEL · {round} / {DUEL_COUNT}
        </p>
        <h2 className="bm-display bm-heartbeat mt-1 text-[1.8rem]">{round === DUEL_COUNT ? "Last one. Which is more you?" : "Which is more you?"}</h2>
        <p className="mt-1 text-[13px] text-[var(--bm-soft)]">You&apos;d rather…</p>
      </div>
      <div className="flex flex-col gap-3">
        {side(card.a, card.lineA, "bm-duel-left")}
        <div className="text-center text-[13px] font-extrabold tracking-[0.2em] text-[var(--bm-soft)]">OR</div>
        {side(card.b, card.lineB, "bm-duel-right")}
      </div>

      {error && <p className="mt-6 text-center text-[14px] font-semibold text-[#FF9C7A]">{error} Pick again to retry.</p>}
    </section>
  );
}
