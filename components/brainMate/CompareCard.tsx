"use client";

import { useState } from "react";
import { ARCHETYPES, TRAITS, TRAIT_INFO, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { OUTCOMES, type Comparison } from "@/lib/brainMate/compare";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import { QuickShare } from "./Share";
import ViewForm from "./ViewForm";

/**
 * Two people's Wavelength, inside the overlay. No scores: the relationship
 * is the story. Three cards and two quiet rows:
 *
 *   the pair + Share
 *   → The two of you (what you'll love about each other, where you click)
 *   → Working together (who does what, how you differ, watch out, ritual)
 *   → Do this together (the activity, an opener)
 *   → quiet rows: how they come across to you · side by side
 *   → Challenge someone else
 *
 * Same visual rules as the archetype card: grey section labels, regular
 * body text, the outcome's own colour for the result, coral only for
 * actions. Anyone who isn't one of the two gets the pair, the warm lines,
 * and a way to find their own Brain-Mate.
 */

const short = (id: ArchetypeId) => ARCHETYPES[id].name.replace("The ", "");

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium tracking-[0.12em] text-[var(--bm-soft)]">{children}</p>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bm-card p-5">
      <Label>{title}</Label>
      <div className="mt-3">{children}</div>
    </section>
  );
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

function Dot({ color }: { color: string }) {
  return <span className="mt-[0.5em] h-1.5 w-1.5 flex-none rounded-full" style={{ background: color }} />;
}

export default function CompareCard({
  c,
  slug,
  origin,
  player,
  viewerIsA,
  relation,
  viewGiven,
  onPlay,
  onChallenge,
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
  /** For the two of them: the next challenge, with someone else. */
  onChallenge?: () => void;
}) {
  const A = ARCHETYPES[c.a.archetype];
  const B = ARCHETYPES[c.b.archetype];
  const o = OUTCOMES[c.outcome];
  const url = `${origin}/brain-mate/${slug}`;
  const [allTraits, setAllTraits] = useState(false);

  // Where the two of you differ most — said in words first, the lines after.
  const diffs = TRAITS.map((k) => ({ k, d: c.a.traits[k] - c.b.traits[k] }))
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
    .slice(0, 3)
    .filter((x) => Math.abs(x.d) >= 0.6);
  const shown = allTraits ? TRAITS : diffs.length ? diffs.map((x) => x.k) : TRAITS.slice(0, 3);
  const at = (z: number) => `${((Math.max(-2.5, Math.min(2.5, z)) / 2.5 + 1) / 2) * 100}%`;

  const person = (name: string, id: ArchetypeId, side: "l" | "r") => (
    <div className="flex flex-1 flex-col items-center text-center">
      <div
        className={`grid h-[80px] w-[80px] place-items-center rounded-full ring-4 ring-[var(--bm-card)] ${side === "l" ? "bm-piece-left" : "bm-piece-right"}`}
        style={{ background: ARCHETYPES[id].color }}
      >
        <ArchetypeMark id={id} size={50} color={ARCHETYPES[id].ink} />
      </div>
      <p className="mt-2.5 text-[1.05rem] font-semibold leading-tight">{name}</p>
      <p className="text-[12.5px]" style={{ color: ARCHETYPES[id].color }}>
        {short(id)}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 px-4 pb-8 pt-4">
      {/* ----------------------------------------------------------- the pair */}
      <section className="bm-card overflow-hidden text-center">
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${A.color}, ${B.color})` }} />
        <div className="px-5 pb-6 pt-5">
          <Label>YOUR WAVELENGTH</Label>
          <div className="mt-4 flex items-start">
            {person(c.a.name, A.id, "l")}
            <span className="mt-7 text-[1.3rem] font-light text-[var(--bm-soft)]">×</span>
            {person(c.b.name, B.id, "r")}
          </div>
          <p className="bm-display mt-5 text-[2rem] leading-none" style={{ color: o.color }}>
            {o.label}
          </p>
          <p className="mt-2 text-[14px] text-[var(--bm-soft)]">{o.stamp}</p>
          <p className="mx-auto mt-4 max-w-[22rem] text-[1.02rem] font-medium leading-snug">“{c.dynamic}”</p>
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

      {/* ------------------------------------------------- the two of you */}
      <Card title="THE TWO OF YOU">
        <div className="flex flex-col gap-2.5 text-[14.5px] leading-snug">
          {[
            { line: c.loves.aSees, color: A.color },
            { line: c.loves.bSees, color: B.color },
          ].map((x) => (
            <p key={x.line} className="flex gap-2.5">
              <Dot color={x.color} />
              <span>{x.line}</span>
            </p>
          ))}
        </div>
        {c.click.length > 0 && (
          <>
            <p className="mt-4 text-[12px] text-[var(--bm-soft)]">Where you click</p>
            <ul className="mt-1.5 flex flex-col gap-1.5 text-[14.5px] leading-snug">
              {c.click.map((x) => (
                <li key={x} className="flex gap-2.5">
                  <Dot color="var(--bm-soft)" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {player && (
        <>
          {/* ------------------------------------------- working together */}
          <Card title="WORKING TOGETHER">
            <p className="text-[15px] font-semibold leading-snug">{c.roles}</p>
            <p className="mt-1.5 text-[14px] leading-snug text-[var(--bm-soft)]">{c.opposites}</p>
            {relation === "colleague" && <p className="mt-1.5 text-[14px] leading-snug text-[var(--bm-soft)]">{viewerIsA ? c.workWith.aToB : c.workWith.bToA}</p>}
            <div className="mt-4 grid gap-3 rounded-2xl bg-[var(--sunk)] p-4 text-[14px] leading-snug">
              <div>
                <Label>WATCH OUT</Label>
                <p className="mt-1">{c.watchOut}</p>
              </div>
              <div>
                <Label>ONE RITUAL</Label>
                <p className="mt-1">{c.tryThis}</p>
              </div>
            </div>
          </Card>

          {/* -------------------------------------------- do this together */}
          <Card title="DO THIS TOGETHER">
            <p className="text-[15px] font-semibold leading-snug">{c.activity}</p>
            <p className="mt-1.5 text-[14px] leading-snug text-[var(--bm-soft)]">{viewerIsA ? c.opener : `Ask ${c.a.name}: “${A.askMe}”`}</p>
          </Card>

          {/* ----------------------------------------------- quiet rows */}
          <section className="bm-card px-5 py-1">
            {!viewGiven && (
              <Fold title={`How does ${viewerIsA ? c.b.name : c.a.name} come across to you?`} hint="20 seconds · sharpens their card">
                <ViewForm bare slug={slug} other={viewerIsA ? c.b.name : c.a.name} />
              </Fold>
            )}
            <Fold title="Side by side" hint={diffs.length ? "Where you two differ most" : "Your nine traits"}>
              {diffs.length > 0 && (
                <ul className="mb-4 flex flex-col gap-1.5 text-[14px] leading-snug">
                  {diffs.map(({ k, d }) => {
                    const [hi, lo] = d > 0 ? [c.a.name, c.b.name] : [c.b.name, c.a.name];
                    return (
                      <li key={k}>
                        <b className="font-semibold">{TRAIT_INFO[k].name}:</b> {hi} leans “{TRAIT_INFO[k].hi.toLowerCase()}”, {lo} “{TRAIT_INFO[k].lo.toLowerCase()}”.
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex flex-col gap-3.5">
                {shown.map((k) => (
                  <div key={k}>
                    <div className="flex justify-between text-[11.5px] text-[var(--bm-soft)]">
                      <span>{TRAIT_INFO[k].lo}</span>
                      <span className="font-medium text-[var(--bm-ink)]">{TRAIT_INFO[k].name}</span>
                      <span>{TRAIT_INFO[k].hi}</span>
                    </div>
                    <div className="relative mt-1.5 h-1 rounded-full bg-[var(--bm-line)]">
                      <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: at(c.a.traits[k]), background: A.color }} />
                      <span
                        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-[var(--bm-card)]"
                        style={{ left: at(c.b.traits[k]), borderColor: B.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-[12px] text-[var(--bm-soft)]">
                <span>
                  <span style={{ color: A.color }}>●</span> {c.a.name} <span style={{ color: B.color }}>○</span> {c.b.name}
                </span>
                <button type="button" className="font-medium underline underline-offset-4" onClick={() => setAllTraits((v) => !v)}>
                  {allTraits ? "Show fewer" : "See all 9"}
                </button>
              </div>
            </Fold>
          </section>

          {/* ------------------------------------------------- what next */}
          {onChallenge && (
            <button type="button" className="bm-btn bm-btn-ghost mt-1 w-full" onClick={onChallenge}>
              Challenge someone else →
            </button>
          )}
        </>
      )}
    </div>
  );
}
