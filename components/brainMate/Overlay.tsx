"use client";

import { useCallback, useEffect, useState } from "react";
import "./brainmate.css";
import type { LinkPayload, MeState } from "@/lib/brainMate/payload";
import AuthGate from "./AuthGate";
import CompareCard from "./CompareCard";
import Game from "./Game";
import IdentityCard from "./IdentityCard";
import TzCookie from "./TzCookie";
import WavelengthReveal from "./WavelengthReveal";
import { ClaimButton, Countdown, NudgeButton, ShareButtons } from "./Share";

/**
 * Brain-Mate, as a window over the map — never a new page or tab.
 *
 * A full-height sheet on a phone, a large centred window on a desktop, the
 * map dimmed behind it. One overlay, three ways in:
 *
 *   play  the game (or a rematch)
 *   card  your Brain-Mate card, or the game if you haven't played
 *   link  a Wavelength link: the invitation, waiting, expired, retake, or
 *         the finished comparison (with its reveal, the first time)
 *
 * Signing in happens inside it, so a friend arriving from WhatsApp never
 * leaves the window they were invited into.
 */

/** `wavelength`: open the card straight at "Find your Brain-Mate". */
export type OverlayMode = { kind: "play" } | { kind: "card"; wavelength?: boolean } | { kind: "link"; slug: string };

type View =
  | { v: "loading" }
  | { v: "auth" }
  | { v: "game"; link: { slug: string; sender: string } | null }
  | { v: "card"; wavelength?: boolean }
  | { v: "link"; slug: string; reveal: boolean };

export default function Overlay({ mode, onClose, onSection }: { mode: OverlayMode; onClose: () => void; onSection?: (i: number) => void }) {
  const [me, setMe] = useState<MeState | null>(null);
  const [view, setView] = useState<View>({ v: "loading" });
  const [link, setLink] = useState<LinkPayload | null>(null);
  const [linkError, setLinkError] = useState("");

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/brain-mate/me", { cache: "no-store" });
    const data = (await res.json()) as MeState;
    setMe(data);
    return data;
  }, []);

  const loadLink = useCallback(async (slug: string) => {
    const res = await fetch(`/api/brain-mate/links/${slug}`, { cache: "no-store" });
    if (!res.ok) {
      setLinkError("That link doesn't exist any more.");
      return null;
    }
    const data = (await res.json()) as LinkPayload;
    setLink(data);
    return data;
  }, []);

  /** Decide what to show from the mode and who's looking. */
  const route = useCallback(
    async (m: OverlayMode) => {
      const state = await loadMe();
      if (!state.signedIn) return setView({ v: "auth" });
      if (m.kind === "link") {
        await loadLink(m.slug);
        return setView({ v: "link", slug: m.slug, reveal: false });
      }
      if (m.kind === "card" && state.card) return setView({ v: "card", wavelength: m.wavelength });
      return setView({ v: "game", link: null });
    },
    [loadLink, loadMe]
  );

  useEffect(() => {
    // Opening the overlay is the external event this synchronises with;
    // everything it sets happens once the fetch comes back.
    void Promise.resolve().then(() => route(mode));
  }, [mode, route]);

  // Escape closes it, like every other window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const signedIn = me?.signedIn ? me : null;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Brain-Mate">
      <button type="button" aria-label="Close Brain-Mate" className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} />
      <div className="bm-root bm-embedded absolute inset-0 overflow-hidden sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[min(880px,94dvh)] sm:w-[30rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]">
        <TzCookie />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-[max(env(safe-area-inset-top,0px),10px)] z-[95] grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] bg-[var(--card)] text-[16px] font-semibold text-[var(--ink)] shadow-[var(--shadow)]"
        >
          ✕
        </button>
        <div className="relative z-0 h-full overflow-y-auto overscroll-contain">
          {view.v === "loading" && <div className="grid h-full place-items-center text-[15px] font-semibold text-[var(--bm-soft)]">One moment…</div>}

          {view.v === "auth" && (
            <div className="bm-shell justify-center gap-5">
              <p className="text-[13px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">READY FOR A SMALL GAME? 🎲</p>
              <h2 className="bm-display text-[2.2rem]">Which of 12 minds are you?</h2>
              <p className="text-[15px] text-[var(--bm-soft)]">3 minutes, no right answers. Sign in with your email to play — it&apos;s how your card and your Wavelengths are saved.</p>
              <AuthGate cta="Let's play" onDone={() => void route(mode)} />
            </div>
          )}

          {view.v === "game" && signedIn && (
            <Game
              defaultName={signedIn.defaultName}
              needsTerms={signedIn.needsTerms}
              link={view.link}
              stats={signedIn.stats}
              previous={signedIn.previous}
              onSection={onSection}
              onDone={async ({ linkSlug }) => {
                if (linkSlug) {
                  await loadLink(linkSlug);
                  await loadMe();
                  setView({ v: "link", slug: linkSlug, reveal: true });
                } else {
                  await loadMe();
                  setView({ v: "card" });
                }
              }}
            />
          )}

          {view.v === "card" && signedIn?.card && (
            <IdentityCard
              card={signedIn.card}
              focusWavelength={Boolean(view.wavelength)}
              onReplay={() => setView({ v: "game", link: null })}
              onOpenLink={async (slug) => {
                await loadLink(slug);
                setView({ v: "link", slug, reveal: false });
              }}
            />
          )}

          {view.v === "link" &&
            (linkError ? (
              <div className="bm-shell items-center justify-center gap-4 text-center">
                <span className="text-[3rem]">🤷</span>
                <p className="text-[17px] font-bold">{linkError}</p>
                <button className="bm-btn bm-btn-brand" onClick={() => setView({ v: "game", link: null })}>
                  Play Brain-Mate
                </button>
              </div>
            ) : link ? (
              <LinkView
                link={link}
                reveal={view.reveal}
                onPlay={() => setView({ v: "game", link: { slug: link.slug, sender: link.senderName } })}
                onRetake={() => setView({ v: "game", link: null })}
                onMyCard={() => setView(signedIn?.card ? { v: "card" } : { v: "game", link: null })}
                onMyCardWavelength={() => setView(signedIn?.card ? { v: "card", wavelength: true } : { v: "game", link: null })}
                onClaimed={async () => {
                  await loadLink(link.slug);
                  setView({ v: "link", slug: link.slug, reveal: true });
                }}
              />
            ) : null)}
        </div>
      </div>
    </div>
  );
}

function LinkView({
  link,
  reveal,
  onPlay,
  onRetake,
  onMyCard,
  onMyCardWavelength,
  onClaimed,
}: {
  link: LinkPayload;
  reveal: boolean;
  onPlay: () => void;
  onRetake: () => void;
  onMyCard: () => void;
  onMyCardWavelength: () => void;
  onClaimed: () => void;
}) {
  const url = `${link.origin}/brain-mate/${link.slug}`;
  const player = link.role === "sender" || link.role === "recipient";

  if (link.state === "done" && link.comparison) {
    const c = link.comparison;
    const card = (
      <CompareCard
        c={c}
        slug={link.slug}
        origin={link.origin}
        player={player}
        viewerIsA={link.role === "sender"}
        relation={link.relation}
        viewGiven={link.viewGiven}
        onPlay={player ? undefined : link.viewerPlayed ? onMyCardWavelength : onRetake}
      />
    );
    return (
      <div className="pt-10">
        {reveal && player ? (
          <div className="bm-shell !min-h-0">
            <WavelengthReveal a={{ name: c.a.name, archetype: c.a.archetype }} b={{ name: c.b.name, archetype: c.b.archetype }} similarity={c.similarity} outcome={c.outcome}>
              {card}
            </WavelengthReveal>
          </div>
        ) : (
          card
        )}
        <div className="flex justify-center gap-5 pb-8 text-[13px] font-semibold text-[var(--bm-soft)]">
          <button className="underline" onClick={onMyCard}>
            My archetype card
          </button>
        </div>
      </div>
    );
  }

  if (link.state === "done") {
    return (
      <div className="bm-shell items-center justify-center gap-4 text-center">
        <span className="text-[3rem]">🔁</span>
        <h2 className="bm-display text-[1.9rem]">
          {link.senderName} × {link.recipientName}: a new Wavelength is coming
        </h2>
        <p className="text-[15px] text-[var(--bm-soft)]">
          Brain-Mate got sharper. {link.waitingOnRetake.join(" and ")} {link.waitingOnRetake.length > 1 ? "need" : "needs"} to retake it — then this shows your new comparison by itself.
        </p>
        {!link.viewerPlayed && player && (
          <button className="bm-btn bm-btn-brand" onClick={onRetake}>
            Rematch · 3 min
          </button>
        )}
      </div>
    );
  }

  if (link.state === "expired") {
    return (
      <div className="bm-shell items-center justify-center gap-4 text-center">
        <span className="text-[3rem]">⌛</span>
        <h2 className="bm-display text-[1.9rem]">{link.role === "sender" ? `${link.recipientName} missed it.` : "This one expired."}</h2>
        <p className="text-[15px] text-[var(--bm-soft)]">Wavelength links last a day. {link.role === "sender" ? "Your next one comes back at midnight." : "You can still find your own Brain-Mate."}</p>
        <button className="bm-btn bm-btn-brand" onClick={link.role === "sender" ? onMyCard : onRetake}>
          {link.role === "sender" ? "Back to my card" : "Play Brain-Mate"}
        </button>
      </div>
    );
  }

  if (link.role === "sender") {
    return (
      <div className="bm-shell justify-center gap-5">
        <div className="text-center">
          <span className="bm-heartbeat mx-auto grid h-20 w-20 place-items-center rounded-full bg-[var(--bm-brand)] text-[2.4rem] font-extrabold text-white">?</span>
          <h2 className="bm-display mt-4 text-[2rem]">Waiting for {link.recipientName}</h2>
          <p className="mt-1 text-[15px] font-semibold text-[var(--bm-soft)]">
            <Countdown to={link.expiresAt} done="Expiring now" /> left to play
          </p>
        </div>
        <section className="bm-card p-5">
          <ShareButtons url={url} text={`${link.senderName} wants to find your Wavelength on Brain-Mate. 3 minutes, then we see how we click:`} />
        </section>
        {!link.nudged && <NudgeButton slug={link.slug} url={url} text={`${link.recipientName}! Still waiting on our Brain-Mate Wavelength 👀`} />}
      </div>
    );
  }

  return (
    <div className="bm-shell justify-center gap-6">
      <div className="text-center">
        <span className="bm-heartbeat mx-auto grid h-[130px] w-[130px] place-items-center rounded-[2rem] bg-[var(--bm-ink)] text-[3.6rem] font-extrabold text-[var(--bm-brand)]">?</span>
        <p className="mt-6 text-[13px] font-extrabold tracking-[0.2em] text-[var(--bm-brand)]">FOR {link.recipientName.toUpperCase()}</p>
        <h2 className="bm-display mt-1 text-[2.2rem]">{link.senderName} wants to find your Wavelength</h2>
        <p className="mt-2 text-[15px] text-[var(--bm-soft)]">{link.senderName}&apos;s type stays hidden until you play. Mind Twins, a Power Duo, or Beautiful Chaos?</p>
        <p className="mt-2 text-[13px] font-bold text-[var(--bm-brand)]">
          <Countdown to={link.expiresAt} done="Expiring now" /> left
        </p>
      </div>
      {link.viewerPlayed ? (
        <ClaimButton slug={link.slug} label={`I'm ${link.recipientName} — reveal our Wavelength`} onDone={onClaimed} />
      ) : (
        <button className="bm-btn bm-btn-brand" onClick={onPlay}>
          Accept the challenge · 3 min
        </button>
      )}
      <p className="text-center text-[12px] text-[var(--bm-soft)]">Not {link.recipientName}? You can still play your own once this is done.</p>
    </div>
  );
}
