import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getProfileById } from "@/lib/profiles";
import { ARCHETYPES, TRAITS, TRAIT_INFO, relationsOf, streakLine, type ArchetypeId } from "@/lib/brainMate/archetypes";
import { OUTCOMES } from "@/lib/brainMate/compare";
import { MIN_CROWD, howDidItKnow, resultFor, strandsFor } from "@/lib/brainMate/score";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import { crowdStats, getBrainMate, myLinks } from "@/lib/brainMate/server";
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
  const [stats, links, profile, origin] = await Promise.all([crowdStats(), myLinks(user.id, tz), getProfileById(user.id), siteOrigin()]);
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
  const sliders = TRAITS.map((k) => ({ label: TRAIT_INFO[k].name, lo: TRAIT_INFO[k].lo, hi: TRAIT_INFO[k].hi, v: res.traits[k] / 2.5 }));

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
          <div className="mt-6 grid gap-3 text-left">
            <div className="rounded-[1.2rem] p-4" style={{ background: chip }}>
              <p className="text-[11px] font-extrabold tracking-[0.18em]" style={{ color: soft }}>
                SUPERPOWER
              </p>
              <p className="mt-1 text-[1.1rem] font-extrabold">{a.superpower}</p>
            </div>
            <div className="rounded-[1.2rem] p-4" style={{ background: chip }}>
              <p className="text-[11px] font-extrabold tracking-[0.18em]" style={{ color: soft }}>
                BLIND SPOT
              </p>
              <p className="mt-1 text-[1.1rem] font-extrabold">{a.roast}</p>
            </div>
          </div>
        </div>
      </section>

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
          <p className="mb-4 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">YOUR EIGHT TRAITS</p>
          <div className="flex flex-col gap-3.5">
            {sliders.map((s) => (
              <div key={s.label}>
                <p className="text-[14px] font-bold">{s.label}</p>
                <div className="mt-1 flex justify-between text-[12px] text-[var(--bm-soft)]">
                  <span>{s.lo}</span>
                  <span>{s.hi}</span>
                </div>
                <div className="relative mt-1.5 h-2 rounded-full bg-[var(--bm-line)]">
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
          <p className="mb-2 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">HOW DID IT KNOW</p>
          <p className="text-[1.05rem] font-bold leading-snug">{howDidItKnow(me.answers, stats)}</p>
        </section>

        <section className="bm-card p-5">
          <p className="mb-3 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">WORK WITH ME</p>
          <div className="grid gap-2 text-[15px]">
            <p>
              <b>I&apos;m at my best when</b> {a.bestWhen}.
            </p>
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
          New questions built on personality research: eight traits, a lightning round with strength, and a final duel that adapts to you.
          Retake it for a more accurate card and sharper Wavelengths — your links update by themselves.
        </p>
        <Link href="/brain-mate/play" className="bm-btn bm-btn-brand">
          Retake · 2½ min
        </Link>
        <p className="text-[12px] text-[var(--bm-soft)]">Last time you were {a.name}. Let&apos;s see if it holds.</p>
      </div>
    </main>
  );
}
