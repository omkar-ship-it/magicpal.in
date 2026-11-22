"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ARCHETYPE_IDS, TRAITS, type ArchetypeId, type Trait } from "@/lib/brainMate/archetypes";
import {
  AGREES,
  AGREE_ORDER,
  CHECKS,
  PAIRS,
  RANKS,
  SLIDERS,
  STORY,
  VALUES,
  type AgreeCard,
  type PickOption,
  type RankRound,
  type StoryBeat,
} from "@/lib/brainMate/rounds";
import {
  DUEL_COUNT,
  MIN_CROWD,
  STAR_POS,
  TRAIT_COLOR,
  checksNeeded,
  nextDuel,
  starLight,
  stillInPlay,
  type Answers,
  type CrowdStats,
} from "@/lib/brainMate/score";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import { buzz, setSound, soundOn, tone } from "./feel";
import Reveal, { type RevealData } from "./Reveal";

/**
 * Brain-Mate v3 — "A Day in Your Mind".
 *
 *   1  A day in your mind   tap through seven moments, sunrise to midnight
 *   2  This or that         eight quick pairs, a timer ring and a streak
 *   3  Prioritise           push five cards up and down, three rounds
 *   4  Agree / don't        twelve cards, swipe or tap
 *   5  Where do you sit?    drag your dot along six lines
 *   6  Pack your bag        two values
 *   ✋ Double-check          only when your answers pulled two ways
 *   7  The final duel       three cards built live from your closest two
 *
 * A title card between sections; undo in every section; your constellation
 * of eight unlabelled stars brightening as you answer; the ring of twelve
 * silhouettes going dark as the scoring narrows you down.
 */

type Props = {
  defaultName: string;
  needsTerms: boolean;
  link: { slug: string; sender: string } | null;
  stats: CrowdStats | null;
  retake: boolean;
};

type Section = "story" | "pairs" | "ranks" | "agree" | "sliders" | "values" | "checks" | "duel";
type Stage = "ready" | "title" | Section | "saving" | "reveal";

const SECTION_TITLE: Record<Section, { n: string; title: string; hint: string }> = {
  story: { n: "1", title: "A Day in Your Mind", hint: "Seven moments. Tap what you'd actually do." },
  pairs: { n: "2", title: "This or That", hint: "Eight quick ones. Gut only." },
  ranks: { n: "3", title: "Prioritise", hint: "Push what matters most to the top." },
  agree: { n: "4", title: "Agree or Don't", hint: "Swipe right if it's you. Left if it isn't." },
  sliders: { n: "5", title: "Where Do You Sit?", hint: "Drag your dot to where you really are." },
  values: { n: "6", title: "Pack Your Bag", hint: "Room for two things. Choose well." },
  checks: { n: "✋", title: "Quick Double-Check", hint: "A couple of your answers pulled two ways. Two seconds each." },
  duel: { n: "7", title: "The Final Duel", hint: "Your two closest matches. Settle it." },
};

const ORDERED_AGREES = AGREE_ORDER.map((id) => AGREES.find((g) => g.id === id)!);
const TOTAL_STEPS = STORY.length + PAIRS.length + RANKS.length + AGREES.length + SLIDERS.length + 1;
const STEP_TONE: Record<Trait, number> = { O: 0, I: 2, D: 4, S: 5, E: 7, A: 9, C: 11, H: 12 };

const SKY: Record<string, string> = {
  dawn: "linear-gradient(180deg,#FFD6C2 0%,#FFF1E6 100%)",
  morning: "linear-gradient(180deg,#CFE8FF 0%,#F4FAFF 100%)",
  noon: "linear-gradient(180deg,#FFF3B8 0%,#FFFBEA 100%)",
  afternoon: "linear-gradient(180deg,#FFE0B2 0%,#FFF6EA 100%)",
  dusk: "linear-gradient(180deg,#FFB38A 0%,#E9C7FF 100%)",
  evening: "linear-gradient(180deg,#B9B4F5 0%,#E7E3FF 100%)",
  night: "linear-gradient(180deg,#2B2A5E 0%,#4A3F7A 100%)",
};

/** Stable pseudo-random from a string, so shuffles don't change between renders. */
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

const emptyAnswers = (): Answers => ({ v: 3, story: {}, pairs: {}, ranks: {}, agree: {}, sliders: {}, values: [], checks: {}, duels: [] });

export default function Game({ defaultName, needsTerms, link, stats, retake }: Props) {
  const [stage, setStage] = useState<Stage>("ready");
  const [next, setNext] = useState<Section>("story");
  const [name, setName] = useState(defaultName);
  const [terms, setTerms] = useState(!needsTerms);
  const [sound, setSoundState] = useState(false);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [checkIds, setCheckIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const [seed] = useState(() => Math.random().toString(36).slice(2));
  const started = useRef(0);
  const skyRef = useRef<HTMLDivElement>(null);
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number; dx: number; dy: number; color: string }[]>([]);
  const sparkId = useRef(0);

  const answered =
    Object.keys(answers.story).length +
    Object.keys(answers.pairs).length +
    Object.keys(answers.ranks).length +
    Object.keys(answers.agree).length +
    Object.keys(answers.sliders).length +
    (answers.values.length ? 1 : 0);
  const fraction = stage === "duel" || stage === "saving" || next === "duel" ? 1 : answered / TOTAL_STEPS;
  const alive = new Set(stillInPlay(answers, fraction));
  // The day plays out in section 1; everything after it happens at night.
  const night = stage !== "story" && stage !== "ready" && !(stage === "title" && next === "story");

  function fly(e: { clientX: number; clientY: number }, color: string) {
    const target = skyRef.current?.getBoundingClientRect();
    if (!target) return;
    const id = ++sparkId.current;
    const x = e.clientX - 7;
    const y = e.clientY - 7;
    setSparks((s) => [...s, { id, x, y, dx: target.left + target.width / 2 - x - 7, dy: target.top + target.height / 2 - y - 7, color }]);
    window.setTimeout(() => setSparks((s) => s.filter((p) => p.id !== id)), 650);
  }

  function goTo(section: Section) {
    setNext(section);
    setStage("title");
    tone(STEP_TONE.E, 0.25);
    tone(STEP_TONE.H, 0.35);
  }

  function finishedSection(current: Section, a: Answers) {
    const order: Section[] = ["story", "pairs", "ranks", "agree", "sliders", "values"];
    const i = order.indexOf(current);
    if (i >= 0 && i < order.length - 1) return goTo(order[i + 1]);
    if (current === "values") {
      const need = checksNeeded(a);
      setCheckIds(need);
      return goTo(need.length ? "checks" : "duel");
    }
    if (current === "checks") return goTo("duel");
  }

  async function save(final: Answers) {
    setStage("saving");
    setError("");
    try {
      const res = await fetch("/api/brain-mate/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, answers: { ...final, ms: Math.round(performance.now() - started.current) }, acceptTerms: terms, link: link?.slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save that.");
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
        next: link
          ? data.linkError
            ? { href: `/brain-mate/${link.slug}`, label: "Back to the link" }
            : { href: `/brain-mate/${link.slug}?reveal=1`, label: `Now: your Wavelength with ${link.sender}` }
          : { href: "/brain-mate/me", label: "See your Brain-Mate card" },
        note: data.linkError ?? null,
      });
      setStage("reveal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
      setAnswers({ ...final, duels: final.duels.slice(0, -1) });
      setStage("duel");
    }
  }

  if (stage === "reveal" && reveal) return <Reveal data={reveal} />;

  if (stage === "ready") {
    return (
      <main className="bm-shell">
        <TopBar />
        <div className="flex flex-1 flex-col justify-center gap-6 py-6">
          <div className="bm-fade-up">
            <p className="text-[13px] font-bold tracking-[0.18em] text-[var(--bm-brand)]">
              {link ? `${link.sender.toUpperCase()} IS WAITING` : retake ? "THE NEW BRAIN-MATE" : "A DAY IN YOUR MIND"}
            </p>
            <h1 className="bm-display mt-2 text-[2.4rem]">What should your card call you?</h1>
            <p className="mt-2 text-[15px] text-[var(--bm-soft)]">
              Seven sections, about 3 minutes. Swipe, rank, drag and duel — no right answers, only yours.
            </p>
          </div>
          <input
            className="bm-input bm-fade-up text-[1.3rem] font-bold"
            value={name}
            maxLength={40}
            autoFocus={!name}
            placeholder="Your first name"
            onChange={(e) => setName(e.target.value)}
            aria-label="Your name"
          />
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
          <button
            type="button"
            className="flex items-center gap-3 self-start rounded-full border-[1.5px] border-[var(--bm-line)] bg-white px-4 py-2 text-[14px] font-semibold"
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
          <p className="text-[13px] text-[var(--bm-soft)]">Answer as you are on an ordinary day — not your best day, not your worst.</p>
          <button
            className="bm-btn bm-btn-brand text-[1.1rem]"
            disabled={name.trim().length < 2 || !terms}
            onClick={() => {
              setSoundState(soundOn());
              buzz(20);
              started.current = performance.now();
              goTo("story");
            }}
          >
            Start my day
          </button>
        </div>
      </main>
    );
  }

  const storyDone = Object.keys(answers.story).length;
  const sky = stage === "story" ? SKY[STORY[Math.min(storyDone, STORY.length - 1)].sky] : undefined;
  const darkUi = stage === "story" && STORY[Math.min(storyDone, STORY.length - 1)].sky === "night";

  return (
    <main
      className={`min-h-[100dvh] transition-[background,color] duration-700 ${night ? "bm-dark" : ""}`}
      style={{ background: sky ?? (night ? "#14102a" : undefined), color: darkUi || night ? "#fff" : undefined }}
    >
      <div className="bm-shell">
        <Ring alive={alive} dark={night || darkUi} />
        <Constellation innerRef={skyRef} answers={answers} />

        <div className="flex flex-1 flex-col">
          {stage === "title" && <TitleCard key={next} section={next} onDone={() => setStage(next)} />}

          {stage === "story" && storyDone < STORY.length && (
            <StoryView
              key={storyDone}
              beat={STORY[storyDone]}
              index={storyDone}
              seed={seed}
              stats={stats}
              dark={darkUi}
              onUndo={
                storyDone
                  ? () => {
                      const s = { ...answers.story };
                      delete s[STORY[storyDone - 1].id];
                      setAnswers({ ...answers, story: s });
                    }
                  : null
              }
              onChoose={(optId, trait, e) => {
                buzz(12);
                tone(STEP_TONE[trait]);
                fly(e, TRAIT_COLOR[trait]);
                const a = { ...answers, story: { ...answers.story, [STORY[storyDone].id]: optId } };
                setAnswers(a);
                if (storyDone + 1 >= STORY.length) window.setTimeout(() => finishedSection("story", a), 250);
              }}
            />
          )}

          {stage === "pairs" && (
            <PairsView
              answers={answers}
              seed={seed}
              onUndo={(id) => {
                const p = { ...answers.pairs };
                delete p[id];
                setAnswers({ ...answers, pairs: p });
              }}
              onChoose={(id, hi, trait, e) => {
                buzz(10);
                tone(STEP_TONE[trait] + (hi ? 2 : 0), 0.08);
                fly(e, TRAIT_COLOR[trait]);
                const a = { ...answers, pairs: { ...answers.pairs, [id]: hi ? 1 : 0 } };
                setAnswers(a);
                if (Object.keys(a.pairs).length === PAIRS.length) window.setTimeout(() => finishedSection("pairs", a), 300);
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
                if (Object.keys(a.ranks).length === RANKS.length) window.setTimeout(() => finishedSection("ranks", a), 250);
              }}
            />
          )}

          {stage === "agree" && (
            <AgreeView
              cards={ORDERED_AGREES}
              given={answers.agree}
              onUndo={(id) => {
                const g = { ...answers.agree };
                delete g[id];
                setAnswers({ ...answers, agree: g });
              }}
              onAnswer={(card, yes, e) => {
                buzz(yes ? 14 : 8);
                tone(STEP_TONE[card.trait] + (yes ? 4 : 0), 0.08);
                if (yes) fly(e, TRAIT_COLOR[card.trait]);
                const a = { ...answers, agree: { ...answers.agree, [card.id]: yes ? 1 : 0 } };
                setAnswers(a);
                if (Object.keys(a.agree).length === AGREES.length) window.setTimeout(() => finishedSection("agree", a), 350);
              }}
            />
          )}

          {stage === "sliders" && (
            <SlidersView
              key={Object.keys(answers.sliders).length}
              index={Object.keys(answers.sliders).length}
              onUndo={
                Object.keys(answers.sliders).length
                  ? () => {
                      const l = { ...answers.sliders };
                      delete l[SLIDERS[Object.keys(answers.sliders).length - 1].id];
                      setAnswers({ ...answers, sliders: l });
                    }
                  : null
              }
              initial={name.trim().charAt(0).toUpperCase() || "•"}
              onSet={(value) => {
                const sl = SLIDERS[Object.keys(answers.sliders).length];
                tone(STEP_TONE[sl.trait] + Math.round((value + 1) * 3), 0.1);
                const a = { ...answers, sliders: { ...answers.sliders, [sl.id]: Math.round(value * 100) / 100 } };
                setAnswers(a);
                if (Object.keys(a.sliders).length === SLIDERS.length) window.setTimeout(() => finishedSection("sliders", a), 250);
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
                finishedSection("values", a);
              }}
            />
          )}

          {stage === "checks" && (
            <AgreeView
              cards={checkIds.map((id) => CHECKS.find((c) => c.id === id)!)}
              given={answers.checks}
              title="Double-check"
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
                if (Object.keys(a.checks).length === checkIds.length) window.setTimeout(() => finishedSection("checks", a), 350);
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
                if (a.duels.length === DUEL_COUNT) void save(a);
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
function TopBar() {
  return (
    <div className="flex items-center justify-between py-1">
      <Link href="/brain-mate" className="text-[13px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">
        BRAIN-MATE
      </Link>
      <span className="text-[12px] text-[var(--bm-soft)]">by OpenNetworks</span>
    </div>
  );
}

function Ring({ alive, dark }: { alive: Set<ArchetypeId>; dark: boolean }) {
  return (
    <div className="flex items-center justify-between gap-1 pt-1" aria-label={`${alive.size} of 12 archetypes still possible`}>
      {ARCHETYPE_IDS.map((id) => (
        <span key={id} className="bm-ring-dot grid aspect-square w-full max-w-[26px] place-items-center rounded-full" data-alive={alive.has(id)}>
          <ArchetypeMark id={id} size={20} stroke={7} color={dark ? "#fff" : "#241A16"} />
        </span>
      ))}
    </div>
  );
}

/** Eight unlabelled stars, one per trait, brightening as evidence comes in. */
function Constellation({ innerRef, answers }: { innerRef: React.RefObject<HTMLDivElement | null>; answers: Answers }) {
  const light = starLight(answers);
  const lit = TRAITS.filter((k) => light[k] > 0.15);
  return (
    <div className="flex justify-center py-2">
      <div ref={innerRef} className="relative h-[92px] w-[92px]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
          {lit.map((k, i) => {
            const nextK = lit[(i + 1) % lit.length];
            if (lit.length < 2 || !nextK) return null;
            const [x1, y1] = STAR_POS[k];
            const [x2, y2] = STAR_POS[nextK];
            return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity={0.18} strokeWidth={0.8} />;
          })}
          {TRAITS.map((k) => {
            const [x, y] = STAR_POS[k];
            const l = light[k];
            return (
              <g key={k}>
                <circle cx={x} cy={y} r={2 + l * 7} fill={TRAIT_COLOR[k]} opacity={0.18 * l} style={{ transition: "all 0.6s" }} />
                <circle cx={x} cy={y} r={1.4 + l * 3} fill={l > 0.15 ? TRAIT_COLOR[k] : "currentColor"} opacity={0.25 + l * 0.75} style={{ transition: "all 0.6s" }} />
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
  // The latest callback, kept in a ref so a parent re-render (a spark
  // landing, say) can't restart the card's timer.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const id = window.setTimeout(() => done.current(), 1300);
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

function Undo({ onClick, dark }: { onClick: (() => void) | null; dark?: boolean }) {
  return (
    <button
      onClick={onClick ?? undefined}
      disabled={!onClick}
      className={`text-[13px] font-semibold disabled:opacity-0 ${dark ? "text-white/60" : "text-[var(--bm-soft)]"}`}
    >
      ↩ undo
    </button>
  );
}

function Head({ kicker, prompt, meta, dark }: { kicker: string; prompt: string; meta?: string; dark?: boolean }) {
  return (
    <div className="bm-fade-up mb-4">
      <p className={`flex justify-between text-[12px] font-extrabold tracking-[0.2em] ${dark ? "text-[#FFB59E]" : "text-[var(--bm-brand)]"}`}>
        <span>{kicker.toUpperCase()}</span>
        {meta && <span className="opacity-60">{meta}</span>}
      </p>
      <h2 className="bm-display mt-1 text-[1.75rem]">{prompt}</h2>
    </div>
  );
}

// -------------------------------------------------- 1. a day in your mind
function StoryView({
  beat,
  index,
  seed,
  stats,
  dark,
  onUndo,
  onChoose,
}: {
  beat: StoryBeat;
  index: number;
  seed: string;
  stats: CrowdStats | null;
  dark: boolean;
  onUndo: (() => void) | null;
  onChoose: (optionId: string, trait: Trait, e: React.MouseEvent) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [split, setSplit] = useState<{ text: string; rare: boolean } | null>(null);
  const options = shuffle(beat.options, `${seed}:${beat.id}`);
  return (
    <section className="flex flex-1 flex-col">
      <Head kicker={`${beat.time} · ${index + 1} of ${STORY.length}`} prompt={beat.prompt} dark={dark} />
      <div className="flex flex-col gap-2.5">
        {options.map((o, i) => (
          <button
            key={o.id}
            className="bm-option flex items-center gap-3"
            style={{ animationDelay: `${i * 60}ms`, color: "var(--bm-ink)" }}
            data-state={chosen ? (chosen === o.id ? "chosen" : "gone") : "idle"}
            onClick={(e) => {
              if (chosen) return;
              setChosen(o.id);
              const share = stats && stats.n >= MIN_CROWD ? stats.share[`${beat.id}:${o.id}`] : undefined;
              if (share !== undefined) {
                const p = Math.max(1, Math.round(share * 100));
                setSplit(p < 12 ? { text: `Only ${p}% chose this`, rare: true } : { text: `${p}% chose this too`, rare: false });
              }
              const trait = (Object.keys(o.load)[0] ?? "O") as Trait;
              const ev = { clientX: e.clientX, clientY: e.clientY } as React.MouseEvent;
              window.setTimeout(() => onChoose(o.id, trait, ev), share !== undefined ? 1000 : 520);
            }}
          >
            <span className="text-[1.5rem]" aria-hidden="true">
              {o.emoji}
            </span>
            <span>{o.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex min-h-[40px] justify-center">
        {split && (
          <span className={`bm-split rounded-full px-4 py-2 text-[14px] font-bold ${split.rare ? "bm-rare" : "bg-[var(--bm-ink)] text-white"}`}>
            {split.rare ? "✨ " : ""}
            {split.text}
          </span>
        )}
      </div>
      <div className="mt-auto pt-2">
        <Undo onClick={onUndo} dark={dark} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------- 2. this or that
function PairsView({
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
  const order = shuffle(PAIRS, `${seed}:pairs`);
  const done = order.filter((p) => answers.pairs[p.id] !== undefined).length;
  const pair = order[done];
  const [picked, setPicked] = useState<"l" | "r" | null>(null);
  if (!pair) return <div className="flex flex-1 items-center justify-center text-[1.4rem] font-extrabold">⚡ Nice.</div>;
  const flip = seeded(`${seed}:${pair.id}:side`) > 0.5;
  const left = flip ? { ...pair.lo, hi: false } : { ...pair.hi, hi: true };
  const right = flip ? { ...pair.hi, hi: true } : { ...pair.lo, hi: false };
  const tile = (side: "l" | "r", o: typeof left) => (
    <button
      className="bm-option flex aspect-[3/4] flex-col items-center justify-center gap-3 !p-3 text-center !text-[1.05rem]"
      style={{ color: "var(--bm-ink)" }}
      data-state={picked ? (picked === side ? "chosen" : "gone") : "idle"}
      onClick={(e) => {
        if (picked) return;
        setPicked(side);
        const ev = { clientX: e.clientX, clientY: e.clientY } as React.MouseEvent;
        window.setTimeout(() => {
          setPicked(null);
          onChoose(pair.id, o.hi, pair.trait, ev);
        }, 260);
      }}
    >
      <span className="text-[3rem]" aria-hidden="true">
        {o.emoji}
      </span>
      <span className="font-extrabold">{o.label}</span>
    </button>
  );
  return (
    <section className="flex flex-1 flex-col">
      <Head kicker="This or that" prompt="Which one's you?" meta={`${done + 1} / ${PAIRS.length}`} dark />
      <div key={pair.id} className="relative grid grid-cols-2 gap-3">
        {tile("l", left)}
        {tile("r", right)}
        <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--bm-brand)] text-[13px] font-extrabold text-white shadow-lg">
          <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeDasharray="100.5"
              className="bm-timer"
              key={pair.id}
            />
          </svg>
          VS
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-[13px] font-semibold">
        <Undo
          dark
          onClick={
            done
              ? () => {
                  onUndo(order[done - 1].id);
                }
              : null
          }
        />
        <span className="text-white/60">{done >= 3 ? `⚡ streak ×${done}` : "gut only"}</span>
      </div>
    </section>
  );
}

// ------------------------------------------------------------ 3. prioritise
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
  const ROW = 68;
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
      <Head kicker={`Prioritise · round ${index + 1} of ${RANKS.length}`} prompt={round.prompt} dark />
      <p className="-mt-2 mb-3 text-[13px] text-white/60">Push the most “you” to the top.</p>
      <div className="relative" style={{ height: order.length * ROW }}>
        {round.cards.map((c) => {
          const pos = order.indexOf(c.id);
          return (
            <div
              key={c.id}
              className="absolute inset-x-0 flex items-center gap-3 rounded-[1.1rem] bg-white px-3 text-[var(--bm-ink)] shadow-[0_10px_24px_-16px_rgba(0,0,0,0.7)]"
              style={{
                top: pos * ROW,
                height: ROW - 8,
                transition: "top 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                border: pos === 0 ? "2px solid #FFB800" : "2px solid transparent",
              }}
            >
              <span className="w-7 text-center text-[1.2rem] font-extrabold">{medals[pos]}</span>
              <span className="text-[1.4rem]" aria-hidden="true">
                {c.emoji}
              </span>
              <span className="flex-1 text-[15px] font-bold leading-tight">{c.label}</span>
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
        <Undo onClick={onUndo} dark />
      </div>
    </section>
  );
}

// -------------------------------------------------------- 4. agree / don't
function AgreeView({
  cards,
  given,
  title = "Agree or don't",
  onUndo,
  onAnswer,
}: {
  cards: AgreeCard[];
  given: Record<string, number>;
  title?: string;
  onUndo: (id: string) => void;
  onAnswer: (card: AgreeCard, yes: boolean, e: { clientX: number; clientY: number }) => void;
}) {
  const done = cards.filter((c) => given[c.id] !== undefined).length;
  const card = cards[done];
  const [dx, setDx] = useState(0);
  const [stamp, setStamp] = useState<"yes" | "no" | null>(null);
  const start = useRef<number | null>(null);
  if (!card) return <div className="flex flex-1 items-center justify-center text-[1.4rem] font-extrabold">✔ Got it.</div>;
  function answer(yes: boolean, at: { clientX: number; clientY: number }) {
    if (stamp) return;
    setStamp(yes ? "yes" : "no");
    window.setTimeout(() => {
      setStamp(null);
      setDx(0);
      onAnswer(card, yes, at);
    }, 280);
  }
  const shift = stamp ? (stamp === "yes" ? 420 : -420) : dx;
  return (
    <section className="flex flex-1 flex-col">
      <Head kicker={title} prompt="Is this you?" meta={`${done + 1} / ${cards.length}`} dark />
      <div className="relative flex flex-1 items-center justify-center">
        <div
          key={card.id}
          className="bm-swipe-card bm-fade-up relative w-full rounded-[1.6rem] bg-white px-6 py-12 text-center text-[1.5rem] font-extrabold leading-tight text-[var(--bm-ink)] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]"
          style={{ transform: `translateX(${shift}px) rotate(${shift / 20}deg)`, opacity: stamp ? 0 : 1 }}
          onPointerDown={(e) => {
            start.current = e.clientX;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => start.current !== null && setDx(e.clientX - start.current)}
          onPointerUp={(e) => {
            const moved = start.current === null ? 0 : e.clientX - start.current;
            start.current = null;
            if (moved > 70) answer(true, e);
            else if (moved < -70) answer(false, e);
            else setDx(0);
          }}
        >
          {dx > 30 && <span className="absolute left-4 top-4 rotate-[-12deg] rounded-md border-[3px] border-[#2FA84F] px-2 text-[14px] text-[#2FA84F]">AGREE</span>}
          {dx < -30 && <span className="absolute right-4 top-4 rotate-[12deg] rounded-md border-[3px] border-[#E0266B] px-2 text-[14px] text-[#E0266B]">NOPE</span>}
          “{card.text}”
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button className="bm-btn !bg-[#E0266B] !py-4 text-[1.05rem]" onClick={(e) => answer(false, e)}>
          ✕ Nope
        </button>
        <button className="bm-btn !bg-[#2FA84F] !py-4 text-[1.05rem]" onClick={(e) => answer(true, e)}>
          ✓ Agree
        </button>
      </div>
      <div className="mt-3 flex justify-between text-[12px] text-white/50">
        <Undo dark onClick={done ? () => onUndo(cards[done - 1].id) : null} />
        <span>swipe or tap</span>
      </div>
    </section>
  );
}

// ------------------------------------------------------ 5. where do you sit?
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
      <Head kicker={`Where do you sit? · ${index + 1} of ${SLIDERS.length}`} prompt={sl.prompt} dark />
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
            // Let go and it locks in; grab it again within a beat to adjust.
            timer.current = window.setTimeout(() => value !== null && onSet(value), 650);
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/15" />
          {[0, 25, 50, 75, 100].map((t) => (
            <span key={t} className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-white/30" style={{ left: `${t}%` }} />
          ))}
          <span
            className={`absolute top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[1.1rem] font-extrabold text-white shadow-[0_10px_24px_-8px_rgba(255,107,74,0.9)] ${
              value === null ? "bm-heartbeat bg-white/25" : "bg-[var(--bm-brand)]"
            }`}
            style={{ left: `${pct}%`, transition: dragging ? "none" : "left 0.25s" }}
          >
            {initial}
          </span>
        </div>
        <p className="mt-4 text-center text-[13px] text-white/60">{value === null ? "Tap or drag to place yourself" : "Let go to lock it in"}</p>
      </div>
      <div className="mt-3">
        <Undo onClick={onUndo} dark />
      </div>
    </section>
  );
}

// ---------------------------------------------------------- 6. pack your bag
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
      <Head kicker="Pack your bag" prompt={prompt} dark />
      <div className="mb-3 flex min-h-[60px] items-center justify-center gap-3 rounded-[1.4rem] border-2 border-dashed border-white/20 p-3">
        {ids.length === 0 && <span className="text-[14px] text-white/60">🎒 Your bag is empty</span>}
        {ids.map((id) => {
          const o = options.find((x) => x.id === id)!;
          return (
            <span key={id} className="bm-stamp rounded-full bg-white px-3 py-1.5 text-[14px] font-bold text-[var(--bm-ink)]">
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
                background: on ? "#FFF1EC" : undefined,
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

// --------------------------------------------------------- 7. the final duel
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
  if (!card) return <p className="mt-16 text-center text-[1.2rem] font-extrabold">Reading your mind…</p>;
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
        <ArchetypeMark id={id} size={40} color="#241A16" />
      </span>
      {line}
    </button>
  );
  return (
    <section key={round} className="flex flex-1 flex-col">
      <div className="bm-fade-up mb-5 text-center">
        <p className="text-[12px] font-extrabold tracking-[0.2em] text-[#FFB59E]">
          THE FINAL DUEL · {round} / {DUEL_COUNT}
        </p>
        <h2 className="bm-display bm-heartbeat mt-1 text-[1.8rem]">{round === DUEL_COUNT ? "Last one. Which is more you?" : "Which is more you?"}</h2>
        <p className="mt-1 text-[13px] text-white/60">You&apos;d rather…</p>
      </div>
      <div className="flex flex-col gap-3">
        {side(card.a, card.lineA, "bm-duel-left")}
        <div className="text-center text-[13px] font-extrabold tracking-[0.2em] text-white/50">OR</div>
        {side(card.b, card.lineB, "bm-duel-right")}
      </div>
      {saving && <p className="mt-6 text-center text-[15px] font-semibold text-white/70">Reading your mind…</p>}
      {error && <p className="mt-6 text-center text-[14px] font-semibold text-[#FF9C7A]">{error} Pick again to retry.</p>}
    </section>
  );
}
