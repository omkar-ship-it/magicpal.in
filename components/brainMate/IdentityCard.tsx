"use client";

import { useState } from "react";
import { ARCHETYPES, TRAITS, TRAIT_INFO, TRAIT_PRAISE, relationsOf, streakLine, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { OUTCOMES } from "@/lib/brainMate/compare";
import { ENERGY } from "@/lib/brainMate/rounds";
import { TRAIT_COLOR, mixLine, showUp, strandsFor } from "@/lib/brainMate/score";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import type { CardPayload } from "@/lib/brainMate/payload";
import { DailyLink, IdentityShare } from "./Share";

/**
 * Your Brain-Mate card, inside the overlay. Ordered by what's most useful
 * and most affirming first:
 *
 *   hero → your top strengths → how you show up → your people →
 *   work with me → growth edge → actions
 *
 * The rest (eight traits, the mix, how it knew, your Wavelengths) folds
 * away under "See my full profile". The roast lives only on the share
 * image, where it earns its screenshots.
 */
export default function IdentityCard({ card, onOpenLink, onReplay }: { card: CardPayload; onOpenLink: (slug: string) => void; onReplay: () => void }) {
  const a = ARCHETYPES[card.archetype];
  const soft = a.ink === "#ffffff" ? "rgba(255,255,255,0.8)" : "rgba(42,30,0,0.72)";
  const chip = a.ink === "#ffffff" ? "rgba(255,255,255,0.16)" : "rgba(42,30,0,0.1)";
  const top = TRAITS.map((k) => ({ k, z: card.traits[k] }))
    .sort((x, y) => Math.abs(y.z) - Math.abs(x.z))
    .slice(0, 3)
    .map(({ k, z }) => ({ k, label: TRAIT_PRAISE[k][z >= 0 ? "hi" : "lo"][0], line: TRAIT_PRAISE[k][z >= 0 ? "hi" : "lo"][1] }));
  const show = showUp(card.traits);
  const rel = relationsOf(a.id);
  const twin = rel.BM[0];
  const duo = a.powerDuo[0];
  const sparring = a.edge.id;
  const seen = card.views.length
    ? Object.fromEntries(TRAITS.map((k) => [k, card.views.reduce((s, v) => s + v.traits[k], 0) / card.views.length]))
    : null;
  const raters = [...new Set(card.views.map((v) => v.by))];
  const [energyDone, setEnergyDone] = useState(Boolean(card.energy));

  const person = (id: ArchetypeId, kicker: string, why: string) => (
    <div className="flex items-center gap-3 rounded-[1.1rem] p-3" style={{ background: ARCHETYPES[id].tint }}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: ARCHETYPES[id].color }}>
        <ArchetypeMark id={id} size={26} color={ARCHETYPES[id].ink} stroke={7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-extrabold tracking-[0.14em]" style={{ color: ARCHETYPES[id].color }}>
          {kicker}
        </span>
        <span className="block text-[15px] font-extrabold">{ARCHETYPES[id].name}</span>
        <span className="block text-[13px] text-[var(--bm-soft)]">{why}</span>
      </span>
    </div>
  );

  return (
    <div className="pb-8">
      {/* ------------------------------------------------------------ hero */}
      <section className="px-5 pb-7 pt-12 text-center" style={{ background: a.color, color: a.ink }}>
        <div className="relative mx-auto grid h-[150px] w-[150px] place-items-center">
          <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
            {strandsFor(card.answers, card.name).map((s, i) => (
              <path key={i} d={s.d} stroke={a.ink} strokeWidth={s.width} strokeOpacity={0.28} fill="none" strokeLinecap="round" />
            ))}
          </svg>
          <span className="grid h-[104px] w-[104px] place-items-center rounded-full" style={{ background: chip }}>
            <span className={`bm-idle-${a.mode}`}>
              <ArchetypeMark id={a.id} size={70} color={a.ink} />
            </span>
          </span>
        </div>
        <p className="mt-2 text-[12px] font-extrabold tracking-[0.2em]" style={{ color: soft }}>
          {card.name.split(" ")[0].toUpperCase()}, YOU ARE
        </p>
        <h2 className="bm-display mt-1 text-[clamp(2rem,9vw,2.5rem)]">{a.name.toUpperCase()}</h2>
        <p className="text-[1.05rem] font-semibold" style={{ color: soft }}>
          {a.tagline}
        </p>
        <p className="mt-2 text-[13px] font-bold" style={{ color: soft }}>
          {card.cusp ? `A ${a.name.replace("The ", "")}–${ARCHETYPES[card.streak].name.replace("The ", "")} cusp · ` : ""}
          {mixLine(card.mix)}
        </p>
        {card.rarity !== null && (
          <span className="mt-2 inline-block rounded-full px-3 py-1 text-[12px] font-extrabold" style={{ background: chip }}>
            ◆ 1 in {Math.max(2, Math.round(1 / Math.max(card.rarity, 0.01)))} people
          </span>
        )}
        <div className="mt-5 rounded-[1.3rem] p-4" style={{ background: chip }}>
          <p className="text-[11px] font-extrabold tracking-[0.2em]" style={{ color: soft }}>
            ✦ YOUR SUPERPOWER ✦
          </p>
          <p className="mt-1 text-[1.2rem] font-extrabold leading-snug">{a.superpower}</p>
        </div>
      </section>

      <div className="flex flex-col gap-3 px-4 pt-4">
        {/* ---------------------------------------------- top strengths */}
        <section className="bm-card p-5">
          <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">YOUR TOP STRENGTHS</p>
          <p className="mt-0.5 text-[13px] text-[var(--bm-soft)]">The three things that stood out most in your answers.</p>
          <div className="mt-4 flex flex-col gap-3">
            {top.map((t, i) => (
              <div key={t.k} className="bm-fade-up flex items-center gap-3" style={{ animationDelay: `${i * 90}ms` }}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[1.05rem] font-extrabold text-white" style={{ background: TRAIT_COLOR[t.k] }}>
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[1.05rem] font-extrabold">{t.label}</span>
                  <span className="block text-[14px] text-[var(--bm-soft)]">{t.line}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------- how you show up */}
        <section className="bm-card p-5">
          <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">HOW YOU SHOW UP</p>
          <div className="mt-3 flex flex-col gap-3">
            {[
              ["👥", "In a team", show.team],
              ["💬", "In conversation", show.talk],
              ["🔥", "Under pressure", show.pressure],
            ].map(([e, k, line]) => (
              <div key={k} className="flex gap-3">
                <span className="text-[1.4rem]" aria-hidden="true">
                  {e}
                </span>
                <span>
                  <span className="block text-[12px] font-extrabold tracking-[0.1em] text-[var(--bm-soft)]">{k.toUpperCase()}</span>
                  <span className="block text-[15px] font-semibold leading-snug">{line}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------ your people */}
        <section className="bm-card p-5">
          <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">YOUR PEOPLE</p>
          <div className="mt-3 flex flex-col gap-2.5">
            {person(duo, "POWER DUO", `The half you don't have — ${ARCHETYPES[duo].tagline.charAt(0).toLowerCase()}${ARCHETYPES[duo].tagline.slice(1)}`)}
            {twin && person(twin, "MIND TWIN", "Thinks the way you do. Instant chemistry.")}
            {person(sparring, a.edge.kind === "clash" ? "SPARRING PARTNER" : "YOUR OPPOSITE", "Challenges you in all the useful ways.")}
          </div>
          <a href="#today" className="bm-btn bm-btn-brand mt-4 w-full">
            Find yours — send today&apos;s Wavelength
          </a>
        </section>

        {/* ---------------------------------------------------- work with me */}
        <section className="bm-card p-5">
          <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">WORK WITH ME</p>
          <p className="mt-2 text-[15px] font-bold">{a.give}</p>
          <p className="mt-1 text-[14px] text-[var(--bm-soft)]">{a.dont}</p>
          <p className="mt-2 text-[14px] text-[var(--bm-soft)]">I&apos;m at my best when {a.bestWhen}.</p>
        </section>

        {/* ----------------------------------------------------- growth edge */}
        <section className="bm-card p-5">
          <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">YOUR GROWTH EDGE</p>
          <p className="mt-2 text-[1.05rem] font-bold leading-snug">{a.growthEdge}</p>
          <div className="mt-3 rounded-[1rem] bg-[#FFF1EC] p-4">
            <p className="text-[11px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">TRY THIS WEEK</p>
            <p className="mt-1 text-[15px] font-semibold">{a.thisWeek}</p>
          </div>
        </section>

        {/* --------------------------------------------------------- actions */}
        <section id="today" className="bm-card p-5">
          <DailyLink myName={card.name} origin={card.origin} today={card.today} />
        </section>
        <section className="bm-card p-5">
          <p className="mb-3 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">SHARE YOUR CARD</p>
          <IdentityShare archetypeName={a.name} origin={card.origin} />
        </section>

        {!energyDone && (
          <section className="bm-card p-5">
            <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-soft)]">ONE OPTIONAL QUESTION</p>
            <p className="mt-1 text-[15px] font-bold">What&apos;s taking most of your energy these days?</p>
            <p className="mt-0.5 text-[12.5px] text-[var(--bm-soft)]">Never part of your result — it helps us check the game is fair to everyone.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ENERGY.map((e) => (
                <button
                  key={e.id}
                  className="rounded-full border-[1.5px] border-[var(--bm-line)] bg-white px-3 py-1.5 text-[13.5px] font-semibold"
                  onClick={async () => {
                    setEnergyDone(true);
                    await fetch("/api/brain-mate/energy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ energy: e.id }) }).catch(() => {});
                  }}
                >
                  {e.emoji} {e.label}
                </button>
              ))}
              <button className="px-2 text-[13px] text-[var(--bm-soft)] underline" onClick={() => setEnergyDone(true)}>
                Skip
              </button>
            </div>
          </section>
        )}

        {/* ------------------------------------------------- full profile */}
        <details className="bm-card group p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-extrabold">
            See my full profile <span className="transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-4 flex flex-col gap-5">
            <div>
              <p className="mb-2 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">YOUR MIND MIX</p>
              {card.mix.map((m) => (
                <div key={m.id} className="mb-1.5 flex items-center gap-3">
                  <span className="w-24 text-[14px] font-bold">{ARCHETYPES[m.id].name.replace("The ", "")}</span>
                  <div className="bm-bar flex-1">
                    <span style={{ width: `${m.pct}%`, background: ARCHETYPES[m.id].color }} />
                  </div>
                  <span className="w-10 text-right text-[13px] font-bold">{m.pct}%</span>
                </div>
              ))}
              <p className="mt-1 text-[12.5px] text-[var(--bm-soft)]">{streakLine(card.streak)} — you&apos;re a blend, not a box.</p>
            </div>
            <div>
              <p className="mb-1 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">YOUR EIGHT TRAITS</p>
              {seen && (
                <p className="mb-2 text-[12px] text-[var(--bm-soft)]">
                  ● you · ○ how {raters.join(" & ")} {raters.length > 1 ? "see" : "sees"} you
                </p>
              )}
              <div className="flex flex-col gap-3">
                {TRAITS.map((k) => (
                  <div key={k}>
                    <p className="text-[13px] font-bold">{TRAIT_INFO[k].name}</p>
                    <div className="flex justify-between text-[11.5px] text-[var(--bm-soft)]">
                      <span>{TRAIT_INFO[k].lo}</span>
                      <span>{TRAIT_INFO[k].hi}</span>
                    </div>
                    <div className="relative mt-1 h-2 rounded-full bg-[var(--bm-line)]">
                      {seen && (
                        <span
                          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--bm-ink)] bg-white"
                          style={{ left: `${((Math.max(-2.5, Math.min(2.5, seen[k])) / 2.5 + 1) / 2) * 100}%` }}
                        />
                      )}
                      <span
                        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{ left: `${((card.traits[k] / 2.5 + 1) / 2) * 100}%`, background: a.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">HOW DID IT KNOW</p>
              <p className="text-[15px] font-bold leading-snug">{card.know}</p>
            </div>
            {card.links.length > 0 && (
              <div>
                <p className="mb-1 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">MY WAVELENGTHS</p>
                <div className="flex flex-col divide-y divide-[var(--bm-line)]">
                  {card.links.map((l) => (
                    <button key={l.slug} onClick={() => onOpenLink(l.slug)} className="flex items-center justify-between gap-3 py-2.5 text-left">
                      <span className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: l.otherArchetype ? ARCHETYPES[l.otherArchetype].color : "var(--bm-line)" }}>
                          {l.otherArchetype ? <ArchetypeMark id={l.otherArchetype} size={18} stroke={8} color={ARCHETYPES[l.otherArchetype].ink} /> : <span className="text-[13px] font-bold">?</span>}
                        </span>
                        <span className="text-[14.5px] font-bold">{l.otherName}</span>
                      </span>
                      <span className="text-[12.5px] font-extrabold" style={{ color: l.outcome ? OUTCOMES[l.outcome].color : "var(--bm-soft)" }}>
                        {l.outcome ? OUTCOMES[l.outcome].label : l.state === "waiting" ? "Waiting…" : l.state === "done" ? "Needs a retake" : "Expired"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button className="self-start text-[13px] font-semibold text-[var(--bm-soft)] underline" onClick={onReplay}>
              Play again
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
