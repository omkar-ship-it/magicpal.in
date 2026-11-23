"use client";

import { ARCHETYPES, TRAITS, TRAIT_INFO, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { OUTCOMES, type Comparison } from "@/lib/brainMate/compare";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import { ShareButtons } from "./Share";
import ViewForm from "./ViewForm";

/**
 * Two people's Wavelength, inside the overlay. Ordered for usefulness:
 *
 *   hero → what you'll love about each other → where you click →
 *   where you differ, usefully → how to work together → watch out →
 *   do this together → how you see each other → (details)
 *
 * Anyone who isn't one of the two gets the hero and the warm lines only.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bm-card p-5">
      <p className="mb-2 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">{title}</p>
      {children}
    </section>
  );
}

export default function CompareCard({
  c,
  slug,
  origin,
  player,
  viewerIsA,
  relation,
  viewGiven,
}: {
  c: Comparison;
  slug: string;
  origin: string;
  player: boolean;
  viewerIsA: boolean;
  relation: "friend" | "colleague";
  viewGiven: boolean;
}) {
  const A = ARCHETYPES[c.a.archetype];
  const B = ARCHETYPES[c.b.archetype];
  const o = OUTCOMES[c.outcome];
  const url = `${origin}/brain-mate/${slug}`;

  const person = (name: string, id: ArchetypeId) => (
    <div className="flex flex-1 flex-col items-center text-center">
      <div className="grid h-[78px] w-[78px] place-items-center rounded-full" style={{ background: ARCHETYPES[id].color }}>
        <ArchetypeMark id={id} size={50} color={ARCHETYPES[id].ink} />
      </div>
      <p className="mt-2 text-[1.15rem] font-extrabold">{name}</p>
      <p className="text-[13px] font-bold" style={{ color: ARCHETYPES[id].color }}>
        {ARCHETYPES[id].name.replace("The ", "")}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 px-4 pb-8 pt-4">
      {/* ---------------------------------------------------------------- hero */}
      <section className="bm-card p-5 text-center">
        <p className="text-[12px] font-extrabold tracking-[0.2em] text-[var(--bm-brand)]">YOUR WAVELENGTH</p>
        <div className="mt-4 flex items-start">
          {person(c.a.name, A.id)}
          <span className="mt-6 text-[1.8rem] font-extrabold text-[var(--bm-brand)]">×</span>
          {person(c.b.name, B.id)}
        </div>
        <div className="bm-stamp mx-auto mt-4 inline-block whitespace-nowrap rounded-[14px] px-5 py-2 text-[clamp(1.2rem,6vw,1.6rem)] font-extrabold text-white" style={{ background: o.color }}>
          {o.label.toUpperCase()}
        </div>
        <p className="mt-2 text-[14px] text-[var(--bm-soft)]">{o.stamp}</p>
        <p className="mt-4 text-[1.15rem] font-extrabold leading-snug">“{c.dynamic}”</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <p className="bm-display text-[2.8rem]">{c.similarity}</p>
            <p className="text-[13px] font-bold">How alike</p>
          </div>
          <div>
            <p className="bm-display text-[2.8rem] text-[var(--bm-brand)]">{c.compatibility}</p>
            <p className="text-[13px] font-bold">How you complement each other</p>
          </div>
        </div>
      </section>

      <Section title="WHAT YOU'LL LOVE ABOUT EACH OTHER">
        <div className="flex flex-col gap-2.5 text-[15px] font-semibold leading-snug">
          <p>💛 {c.loves.aSees}</p>
          <p>💛 {c.loves.bSees}</p>
        </div>
      </Section>

      <Section title="WHERE YOU CLICK">
        <ul className="flex flex-col gap-2 text-[15px] font-semibold leading-snug">
          {c.click.map((x) => (
            <li key={x}>✦ {x}</li>
          ))}
        </ul>
      </Section>

      {player && (
        <>
          <Section title="WHERE YOU DIFFER — USEFULLY">
            <p className="text-[15px] font-semibold leading-snug">{c.opposites}</p>
          </Section>

          <Section title="HOW TO WORK TOGETHER">
            <p className="text-[15px] font-semibold leading-snug">{c.roles}</p>
            <p className="mt-2 text-[14px] text-[var(--bm-soft)]">One ritual: {c.tryThis}</p>
            {relation === "colleague" && <p className="mt-2 text-[14px] text-[var(--bm-soft)]">{viewerIsA ? c.workWith.aToB : c.workWith.bToA}</p>}
          </Section>

          <Section title="WATCH OUT">
            <p className="text-[15px] font-semibold leading-snug">{c.watchOut}</p>
          </Section>

          <Section title="DO THIS TOGETHER">
            <p className="text-[15px] font-semibold leading-snug">{c.activity}</p>
            <p className="mt-2 text-[14px] text-[var(--bm-soft)]">{viewerIsA ? c.opener : `Ask ${c.a.name}: “${A.askMe}”`}</p>
          </Section>

          {!viewGiven && (
            <section className="bm-card p-5">
              <ViewForm slug={slug} other={viewerIsA ? c.b.name : c.a.name} />
            </section>
          )}

          <section className="bm-card p-5">
            <p className="mb-3 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">SHARE YOUR WAVELENGTH</p>
            <ShareButtons url={url} text={`${c.a.name} × ${c.b.name}: ${o.label} on Brain-Mate.`} image={`/brain-mate/${slug}/card`} filename={`${slug}.png`} />
          </section>

          <details className="bm-card group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-extrabold">
              See the details <span className="transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-4 flex flex-col gap-5">
              <div>
                <p className="mb-2 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">HOW YOU FIT</p>
                {c.fit.map((f) => (
                  <div key={f.label} className="mb-2">
                    <div className="flex justify-between text-[13px] font-bold">
                      <span>{f.label}</span>
                      <span>{f.value}</span>
                    </div>
                    <div className="bm-bar mt-1">
                      <span style={{ width: `${Math.max(4, f.value)}%`, background: "var(--bm-brand)" }} />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-1 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">SIDE BY SIDE</p>
                <p className="mb-2 text-[12px] text-[var(--bm-soft)]">
                  ● {c.a.name} · ○ {c.b.name}
                </p>
                {TRAITS.map((k) => (
                  <div key={k} className="mb-3">
                    <p className="text-[13px] font-bold">{TRAIT_INFO[k].name}</p>
                    <div className="flex justify-between text-[11.5px] text-[var(--bm-soft)]">
                      <span>{TRAIT_INFO[k].lo}</span>
                      <span>{TRAIT_INFO[k].hi}</span>
                    </div>
                    <div className="relative mt-1 h-2 rounded-full bg-[var(--bm-line)]">
                      <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${((c.a.traits[k] / 2.5 + 1) / 2) * 100}%`, background: A.color }} />
                      <span
                        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-white"
                        style={{ left: `${((c.b.traits[k] / 2.5 + 1) / 2) * 100}%`, borderColor: B.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {c.replay.length > 0 && (
                <div>
                  <p className="mb-1 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">ANSWER REPLAY</p>
                  <div className="flex flex-col divide-y divide-[var(--bm-line)]">
                    {c.replay.map((r, i) => (
                      <div key={i} className="py-2.5">
                        <p className="text-[12px] font-bold text-[var(--bm-soft)]">
                          {r.title} {r.same ? "· SAME 🤝" : ""}
                        </p>
                        <div className="mt-1 grid grid-cols-2 gap-3 text-[13.5px]">
                          <p>
                            <b style={{ color: A.color }}>{c.a.name}:</b> {r.a}
                          </p>
                          <p>
                            <b style={{ color: B.color }}>{c.b.name}:</b> {r.b}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
