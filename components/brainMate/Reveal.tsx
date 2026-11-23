"use client";

import { useEffect, useState } from "react";
import { ARCHETYPES, streakLine, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { TRAITS } from "@/lib/brainMate/archetypes";
import { MIN_CROWD, STAR_POS, TRAIT_COLOR, montageWords, starLight, strandsFor, type Answers } from "@/lib/brainMate/score";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import { buzz, tone } from "./feel";

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
  note: string | null;
};

/**
 * The peak. About five seconds play out on their own — your answers flash
 * past, the losing silhouette shatters into your art, the art inhales to a
 * point, then blooms into your mark while your colour floods the screen and
 * the name lands letter by letter. After that the pace is yours: you deal
 * your own hand, one card per tap, and the blind spot is the last card for
 * a reason — it's the laugh.
 */

const T = { shatter: 1700, inhale: 2250, bloom: 2800, name: 3200, tagline: 4100, rarity: 4700, hand: 5300 };

function seeded(i: number) {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export default function Reveal({ data }: { data: RevealData }) {
  const a = ARCHETYPES[data.archetype];
  const [t, setT] = useState(0);
  const [flipped, setFlipped] = useState<number[]>([]);
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

  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    words.forEach((_, i) => at(i * 190, () => tone(i % 2 ? 4 : 7, 0.06)));
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
  const cards = [
    { k: "Trait", v: a.traits[0] },
    { k: "Trait", v: a.traits[1] },
    { k: "Trait", v: a.traits[2] },
    { k: "Superpower", v: a.superpower },
    { k: "Blind spot", v: a.roast },
  ];
  const allFlipped = flipped.length === cards.length;
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
            {t < T.shatter ? (
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
                {/* Your constellation: the eight stars, joined up, about to become your mark. */}
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
            <p className="bm-fade-up text-[12px] font-extrabold tracking-[0.22em]" style={{ color: soft }}>
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
              <h1 className="bm-display mt-4 text-[clamp(2rem,10vw,2.7rem)]" aria-label={a.name}>
                {/* Letters animate one by one, but words never break mid-way. */}
                {a.name
                  .toUpperCase()
                  .split(" ")
                  .map((word, w, words) => {
                    const offset = words.slice(0, w).join(" ").length + (w ? 1 : 0);
                    return (
                      <span key={w} className="inline-block whitespace-nowrap" aria-hidden="true">
                        {word.split("").map((ch, k) => (
                          <span key={k} className="bm-letter" style={{ animationDelay: `${(offset + k) * 45}ms` }}>
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
              <p className="bm-fade-up mt-1 text-[1.15rem] font-semibold" style={{ color: soft }}>
                {a.tagline}
              </p>
            )}
            {t >= T.rarity && (
              <span className="bm-stamp mt-3 rounded-full px-4 py-1.5 text-[13px] font-extrabold" style={{ background: chip }}>
                ◆ {rarityLine}
              </span>
            )}
            {t >= T.rarity && data.mix?.length > 0 && (
              <div className="bm-fade-up mt-4 w-full max-w-[20rem]" style={{ animationDelay: "0.25s" }}>
                {/* The blend is the honest claim — right far more often than any single label. */}
                <div className="flex h-3 overflow-hidden rounded-full" style={{ background: chip }}>
                  {data.mix.map((m, i) => (
                    <span
                      key={m.id}
                      style={{ width: `${m.pct}%`, background: ARCHETYPES[m.id].color, opacity: i === 0 ? 1 : 0.75 }}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[13px] font-bold" style={{ color: soft }}>
                  {data.mix.map((m) => `${m.pct}% ${ARCHETYPES[m.id].name.replace("The ", "")}`).join(" · ")}
                </p>
              </div>
            )}

            {t >= T.hand && (
              <div className="mt-6 w-full">
                {!allFlipped && (
                  <p className="bm-fade-up mb-2 text-[13px] font-bold" style={{ color: soft }}>
                    Tap to deal your hand ({flipped.length}/{cards.length})
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  {cards.map((c, i) => {
                    const open = flipped.includes(i);
                    const wide = i >= 3;
                    return (
                      <button
                        key={i}
                        className={`bm-flip bm-fade-up text-left ${wide ? "col-span-2" : i === 2 ? "col-span-2" : ""}`}
                        style={{ animationDelay: `${i * 70}ms` }}
                        data-open={open}
                        onClick={() => {
                          if (open) return;
                          buzz(10);
                          tone(i * 2, 0.1);
                          setFlipped((f) => [...f, i]);
                        }}
                        aria-label={open ? `${c.k}: ${c.v}` : `Flip card ${i + 1}`}
                      >
                        <div className="bm-flip-inner">
                          <div className="bm-flip-face items-center" style={{ background: chip, border: `1.5px solid var(--bm-line)` }}>
                            <span className="opacity-70">
                              <ArchetypeMark id={a.id} size={30} color={a.color} />
                            </span>
                          </div>
                          <div className="bm-flip-back" style={{ background: "var(--bm-card)", color: "var(--bm-ink)", border: "1.5px solid var(--bm-line)" }}>
                            <span className="text-[11px] font-extrabold tracking-[0.18em]" style={{ color: a.color }}>
                              {c.k.toUpperCase()}
                            </span>
                            <span className="text-[1.05rem] font-extrabold leading-snug">{c.v}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!allFlipped && (
                  <button
                    className="mt-3 text-[12px] font-semibold underline opacity-70"
                    onClick={() => setFlipped(cards.map((_, i) => i))}
                  >
                    Flip them all
                  </button>
                )}
              </div>
            )}

            {allFlipped && (
              <div className="mt-6 flex w-full flex-col items-center gap-4">
                <p className="bm-fade-up max-w-[22rem] text-[1.1rem] font-bold leading-snug">{data.know}</p>
                <span
                  className="bm-stamp flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-extrabold"
                  style={{ background: ARCHETYPES[data.streak].color, color: ARCHETYPES[data.streak].ink, animationDelay: "0.3s" }}
                >
                  <ArchetypeMark id={data.streak} size={20} color={ARCHETYPES[data.streak].ink} stroke={8} />
                  {data.cusp ? `${a.name.replace("The ", "")}–${ARCHETYPES[data.streak].name.replace("The ", "")} cusp` : streakLine(data.streak)}
                </span>
                {data.note && <p className="text-[13px] font-semibold opacity-80">{data.note}</p>}
                <button
                  type="button"
                  onClick={data.next.onClick}
                  className="bm-btn bm-btn-brand bm-fade-up mt-2 w-full"
                  style={{ animationDelay: "0.5s" }}
                >
                  {data.next.label} →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
