import Link from "next/link";
import { ARCHETYPES, TRAITS, TRAIT_INFO, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { OUTCOMES, type Comparison } from "@/lib/brainMate/compare";
import { ArchetypeMark } from "@/lib/brainMate/symbols";

/**
 * A finished Wavelength. `full` is what the two players see — breakdowns,
 * both sets of sliders, the watch-out, the replay. Everyone else with the
 * link gets the compact card: enough to be an advert, nothing that reads
 * like a file on either of them.
 */

function Person({ name, id }: { name: string; id: ArchetypeId }) {
  const a = ARCHETYPES[id];
  return (
    <div className="flex flex-1 flex-col items-center text-center">
      <div className="grid h-[88px] w-[88px] place-items-center rounded-full" style={{ background: a.color }}>
        <ArchetypeMark id={id} size={58} color={a.ink} />
      </div>
      <p className="mt-2 text-[1.2rem] font-extrabold">{name}</p>
      <p className="text-[13px] font-bold" style={{ color: a.color }}>
        {a.name.replace("The ", "")}
      </p>
    </div>
  );
}

export function CompareHero({ c }: { c: Comparison }) {
  const o = OUTCOMES[c.outcome];
  return (
    <div className="bm-card p-5 text-center">
      <p className="text-[12px] font-extrabold tracking-[0.2em] text-[var(--bm-brand)]">YOUR WAVELENGTH</p>
      <div className="mt-4 flex items-start">
        <Person name={c.a.name} id={c.a.archetype} />
        <span className="mt-7 text-[2rem] font-extrabold text-[var(--bm-brand)]">×</span>
        <Person name={c.b.name} id={c.b.archetype} />
      </div>
      <div className="bm-stamp mx-auto mt-5 inline-block rounded-[14px] px-5 py-2 text-[1.6rem] font-extrabold text-white" style={{ background: o.color }}>
        {o.label.toUpperCase()}
      </div>
      <p className="mt-2 text-[14px] text-[var(--bm-soft)]">{o.stamp}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <p className="bm-display text-[3.2rem]">{c.similarity}</p>
          <p className="text-[13px] font-bold">Same wavelength</p>
          <p className="text-[12px] text-[var(--bm-soft)]">how alike you are</p>
        </div>
        <div>
          <p className="bm-display text-[3.2rem] text-[var(--bm-brand)]">{c.compatibility}</p>
          <p className="text-[13px] font-bold">Compatibility</p>
          <p className="text-[12px] text-[var(--bm-soft)]">how you complete each other</p>
        </div>
      </div>
      <p className="mt-5 text-[1.15rem] font-extrabold leading-snug">&ldquo;{c.dynamic}&rdquo;</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bm-card p-5">
      <p className="mb-3 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">{title.toUpperCase()}</p>
      {children}
    </section>
  );
}

const SLIDERS = TRAITS.map((k) => ({ k, lo: TRAIT_INFO[k].lo, hi: TRAIT_INFO[k].hi, name: TRAIT_INFO[k].name }));

export default function CompareView({
  c,
  full,
  relation,
  viewerIsA,
}: {
  c: Comparison;
  full: boolean;
  relation: "friend" | "colleague";
  viewerIsA: boolean;
}) {
  const A = ARCHETYPES[c.a.archetype];
  const B = ARCHETYPES[c.b.archetype];
  if (!full) {
    return (
      <div className="flex flex-col gap-3">
        <CompareHero c={c} />
        <Section title="Twins on">
          <p className="text-[15px] font-semibold">{c.twins}</p>
        </Section>
        <Section title="Opposites on">
          <p className="text-[15px] font-semibold">{c.opposites}</p>
        </Section>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <CompareHero c={c} />

      <Section title="Where you match">
        <div className="flex flex-col gap-2.5">
          {c.layers.map((l, i) => (
            <div key={l.label} className="flex items-center gap-3">
              <span className="w-16 text-[13px] font-bold">{l.label}</span>
              <div className="bm-bar flex-1">
                <span style={{ width: `${Math.max(4, l.value)}%`, background: "var(--bm-ink)", animationDelay: `${i * 90}ms` }} />
              </div>
              <span className="w-9 text-right text-[13px] font-bold">{l.value}</span>
            </div>
          ))}
        </div>
        {!c.intentKnown && (
          <Link href="/?panel=profile" className="mt-4 block rounded-[1rem] bg-[#FFF1EC] p-3 text-[13px] font-semibold">
            🔒 Compatibility counts more once you both say what you need and offer on OpenNetworks.{" "}
            <span className="underline">Add yours</span>
          </Link>
        )}
      </Section>

      <Section title="How you fit">
        <div className="flex flex-col gap-2.5">
          {c.fit.map((f, i) => (
            <div key={f.label}>
              <div className="flex justify-between text-[13px] font-bold">
                <span>{f.label}</span>
                <span>{f.value}</span>
              </div>
              <div className="bm-bar mt-1">
                <span style={{ width: `${Math.max(4, f.value)}%`, background: "var(--bm-brand)", animationDelay: `${i * 90}ms` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-[var(--bm-soft)]">
          Compatibility rewards complementary roles and a clear lead, and similar warmth and structure — what research on working pairs finds matters.
        </p>
      </Section>

      <Section title="Side by side">
        <div className="mb-3 flex gap-4 text-[12px] font-bold">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: A.color }} /> {c.a.name}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 bg-white" style={{ borderColor: B.color }} /> {c.b.name}
          </span>
        </div>
        <div className="flex flex-col gap-3.5">
          {SLIDERS.map((s) => {
            const pa = ((c.a.traits[s.k] / 2.5 + 1) / 2) * 100;
            const pb = ((c.b.traits[s.k] / 2.5 + 1) / 2) * 100;
            return (
              <div key={s.k}>
                <p className="text-[13px] font-bold">{s.name}</p>
                <div className="flex justify-between text-[12px] font-semibold text-[var(--bm-soft)]">
                  <span>{s.lo}</span>
                  <span>{s.hi}</span>
                </div>
                <div className="relative mt-1.5 h-2 rounded-full bg-[var(--bm-line)]">
                  <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${pa}%`, background: A.color }} />
                  <span
                    className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-white"
                    style={{ left: `${pb}%`, borderColor: B.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Your dynamic">
        <p className="text-[15px] font-semibold">{c.roles}</p>
        <div className="mt-3 grid gap-2 text-[14px]">
          <p>
            <b>Twins on:</b> {c.twins}
          </p>
          <p>
            <b>Opposites on:</b> {c.opposites}
          </p>
        </div>
      </Section>

      <Section title="Watch out">
        <p className="text-[15px] font-semibold">{c.watchOut}</p>
        <p className="mt-1 text-[14px] text-[var(--bm-soft)]">Try: {c.tryThis}</p>
      </Section>

      {relation === "colleague" && (
        <Section title="Working together">
          <p className="text-[14px]">{viewerIsA ? c.workWith.aToB : c.workWith.bToA}</p>
          <p className="mt-2 text-[14px] text-[var(--bm-soft)]">{viewerIsA ? c.workWith.bToA : c.workWith.aToB}</p>
        </Section>
      )}

      <Section title="Do this together">
        <p className="text-[15px] font-semibold">{c.activity}</p>
        <p className="mt-2 text-[14px] text-[var(--bm-soft)]">{viewerIsA ? c.opener : `Ask ${c.a.name}: “${A.askMe}”`}</p>
      </Section>

      <Section title="Answer replay">
        <div className="flex flex-col divide-y divide-[var(--bm-line)]">
          {c.replay.map((r) => (
            <div key={r.title} className="py-2.5">
              <p className="text-[12px] font-extrabold tracking-[0.12em] text-[var(--bm-soft)]">
                {r.title.toUpperCase()} {r.same ? "· SAME 🤝" : ""}
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
      </Section>
    </div>
  );
}
