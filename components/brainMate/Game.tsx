"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ARCHETYPE_IDS, type ArchetypeId, type Trait } from "@/lib/brainMate/archetypes";
import {
  AGREE,
  SCENARIOS,
  STATEMENTS,
  STATEMENT_ORDER,
  TILES,
  VALUES,
  type Loading,
  type PickOption,
  type Scenario,
} from "@/lib/brainMate/rounds";
import {
  DUEL_COUNT,
  MIN_CROWD,
  TRAIT_COLOR,
  nextDuel,
  stillInPlay,
  strandsFor,
  traitVector,
  type Answers,
  type CrowdStats,
} from "@/lib/brainMate/score";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import { buzz, setSound, soundOn, tone } from "./feel";
import Reveal, { type RevealData } from "./Reveal";

/**
 * The game, v2. Four acts:
 *   1. Eight scenarios — tap the card that's most you.
 *   2. The lightning round — sixteen statements, four taps each
 *      (Nope · Not really · Kinda · Totally), on a dark screen with a beat.
 *   3. Pack your bag (two values) and your weekend (three interests).
 *   4. The final duel — up to three cards, each built live from the two
 *      archetypes you're closest to, contrasting the traits that split them.
 *
 * Progress is the ring of twelve silhouettes going dark as your answers
 * move away from them, computed by the same scoring the server uses.
 */

type Props = {
  defaultName: string;
  needsTerms: boolean;
  link: { slug: string; sender: string } | null;
  stats: CrowdStats | null;
  retake: boolean;
};

type Stage = "ready" | "scenario" | "statements" | "tease" | "values" | "tiles" | "duel" | "saving" | "reveal";
type Spark = { id: number; x: number; y: number; dx: number; dy: number; color: string };

const TRAIT_ORDER: Trait[] = ["O", "I", "D", "S", "E", "A", "C", "H"];
const colorOf = (load: Loading) => {
  const k = (Object.entries(load).sort((a, b) => Math.abs(b[1] ?? 0) - Math.abs(a[1] ?? 0))[0]?.[0] ?? "O") as Trait;
  return TRAIT_COLOR[k];
};
const stepOf = (load: Loading) => TRAIT_ORDER.indexOf(Object.keys(load)[0] as Trait) * 2;
const TOTAL = SCENARIOS.length + STATEMENTS.length + 2;
const ORDERED_STATEMENTS = STATEMENT_ORDER.map((id) => STATEMENTS.find((s) => s.id === id)!);

export default function Game({ defaultName, needsTerms, link, stats, retake }: Props) {
  const [stage, setStage] = useState<Stage>("ready");
  const [name, setName] = useState(defaultName);
  const [terms, setTerms] = useState(!needsTerms);
  const [sound, setSoundState] = useState(false);
  const [sIdx, setSIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ v: 2, s: {}, t: {}, values: [], tiles: [], duels: [] });
  const [chosen, setChosen] = useState<string | null>(null);
  const [split, setSplit] = useState<{ text: string; rare: boolean } | null>(null);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const statementsStart = useRef(0);
  const sparkId = useRef(0);

  const answered = Object.keys(answers.s).length + Object.keys(answers.t).length + (answers.values.length ? 1 : 0) + (answers.tiles.length ? 1 : 0);
  const fraction = stage === "duel" || stage === "saving" ? 1 : answered / TOTAL;
  const alive = new Set(stillInPlay(answers, fraction));
  const strands = strandsFor(answers, name);
  const dark = stage === "statements";

  function flySpark(e: { clientX: number; clientY: number }, color: string) {
    const orb = orbRef.current?.getBoundingClientRect();
    if (!orb) return;
    const id = ++sparkId.current;
    const x = e.clientX - 7;
    const y = e.clientY - 7;
    setSparks((s) => [...s, { id, x, y, dx: orb.left + orb.width / 2 - x - 7, dy: orb.top + orb.height / 2 - y - 7, color }]);
    window.setTimeout(() => setSparks((s) => s.filter((p) => p.id !== id)), 650);
  }

  // ------------------------------------------------------------ act 1
  function chooseScenario(sc: Scenario, optionId: string, load: Loading, e: React.MouseEvent) {
    if (chosen) return;
    setChosen(optionId);
    buzz(12);
    tone(stepOf(load));
    flySpark(e, colorOf(load));
    setAnswers((a) => ({ ...a, s: { ...a.s, [sc.id]: optionId } }));
    const share = stats && stats.n >= MIN_CROWD ? stats.share[`${sc.id}:${optionId}`] : undefined;
    if (share !== undefined) {
      const p = Math.max(1, Math.round(share * 100));
      setSplit(p < 12 ? { text: `Only ${p}% chose this`, rare: true } : { text: `${p}% chose this too`, rare: false });
    }
    window.setTimeout(
      () => {
        setChosen(null);
        setSplit(null);
        if (sIdx + 1 < SCENARIOS.length) setSIdx(sIdx + 1);
        else {
          statementsStart.current = performance.now();
          setStage("statements");
        }
      },
      share !== undefined ? 1150 : 700
    );
  }

  // ------------------------------------------------------------ act 2
  function answerStatement(id: string, value: number, load: Loading, e: React.MouseEvent) {
    buzz(value === 0 || value === 3 ? 18 : 8);
    tone(stepOf(load) + value, 0.08);
    if (value === 0 || value === 3) flySpark(e, colorOf(load));
    const t = { ...answers.t, [id]: value };
    const next: Answers = { ...answers, t };
    if (Object.keys(t).length === STATEMENTS.length) {
      next.ms = Math.round(performance.now() - statementsStart.current);
      setAnswers(next);
      window.setTimeout(() => {
        setStage("tease");
        window.setTimeout(() => setStage("values"), 1500);
      }, 300);
    } else setAnswers(next);
  }

  function undoStatement() {
    const order = ORDERED_STATEMENTS.filter((s) => answers.t[s.id] !== undefined);
    const last = order[order.length - 1];
    if (!last) return;
    const t = { ...answers.t };
    delete t[last.id];
    setAnswers({ ...answers, t });
  }

  // ------------------------------------------------------------ act 3
  function confirmPick(kind: "values" | "tiles", ids: string[], e: React.MouseEvent) {
    buzz(15);
    tone(7);
    flySpark(e, "#FF6B4A");
    setAnswers((a) => ({ ...a, [kind]: ids }));
    setStage(kind === "values" ? "tiles" : "duel");
    if (kind === "tiles") tone(12, 0.4);
  }

  // ------------------------------------------------------------ act 4
  async function chooseDuel(pick: ArchetypeId) {
    const card = nextDuel(answers);
    if (!card) return;
    buzz([20, 40, 60]);
    tone(19, 0.4);
    const final: Answers = { ...answers, duels: [...answers.duels, { a: card.a, b: card.b, pick }] };
    setAnswers(final);
    if (final.duels.length < DUEL_COUNT) return;
    setStage("saving");
    setError("");
    try {
      const res = await fetch("/api/brain-mate/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, answers: final, acceptTerms: terms, link: link?.slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save that.");
      setReveal({
        name,
        answers: final,
        archetype: data.archetype,
        streak: data.streak,
        cusp: data.cusp,
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
      // Let the last duel be answered again.
      setAnswers({ ...final, duels: final.duels.slice(0, -1) });
      setStage("duel");
    }
  }

  if (stage === "reveal" && reveal) return <Reveal data={reveal} />;

  // ------------------------------------------------------------- ready
  if (stage === "ready") {
    return (
      <main className="bm-shell">
        <TopBar />
        <div className="flex flex-1 flex-col justify-center gap-6 py-6">
          <div className="bm-fade-up">
            <p className="text-[13px] font-bold tracking-[0.18em] text-[var(--bm-brand)]">
              {link ? `${link.sender.toUpperCase()} IS WAITING` : retake ? "THE NEW BRAIN-MATE" : "READY?"}
            </p>
            <h1 className="bm-display mt-2 text-[2.4rem]">What should your card call you?</h1>
            <p className="mt-2 text-[15px] text-[var(--bm-soft)]">
              {retake
                ? "Sharper questions, built on personality research. About 2½ minutes."
                : "Eight scenarios, a lightning round and a final duel — about 2½ minutes."}
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
          <p className="text-[13px] text-[var(--bm-soft)]">Answer with your gut — what you actually do, not what you wish you did.</p>
          <button
            className="bm-btn bm-btn-brand text-[1.1rem]"
            disabled={name.trim().length < 2 || !terms}
            onClick={() => {
              setSoundState(soundOn());
              buzz(20);
              tone(0);
              setStage("scenario");
            }}
          >
            Read my mind
          </button>
        </div>
      </main>
    );
  }

  const duel = stage === "duel" || stage === "saving" ? nextDuel(answers) : null;

  return (
    <main className={`bm-shell transition-colors duration-500 ${dark ? "bm-dark" : ""}`} style={dark ? { maxWidth: "none" } : undefined}>
      <div className={dark ? "mx-auto w-full max-w-[30rem]" : "w-full"}>
        <Ring alive={alive} dark={dark} />
        <Orb innerRef={orbRef} strands={strands} tease={stage === "tease" ? leadingColor(answers) : null} />
      </div>

      <div className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col">
        {stage === "scenario" && (
          <ScenarioView key={SCENARIOS[sIdx].id} sc={SCENARIOS[sIdx]} index={sIdx} chosen={chosen} split={split} onChoose={chooseScenario} />
        )}
        {stage === "statements" && <StatementsView answers={answers} onAnswer={answerStatement} onUndo={undoStatement} />}
        {stage === "tease" && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="bm-fade-up bm-display text-[1.9rem]">Your mind is taking shape…</p>
            <p className="bm-fade-up mt-2 text-[15px] text-[var(--bm-soft)]">{alive.size} of 12 still in play.</p>
          </div>
        )}
        {stage === "values" && (
          <PickView
            key="values"
            title="Pack your bag"
            prompt="You can only take two. What matters most to you right now?"
            options={VALUES}
            count={2}
            bag
            done="Zip it up"
            onConfirm={(ids, e) => confirmPick("values", ids, e)}
          />
        )}
        {stage === "tiles" && (
          <PickView
            key="tiles"
            title="Your weekend"
            prompt="Pick three you'd happily lose a weekend to."
            options={TILES}
            count={3}
            done="That's my weekend"
            onConfirm={(ids, e) => confirmPick("tiles", ids, e)}
          />
        )}
        {(stage === "duel" || stage === "saving") && duel && (
          <DuelView
            key={`${answers.duels.length}`}
            round={answers.duels.length + 1}
            card={duel}
            saving={stage === "saving"}
            error={error}
            onChoose={chooseDuel}
          />
        )}
        {stage === "saving" && !duel && <p className="mt-10 text-center text-[15px] font-semibold text-[var(--bm-soft)]">Reading your mind…</p>}
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

function leadingColor(a: Answers) {
  const z = traitVector(a);
  let best = 0;
  z.forEach((x, i) => (x > z[best] ? (best = i) : null));
  return TRAIT_COLOR[TRAIT_ORDER[best]];
}

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

/** The twelve silhouettes. Unnamed until the reveal; the ones you're leaving go dark. */
function Ring({ alive, dark }: { alive: Set<ArchetypeId>; dark: boolean }) {
  return (
    <div className="flex items-center justify-between gap-1 pt-1" aria-label={`${alive.size} of 12 archetypes still possible`}>
      {ARCHETYPE_IDS.map((id) => (
        <span key={id} className="bm-ring-dot grid aspect-square w-full max-w-[28px] place-items-center rounded-full" data-alive={alive.has(id)}>
          <ArchetypeMark id={id} size={22} stroke={7} color={dark ? "#fff" : "#241A16"} />
        </span>
      ))}
    </div>
  );
}

/** Your Brain-Mate art, growing one strand per answer. */
function Orb({
  innerRef,
  strands,
  tease,
}: {
  innerRef: React.RefObject<HTMLDivElement | null>;
  strands: ReturnType<typeof strandsFor>;
  tease: string | null;
}) {
  return (
    <div className="flex justify-center py-3">
      <div
        ref={innerRef}
        className="relative grid h-[108px] w-[108px] place-items-center rounded-full transition-[background-color,box-shadow] duration-700"
        style={{
          background: tease ?? "rgba(255,107,74,0.08)",
          boxShadow: tease ? `0 0 60px -6px ${tease}` : "inset 0 0 0 1.5px rgba(255,107,74,0.25)",
        }}
      >
        <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
          {strands.map((s, i) => (
            <path
              key={i}
              d={s.d}
              stroke={tease ? "#fff" : s.color}
              strokeWidth={s.width * 1.6}
              strokeOpacity={tease ? 0.7 : Math.min(1, s.opacity + 0.25)}
              fill="none"
              strokeLinecap="round"
              className="bm-orb-strand"
            />
          ))}
        </svg>
        {strands.length === 0 && <span className="bm-heartbeat h-3 w-3 rounded-full bg-[var(--bm-brand)]" />}
      </div>
    </div>
  );
}

function RoundHead({ title, prompt, dark, meta }: { title: string; prompt: string; dark?: boolean; meta?: string }) {
  return (
    <div className="bm-fade-up mb-4">
      <p className={`flex justify-between text-[12px] font-extrabold tracking-[0.2em] ${dark ? "text-[#FFB59E]" : "text-[var(--bm-brand)]"}`}>
        <span>{title.toUpperCase()}</span>
        {meta && <span className={dark ? "text-white/50" : "text-[var(--bm-soft)]"}>{meta}</span>}
      </p>
      <h2 className="bm-display mt-1 text-[1.7rem]">{prompt}</h2>
    </div>
  );
}

function ScenarioView({
  sc,
  index,
  chosen,
  split,
  onChoose,
}: {
  sc: Scenario;
  index: number;
  chosen: string | null;
  split: { text: string; rare: boolean } | null;
  onChoose: (sc: Scenario, optionId: string, load: Loading, e: React.MouseEvent) => void;
}) {
  return (
    <section className="flex flex-1 flex-col">
      <RoundHead title={sc.title} prompt={sc.prompt} meta={`${index + 1} / ${SCENARIOS.length}`} />
      <div className="flex flex-col gap-3">
        {sc.options.map((o, i) => (
          <button
            key={o.id}
            className="bm-option"
            style={{ animationDelay: `${i * 60}ms` }}
            data-state={chosen ? (chosen === o.id ? "chosen" : "gone") : "idle"}
            onClick={(e) => onChoose(sc, o.id, o.load, e)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex min-h-[44px] justify-center">
        {split && (
          <span className={`bm-split rounded-full px-4 py-2 text-[14px] font-bold ${split.rare ? "bm-rare" : "bg-[var(--bm-ink)] text-white"}`}>
            {split.rare ? "✨ " : ""}
            {split.text}
          </span>
        )}
      </div>
    </section>
  );
}

/**
 * The lightning round: one statement at a time, four taps. The two ends
 * get a stronger buzz and a spark — saying "Totally" should feel like it.
 */
function StatementsView({
  answers,
  onAnswer,
  onUndo,
}: {
  answers: Answers;
  onAnswer: (id: string, value: number, load: Loading, e: React.MouseEvent) => void;
  onUndo: () => void;
}) {
  const done = ORDERED_STATEMENTS.filter((s) => answers.t[s.id] !== undefined).length;
  const st = ORDERED_STATEMENTS[done];
  if (!st) return <div className="flex flex-1 items-center justify-center text-[1.4rem] font-extrabold">Gut check: done ⚡</div>;
  const tones = ["#3B82F6", "#93C5FD", "#FDBA74", "#FF6B4A"];
  return (
    <section className="flex flex-1 flex-col">
      <RoundHead title="Lightning round" prompt="Gut only. Don't think." dark meta={`${done + 1} / ${STATEMENTS.length}`} />
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#FF6B4A] transition-[width] duration-300" style={{ width: `${(done / STATEMENTS.length) * 100}%` }} />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div
          key={st.id}
          className="bm-stamp w-full rounded-[1.6rem] bg-white px-6 py-10 text-center text-[1.55rem] font-extrabold leading-tight text-[var(--bm-ink)] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]"
          style={{ animationDuration: "0.35s" }}
        >
          “{st.text}”
        </div>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2">
        {AGREE.map((label, v) => (
          <button
            key={label}
            className="flex min-h-[64px] items-center justify-center rounded-[1.1rem] px-1 text-center text-[13px] font-extrabold leading-tight transition-transform active:scale-90"
            style={{ background: tones[v], color: v === 1 || v === 2 ? "#17110e" : "#fff" }}
            onClick={(e) => onAnswer(st.id, v, st.load, e)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-[12px] font-semibold text-white/50">
        <button onClick={onUndo} disabled={done === 0} className="disabled:opacity-0">
          ↩ undo
        </button>
        <span>{done > 2 ? `⚡ ×${done}` : "trust your gut"}</span>
      </div>
    </section>
  );
}

function PickView({
  title,
  prompt,
  options,
  count,
  bag,
  done,
  onConfirm,
}: {
  title: string;
  prompt: string;
  options: PickOption[];
  count: number;
  bag?: boolean;
  done: string;
  onConfirm: (ids: string[], e: React.MouseEvent) => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const full = ids.length === count;
  function toggle(id: string) {
    buzz(6);
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < count ? [...cur, id] : cur));
  }
  return (
    <section className="flex flex-1 flex-col">
      <RoundHead title={title} prompt={prompt} />
      {bag && (
        <div className="mb-3 flex min-h-[60px] items-center justify-center gap-3 rounded-[1.4rem] border-2 border-dashed border-[var(--bm-line)] bg-white/60 p-3">
          {ids.length === 0 && <span className="text-[14px] text-[var(--bm-soft)]">🎒 Your bag is empty</span>}
          {ids.map((id) => {
            const o = options.find((x) => x.id === id)!;
            return (
              <span key={id} className="bm-stamp rounded-full bg-[var(--bm-ink)] px-3 py-1.5 text-[14px] font-bold text-white">
                {o.emoji} {o.label}
              </span>
            );
          })}
        </div>
      )}
      <div className={`grid gap-2.5 ${bag ? "grid-cols-2" : "grid-cols-3"}`}>
        {options.map((o, i) => {
          const on = ids.includes(o.id);
          return (
            <button
              key={o.id}
              onClick={() => toggle(o.id)}
              className="bm-option flex flex-col items-center gap-1 !p-3 text-center !text-[14px]"
              style={{
                animationDelay: `${i * 40}ms`,
                borderColor: on ? "var(--bm-brand)" : undefined,
                background: on ? "#FFF1EC" : undefined,
                opacity: !on && full ? 0.45 : 1,
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

function DuelView({
  round,
  card,
  saving,
  error,
  onChoose,
}: {
  round: number;
  card: NonNullable<ReturnType<typeof nextDuel>>;
  saving: boolean;
  error: string;
  onChoose: (pick: ArchetypeId) => void;
}) {
  const [picked, setPicked] = useState<ArchetypeId | null>(null);
  const side = (id: ArchetypeId, line: string, cls: string) => (
    <button
      className={`bm-option ${cls} !p-5 text-center !text-[1.2rem]`}
      data-state={picked ? (picked === id ? "chosen" : "gone") : "idle"}
      disabled={saving || Boolean(picked)}
      onClick={() => {
        setPicked(id);
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
    <section className="flex flex-1 flex-col">
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
      {saving && <p className="mt-6 text-center text-[15px] font-semibold text-[var(--bm-soft)]">Reading your mind…</p>}
      {error && <p className="mt-6 text-center text-[14px] font-semibold text-[#c2410c]">{error} Pick again to retry.</p>}
    </section>
  );
}
