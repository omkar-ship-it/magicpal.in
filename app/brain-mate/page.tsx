import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { ARCHETYPES, ARCHETYPE_IDS } from "@/lib/brainMate/archetypes";
import { ArchetypeMark } from "@/lib/brainMate/symbols";
import { crowdStats, getBrainMate } from "@/lib/brainMate/server";
import { MIN_CROWD } from "@/lib/brainMate/score";
import AuthGate from "@/components/brainMate/AuthGate";

/**
 * Find your Brain-Mates. The twelve marks orbit the headline, one button,
 * and — because playing needs an account — the sign-in sits right on this
 * screen rather than behind a redirect.
 */
export default async function BrainMateLanding() {
  const user = await getSessionUser();
  const [me, stats] = await Promise.all([user ? getBrainMate(user.id) : null, crowdStats()]);
  const rarest =
    stats.n >= MIN_CROWD
      ? ARCHETYPE_IDS.reduce((x, y) => ((stats.archetypes[y] ?? 0) < (stats.archetypes[x] ?? 0) ? y : x))
      : null;

  return (
    <main className="bm-shell">
      <div className="flex items-center justify-between py-1">
        <span className="text-[13px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">BRAIN-MATE</span>
        <Link href="/" className="text-[12px] text-[var(--bm-soft)]">
          by OpenNetworks
        </Link>
      </div>

      <div className="relative mx-auto my-6 aspect-square w-full max-w-[300px]">
        {ARCHETYPE_IDS.map((id, i) => {
          const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const a = ARCHETYPES[id];
          return (
            <span
              key={id}
              className={`bm-fade-up bm-idle-${a.mode} absolute grid h-[17%] w-[17%] place-items-center rounded-full`}
              style={{
                left: `${50 + 42 * Math.cos(angle) - 8.5}%`,
                top: `${50 + 42 * Math.sin(angle) - 8.5}%`,
                background: a.color,
                animationDelay: `${i * 60}ms`,
              }}
            >
              <ArchetypeMark id={id} size={30} color={a.ink} stroke={7} />
            </span>
          );
        })}
        <div className="absolute inset-[24%] grid place-items-center rounded-full bg-white shadow-[0_20px_50px_-25px_rgba(90,40,20,0.5)]">
          <span className="bm-heartbeat text-[3rem] font-extrabold text-[var(--bm-brand)]">?</span>
        </div>
      </div>

      <div className="bm-fade-up text-center">
        <h1 className="bm-display text-[2.6rem]">Find your Brain-Mates</h1>
        <p className="mt-2 text-[16px] text-[var(--bm-soft)]">12 kinds of minds. Which one is yours? A day in your mind, This or That, Prioritise, Agree or Don&apos;t and a final duel. About 3 minutes.</p>
        {stats.n > 0 && (
          <p className="mt-3 text-[13px] font-semibold text-[var(--bm-soft)]">
            {stats.n.toLocaleString("en-IN")} {stats.n === 1 ? "mind" : "minds"} read
            {rarest ? ` · rarest so far: ${ARCHETYPES[rarest].name.replace("The ", "")}` : ""}
          </p>
        )}
      </div>

      <div className="mt-6">
        {!user ? (
          <AuthGate cta="Read my mind" />
        ) : me ? (
          <div className="flex flex-col gap-3">
            <Link href="/brain-mate/me" className="bm-btn bm-btn-brand">
              See my Brain-Mate card
            </Link>
            <Link href="/brain-mate/play" className="bm-btn bm-btn-ghost">
              Play again
            </Link>
          </div>
        ) : (
          <Link href="/brain-mate/play" className="bm-btn bm-btn-brand w-full">
            Read my mind
          </Link>
        )}
      </div>

      <section className="mt-12">
        <p className="mb-3 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">THE TWELVE</p>
        <div className="grid grid-cols-3 gap-2.5">
          {ARCHETYPE_IDS.map((id) => {
            const a = ARCHETYPES[id];
            return (
              <div key={id} className="flex flex-col items-center rounded-[1.2rem] p-3 text-center" style={{ background: a.tint }}>
                <span className="grid h-11 w-11 place-items-center rounded-full" style={{ background: a.color }}>
                  <ArchetypeMark id={id} size={26} color={a.ink} stroke={7} />
                </span>
                <span className="mt-1.5 text-[13px] font-extrabold">{a.name.replace("The ", "")}</span>
                <span className="text-[11px] leading-tight text-[var(--bm-soft)]">{a.tagline}</span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
