"use client";

import { useEffect, useState } from "react";
import { ARCHETYPES, streakLine, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { TRAITS } from "@/lib/brainMate/archetypes";
import { HIGH_PHRASE, LOW_PHRASE, MIN_CROWD, STAR_POS, TRAIT_COLOR, montageWords, starLight, strandsFor, traitVector, type Answers } from "@/lib/brainMate/score";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import { buzz, tone } from "./feel";
import { QuickShare } from "./Share";

export type RevealData = {
  name: string;
  answers: Answers;
  archetype: ArchetypeId;
  streak: ArchetypeId;
  /** The top two were nearly tied. */
  cusp: boolean;
  /** The top three, the honest headline: "58% Connector · 27% Spark · 15% Mentor". */
  mix: { id: ArchetypeId; pct: number }[];
  rarity: number;
  players: number;
  know: string;
  /** The final button: hands control back to whoever opened the game. */
  next: { label: string; onClick: () => void };
  /** Share the archetype straight from the reveal (once it's saved). */
  share?: { url: string; text: string; image: string };
  /** Open the full archetype card instead. */
  onCard?: () => void;
  note: string | null;
  /** The save is still on its way: rarity and "how did it know" fill in when it lands. */
  pending?: boolean;
  error?: string;
};

/**
 * The peak. First the engine calibrates: about five seconds of fleeting
 * status lines (some built from your own answers) over a slowly filling
 * bar, so the result feels earned. Then about five seconds play out on
 * their own — your answers flash
 * past, the losing silhouette shatters into your art, the art inhales to a
 * point, then blooms into your mark while your colour floods the screen and
 * the name lands letter by letter. After that the pace is yours: you deal
 * your own hand, one card per tap, and the blind spot is the last card for
 * a reason — it's the laugh.
 */

/** Calibration first; everything after it is offset by CAL. */
const CAL = 5600;
const CAL_STEP = CAL / 6;
const T = { montage: CAL, shatter: CAL + 1700, inhale: CAL + 2250, bloom: CAL + 2800, name: CAL + 3200, tagline: CAL + 3900, rarity: CAL + 4400, hand: CAL + 4900, actions: CAL + 5600 };

/** Six fleeting lines — generic where it must be, yours where it can be. */
function calibrationLines(data: RevealData): string[] {
  const a = data.answers;
  const n =
    Object.keys(a.rather ?? {}).length +
    Object.keys(a.tend ?? {}).length +
    Object.keys(a.calls ?? {}).length +
    Object.keys(a.ranks ?? {}).length +
    Object.keys(a.sliders ?? {}).length +
    Object.keys(a.checks ?? {}).length +
    (a.duels?.length ?? 0);
  const z = traitVector(a);
  const strongest = TRAITS.map((k, i) => ({ k, z: z[i] })).sort((x, y) => Math.abs(y.z) - Math.abs(x.z))[0];
  const short = (id: ArchetypeId) => ARCHETYPES[id].name.replace("The ", "");
  const second = data.mix[1];
  return [
    `Reading your ${n} answers…`,
    "Calibrating nine traits…",
    `Strong signal: ${strongest.z >= 0 ? HIGH_PHRASE[strongest.k] : LOW_PHRASE[strongest.k]}`,
    Object.keys(a.checks ?? {}).length ? "Weighing the answers that pulled two ways…" : "Cross-checking every answer against the others…",
    second && second.pct >= 15 ? `${short(data.archetype)} or ${short(second.id)}? Close call…` : "Ruling out 11 other minds…",
    "Locking it in…",
  ];
}

function seeded(i: number) {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export default function Reveal({ data }: { data: RevealData }) {
  const a = ARCHETYPES[data.archetype];
  const [t, setT] = useState(0);
  const [going, setGoing] = useState(false);
  const [confetti] = useState(() =>
    Array.from({ length: 16 }, (_, i) => ({
      dx: (seeded(i) - 0.5) * 520,
      dy: -120 - seeded(i + 40) * 380,
      rot: (seeded(i + 80) - 0.5) * 720,
      size: 14 + seeded(i + 120) * 18,
      delay: seeded(i + 160) * 0.25,
    }))
  );

  const words = montageWords(data.answers);
  const stars = starLight(data.answers);
  const [lines] = useState(() => calibrationLines(data));
  const [line, setLine] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    lines.forEach((_, i) =>
      at(i * CAL_STEP, () => {
        setLine(i);
        tone(i * 2, 0.05);
      })
    );
    words.forEach((_, i) => at(CAL + i * 190, () => tone(i % 2 ? 4 : 7, 0.06)));
    for (const ms of Object.values(T)) at(ms, () => setT(ms));
    at(T.bloom, () => {
      buzz([30, 60, 90]);
      tone(0, 0.5);
      tone(7, 0.6);
      tone(12, 0.8);
    });
    return () => timers.forEach((x) => window.clearTimeout(x));
    // Runs once: the sequence is the same however long the page stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bloomed = t >= T.bloom;
  const rarityLine =
    data.players >= MIN_CROWD
      ? `1 in ${Math.max(2, Math.round(1 / Math.max(data.rarity, 0.01)))} people are ${a.name.replace("The ", "")}s`
      : data.players <= 1
        ? "The very first Brain-Mate"
        : `One of the first ${data.players} Brain-Mates`;
  // The app's own surfaces, with the archetype as the accent — and a tint
  // mixed from the card colour so it holds up in dark mode too.
  const soft = "var(--bm-soft)";
  const chip = `color-mix(in srgb, ${a.color} 14%, var(--bm-card))`;

  return (
    <main
      className="bm-flood bm-full relative overflow-hidden"
      style={{ background: "var(--bm-cream)", color: "var(--bm-ink)" }}
    >
      <div className="bm-shell">
        {/* --------------------------------------------- before the bloom */}
        {!bloomed && (
          <div className="flex flex-1 flex-col items-center justify-center">
            {t < CAL ? (
              <div className="flex w-full flex-col items-center text-center">
                {/* The engine, calibrating: your nine stars breathing, a bar filling, lines flickering past. */}
                <div className="bm-calib-orb relative grid h-[150px] w-[150px] place-items-center">
                  <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
                    {TRAITS.map((k, i) => {
                      const [x, y] = STAR_POS[k];
                      return <circle key={k} cx={x} cy={y} r={2.6} fill={TRAIT_COLOR[k]} className="bm-calib-star" style={{ animationDelay: `${i * 140}ms` }} />;
                    })}
                  </svg>
                  <span className="h-10 w-10 rounded-full border-[3px] border-[var(--bm-line)] border-t-[var(--bm-brand)] bm-calib-spin" />
                </div>
                <p className="mt-6 text-[11.5px] font-bold tracking-[0.14em] text-[var(--bm-brand)]">CALIBRATING</p>
                <p key={line} className="bm-calib-line mt-2 min-h-[1.6em] text-[1.15rem] font-bold" style={{ animationDuration: `${CAL_STEP}ms` }}>
                  {lines[line]}
                </p>
                <div className="mt-5 h-1 w-48 overflow-hidden rounded-full bg-[var(--bm-line)]">
                  <span className="bm-calib-bar block h-full rounded-full bg-[var(--bm-brand)]" style={{ animationDuration: `${CAL}ms` }} />
                </div>
              </div>
            ) : t < T.shatter ? (
              <div className="relative h-[120px] w-full text-center">
                {words.map((w, i) => (
                  <span
                    key={i}
                    className="bm-montage-word absolute inset-x-0 top-1/2 -translate-y-1/2 text-[2.2rem] font-extrabold"
                    style={{ animationDelay: `${i * 190}ms`, opacity: 0 }}
                  >
                    {w}
                  </span>
                ))}
              </div>
            ) : (
              <div className={`relative grid h-[220px] w-[220px] place-items-center ${t >= T.inhale ? "bm-inhale" : ""}`}>
                {/* Your constellation: the nine stars, joined up, about to become your mark. */}
                <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
                  {TRAITS.map((k, i) => {
                    const [x1, y1] = STAR_POS[k];
                    const [x2, y2] = STAR_POS[TRAITS[(i + 1) % TRAITS.length]];
                    return (
                      <line
                        key={`l${k}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="currentColor"
                        strokeOpacity={0.25}
                        strokeWidth={0.6}
                        className="bm-orb-strand"
                        style={{ animationDelay: `${i * 70}ms` }}
                      />
                    );
                  })}
                  {TRAITS.map((k) => {
                    const [x, y] = STAR_POS[k];
                    const l = stars[k];
                    return (
                      <g key={k}>
                        <circle cx={x} cy={y} r={3 + l * 9} fill={TRAIT_COLOR[k]} opacity={0.3} />
                        <circle cx={x} cy={y} r={1.6 + l * 3.4} fill={TRAIT_COLOR[k]} />
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------- after the bloom */}
        {bloomed && (
          <div className="flex flex-1 flex-col items-center pt-6 text-center">
            <p className="bm-fade-up text-[12px] font-extrabold tracking-[0.14em]" style={{ color: soft }}>
              {data.name.split(" ")[0].toUpperCase()}, YOU ARE
            </p>
            <div className="relative mt-4 grid h-[190px] w-[190px] place-items-center">
              <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
                {strandsFor(data.answers, data.name).map((s, i) => (
                  <path key={i} d={s.d} stroke={a.color} strokeWidth={s.width} strokeOpacity={0.3} fill="none" strokeLinecap="round" />
                ))}
              </svg>
              <div className="bm-bloom grid h-[132px] w-[132px] place-items-center rounded-full shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)]" style={{ background: a.color }}>
                <span className={`bm-idle-${a.mode}`}>
                  <ArchetypeMark id={a.id} size={96} color={a.ink} />
                </span>
              </div>
              {confetti.map((c, i) => (
                <span
                  key={i}
                  className="bm-confetti left-1/2 top-1/2"
                  style={{
                    ["--dx" as string]: `${c.dx}px`,
                    ["--dy" as string]: `${c.dy}px`,
                    ["--rot" as string]: `${c.rot}deg`,
                    animationDelay: `${c.delay}s`,
                  }}
                >
                  <ArchetypeMark id={a.id} size={c.size} color={a.color} stroke={8} />
                </span>
              ))}
            </div>

            {t >= T.name && (
              <h1 className="bm-display mt-5 text-[clamp(2rem,9vw,2.5rem)]" aria-label={a.name}>
                {/* Letters animate one by one, but words never break mid-way. */}
                {a.name.split(" ").map((word, w, words) => {
                  const offset = words.slice(0, w).join(" ").length + (w ? 1 : 0);
                  return (
                    <span key={w} className="inline-block whitespace-nowrap" aria-hidden="true">
                      {word.split("").map((ch, k) => (
                        <span key={k} className="bm-letter" style={{ animationDelay: `${(offset + k) * 40}ms` }}>
                          {ch}
                        </span>
                      ))}
                      {w < words.length - 1 ? "\u00A0" : ""}
                    </span>
                  );
                })}
              </h1>
            )}
            {t >= T.tagline && (
              <p className="bm-fade-up mt-1.5 text-[1.05rem]" style={{ color: soft }}>
                {a.tagline}
              </p>
            )}
            {t >= T.rarity && data.mix?.length > 0 && (
              <div className="bm-fade-up mt-5 w-full max-w-[18rem]">
                {/* The blend is the honest claim — right far more often than any single label. */}
                <div className="flex h-1.5 overflow-hidden rounded-full" style={{ background: chip }}>
                  {data.mix.map((m, i) => (
                    <span key={m.id} style={{ width: `${m.pct}%`, background: ARCHETYPES[m.id].color, opacity: i === 0 ? 1 : 0.6 }} />
                  ))}
                </div>
                <p className="mt-2 text-[12.5px]" style={{ color: soft }}>
                  {data.mix.map((m) => `${m.pct}% ${ARCHETYPES[m.id].name.replace("The ", "")}`).join("  ·  ")}
                </p>
              </div>
            )}

            {/* One quiet card instead of a hand of flip cards: what you're like, your superpower, your blind spot. */}
            {t >= T.hand && (
              <section className="bm-fade-up mt-6 w-full rounded-[1.25rem] border border-[var(--bm-line)] bg-[var(--bm-card)] p-5 text-left">
                <div className="flex flex-wrap gap-1.5">
                  {a.traits.map((tr) => (
                    <span key={tr} className="rounded-full px-3 py-1 text-[12.5px] font-medium" style={{ background: chip }}>
                      {tr}
                    </span>
                  ))}
                </div>
                <p className="mt-5 text-[11px] font-semibold tracking-[0.14em]" style={{ color: a.color }}>
                  SUPERPOWER
                </p>
                <p className="mt-1 text-[1.02rem] font-semibold leading-snug">{a.superpower}</p>
                <p className="mt-4 text-[11px] font-semibold tracking-[0.14em]" style={{ color: soft }}>
                  BLIND SPOT
                </p>
                <p className="mt-1 text-[14px] leading-snug" style={{ color: soft }}>
                  {a.roast}
                </p>
                {data.know && (
                  <p className="mt-4 border-t border-[var(--bm-line)] pt-3 text-[13px] leading-snug" style={{ color: soft }}>
                    {data.know}
                  </p>
                )}
                <p className="mt-3 text-[12.5px]" style={{ color: soft }}>
                  {data.cusp ? `${a.name.replace("The ", "")}–${ARCHETYPES[data.streak].name.replace("The ", "")} cusp` : streakLine(data.streak)}
                  {!data.pending && !data.error ? ` · ${rarityLine}` : ""}
                </p>
              </section>
            )}

            {/* What next: find your Brain-Mate, share it, or see the full card. Never blocked on the save. */}
            {t >= T.actions && (
              <div className="bm-fade-up mt-5 flex w-full flex-col items-stretch gap-3">
                {data.note && <p className="text-[13px]" style={{ color: soft }}>{data.note}</p>}
                {data.error && <p className="text-[13px] font-medium text-[var(--warn)]">{data.error}</p>}
                <button
                  type="button"
                  className="bm-btn bm-btn-brand w-full"
                  disabled={going && Boolean(data.pending)}
                  onClick={() => {
                    setGoing(true);
                    data.next.onClick();
                  }}
                >
                  {going && data.pending ? "One moment…" : `${data.next.label} →`}
                </button>
                {!data.pending && !data.error && data.share && (
                  <QuickShare tone="ghost" label="Share my archetype" copy={false} url={data.share.url} text={data.share.text} image={data.share.image} filename="my-archetype.png" />
                )}
                {data.onCard && (
                  <button type="button" className="text-[13px] font-medium underline underline-offset-4" style={{ color: soft }} onClick={data.onCard}>
                    See my full archetype card
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
