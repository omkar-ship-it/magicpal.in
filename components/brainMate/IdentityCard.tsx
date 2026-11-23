"use client";

import { useEffect, useState } from "react";
import { ARCHETYPES, TRAITS, TRAIT_INFO, TRAIT_PRAISE, relationsOf, streakLine, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { OUTCOMES } from "@/lib/brainMate/compare";
import { ENERGY } from "@/lib/brainMate/rounds";
import { TRAIT_COLOR, showUp, strandsFor } from "@/lib/brainMate/score";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import type { CardPayload } from "@/lib/brainMate/payload";
import { QuickShare, WavelengthCta } from "./Share";

/**
 * Your archetype card, inside the overlay. Four things, in order:
 *
 *   the card itself (your colour, your mark, your superpower) + Share
 *   → your top strengths → FIND YOUR BRAIN-MATE (the one big action)
 *   → who you click with
 *
 * Everything else (how you show up, growth edge, the mix, nine traits, how
 * it knew, work with me, your Wavelengths) folds away under "More about you".
 */

const tintOf = (color: string) => `color-mix(in srgb, ${color} 13%, var(--bm-card))`;
const short = (id: ArchetypeId) => ARCHETYPES[id].name.replace("The ", "");

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="text-[11.5px] font-bold tracking-[0.16em] text-[var(--bm-brand)]">{children}</p>;
}

export default function IdentityCard({
  card,
  onOpenLink,
  onReplay,
  focusWavelength = false,
}: {
  card: CardPayload;
  onOpenLink: (slug: string) => void;
  onReplay: () => void;
  /** Opened from "Find your Brain-Mate": scroll to it and open the name field. */
  focusWavelength?: boolean;
}) {
  const a = ARCHETYPES[card.archetype];
  const first = card.name.split(" ")[0];
  const top = TRAITS.map((k) => ({ k, z: card.traits[k] }))
    .sort((x, y) => Math.abs(y.z) - Math.abs(x.z))
    .slice(0, 3)
    .map(({ k, z }) => ({ k, label: TRAIT_PRAISE[k][z >= 0 ? "hi" : "lo"][0], line: TRAIT_PRAISE[k][z >= 0 ? "hi" : "lo"][1] }));
  const show = showUp(card.traits);
  const twin = relationsOf(a.id).BM[0];
  const people: { id: ArchetypeId; kicker: string }[] = [
    { id: a.powerDuo[0], kicker: "Power Duo" },
    ...(twin ? [{ id: twin, kicker: "Mind Twin" }] : []),
    { id: a.edge.id, kicker: a.edge.kind === "clash" ? "Sparring partner" : "Your opposite" },
  ];
  const seen = card.views.length
    ? Object.fromEntries(TRAITS.map((k) => [k, card.views.reduce((s, v) => s + v.traits[k], 0) / card.views.length]))
    : null;
  const raters = [...new Set(card.views.map((v) => v.by))];
  const [energyDone, setEnergyDone] = useState(Boolean(card.energy));
  const soft = a.ink === "#ffffff" ? "rgba(255,255,255,0.8)" : "rgba(36,26,22,0.72)";
  const glass = a.ink === "#ffffff" ? "rgba(255,255,255,0.15)" : "rgba(36,26,22,0.08)";

  useEffect(() => {
    if (!focusWavelength) return;
    const id = window.setTimeout(() => document.getElementById("today")?.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
    return () => window.clearTimeout(id);
  }, [focusWavelength]);

  return (
    <div className="flex flex-col gap-3 px-4 pb-8 pt-14">
      {/* ------------------------------------------------------- the card */}
      <section
        className="relative overflow-hidden rounded-[28px] px-6 pb-6 pt-7 text-center shadow-[0_24px_50px_-28px_rgba(0,0,0,0.55)]"
        style={{ background: a.color, color: a.ink }}
      >
        <svg viewBox="0 0 400 400" className="pointer-events-none absolute -right-24 -top-24 h-[340px] w-[340px]" aria-hidden="true">
          {strandsFor(card.answers, card.name).map((s, i) => (
            <path key={i} d={s.d} stroke={a.ink} strokeWidth={s.width} strokeOpacity={0.16} fill="none" strokeLinecap="round" />
          ))}
        </svg>
        <p className="relative text-[11.5px] font-bold tracking-[0.2em]" style={{ color: soft }}>
          {first.toUpperCase()}, YOUR ARCHETYPE
        </p>
        <span className="relative mx-auto mt-4 grid h-[104px] w-[104px] place-items-center rounded-full" style={{ background: glass }}>
          <span className={`bm-idle-${a.mode}`}>
            <ArchetypeMark id={a.id} size={68} color={a.ink} />
          </span>
        </span>
        <h2 className="bm-display relative mt-4 text-[2.3rem] leading-none">{a.name}</h2>
        <p className="relative mt-1.5 text-[15.5px]" style={{ color: soft }}>
          {a.tagline}
        </p>
        <p className="relative mt-5 text-[11px] font-bold tracking-[0.18em]" style={{ color: soft }}>
          SUPERPOWER
        </p>
        <p className="relative mx-auto mt-1 max-w-[20rem] text-[1.1rem] font-bold leading-snug">{a.superpower}</p>
        <div className="relative mt-4 flex flex-wrap justify-center gap-1.5">
          {card.mix.map((m) => (
            <span key={m.id} className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: glass }}>
              {m.pct}% {short(m.id)}
            </span>
          ))}
        </div>
        <div className="relative mt-6">
          <QuickShare
            tone="light"
            label="Share my archetype"
            url={`${card.origin}/brain-mate`}
            text={`I'm ${a.name} on Brain-Mate — "${a.tagline}" What are you?`}
            image="/api/brain-mate/card"
            filename="my-archetype.png"
          />
        </div>
      </section>

      {/* ------------------------------------------------- top strengths */}
      <section className="bm-card p-5">
        <Kicker>YOUR TOP STRENGTHS</Kicker>
        <div className="mt-3 flex flex-col gap-3">
          {top.map((t) => (
            <div key={t.k} className="flex items-center gap-3">
              <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: TRAIT_COLOR[t.k] }} />
              <span>
                <span className="block text-[15.5px] font-bold">{t.label}</span>
                <span className="block text-[13.5px] text-[var(--bm-soft)]">{t.line}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------- the one big action: find your Brain-Mate */}
      <section id="today" className="bm-card p-5" style={{ background: "var(--sunk)" }}>
        <WavelengthCta myName={card.name} origin={card.origin} today={card.today} autoOpen={focusWavelength} />
      </section>

      {/* ------------------------------------------------ who you click with */}
      <section className="bm-card p-5">
        <Kicker>WHO YOU CLICK WITH</Kicker>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {people.map((p) => (
            <div key={p.kicker} className="flex flex-col items-center rounded-2xl p-2.5 text-center" style={{ background: tintOf(ARCHETYPES[p.id].color) }}>
              <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: ARCHETYPES[p.id].color }}>
                <ArchetypeMark id={p.id} size={24} color={ARCHETYPES[p.id].ink} stroke={7} />
              </span>
              <span className="mt-1.5 text-[11px] font-semibold text-[var(--bm-soft)]">{p.kicker}</span>
              <span className="text-[13px] font-bold leading-tight">{short(p.id)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- more about you */}
      <details className="bm-card group p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-semibold">
          More about you <span className="text-[var(--bm-soft)] transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-4 flex flex-col gap-5">
          <div>
            <Kicker>HOW YOU SHOW UP</Kicker>
            <dl className="mt-2 grid gap-2.5 text-[14.5px]">
              {[
                ["In a team", show.team],
                ["In conversation", show.talk],
                ["Under pressure", show.pressure],
              ].map(([k, line]) => (
                <div key={k}>
                  <dt className="text-[12px] font-semibold text-[var(--bm-soft)]">{k}</dt>
                  <dd className="font-semibold leading-snug">{line}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <Kicker>YOUR GROWTH EDGE</Kicker>
            <p className="mt-1.5 text-[14.5px] font-semibold leading-snug">{a.growthEdge}</p>
            <p className="mt-1.5 text-[13.5px] text-[var(--bm-soft)]">
              <b className="text-[var(--bm-ink)]">This week:</b> {a.thisWeek}
            </p>
          </div>
          <div>
            <Kicker>YOUR MIND MIX</Kicker>
            <div className="mt-2">
              {card.mix.map((m) => (
                <div key={m.id} className="mb-1.5 flex items-center gap-3">
                  <span className="w-24 text-[13.5px] font-semibold">{short(m.id)}</span>
                  <div className="bm-bar flex-1">
                    <span style={{ width: `${m.pct}%`, background: ARCHETYPES[m.id].color }} />
                  </div>
                  <span className="w-10 text-right text-[13px] font-semibold">{m.pct}%</span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[12.5px] text-[var(--bm-soft)]">
              {card.cusp ? `${short(a.id)}–${short(card.streak)} cusp` : streakLine(card.streak)} — a blend, not a box.
            </p>
          </div>
          <div>
            <Kicker>YOUR NINE TRAITS</Kicker>
            {seen && (
              <p className="mt-1 text-[12px] text-[var(--bm-soft)]">
                ● you · ○ how {raters.join(" & ")} {raters.length > 1 ? "see" : "sees"} you
              </p>
            )}
            <div className="mt-2 flex flex-col gap-3">
              {TRAITS.map((k) => (
                <div key={k}>
                  <div className="flex justify-between text-[11.5px] text-[var(--bm-soft)]">
                    <span>{TRAIT_INFO[k].lo}</span>
                    <span className="font-semibold text-[var(--bm-ink)]">{TRAIT_INFO[k].name}</span>
                    <span>{TRAIT_INFO[k].hi}</span>
                  </div>
                  <div className="relative mt-1 h-1.5 rounded-full bg-[var(--bm-line)]">
                    {seen && (
                      <span
                        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--bm-ink)] bg-[var(--bm-card)]"
                        style={{ left: `${((Math.max(-2.5, Math.min(2.5, seen[k])) / 2.5 + 1) / 2) * 100}%` }}
                      />
                    )}
                    <span
                      className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ left: `${((card.traits[k] / 2.5 + 1) / 2) * 100}%`, background: a.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Kicker>WORK WITH ME</Kicker>
            <p className="mt-1.5 text-[14.5px] font-semibold">{a.give}</p>
            <p className="text-[13.5px] text-[var(--bm-soft)]">
              {a.dont} I&apos;m at my best when {a.bestWhen}.
            </p>
          </div>
          <div>
            <Kicker>HOW DID IT KNOW</Kicker>
            <p className="mt-1.5 text-[14.5px] font-semibold leading-snug">{card.know}</p>
          </div>
          {card.links.length > 0 && (
            <div>
              <Kicker>YOUR WAVELENGTHS</Kicker>
              <div className="mt-1 flex flex-col divide-y divide-[var(--bm-line)]">
                {card.links.map((l) => (
                  <button key={l.slug} onClick={() => onOpenLink(l.slug)} className="flex items-center justify-between gap-3 py-2.5 text-left">
                    <span className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: l.otherArchetype ? ARCHETYPES[l.otherArchetype].color : "var(--bm-line)" }}>
                        {l.otherArchetype ? <ArchetypeMark id={l.otherArchetype} size={18} stroke={8} color={ARCHETYPES[l.otherArchetype].ink} /> : <span className="text-[13px] font-bold">?</span>}
                      </span>
                      <span className="text-[14px] font-semibold">{l.otherName}</span>
                    </span>
                    <span className="text-[12.5px] font-semibold" style={{ color: l.outcome ? OUTCOMES[l.outcome].color : "var(--bm-soft)" }}>
                      {l.outcome ? OUTCOMES[l.outcome].label : l.state === "waiting" ? "Waiting…" : l.state === "done" ? "Needs a rematch" : "Expired"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-semibold">
            <a className="text-[var(--bm-brand)]" href="/api/brain-mate/card?v=colleague" target="_blank" rel="noopener noreferrer">
              Work-safe image (no guilty habit)
            </a>
            <button className="text-[var(--bm-soft)] underline" onClick={onReplay}>
              Play again
            </button>
          </div>
        </div>
      </details>

      {!energyDone && (
        <section className="rounded-[1.25rem] border border-dashed border-[var(--bm-line)] p-4">
          <p className="text-[13.5px] font-semibold">Optional: what&apos;s taking most of your energy these days?</p>
          <p className="text-[12px] text-[var(--bm-soft)]">Never part of your result — it helps us keep the game fair to everyone.</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {ENERGY.map((e) => (
              <button
                key={e.id}
                className="rounded-full border border-[var(--bm-line)] bg-[var(--bm-card)] px-3 py-1.5 text-[13px] font-medium"
                onClick={async () => {
                  setEnergyDone(true);
                  await fetch("/api/brain-mate/energy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ energy: e.id }) }).catch(() => {});
                }}
              >
                {e.emoji} {e.label}
              </button>
            ))}
            <button className="px-2 text-[12.5px] text-[var(--bm-soft)] underline" onClick={() => setEnergyDone(true)}>
              Skip
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
