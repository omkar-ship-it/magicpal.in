import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { OUTCOMES } from "@/lib/brainMate/compare";
import { comparisonFor, getBrainMate, getLink, needsRetake, stateOf } from "@/lib/brainMate/server";
import { siteOrigin } from "@/lib/brainMate/origin";
import AuthGate from "@/components/brainMate/AuthGate";
import CompareView from "@/components/brainMate/CompareView";
import WavelengthReveal from "@/components/brainMate/WavelengthReveal";
import ViewForm from "@/components/brainMate/ViewForm";
import { ClaimButton, Countdown, NudgeButton, ShareButtons } from "@/components/brainMate/Share";

/**
 * One Wavelength link — omkar-sunil-k7x — for good.
 *
 * The same address changes with its state and with who is looking:
 *
 *   waiting  sender → "waiting for Sunil", share again, one nudge
 *            friend → the invitation, sender's type face-down, countdown,
 *                     sign in → play (or answer straight away if they
 *                     already have a Brain-Mate)
 *            others → "this one's waiting for Sunil" + find your own
 *   done     the two players → the full comparison (the reveal plays
 *                     first, once, on ?reveal=1)
 *            everyone else → the compact card: an advert, not a file
 *   expired  "missed it" for the sender, the landing for everyone else
 */

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ reveal?: string }> };

const first = (s: string) => s.split(" ")[0];

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const link = await getLink(slug);
  if (!link) return { title: "Brain-Mate" };
  const c = await comparisonFor(link);
  if (c) {
    const o = OUTCOMES[c.outcome];
    return {
      title: `${c.a.name} × ${c.b.name}: ${o.label} — Brain-Mate`,
      description: `${c.similarity} on the same wavelength, ${c.compatibility} compatible. “${c.dynamic}” Find your Brain-Mates.`,
    };
  }
  const sender = await getBrainMate(link.senderId);
  const s = first(sender?.displayName ?? "Someone");
  return {
    title: `${s} wants to find your Wavelength — Brain-Mate`,
    description: `${s}'s type stays hidden until you play. About 3 minutes, then see how you click.`,
  };
}

export default async function LinkPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { reveal } = await searchParams;
  const link = await getLink(slug);
  if (!link) notFound();

  const [user, sender, origin] = await Promise.all([getSessionUser(), getBrainMate(link.senderId), siteOrigin()]);
  const state = stateOf(link);
  const senderName = first(sender?.displayName ?? "Your friend");
  const recipient = first(link.recipientName);
  const isSender = user?.id === link.senderId;
  const isRecipient = Boolean(user && link.recipientId === user.id);
  const url = `${origin}/brain-mate/${slug}`;

  const header = (
    <div className="flex items-center justify-between py-1">
      <Link href="/brain-mate" className="text-[13px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">
        BRAIN-MATE
      </Link>
      <Link href="/" className="text-[12px] text-[var(--bm-soft)]">
        by OpenNetworks
      </Link>
    </div>
  );

  // ------------------------------------------------------------ done
  if (state === "done") {
    const c = await comparisonFor(link);
    if (!c) {
      // Finished on the first questionnaire: show who still needs to retake
      // instead of a stale comparison. The link updates itself afterwards.
      const need = await needsRetake(link);
      const recipientName = first(link.recipientName);
      const waitingOn = [need.sender ? senderName : null, need.recipient ? recipientName : null].filter(Boolean) as string[];
      const meNeeds = (isSender && need.sender) || (isRecipient && need.recipient);
      return (
        <main className="bm-shell">
          {header}
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <span className="text-[3rem]">🔁</span>
            <h1 className="bm-display text-[2rem]">
              {senderName} × {recipientName}: a new Wavelength is coming
            </h1>
            <p className="text-[15px] text-[var(--bm-soft)]">
              Brain-Mate got sharper. {waitingOn.join(" and ")} {waitingOn.length > 1 ? "need" : "needs"} to retake it — then this link shows
              your new comparison by itself.
            </p>
            {meNeeds ? (
              <Link href="/brain-mate/play" className="bm-btn bm-btn-brand">
                Retake · 3 min
              </Link>
            ) : (
              <Link href="/brain-mate" className="bm-btn bm-btn-brand">
                Find your Brain-Mates
              </Link>
            )}
          </div>
        </main>
      );
    }
    const player = isSender || isRecipient;
    const view = (
      <div className="flex flex-col gap-3 pt-3">
        <CompareView c={c} full={player} relation={link.relation as "friend" | "colleague"} viewerIsA={isSender} />
        {player && !(isSender ? link.viewOfRecipient : link.viewOfSender) && (
          <section className="bm-card p-5">
            <ViewForm slug={slug} other={isSender ? c.b.name : c.a.name} />
          </section>
        )}
        <section className="bm-card p-5">
          <p className="mb-3 text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">
            {player ? "SHARE YOUR WAVELENGTH" : "FIND YOURS"}
          </p>
          {player ? (
            <ShareButtons
              url={url}
              text={`${c.a.name} × ${c.b.name}: ${OUTCOMES[c.outcome].label} on Brain-Mate.`}
              image={`/brain-mate/${slug}/card`}
              filename={`${slug}.png`}
            />
          ) : (
            <Link href="/brain-mate" className="bm-btn bm-btn-brand w-full">
              Find your Brain-Mates
            </Link>
          )}
        </section>
        {player && (
          <div className="flex justify-center gap-5 text-[13px] font-semibold text-[var(--bm-soft)]">
            <Link href="/brain-mate/me" className="underline">
              My Brain-Mate
            </Link>
            <Link href="/brain-mate/me" className="underline">
              Challenge someone else
            </Link>
          </div>
        )}
      </div>
    );
    return (
      <main className="bm-shell">
        {header}
        {player && reveal === "1" ? (
          <WavelengthReveal
            a={{ name: c.a.name, archetype: c.a.archetype }}
            b={{ name: c.b.name, archetype: c.b.archetype }}
            similarity={c.similarity}
            compatibility={c.compatibility}
            outcome={c.outcome}
          >
            {view}
          </WavelengthReveal>
        ) : (
          view
        )}
      </main>
    );
  }

  // --------------------------------------------------------- expired
  if (state === "expired") {
    return (
      <main className="bm-shell">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <span className="text-[3rem]">⌛</span>
          <h1 className="bm-display text-[2rem]">{isSender ? `${recipient} missed it.` : "This one expired."}</h1>
          <p className="text-[15px] text-[var(--bm-soft)]">
            {isSender
              ? "Links last 24 hours. Your next one comes back at midnight."
              : "Wavelength links last a day. You can still find your own Brain-Mate."}
          </p>
          <Link href={isSender ? "/brain-mate/me" : "/brain-mate"} className="bm-btn bm-btn-brand">
            {isSender ? "Back to my Brain-Mate" : "Find your Brain-Mates"}
          </Link>
        </div>
      </main>
    );
  }

  // --------------------------------------------------------- waiting
  if (isSender) {
    return (
      <main className="bm-shell">
        {header}
        <div className="flex flex-1 flex-col justify-center gap-5">
          <div className="text-center">
            <span className="bm-heartbeat mx-auto grid h-20 w-20 place-items-center rounded-full bg-[var(--bm-brand)] text-[2.4rem] font-extrabold text-white">
              ?
            </span>
            <h1 className="bm-display mt-4 text-[2rem]">Waiting for {recipient}</h1>
            <p className="mt-1 text-[15px] font-semibold text-[var(--bm-soft)]">
              <Countdown to={link.expiresAt.toISOString()} prefix="" done="Expiring now" /> left to play
            </p>
          </div>
          <section className="bm-card p-5">
            <ShareButtons url={url} text={`${senderName} wants to find your Wavelength on Brain-Mate. About 3 minutes, then we see how we click:`} />
          </section>
          {!link.nudgedAt && (
            <NudgeButton slug={slug} url={url} text={`${recipient}! Still waiting on our Brain-Mate Wavelength 👀`} />
          )}
        </div>
      </main>
    );
  }

  const me = user ? await getBrainMate(user.id) : null;
  return (
    <main className="bm-shell">
      {header}
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="text-center">
          <div className="relative mx-auto h-[150px] w-[150px]">
            <span className="bm-heartbeat absolute inset-0 grid place-items-center rounded-[2rem] bg-[var(--bm-ink)] text-[4rem] font-extrabold text-[var(--bm-brand)] shadow-[0_24px_50px_-24px_rgba(0,0,0,0.6)]">
              ?
            </span>
          </div>
          <p className="mt-6 text-[13px] font-extrabold tracking-[0.2em] text-[var(--bm-brand)]">FOR {recipient.toUpperCase()}</p>
          <h1 className="bm-display mt-1 text-[2.3rem]">{senderName} wants to find your Wavelength</h1>
          <p className="mt-2 text-[15px] text-[var(--bm-soft)]">
            {senderName}&apos;s type stays hidden until you play. Mind Twins, a Power Duo, or Beautiful Chaos?
          </p>
          <p className="mt-2 text-[13px] font-bold text-[var(--bm-brand)]">
            <Countdown to={link.expiresAt.toISOString()} prefix="" done="Expiring now" /> left
          </p>
        </div>

        {!user ? (
          <AuthGate cta="Accept the challenge" />
        ) : me ? (
          <ClaimButton slug={slug} label={`I'm ${recipient} — reveal our Wavelength`} />
        ) : (
          <Link href={`/brain-mate/play?link=${slug}`} className="bm-btn bm-btn-brand">
            Accept the challenge · 3 min
          </Link>
        )}
        <p className="text-center text-[12px] text-[var(--bm-soft)]">
          Not {recipient}?{" "}
          <Link href="/brain-mate" className="underline">
            Find your own Brain-Mates
          </Link>
        </p>
      </div>
    </main>
  );
}
