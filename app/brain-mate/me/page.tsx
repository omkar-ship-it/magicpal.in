import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getProfileById } from "@/lib/profiles";
import { ARCHETYPES, TRAITS, TRAIT_INFO, TRAIT_PRAISE, relationsOf, streakLine, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { OUTCOMES } from "@/lib/brainMate/compare";
import { MIN_CROWD, TRAIT_COLOR, howDidItKnow, resultFor, strandsFor } from "@/lib/brainMate/score";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import { crowdStats, getBrainMate, myLinks, viewsOf } from "@/lib/brainMate/server";
import { siteOrigin } from "@/lib/brainMate/origin";
import { DailyLink, IdentityShare } from "@/components/brainMate/Share";

/**
 * Your Brain-Mate: the rich result screen. The share card is a separate,
 * glanceable image (see lib/brainMate/cards); this is the version for you —
 * your blend, your four layers, how it knew, how to work with you, who you
 * click with, and the Wavelengths you've found so far.
 */
export default async function MyBrainMate() {
  const user = await getSessionUser();
  if (!user) redirect("/brain-mate");
  const me = await getBrainMate(user.id);
  if (!me) redirect("/brain-mate/play");
  if (!me.current) return <RetakeScreen name={me.displayName} archetype={me.archetype} />;

  const tz = (await cookies()).get("bm_tz")?.value ?? "Asia/Kolkata";
  const [stats, links, profile, origin, views] = await Promise.all([
    crowdStats(),
    myLinks(user.id, tz),
    getProfileById(user.id),
    siteOrigin(),
    viewsOf(user.id),
  ]);
  const a = ARCHETYPES[me.archetype];
  const res = resultFor(me.answers);
  const soft = a.ink === "#ffffff" ? "rgba(255,255,255,0.78)" : "rgba(42,30,0,0.72)";
  const chip = a.ink === "#ffffff" ? "rgba(255,255,255,0.16)" : "rgba(42,30,0,0.1)";
  const rarity = stats.n >= MIN_CROWD ? stats.archetypes[me.archetype] : null;

  const todays = links.find((l) => l.sentToday) ?? null;
  const done = links.filter((l) => l.state === "done" && l.otherArchetype);
  const found = new Set<ArchetypeId>(done.map((l) => l.otherArchetype!));
  const missing = (Object.keys(ARCHETYPES) as ArchetypeId[]).filter((id) => !found.has(id));
  const rel = relationsOf(me.archetype);
  const intentMissing = !profile?.lookingFor?.length || !profile?.canHelpWith?.length || !profile?.name;

  // Eight traits, as positions between their two ends. ±2.5 standard units
  // spans the whole bar; the middle is a typical player.
  // Others' view (when anyone has rated you) is shown beside your own dot.
  const seen = views.length
    ? Object.fromEntries(TRAITS.map((k) => [k, views.reduce((sum, v) => sum + v.traits[k], 0) / views.length]))
    : null;
  const sliders = TRAITS.map((k) => ({
    k,
    label: TRAIT_INFO[k].name,
    lo: TRAIT_INFO[k].lo,
    hi: TRAIT_INFO[k].hi,
    v: res.traits[k] / 2.5,
    o: seen ? Math.max(-1, Math.min(1, seen[k] / 2.5)) : null,
  }));
  const biggestGap = seen
    ? TRAITS.map((k) => ({ k, gap: seen[k] - res.traits[k] })).sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap))[0]
    : null;
  const raters = [...new Set(views.map((v) => v.by))];
  // Your three most pronounced traits, each praised at whichever end you sit:
  // a low score is a different strength, never a gap.
  const topStrengths = TRAITS.map((k) => ({ k, z: res.traits[k] }))
    .sort((x, y) => Math.abs(y.z) - Math.abs(x.z))
    .slice(0, 3)
    .map(({ k, z }) => ({ k, high: z >= 0, label: TRAIT_PRAISE[k][z >= 0 ? "hi" : "lo"][0], line: TRAIT_PRAISE[k][z >= 0 ? "hi" : "lo"][1] }));

  return (
    <main className="pb-10">
      {/* -------------------------------------------------------- hero */}
      <section style={{ background: a.color, color: a.ink }}>
        <div className="bm-shell !min-h-0 !pb-8">
          <div className="flex items-center justify-between py-1">
            <Link href="/brain-mate" className="text-[13px] font-extrabold tracking-[0.18em]" style={{ color: a.ink }}>
              BRAIN-MATE
            </Link>
            <span className="text-[13px] font-extrabold tracking-[0.18em]">{me.displayName.split(" ")[0].toUpperCase()}</span>
          </div>
          <div className="relative mx-auto mt-4 grid h-[190px] w-[190px] place-items-center">
            <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
              {strandsFor(me.answers, me.displayName).map((s, i) => (
                <path key={i} d={s.d} stroke={a.ink} strokeWidth={s.width} strokeOpacity={0.3} fill="none" strokeLinecap="round" />
              ))}
            </svg>
            <div className="grid h-[128px] w-[128px] place-items-center rounded-full" style={{ background: chip }}>
              <span className={`bm-idle-${a.mode}`}>
                <ArchetypeMark id={a.id} size={92} color={a.ink} />
              </span>
            </div>
          </div>
          <div className="text-center">
            <h1 className="bm-display mt-3 text-[2.5rem]">{a.name.toUpperCase()}</h1>
            <p className="text-[1.1rem] font-semibold" style={{ color: soft }}>
              {a.tagline}
            </p>
            <p className="mt-2 text-[13px] font-bold" style={{ color: soft }}>
              {res.mix.map((m) => `${m.pct}% ${ARCHETYPES[m.id].name.replace("The ", "")}`).join(" · ")}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[13px] font-extrabold">
              <span className="rounded-full px-3 py-1" style={{ background: chip }}>
                {streakLine(me.streak)}
              </span>
              {rarity !== null && rarity !== undefined && (
                <span className="rounded-full px-3 py-1" style={{ background: chip }}>
                  ◆ 1 in {Math.max(2, Math.round(1 / Math.max(rarity, 0.01)))}
                </span>
              )}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {a.traits.map((t) => (
                <span key={t} className="rounded-full px-3.5 py-1.5 text-[14px] font-bold" style={{ background: chip }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          {/* The superpower, as the card's headline promise. */}
          <div className="mt-6 rounded-[1.4rem] p-5 text-center" style={{ background: chip }}>
            <p className="text-[11px] font-extrabold tracking-[0.2em]" style={{ color: soft }}>
              ✦ YOUR SUPERPOWER ✦
            </p>
            <p className="mt-1.5 text-[1.3rem] font-extrabold leading-snug">{a.superpower}</p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- the gifts */}
      <div className="bm-shell !min-h-0 gap-3 !pb-0 !pt-4">
        <section className="bm-card overflow-hidden">
          <div className="p-5">
            <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">YOUR TOP STRENGTHS</p>
            <p className="mt-0.5 text-[13px] text-[var(--bm-soft)]">From your own answers — the three things that stood out most.</p>
            <div className="mt-4 flex flex-col gap-3">
              {topStrengths.map((t, i) => (
                <div key={t.k} className="bm-fade-up flex items-center gap-3" style={{ animationDelay: `${i * 90}ms` }}>
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[1.05rem] font-extrabold text-white"
                    style={{ background: TRAIT_COLOR[t.k] }}
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-[1.05rem] font-extrabold">{t.label}</span>
                    <span className="block text-[14px] text-[var(--bm-soft)]">{t.line}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--bm-line)] p-5" style={{ background: a.tint }}>
            <p className="text-[12px] font-extrabold tracking-[0.18em]" style={{ color: a.color }}>
              WHAT MAKES {a.name.toUpperCase()} BRILLIANT
            </p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {a.strengths.map((x) => (
                <li key={x} className="flex gap-2.5 text-[15px] font-semibold leading-snug">
                  <span style={{ color: a.color }}>✦</span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bm-card p-5 text-center">
          <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">PEOPLE LOVE YOU FOR</p>
          <p className="bm-display mt-2 text-[1.5rem] leading-tight">“{a.lovedFor}”</p>
        </section>

        <section className="bm-card p-5">
          <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">WHERE YOU SHINE</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {a.shineIn.map((x) => (
              <span key={x} className="rounded-full px-3.5 py-2 text-[14px] font-bold" style={{ background: a.tint, color: a.color }}>
                {x}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[14px] text-[var(--bm-soft)]">
            You&apos;re at your best when {a.bestWhen}.
          </p>
        </section>

        <section className="bm-card p-5">
          <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">YOUR GROWTH EDGE</p>
          <p className="mt-2 text-[1.05rem] font-bold leading-snug">{a.growthEdge}</p>
          <div className="mt-4 rounded-[1rem] bg-[#FFF1EC] p-4">
            <p className="text-[11px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">TRY THIS WEEK</p>
            <p className="mt-1 text-[15px] font-semibold">{a.thisWeek}</p>
          </div>
          <p className="mt-4 text-[13px] text-[var(--bm-soft)]">
            Your guilty habit 😅 <b className="text-[var(--bm-ink)]">{a.roast}</b>
          </p>
        </section>
      </div>

      <div className="bm-shell !min-h-0 gap-3 !pt-4">
        {/* ----------------------------------------------------- share */}
        <section className="bm-card p-5">
          <DailyLink
            myName={me.displayName}
            origin={origin}
            today={todays ? { slug: todays.slug, recipient: todays.otherName, state: todays.state } : null}
          />
        </section>
        <section className="bm-card p-5">
          <p className="mb-3 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">SHARE YOUR CARD</p>
          <IdentityShare archetypeName={a.name} origin={origin} />
        </section>

        {/* ------------------------------------------------------- mix */}
        <section className="bm-card p-5">
          <p className="mb-3 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">YOUR MIND MIX</p>
          <div className="flex flex-col gap-2.5">
            {res.mix.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3">
                <span className="w-24 text-[14px] font-bold">{ARCHETYPES[m.id].name.replace("The ", "")}</span>
                <div className="bm-bar flex-1">
                  <span style={{ width: `${m.pct}%`, background: ARCHETYPES[m.id].color, animationDelay: `${i * 100}ms` }} />
                </div>
                <span className="w-10 text-right text-[14px] font-bold">{m.pct}%</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-[var(--bm-soft)]">You&apos;re a blend, not a box.</p>
        </section>

        {/* ---------------------------------------------------- layers */}
        <section className="bm-card p-5">
          <p className="mb-1 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">YOUR EIGHT TRAITS</p>
          <p className="mb-4 flex flex-wrap gap-x-4 text-[12px] text-[var(--bm-soft)]">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: a.color }} /> you
            </span>
            {seen && (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border-2 border-[var(--bm-ink)] bg-white" /> how {raters.join(" & ")} {raters.length > 1 ? "see" : "sees"} you
              </span>
            )}
          </p>
          <div className="flex flex-col gap-3.5">
            {sliders.map((s) => (
              <div key={s.label}>
                <p className="text-[14px] font-bold">{s.label}</p>
                <div className="mt-1 flex justify-between text-[12px] text-[var(--bm-soft)]">
                  <span>{s.lo}</span>
                  <span>{s.hi}</span>
                </div>
                <div className="relative mt-1.5 h-2 rounded-full bg-[var(--bm-line)]">
                  {s.o !== null && (
                    <span
                      className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--bm-ink)] bg-white"
                      style={{ left: `${((s.o + 1) / 2) * 100}%` }}
                    />
                  )}
                  <span
                    className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${((s.v + 1) / 2) * 100}%`, background: a.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bm-card p-5">
          <p className="mb-2 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">HOW OTHERS SEE YOU</p>
          {biggestGap && Math.abs(biggestGap.gap) >= 0.6 ? (
            <p className="text-[1.05rem] font-bold leading-snug">
              {raters.join(" & ")} {raters.length > 1 ? "see" : "sees"} you as more “
              {(biggestGap.gap > 0 ? TRAIT_INFO[biggestGap.k].hi : TRAIT_INFO[biggestGap.k].lo).toLowerCase()}” than you see yourself.
            </p>
          ) : biggestGap ? (
            <p className="text-[1.05rem] font-bold leading-snug">
              {raters.join(" & ")} {raters.length > 1 ? "see" : "sees"} you almost exactly as you see yourself. Rare.
            </p>
          ) : (
            <p className="text-[14px] text-[var(--bm-soft)]">
              When a friend finishes a Wavelength with you, they can share how you come across. It sharpens your profile — and the gap is
              often the most interesting thing on the card.
            </p>
          )}
        </section>

        <section className="bm-card p-5">
          <p className="mb-2 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">HOW DID IT KNOW</p>
          <p className="text-[1.05rem] font-bold leading-snug">{howDidItKnow(me.answers, stats)}</p>
        </section>

        <section className="bm-card p-5">
          <p className="mb-3 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">WORK WITH ME</p>
          <div className="grid gap-2 text-[15px]">
            <p>
              <b>{a.give}</b>
            </p>
            <p className="text-[var(--bm-soft)]">{a.dont}</p>
          </div>
        </section>

        {/* ------------------------------------------- brain-mates by type */}
        <section className="bm-card p-5">
          <p className="mb-3 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">YOUR BRAIN-MATES, BY TYPE</p>
          <div className="flex flex-col gap-3">
            {(
              [
                ["power_duo", a.powerDuo],
                ["mind_twins", rel.BM],
                ["friendly_friction", rel.FF.slice(0, 3)],
                ["beautiful_chaos", rel.BC],
              ] as const
            )
              .filter(([, ids]) => ids.length > 0)
              .map(([o, ids]) => (
                <div key={o} className="flex items-center justify-between gap-3">
                  <span className="whitespace-nowrap text-[14px] font-extrabold" style={{ color: OUTCOMES[o].color }}>
                    {OUTCOMES[o].label}
                  </span>
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {ids.map((id) => (
                      <span key={id} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold" style={{ background: ARCHETYPES[id].tint }}>
                        <ArchetypeMark id={id} size={16} color={ARCHETYPES[id].color} stroke={9} />
                        {ARCHETYPES[id].name.replace("The ", "")}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
          </div>
          <p className="mt-4 text-[13px] text-[var(--bm-soft)]">
            {a.edge.kind === "clash" ? "You clash most with" : "No real friction with anyone — your opposite is"}{" "}
            <b className="text-[var(--bm-ink)]">{ARCHETYPES[a.edge.id].name}</b>.
          </p>
        </section>

        {/* ----------------------------------------------- collection */}
        <section className="bm-card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">MY BRAIN-MATES</p>
            <p className="text-[13px] font-bold">{found.size} of 12 found</p>
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(Object.keys(ARCHETYPES) as ArchetypeId[]).map((id) => (
              <span
                key={id}
                className="grid h-8 w-8 place-items-center rounded-full"
                style={{ background: found.has(id) ? ARCHETYPES[id].color : "var(--bm-line)", opacity: found.has(id) ? 1 : 0.6 }}
                title={ARCHETYPES[id].name}
              >
                <ArchetypeMark id={id} size={18} stroke={8} color={found.has(id) ? ARCHETYPES[id].ink : "#b7a79f"} />
              </span>
            ))}
          </div>
          {links.length === 0 ? (
            <p className="text-[14px] text-[var(--bm-soft)]">
              No Wavelengths yet. Today&apos;s link is above — who do you know that might be a{" "}
              {ARCHETYPES[missing.find((m) => m !== me.archetype) ?? "peacemaker"].name.replace("The ", "")}?
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--bm-line)]">
              {links.map((l) => (
                <Link key={l.slug} href={`/brain-mate/${l.slug}`} className="flex items-center justify-between gap-3 py-3">
                  <span className="flex items-center gap-3">
                    <span
                      className="grid h-9 w-9 place-items-center rounded-full"
                      style={{ background: l.otherArchetype ? ARCHETYPES[l.otherArchetype].color : "var(--bm-line)" }}
                    >
                      {l.otherArchetype ? (
                        <ArchetypeMark id={l.otherArchetype} size={20} stroke={8} color={ARCHETYPES[l.otherArchetype].ink} />
                      ) : (
                        <span className="text-[14px] font-extrabold text-[var(--bm-soft)]">?</span>
                      )}
                    </span>
                    <span>
                      <span className="block text-[15px] font-bold">{l.otherName}</span>
                      <span className="block text-[12px] text-[var(--bm-soft)]">
                        {l.direction === "sent" ? "You sent" : "Sent to you"} · {l.relation}
                      </span>
                    </span>
                  </span>
                  <span className="text-right text-[13px] font-extrabold">
                    {l.state === "done" && l.outcome ? (
                      <span style={{ color: OUTCOMES[l.outcome].color }}>
                        {OUTCOMES[l.outcome].label} · {l.similarity}
                      </span>
                    ) : l.state === "done" ? (
                      <span className="text-[var(--bm-soft)]">Needs a retake</span>
                    ) : l.state === "waiting" ? (
                      <span className="text-[var(--bm-soft)]">Waiting…</span>
                    ) : (
                      <span className="text-[var(--bm-soft)]">Expired</span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {intentMissing && (
          <Link href="/?panel=profile" className="bm-card block p-5">
            <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">🔒 UNLOCK YOUR COMPATIBILITY</p>
            <p className="mt-1 text-[15px] font-semibold">
              Tell OpenNetworks what you need and what you can offer. Your Wavelengths start counting it — and Missing Piece matches appear.
            </p>
          </Link>
        )}

        <div className="mt-2 flex justify-center gap-5 text-[13px] font-semibold text-[var(--bm-soft)]">
          <Link href="/brain-mate/play" className="underline">
            Play again
          </Link>
          <Link href="/" className="underline">
            Open OpenNetworks
          </Link>
        </div>
      </div>
    </main>
  );
}

/** A result from the first questionnaire: it can't be read by the new one, so ask once, kindly. */
function RetakeScreen({ name, archetype }: { name: string; archetype: ArchetypeId }) {
  const a = ARCHETYPES[archetype];
  return (
    <main className="bm-shell">
      <div className="flex flex-1 flex-col justify-center gap-5 text-center">
        <span className="mx-auto grid h-24 w-24 place-items-center rounded-full" style={{ background: a.color }}>
          <ArchetypeMark id={archetype} size={60} color={a.ink} />
        </span>
        <h1 className="bm-display text-[2.2rem]">Brain-Mate got sharper, {name.split(" ")[0]}.</h1>
        <p className="text-[15px] text-[var(--bm-soft)]">
          A whole new game, built on personality research: a day in your mind, This or That, Prioritise, Agree or Don&apos;t — and a final duel that adapts to you.
          Retake it for a more accurate card and sharper Wavelengths — your links update by themselves.
        </p>
        <Link href="/brain-mate/play" className="bm-btn bm-btn-brand">
          Retake · 3 min
        </Link>
        <p className="text-[12px] text-[var(--bm-soft)]">Last time you were {a.name}. Let&apos;s see if it holds.</p>
      </div>
    </main>
  );
}
