"use client";

import { ARCHETYPES, TRAITS, TRAIT_INFO, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { OUTCOMES, type Comparison } from "@/lib/brainMate/compare";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import { QuickShare } from "./Share";
import ViewForm from "./ViewForm";

/**
 * Two people's Wavelength, inside the overlay. No scores: the relationship
 * is the story. Ordered for usefulness:
 *
 *   the pair + Share → what you'll love about each other → where you click
 *   → working together (roles, ritual, watch out) → do this together
 *   → how you see each other → (side by side)
 *
 * Anyone who isn't one of the two gets the pair, the warm lines, and a way
 * to find their own Brain-Mate.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bm-card p-5">
      <p className="mb-2 text-[11.5px] font-bold tracking-[0.16em] text-[var(--bm-brand)]">{title}</p>
      {children}
    </section>
  );
}

const short = (id: ArchetypeId) => ARCHETYPES[id].name.replace("The ", "");

export default function CompareCard({
  c,
  slug,
  origin,
  player,
  viewerIsA,
  relation,
  viewGiven,
  onPlay,
}: {
  c: Comparison;
  slug: string;
  origin: string;
  player: boolean;
  viewerIsA: boolean;
  relation: "friend" | "colleague";
  viewGiven: boolean;
  /** For anyone who isn't one of the two: play and find your own. */
  onPlay?: () => void;
}) {
  const A = ARCHETYPES[c.a.archetype];
  const B = ARCHETYPES[c.b.archetype];
  const o = OUTCOMES[c.outcome];
  const url = `${origin}/brain-mate/${slug}`;

  const person = (name: string, id: ArchetypeId, side: "l" | "r") => (
    <div className="flex flex-1 flex-col items-center text-center">
      <div
        className={`grid h-[84px] w-[84px] place-items-center rounded-full ring-4 ring-[var(--bm-card)] ${side === "l" ? "bm-piece-left" : "bm-piece-right"}`}
        style={{ background: ARCHETYPES[id].color }}
      >
        <ArchetypeMark id={id} size={52} color={ARCHETYPES[id].ink} />
      </div>
      <p className="mt-2.5 text-[1.1rem] font-bold leading-tight">{name}</p>
      <p className="text-[12.5px] font-semibold" style={{ color: ARCHETYPES[id].color }}>
        {short(id)}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 px-4 pb-8 pt-4">
      {/* ----------------------------------------------------------- the pair */}
      <section className="bm-card overflow-hidden text-center">
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${A.color}, ${B.color})` }} />
        <div className="px-5 pb-6 pt-5">
          <p className="text-[11.5px] font-bold tracking-[0.14em] text-[var(--bm-soft)]">YOUR WAVELENGTH</p>
          <div className="mt-4 flex items-start">
            {person(c.a.name, A.id, "l")}
            <span className="mt-7 text-[1.4rem] font-light text-[var(--bm-soft)]">×</span>
            {person(c.b.name, B.id, "r")}
          </div>
          <p className="bm-display mt-5 text-[2.1rem] leading-none" style={{ color: o.color }}>
            {o.label}
          </p>
          <p className="mt-1.5 text-[14px] text-[var(--bm-soft)]">{o.stamp}</p>
          <p className="mx-auto mt-4 max-w-[22rem] text-[1.08rem] font-semibold leading-snug">“{c.dynamic}”</p>
          <div className="mt-5">
            {player ? (
              <QuickShare
                label="Share our Wavelength"
                url={url}
                text={`${c.a.name} × ${c.b.name}: ${o.label} on Brain-Mate. Find yours:`}
                image={`/brain-mate/${slug}/card`}
                filename={`${slug}.png`}
              />
            ) : (
              onPlay && (
                <button className="bm-btn bm-btn-brand w-full" onClick={onPlay}>
                  Find your Brain-Mate →
                </button>
              )
            )}
          </div>
        </div>
      </section>

      <Section title="WHAT YOU'LL LOVE ABOUT EACH OTHER">
        <div className="flex flex-col gap-2.5 text-[15px] leading-snug">
          {[
            { line: c.loves.aSees, color: A.color },
            { line: c.loves.bSees, color: B.color },
          ].map((x) => (
            <p key={x.line} className="flex gap-2.5">
              <span className="mt-[0.45em] h-2 w-2 shrink-0 rounded-full" style={{ background: x.color }} />
              <span>{x.line}</span>
            </p>
          ))}
        </div>
      </Section>

      <Section title="WHERE YOU CLICK">
        <ul className="flex flex-col gap-2 text-[15px] leading-snug">
          {c.click.map((x) => (
            <li key={x} className="flex gap-2.5">
              <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bm-brand)]" />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </Section>

      {player && (
        <>
          <Section title="WORKING TOGETHER">
            <p className="text-[15px] font-semibold leading-snug">{c.roles}</p>
            <p className="mt-2 text-[14px] text-[var(--bm-soft)]">{c.opposites}</p>
            {relation === "colleague" && <p className="mt-2 text-[14px] text-[var(--bm-soft)]">{viewerIsA ? c.workWith.aToB : c.workWith.bToA}</p>}
            <div className="mt-3 rounded-2xl bg-[var(--sunk)] px-4 py-3">
              <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--bm-soft)]">WATCH OUT</p>
              <p className="mt-0.5 text-[14px] leading-snug">{c.watchOut}</p>
              <p className="mt-2 text-[11px] font-bold tracking-[0.14em] text-[var(--bm-soft)]">ONE RITUAL</p>
              <p className="mt-0.5 text-[14px] leading-snug">{c.tryThis}</p>
            </div>
          </Section>

          <Section title="DO THIS TOGETHER">
            <p className="text-[15px] font-semibold leading-snug">{c.activity}</p>
            <p className="mt-2 text-[14px] text-[var(--bm-soft)]">{viewerIsA ? c.opener : `Ask ${c.a.name}: “${A.askMe}”`}</p>
          </Section>

          {!viewGiven && (
            <details className="bm-card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span>
                  <span className="block text-[14px] font-semibold">How does {viewerIsA ? c.b.name : c.a.name} come across to you?</span>
                  <span className="block text-[12.5px] text-[var(--bm-soft)]">20 seconds · sharpens their card</span>
                </span>
                <span className="text-[var(--bm-soft)] transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <div className="mt-4">
                <ViewForm slug={slug} other={viewerIsA ? c.b.name : c.a.name} />
              </div>
            </details>
          )}

          <details className="bm-card group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-semibold">
              Side by side <span className="text-[var(--bm-soft)] transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-4 flex flex-col gap-5">
              <div>
                <p className="mb-2 text-[12px] text-[var(--bm-soft)]">
                  <span style={{ color: A.color }}>●</span> {c.a.name} · <span style={{ color: B.color }}>○</span> {c.b.name}
                </p>
                {TRAITS.map((k) => (
                  <div key={k} className="mb-3">
                    <div className="flex justify-between text-[11.5px] text-[var(--bm-soft)]">
                      <span>{TRAIT_INFO[k].lo}</span>
                      <span className="font-semibold text-[var(--bm-ink)]">{TRAIT_INFO[k].name}</span>
                      <span>{TRAIT_INFO[k].hi}</span>
                    </div>
                    <div className="relative mt-1 h-1.5 rounded-full bg-[var(--bm-line)]">
                      <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${((c.a.traits[k] / 2.5 + 1) / 2) * 100}%`, background: A.color }} />
                      <span
                        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-[var(--bm-card)]"
                        style={{ left: `${((c.b.traits[k] / 2.5 + 1) / 2) * 100}%`, borderColor: B.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
