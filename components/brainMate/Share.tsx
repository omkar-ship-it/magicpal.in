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
            style={{ background: colleague === (i === 1) ? "#fff" : "transparent" }}
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
              `I'm ${archetypeName} on Brain-Mate. What are you? ${origin}/brain-mate`
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
}: {
  myName: string;
  origin: string;
  /** Today's link if already sent. */
  today: { slug: string; recipient: string; state: "waiting" | "done" | "expired" } | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<"friend" | "colleague">("friend");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [made, setMade] = useState<{ slug: string; recipient: string } | null>(null);

  const sent = made ?? today;
  if (sent) {
    const url = `${origin}/brain-mate/${sent.slug}`;
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-[1.2rem] bg-[#FFF1EC] p-4">
          <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">TODAY&apos;S WAVELENGTH</p>
          <p className="mt-1 text-[1.15rem] font-extrabold">
            {sent.recipient}
            {today?.state === "done" ? " played ✓" : today?.state === "expired" ? " missed it" : ""}
          </p>
          <p className="mt-0.5 break-all text-[13px] text-[var(--bm-soft)]">{url.replace(/^https?:\/\//, "")}</p>
        </div>
        {(made || today?.state === "waiting") && (
          <ShareButtons
            url={url}
            text={`${myName.split(" ")[0]} wants to find your Wavelength on Brain-Mate. About 3 minutes, then we see how we click:`}
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
            body: JSON.stringify({ name, relation, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
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
      <div>
        <p className="text-[12px] font-extrabold tracking-[0.18em] text-[var(--bm-brand)]">ONE PERSON. ONE CHALLENGE.</p>
        <p className="mt-1 text-[15px] text-[var(--bm-soft)]">
          Share with a friend or colleague to find your Wavelength. One a day — choose well.
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
      <div className="flex gap-2 rounded-full bg-[var(--bm-line)] p-1 text-[14px] font-bold">
        {(["friend", "colleague"] as const).map((r) => (
          <button
            type="button"
            key={r}
            className="flex-1 rounded-full py-2.5 capitalize transition-colors"
            style={{ background: relation === r ? "#fff" : "transparent" }}
            onClick={() => setRelation(r)}
            aria-pressed={relation === r}
          >
            {r}
          </button>
        ))}
      </div>
      {error && <p className="text-[13px] font-semibold text-[#c2410c]">{error}</p>}
      <button className="bm-btn bm-btn-brand" disabled={busy || name.trim().length < 2}>
        {busy ? "Making your link…" : "Create today's link"}
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
      {error && <p className="text-center text-[13px] font-semibold text-[#c2410c]">{error}</p>}
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
