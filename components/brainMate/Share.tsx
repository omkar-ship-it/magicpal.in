"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buzz } from "./feel";

/**
 * Everything that leaves the app: the identity image, the one-a-day link,
 * and the buttons on a link page. Native share sheet where the phone has
 * one (it carries the image itself into WhatsApp or Instagram), WhatsApp
 * and copy as the always-there fallbacks.
 */

export function Countdown({ to, prefix = "", done = "now" }: { to: string | "midnight"; prefix?: string; done?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  let target: number;
  if (to === "midnight") {
    const d = new Date(now);
    d.setHours(24, 0, 0, 0);
    target = d.getTime();
  } else target = new Date(to).getTime();
  const ms = target - now;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  // Server and browser clocks differ by the render gap, so the minute shown
  // can legitimately differ between the two passes.
  return <span suppressHydrationWarning>{ms <= 0 ? done : `${prefix}${h > 0 ? `${h}h ${m}m` : `${m}m`}`}</span>;
}

async function shareImage(url: string, filename: string, text: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't make the image.");
  const blob = await res.blob();
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], text });
    return "shared";
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}

export function ShareButtons({ url, text, image, filename }: { url: string; text: string; image?: string; filename?: string }) {
  const [msg, setMsg] = useState("");
  const full = `${text} ${url}`;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <a
          className="bm-btn !bg-[#25D366] !py-3 text-[15px]"
          href={`https://wa.me/?text=${encodeURIComponent(full)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => buzz(10)}
        >
          WhatsApp
        </a>
        <button
          className="bm-btn bm-btn-ghost !py-3 text-[15px]"
          onClick={async () => {
            buzz(10);
            try {
              await navigator.clipboard.writeText(url);
              setMsg("Link copied ✓");
            } catch {
              setMsg(url);
            }
          }}
        >
          Copy link
        </button>
      </div>
      {image && (
        <button
          className="bm-btn bm-btn-ghost !py-3 text-[15px]"
          onClick={async () => {
            setMsg("Making your card…");
            try {
              const r = await shareImage(image, filename ?? "brain-mate.png", full);
              setMsg(r === "shared" ? "Shared ✓" : "Card saved ✓");
            } catch (e) {
              setMsg(e instanceof Error && e.name !== "AbortError" ? e.message : "");
            }
          }}
        >
          Share the card as an image
        </button>
      )}
      {msg && <p className="text-center text-[13px] font-semibold text-[var(--bm-soft)]">{msg}</p>}
    </div>
  );
}

/** The identity image: unlimited, and it points at the landing page, not at a comparison with you. */
export function IdentityShare({ archetypeName, origin }: { archetypeName: string; origin: string }) {
  const [colleague, setColleague] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2 rounded-full bg-[var(--bm-line)] p-1 text-[13px] font-bold">
        {(["Friends", "Work-safe"] as const).map((l, i) => (
          <button
            key={l}
            className="flex-1 rounded-full py-2 transition-colors"
            style={{ background: colleague === (i === 1) ? "var(--card)" : "transparent" }}
            onClick={() => setColleague(i === 1)}
          >
            {l}
          </button>
        ))}
      </div>
      <button
        className="bm-btn bm-btn-brand"
        onClick={async () => {
          buzz(12);
          setMsg("Making your card…");
          try {
            const r = await shareImage(
              `/api/brain-mate/card${colleague ? "?v=colleague" : ""}`,
              "my-brain-mate.png",
              `I'm ${archetypeName} on Brain-Mate. What are you? ${origin.replace("://www.", "://")}`
            );
            setMsg(r === "shared" ? "Shared ✓" : "Card saved ✓");
          } catch (e) {
            setMsg(e instanceof Error && e.name !== "AbortError" ? e.message : "");
          }
        }}
      >
        Share my Brain-Mate card
      </button>
      <a className="text-center text-[13px] font-semibold text-[var(--bm-soft)] underline" href={`/api/brain-mate/card${colleague ? "?v=colleague" : ""}`} target="_blank">
        Open the image
      </a>
      {msg && <p className="text-center text-[13px] font-semibold text-[var(--bm-soft)]">{msg}</p>}
    </div>
  );
}

/** Today's one Wavelength link. */
export function DailyLink({
  myName,
  today,
  origin,
  bare = false,
}: {
  myName: string;
  origin: string;
  /** Today's link if already sent. */
  today: { slug: string; recipient: string; state: "waiting" | "done" | "expired" } | null;
  /** Inside a screen that already says what this is: no heading of its own. */
  bare?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [made, setMade] = useState<{ slug: string; recipient: string } | null>(null);

  const sent = made ?? today;
  if (sent) {
    const url = `${origin}/brain-mate/${sent.slug}`;
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-[1.2rem] bg-[var(--sunk)] p-4">
          <p className="text-[12px] font-extrabold tracking-[0.14em] text-[var(--bm-brand)]">TODAY&apos;S BRAIN-MATE CHECK</p>
          <p className="mt-1 text-[1.15rem] font-extrabold">
            {sent.recipient}
            {today?.state === "done" ? " played ✓" : today?.state === "expired" ? " missed it" : ""}
          </p>
          <p className="mt-0.5 break-all text-[13px] text-[var(--bm-soft)]">{url.replace(/^https?:\/\//, "")}</p>
        </div>
        {(made || today?.state === "waiting") && (
          <QuickShare
            label={`Send it to ${sent.recipient}`}
            url={url}
            text={`${sent.recipient}, ${myName.split(" ")[0]} wants to find your Wavelength on Brain-Mate. About 3 minutes, then we see how we click:`}
          />
        )}
        <p className="text-center text-[13px] font-semibold text-[var(--bm-soft)]">
          <Countdown to="midnight" prefix="Your next one in " done="A new one is ready — refresh" />
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const res = await fetch("/api/brain-mate/links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, relation: "friend", tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Couldn't make the link.");
          buzz([15, 30, 15]);
          setMade({ slug: data.slug, recipient: name.trim().split(" ")[0] });
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't make the link.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div hidden={bare}>
        <p className="text-[12px] font-extrabold tracking-[0.14em] text-[var(--bm-brand)]">FIND YOUR BRAIN-MATE · 1 TODAY</p>
        <p className="mt-1 text-[15px] text-[var(--bm-soft)]">
          Who&apos;s on your wavelength? Send them the game — when they play, you both see how you click.
        </p>
      </div>
      <input
        className="bm-input text-[1.1rem] font-bold"
        placeholder="Their first name"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        aria-label="Their name"
      />
      {error && <p className="text-[13px] font-semibold text-[var(--warn)]">{error}</p>}
      <button className="bm-btn bm-btn-brand" disabled={busy || name.trim().length < 2}>
        {busy ? "Making your link…" : "Send the challenge"}
      </button>
    </form>
  );
}

/** On someone else's waiting link, once you've already played: answer it without replaying. */
export function ClaimButton({ slug, label, onDone }: { slug: string; label: string; onDone?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <button
        className="bm-btn bm-btn-brand"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          const res = await fetch(`/api/brain-mate/links/${slug}/claim`, { method: "POST" });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            buzz([20, 40, 60]);
            if (onDone) onDone();
            else {
              router.push(`/brain-mate/${slug}?reveal=1`);
              router.refresh();
            }
          } else {
            setError(data.error ?? "Couldn't open it.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Lining up your waves…" : label}
      </button>
      {error && <p className="text-center text-[13px] font-semibold text-[var(--warn)]">{error}</p>}
    </div>
  );
}

/** The sender's one reminder. */
export function NudgeButton({ slug, url, text }: { slug: string; url: string; text: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  if (state === "done") return <p className="text-center text-[13px] font-semibold text-[var(--bm-soft)]">Nudged ✓ — that was your one.</p>;
  return (
    <a
      className="bm-btn bm-btn-ghost"
      href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={async () => {
        const res = await fetch(`/api/brain-mate/links/${slug}/nudge`, { method: "POST" });
        setState(res.ok ? "done" : "error");
      }}
    >
      {state === "error" ? "Already nudged" : "Nudge them (once)"}
    </a>
  );
}

/**
 * The viral loop, as one call to action: find your Brain-Mate by sending a
 * Wavelength check — one a day, so it's an event, not spam. Collapsed, an
 * invitation; tapped, the name field; once sent, today's check and when
 * the next one unlocks. `autoOpen` jumps straight to the name field.
 */
export function WavelengthCta({
  myName,
  origin,
  today,
  autoOpen = false,
}: {
  myName: string;
  origin: string;
  today: { slug: string; recipient: string; state: "waiting" | "done" | "expired" } | null;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  if (today || open) return <DailyLink myName={myName} origin={origin} today={today} />;
  return (
    <div className="flex flex-col gap-4 text-center">
      <div className="mx-auto flex items-center gap-1.5 rounded-full bg-[var(--bm-card)] px-3 py-1 text-[11.5px] font-bold tracking-[0.12em] text-[var(--bm-brand)]">
        🌊 ONE A DAY
      </div>
      <div>
        <p className="bm-display text-[1.7rem] leading-tight">Find your Brain-Mate</p>
        <p className="mx-auto mt-1.5 max-w-[22rem] text-[14.5px] text-[var(--bm-soft)]">
          Send one person a Wavelength check. When they play, you&apos;ll both see how you click — Mind Twins, Power Duo, or Beautiful Chaos?
        </p>
      </div>
      <button
        className="bm-btn bm-btn-brand"
        onClick={() => {
          buzz(12);
          setOpen(true);
        }}
      >
        Find my Brain-Mate →
      </button>
    </div>
  );
}

/**
 * One tap to share. The phone's own share sheet carries the image itself
 * (WhatsApp, Instagram, anywhere); without one, WhatsApp opens with the
 * link. Copy and save sit underneath, quietly.
 */
export function QuickShare({
  url,
  text,
  image,
  filename = "brain-mate.png",
  label = "Share",
  tone: look = "brand",
  copy = true,
}: {
  url: string;
  text: string;
  image?: string;
  filename?: string;
  label?: string;
  /** "light" sits on an archetype-coloured card. */
  tone?: "brand" | "light" | "ghost";
  /** Show "Copy link" under the button. */
  copy?: boolean;
}) {
  const [msg, setMsg] = useState("");
  const full = `${text} ${url}`;
  const share = async () => {
    buzz(12);
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    try {
      if (image && nav.share) {
        setMsg("Getting it ready…");
        const res = await fetch(image);
        if (res.ok) {
          const file = new File([await res.blob()], filename, { type: "image/png" });
          if (nav.canShare?.({ files: [file] })) {
            await nav.share({ files: [file], text: full });
            setMsg("Shared ✓");
            return;
          }
        }
      }
      if (nav.share) {
        await nav.share({ text, url });
        setMsg("Shared ✓");
        return;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(full)}`, "_blank", "noopener,noreferrer");
      setMsg("");
    } catch (e) {
      setMsg(e instanceof Error && e.name !== "AbortError" ? "Couldn't share — try copying the link." : "");
    }
  };
  const light = look === "light";
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={share}
        className={light ? "bm-btn w-full !bg-white !text-[#241A16] !shadow-none" : look === "ghost" ? "bm-btn bm-btn-ghost w-full" : "bm-btn bm-btn-brand w-full"}
      >
        {label} ↗
      </button>
      <div className={`flex items-center gap-4 text-[12.5px] font-semibold ${light ? "opacity-85" : "text-[var(--bm-soft)]"}`}>
        <a href={`https://wa.me/?text=${encodeURIComponent(full)}`} target="_blank" rel="noopener noreferrer" onClick={() => buzz(8)}>
          WhatsApp
        </a>
        {copy && (
          <>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={async () => {
                buzz(8);
                try {
                  await navigator.clipboard.writeText(url);
                  setMsg("Link copied ✓");
                } catch {
                  setMsg(url);
                }
              }}
            >
              Copy link
            </button>
          </>
        )}
        {image && (
          <>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={async () => {
                setMsg("Saving…");
                try {
                  const r = await shareImage(image, filename, full);
                  setMsg(r === "shared" ? "Shared ✓" : "Saved ✓");
                } catch {
                  setMsg("");
                }
              }}
            >
              Save image
            </button>
          </>
        )}
      </div>
      {msg && <p className={`text-[12.5px] font-semibold ${light ? "opacity-85" : "text-[var(--bm-soft)]"}`}>{msg}</p>}
    </div>
  );
}
