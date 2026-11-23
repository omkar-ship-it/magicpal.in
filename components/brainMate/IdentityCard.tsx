"use client";

import { useEffect, useState } from "react";
import { ARCHETYPES, TRAITS, TRAIT_INFO, TRAIT_PRAISE, relationsOf, streakLine, type ArchetypeId, type Trait } from "@/lib/brainMate/archetypes";
import { OUTCOMES } from "@/lib/brainMate/compare";
import { showUp } from "@/lib/brainMate/score";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import type { CardPayload } from "@/lib/brainMate/payload";
import { QuickShare, WavelengthCta } from "./Share";

/**
 * Your archetype card, inside the overlay, in OpenNetworks' own look.
 *
 *   the card (mark, name, tagline, superpower) + Share
 *   → top strengths → Find your Brain-Mate → who you click with
 *   → three quiet rows that open on a tap: How you work · Your traits ·
 *     Your Wavelengths
 *   → Retake the game
 *
 * One accent for action (coral), the archetype's colour for identity, and
 * neutral for everything else. Section labels are small and grey; only
 * titles are semibold.
 */

const short = (id: ArchetypeId) => ARCHETYPES[id].name.replace("The ", "");

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium tracking-[0.12em] text-[var(--bm-soft)]">{children}</p>;
}

/** A quiet row that opens on a tap. */
function Fold({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-[var(--bm-line)] first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4">
        <span>
          <span className="block text-[15px] font-semibold">{title}</span>
          <span className="block text-[12.5px] text-[var(--bm-soft)]">{hint}</span>
        </span>
        <span className="text-[var(--bm-soft)] transition-transform duration-200 group-open:rotate-180" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

/** One trait as a line: your dot, and (if anyone has said) how others see you. */
function TraitLine({ k, me, them, color }: { k: Trait; me: number; them: number | null; color: string }) {
  const at = (z: number) => `${((Math.max(-2.5, Math.min(2.5, z)) / 2.5 + 1) / 2) * 100}%`;
  return (
    <div>
      <div className="flex justify-between text-[11.5px] text-[var(--bm-soft)]">
        <span>{TRAIT_INFO[k].lo}</span>
        <span className="font-medium text-[var(--bm-ink)]">{TRAIT_INFO[k].name}</span>
        <span>{TRAIT_INFO[k].hi}</span>
      </div>
      <div className="relative mt-1.5 h-1 rounded-full bg-[var(--bm-line)]">
        {them !== null && (
          <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--bm-soft)] bg-[var(--bm-card)]" style={{ left: at(them) }} />
        )}
        <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: at(me), background: color }} />
      </div>
    </div>
  );
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

  // How others see you, averaged — and the three traits where they differ from you most.
  const seen = card.views.length
    ? (Object.fromEntries(TRAITS.map((k) => [k, card.views.reduce((s, v) => s + v.traits[k], 0) / card.views.length])) as Record<Trait, number>)
    : null;
  const raters = [...new Set(card.views.map((v) => v.by))];
  const who = raters.length === 1 ? raters[0] : "Friends";
  const gaps = seen
    ? TRAITS.map((k) => ({ k, d: seen[k] - card.traits[k] }))
        .filter((x) => Math.abs(x.d) >= 0.6)
        .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
        .slice(0, 3)
    : [];
  const highlight: Trait[] = gaps.length
    ? gaps.map((g) => g.k)
    : TRAITS.map((k) => ({ k, z: card.traits[k] }))
        .sort((x, y) => Math.abs(y.z) - Math.abs(x.z))
        .slice(0, 3)
        .map((x) => x.k);
  const [allTraits, setAllTraits] = useState(false);

  // One row per person: two links with the same friend show once, newest first.
  const wavelengths = card.links.filter((l, i, all) => all.findIndex((m) => m.otherName.trim().toLowerCase() === l.otherName.trim().toLowerCase()) === i);
  const mix = card.mix.filter((m) => m.pct >= 10);

  useEffect(() => {
    if (!focusWavelength) return;
    const id = window.setTimeout(() => document.getElementById("today")?.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
    return () => window.clearTimeout(id);
  }, [focusWavelength]);

  return (
    <div className="flex flex-col gap-3 px-4 pb-8 pt-14">
      {/* ------------------------------------------------------- the card */}
      <section className="bm-card relative overflow-hidden text-center">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-44"
          style={{ background: `radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, ${a.color} 10%, transparent), transparent 70%)` }}
        />
        <div className="relative px-6 pb-6 pt-8">
          <Label>
            {first.toUpperCase()} · YOUR ARCHETYPE
          </Label>
          <span
            className="mx-auto mt-5 grid h-[92px] w-[92px] place-items-center rounded-full"
            style={{ background: a.color, boxShadow: `0 0 0 8px color-mix(in srgb, ${a.color} 12%, var(--bm-card)), 0 18px 36px -18px ${a.color}` }}
          >
            <span className={`bm-idle-${a.mode}`}>
              <ArchetypeMark id={a.id} size={54} color={a.ink} />
            </span>
          </span>
          <h2 className="bm-display mt-5 text-[2.2rem] leading-none">{a.name}</h2>
          <p className="mt-2 text-[15px] text-[var(--bm-soft)]">{a.tagline}</p>
          <p className="mx-auto mt-6 max-w-[19rem] text-[1.05rem] font-medium leading-snug">“{a.superpower}”</p>
          <div className="mt-6">
            <QuickShare
              label="Share my archetype"
              copy={false}
              url={card.origin.replace("://www.", "://")}
              text={`I'm ${a.name} on Brain-Mate — "${a.tagline}" What are you?`}
              image="/api/brain-mate/card"
              filename="my-archetype.png"
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- top strengths */}
      <section className="bm-card p-5">
        <Label>YOUR TOP STRENGTHS</Label>
        <div className="mt-3 flex flex-col gap-3">
          {top.map((t) => (
            <div key={t.k} className="flex gap-3">
              <span className="mt-[0.5em] h-1.5 w-1.5 flex-none rounded-full" style={{ background: a.color }} />
              <span>
                <span className="block text-[15px] font-semibold">{t.label}</span>
                <span className="block text-[13.5px] text-[var(--bm-soft)]">{t.line}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------- the one big action: find your Brain-Mate */}
      <section id="today" className="bm-card p-5" style={{ background: "var(--sunk)" }}>
        <WavelengthCta myName={card.name} origin={card.origin} today={card.today} autoOpen={focusWavelength} onOpenLink={onOpenLink} />
      </section>

      {/* ------------------------------------------------ who you click with */}
      <section className="bm-card p-5">
        <Label>WHO YOU CLICK WITH</Label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {people.map((p) => (
            <div key={p.kicker} className="flex flex-col items-center rounded-2xl bg-[var(--sunk)] px-2 py-3 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: ARCHETYPES[p.id].color }}>
                <ArchetypeMark id={p.id} size={24} color={ARCHETYPES[p.id].ink} stroke={7} />
              </span>
              <span className="mt-2 text-[11.5px] text-[var(--bm-soft)]">{p.kicker}</span>
              <span className="text-[13.5px] font-semibold leading-tight">{short(p.id)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------- three quiet rows */}
      <section className="bm-card px-5 py-1">
        <Fold title="How you work" hint="In a team, under pressure, and your next step">
          <dl className="grid gap-3 text-[14px] leading-snug">
            {[
              ["In a team", show.team],
              ["In conversation", show.talk],
              ["Under pressure", show.pressure],
              ["Work with me", `${a.give} ${a.dont}`],
            ].map(([k, line]) => (
              <div key={k}>
                <dt className="text-[12px] text-[var(--bm-soft)]">{k}</dt>
                <dd className="mt-0.5">{line}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-2xl bg-[var(--sunk)] p-4">
            <Label>YOUR GROWTH EDGE</Label>
            <p className="mt-1.5 text-[14px] font-medium leading-snug">{a.growthEdge}</p>
            <p className="mt-1.5 text-[13px] leading-snug text-[var(--bm-soft)]">This week: {a.thisWeek}</p>
          </div>
        </Fold>

        <Fold title="Your traits" hint={seen ? `Your mix, and how ${who} sees you` : "Your mix, and what stands out"}>
          {mix.length > 1 && (
            <div className="mb-5">
              <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--bm-line)]">
                {mix.map((m) => (
                  <span key={m.id} style={{ width: `${m.pct}%`, background: ARCHETYPES[m.id].color, opacity: m.id === a.id ? 1 : 0.55 }} />
                ))}
              </div>
              <p className="mt-2 text-[12.5px] text-[var(--bm-soft)]">
                {mix.map((m) => `${m.pct}% ${short(m.id)}`).join("  ·  ")} — {card.cusp ? `${short(a.id)}–${short(card.streak)} cusp` : streakLine(card.streak)}
              </p>
            </div>
          )}
          {gaps.length > 0 && (
            <ul className="mb-4 flex flex-col gap-1.5 text-[14px] leading-snug">
              {gaps.map((g) => (
                <li key={g.k}>
                  {who} {raters.length === 1 ? "sees" : "see"}{" "}
                  <b className="font-semibold">
                    {g.d > 0 ? "more" : "less"} {TRAIT_INFO[g.k].name.toLowerCase()}
                  </b>{" "}
                  in you than you do.
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-3.5">
            {(allTraits ? TRAITS : highlight).map((k) => (
              <TraitLine key={k} k={k} me={card.traits[k]} them={seen ? seen[k] : null} color={a.color} />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-[12px] text-[var(--bm-soft)]">
            <span>{seen ? `● you  ○ ${who}` : ""}</span>
            <button type="button" className="font-medium underline underline-offset-4" onClick={() => setAllTraits((v) => !v)}>
              {allTraits ? "Show fewer" : "See all 9"}
            </button>
          </div>
          <p className="mt-4 text-[13px] leading-snug text-[var(--bm-soft)]">{card.know}</p>
        </Fold>

        {wavelengths.length > 0 && (
          <Fold title="Your Wavelengths" hint={`${wavelengths.length} ${wavelengths.length === 1 ? "person" : "people"} so far`}>
            <div className="flex flex-col divide-y divide-[var(--bm-line)]">
              {wavelengths.map((l) => (
                <button key={l.slug} onClick={() => onOpenLink(l.slug)} className="flex items-center justify-between gap-3 py-2.5 text-left">
                  <span className="flex items-center gap-2.5">
                    <span
                      className="grid h-8 w-8 place-items-center rounded-full"
                      style={{ background: l.otherArchetype ? ARCHETYPES[l.otherArchetype].color : "var(--bm-line)" }}
                    >
                      {l.otherArchetype ? <ArchetypeMark id={l.otherArchetype} size={18} stroke={8} color={ARCHETYPES[l.otherArchetype].ink} /> : <span className="text-[13px]">?</span>}
                    </span>
                    <span className="text-[14px] font-medium">{l.otherName}</span>
                  </span>
                  <span className="text-[12.5px] text-[var(--bm-soft)]">
                    {l.outcome ? OUTCOMES[l.outcome].label : l.state === "waiting" ? "Waiting…" : l.state === "done" ? "Needs a rematch" : "Expired"} ›
                  </span>
                </button>
              ))}
            </div>
          </Fold>
        )}
      </section>

      <button type="button" className="mt-1 self-center text-[12.5px] text-[var(--bm-soft)] underline underline-offset-4" onClick={onReplay}>
        Retake the game
      </button>
    </div>
  );
}
