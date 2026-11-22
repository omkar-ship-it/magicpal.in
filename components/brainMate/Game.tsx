"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ARCHETYPE_IDS, REALM_COLOR, REALMS, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { ROUNDS, type Option, type PickRound, type SingleRound, type SwipeRound } from "@/lib/brainMate/rounds";
import {
  MIN_CROWD,
  aliveAfter,
  duelFor,
  pointsFor,
  strandsFor,
  type Answers,
  type CrowdStats,
} from "@/lib/brainMate/score";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import { buzz, setSound, soundOn, tone } from "./feel";
import Reveal, { type RevealData } from "./Reveal";

/**
 * The game. One thumb, no scrolling, nothing typed after the first screen,
 * and every tap answered within a frame: the card lifts, a spark flies into
 * your growing Brain-Mate art, and the crowd split says how rare that was.
 *
 * Progress is never "question 3 of 10". It is the ring of twelve
 * silhouettes at the top going dark as your answers move away from them —
 * 12, 10, 8 … 2 — until the last two meet in the final duel. The ring is
 * computed by the same scoring the server uses, so what you watch narrow is
 * what decides you.
 */

type Props = {
  defaultName: string;
  needsTerms: boolean;
  link: { slug: string; sender: string } | null;
  stats: CrowdStats | null;
};

type Phase = "ready" | "play" | "tease" | "duel" | "saving" | "reveal";

type Spark = { id: number; x: number; y: number; dx: number; dy: number; color: string };

const effectColor = (o: Option) => {
  for (const r of REALMS) if (o.effect[r]) return REALM_COLOR[r];
  return "#FF6B4A";
};
const effectStep = (o: Option) => {
  const keys = Object.keys(o.effect);
  return ["imagine", "reason", "act", "relate", "ignite", "seek", "steady"].indexOf(keys[0] ?? "") * 2;
};

export default function Game({ defaultName, needsTerms, link, stats }: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [name, setName] = useState(defaultName);
  const [terms, setTerms] = useState(!needsTerms);
  const [sound, setSoundState] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ r5: {} });
  const [chosen, setChosen] = useState<string | null>(null);
  const [split, setSplit] = useState<{ text: string; rare: boolean } | null>(null);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const lightningStart = useRef(0);
  const sparkId = useRef(0);

  const round = ROUNDS[idx];
  const alive = new Set(aliveAfter(answers, phase === "duel" || phase === "saving" ? 9 : idx));
  const strands = strandsFor(answers, name);
  const dark = phase === "play" && round?.kind === "swipe";

  function flySpark(e: { clientX: number; clientY: number }, color: string) {
    const orb = orbRef.current?.getBoundingClientRect();
    if (!orb) return;
    const id = ++sparkId.current;
    const x = e.clientX - 7;
    const y = e.clientY - 7;
    setSparks((s) => [...s, { id, x, y, dx: orb.left + orb.width / 2 - x - 7, dy: orb.top + orb.height / 2 - y - 7, color }]);
    window.setTimeout(() => setSparks((s) => s.filter((p) => p.id !== id)), 650);
  }

  function next() {
    const done = idx + 1;
    if (done >= ROUNDS.length) {
      setPhase("duel");
      tone(12, 0.4);
      return;
    }
    // After the lightning round, a beat: the art takes on its leading colour.
    if (ROUNDS[idx].kind === "swipe") {
      setPhase("tease");
      window.setTimeout(() => {
        setIdx(done);
        setPhase("play");
      }, 1500);
      return;
    }
    if (ROUNDS[done].kind === "swipe") lightningStart.current = performance.now();
    setIdx(done);
  }

  function chooseSingle(r: SingleRound, o: Option, e: React.MouseEvent) {
    if (chosen) return;
    setChosen(o.id);
    buzz(12);
    tone(effectStep(o));
    flySpark(e, effectColor(o));
    const nextAnswers = { ...answers, [r.id]: o.id };
    setAnswers(nextAnswers);
    const share = stats && stats.n >= MIN_CROWD ? stats.share[`${r.id}:${o.id}`] : undefined;
    if (share !== undefined) {
      const p = Math.max(1, Math.round(share * 100));
      setSplit(p < 12 ? { text: `Only ${p}% chose this`, rare: true } : { text: `${p}% chose this too`, rare: false });
    }
    window.setTimeout(() => {
      setChosen(null);
      setSplit(null);
      next();
    }, share !== undefined ? 1150 : 700);
  }

  function chooseSwipe(card: string, o: Option, at: { clientX: number; clientY: number }) {
    buzz(8);
    tone(effectStep(o), 0.08);
    flySpark(at, effectColor(o));
    const r5 = { ...(answers.r5 ?? {}), [card]: o.id };
    const nextAnswers: Answers = { ...answers, r5 };
    const sw = ROUNDS[idx] as SwipeRound;
    if (Object.keys(r5).length === sw.cards.length) {
      nextAnswers.lightningMs = Math.round(performance.now() - lightningStart.current);
      setAnswers(nextAnswers);
      window.setTimeout(() => next(), 350);
    } else setAnswers(nextAnswers);
  }

  function confirmPick(r: PickRound, ids: string[], e: React.MouseEvent) {
    buzz(15);
    tone(7);
    flySpark(e, "#FF6B4A");
    const nextAnswers = { ...answers, [r.id]: ids };
    setAnswers(nextAnswers);
    next();
  }

  async function chooseDuel(id: ArchetypeId, loser: ArchetypeId) {
    buzz([20, 40, 60]);
    tone(19, 0.5);
    const final = { ...answers, duel: id };
    setAnswers(final);
    setPhase("saving");
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
        loser,
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
      setPhase("reveal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
      setPhase("duel");
    }
  }

  if (phase === "reveal" && reveal) return <Reveal data={reveal} />;

  // ------------------------------------------------------------- ready
  if (phase === "ready") {
    return (
      <main className="bm-shell">
        <TopBar />
        <div className="flex flex-1 flex-col justify-center gap-6 py-6">
          <div className="bm-fade-up">
            <p className="text-[13px] font-bold tracking-[0.18em] text-[var(--bm-brand)]">
              {link ? `${link.sender.toUpperCase()} IS WAITING` : "READY?"}
            </p>
            <h1 className="bm-display mt-2 text-[2.4rem]">What should your card call you?</h1>
            <p className="mt-2 text-[15px] text-[var(--bm-soft)]">
              First name is perfect. 9 rounds and a final duel — about two minutes.
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
          <button
            className="bm-btn bm-btn-brand text-[1.1rem]"
            disabled={name.trim().length < 2 || !terms}
            onClick={() => {
              setSoundState(soundOn());
              buzz(20);
              tone(0);
              setPhase("play");
            }}
          >
            Read my mind
          </button>
        </div>
      </main>
    );
  }

  // ------------------------------------------------------- in the game
  return (
    <main className={`bm-shell transition-colors duration-500 ${dark ? "bm-dark" : ""}`} style={dark ? { maxWidth: "none" } : undefined}>
      <div className={dark ? "mx-auto w-full max-w-[30rem]" : "w-full"}>
        <Ring alive={alive} dark={dark} />
        <Orb innerRef={orbRef} strands={strands} tease={phase === "tease" ? leadingColor(answers) : null} />
      </div>

      <div className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col">
        {phase === "tease" && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="bm-fade-up bm-display text-[1.9rem]">Your mind is leaning somewhere…</p>
            <p className="bm-fade-up mt-2 text-[15px] text-[var(--bm-soft)]">{alive.size} of 12 still in play.</p>
          </div>
        )}

        {phase === "play" && round?.kind === "cards" && (
          <CardsRound key={round.id} round={round} chosen={chosen} split={split} onChoose={chooseSingle} />
        )}
        {phase === "play" && round?.kind === "swipe" && <SwipeRoundView key={round.id} round={round} answers={answers} onChoose={chooseSwipe} />}
        {phase === "play" && round?.kind === "pick" && <PickRoundView key={round.id} round={round} onConfirm={confirmPick} />}
        {(phase === "duel" || phase === "saving") && (
          <DuelView answers={answers} saving={phase === "saving"} error={error} onChoose={chooseDuel} />
        )}
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
  const p = pointsFor(a);
  const best = REALMS.reduce((x, y) => (p[y] > p[x] ? y : x));
  return REALM_COLOR[best];
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
        className="relative grid h-[118px] w-[118px] place-items-center rounded-full transition-[background-color,box-shadow] duration-700"
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

function RoundHead({ title, prompt, dark }: { title: string; prompt: string; dark?: boolean }) {
  return (
    <div className="bm-fade-up mb-4">
      <p className={`text-[12px] font-extrabold tracking-[0.2em] ${dark ? "text-[#FFB59E]" : "text-[var(--bm-brand)]"}`}>{title.toUpperCase()}</p>
      <h2 className="bm-display mt-1 text-[1.7rem]">{prompt}</h2>
    </div>
  );
}

function CardsRound({
  round,
  chosen,
  split,
  onChoose,
}: {
  round: SingleRound;
  chosen: string | null;
  split: { text: string; rare: boolean } | null;
  onChoose: (r: SingleRound, o: Option, e: React.MouseEvent) => void;
}) {
  const headline = round.look === "headline";
  return (
    <section className="flex flex-1 flex-col">
      <RoundHead title={round.title} prompt={round.prompt} />
      <div className="flex flex-col gap-3">
        {round.options.map((o, i) => (
          <button
            key={o.id}
            className={`bm-option ${headline ? "bm-headline" : ""}`}
            style={{ animationDelay: `${i * 60}ms` }}
            data-state={chosen ? (chosen === o.id ? "chosen" : "gone") : "idle"}
            onClick={(e) => onChoose(round, o, e)}
          >
            {headline && <small>THE DAILY MIND · FRONT PAGE</small>}
            {headline ? `“${o.label}”` : o.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex min-h-[44px] justify-center">
        {split && (
          <span
            className={`bm-split rounded-full px-4 py-2 text-[14px] font-bold ${split.rare ? "bm-rare" : "bg-[var(--bm-ink)] text-white"}`}
          >
            {split.rare ? "✨ " : ""}
            {split.text}
          </span>
        )}
      </div>
    </section>
  );
}

/** The lightning round: flick left or right. Drag, or tap a side. */
function SwipeRoundView({
  round,
  answers,
  onChoose,
}: {
  round: SwipeRound;
  answers: Answers;
  onChoose: (card: string, o: Option, at: { clientX: number; clientY: number }) => void;
}) {
  const done = Object.keys(answers.r5 ?? {}).length;
  const card = round.cards[done];
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const [fly, setFly] = useState<"left" | "right" | null>(null);

  function pick(side: "left" | "right", at: { clientX: number; clientY: number }) {
    if (!card || fly) return;
    setFly(side);
    const chosenCard = card;
    window.setTimeout(() => {
      setFly(null);
      setDx(0);
      onChoose(chosenCard.id, side === "left" ? chosenCard.left : chosenCard.right, at);
    }, 180);
  }

  if (!card) return <div className="flex flex-1 items-center justify-center text-[1.4rem] font-extrabold">Gut check: done ⚡</div>;
  const tilt = fly ? (fly === "left" ? -420 : 420) : dx;

  return (
    <section className="flex flex-1 flex-col">
      <RoundHead title={round.title} prompt={round.prompt} dark />
      <div className="mb-3 flex items-center justify-between text-[13px] font-bold text-white/60">
        <span>
          {done + 1} / {round.cards.length}
        </span>
        <span>{done > 1 ? `⚡ ×${done}` : "flick it"}</span>
      </div>
      <div className="relative flex flex-1 items-center justify-center">
        <div
          key={card.id}
          className="bm-swipe-card bm-fade-up grid w-full grid-cols-2 overflow-hidden rounded-[1.6rem] bg-white text-[var(--bm-ink)] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]"
          style={{ transform: `translateX(${tilt}px) rotate(${tilt / 18}deg)`, opacity: fly ? 0 : 1 }}
          onPointerDown={(e) => {
            start.current = e.clientX;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (start.current !== null) setDx(e.clientX - start.current);
          }}
          onPointerUp={(e) => {
            const moved = start.current === null ? 0 : e.clientX - start.current;
            start.current = null;
            if (moved < -70) pick("left", e);
            else if (moved > 70) pick("right", e);
            else {
              setDx(0);
              // A tap rather than a drag: whichever half was touched.
              const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
              if (Math.abs(moved) < 8) pick(e.clientX < box.left + box.width / 2 ? "left" : "right", e);
            }
          }}
        >
          {[card.left, card.right].map((o, i) => (
            <div
              key={o.id}
              className={`flex min-h-[220px] items-center justify-center p-5 text-center text-[1.45rem] font-extrabold leading-tight ${
                i === 0 ? "border-r border-[var(--bm-line)]" : ""
              }`}
              style={{
                background:
                  (dx < -30 && i === 0) || (dx > 30 && i === 1) ? "rgba(255,107,74,0.14)" : "transparent",
              }}
            >
              {o.label}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex justify-between text-[13px] font-semibold text-white/50">
        <span>← swipe</span>
        <span>swipe →</span>
      </div>
    </section>
  );
}

function PickRoundView({
  round,
  onConfirm,
}: {
  round: PickRound;
  onConfirm: (r: PickRound, ids: string[], e: React.MouseEvent) => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const full = ids.length === round.count;
  function toggle(id: string) {
    buzz(6);
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < round.count ? [...cur, id] : cur));
  }
  const bag = round.look === "bag";
  return (
    <section className="flex flex-1 flex-col">
      <RoundHead title={round.title} prompt={round.prompt} />
      {bag && (
        <div className="mb-3 flex min-h-[64px] items-center justify-center gap-3 rounded-[1.4rem] border-2 border-dashed border-[var(--bm-line)] bg-white/60 p-3">
          {ids.length === 0 && <span className="text-[14px] text-[var(--bm-soft)]">🎒 Your bag is empty</span>}
          {ids.map((id) => {
            const o = round.options.find((x) => x.id === id)!;
            return (
              <span key={id} className="bm-stamp rounded-full bg-[var(--bm-ink)] px-3 py-1.5 text-[14px] font-bold text-white">
                {o.emoji} {o.label}
              </span>
            );
          })}
        </div>
      )}
      <div className={`grid gap-2.5 ${bag ? "grid-cols-2" : "grid-cols-3"}`}>
        {round.options.map((o, i) => {
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
      <button className="bm-btn bm-btn-brand mt-5" disabled={!full} onClick={(e) => onConfirm(round, ids, e)}>
        {full ? (bag ? "Zip it up" : "That's my weekend") : `Pick ${round.count - ids.length} more`}
      </button>
    </section>
  );
}

function DuelView({
  answers,
  saving,
  error,
  onChoose,
}: {
  answers: Answers;
  saving: boolean;
  error: string;
  onChoose: (id: ArchetypeId, loser: ArchetypeId) => void;
}) {
  const duel = duelFor(answers);
  const [picked, setPicked] = useState<ArchetypeId | null>(null);
  const side = (id: ArchetypeId, line: string, cls: string, other: ArchetypeId) => (
    <button
      className={`bm-option ${cls} !p-5 text-center !text-[1.2rem]`}
      data-state={picked ? (picked === id ? "chosen" : "gone") : "idle"}
      disabled={saving}
      onClick={() => {
        setPicked(id);
        window.setTimeout(() => onChoose(id, other), 450);
      }}
    >
      <span className="mb-3 flex justify-center opacity-25">
        <ArchetypeMark id={id} size={44} color="#241A16" />
      </span>
      {line}
    </button>
  );
  return (
    <section className="flex flex-1 flex-col">
      <div className="bm-fade-up mb-5 text-center">
        <p className="text-[12px] font-extrabold tracking-[0.2em] text-[var(--bm-brand)]">THE FINAL DUEL</p>
        <h2 className="bm-display bm-heartbeat mt-1 text-[1.8rem]">{duel.prompt}</h2>
      </div>
      <div className="flex flex-col gap-3">
        {side(duel.a, duel.lineA, "bm-duel-left", duel.b)}
        <div className="text-center text-[13px] font-extrabold tracking-[0.2em] text-[var(--bm-soft)]">OR</div>
        {side(duel.b, duel.lineB, "bm-duel-right", duel.a)}
      </div>
      {saving && <p className="mt-6 text-center text-[15px] font-semibold text-[var(--bm-soft)]">Reading your mind…</p>}
      {error && (
        <p className="mt-6 text-center text-[14px] font-semibold text-[#c2410c]">
          {error}{" "}
          <button className="underline" onClick={() => setPicked(null)}>
            Try again
          </button>
        </p>
      )}
    </section>
  );
}
