"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import AvatarPicker from "./AvatarPicker";
import PlaceSearch, { type Place } from "./PlaceSearch";
import TopicPicker from "./TopicPicker";
import OwnWords from "./OwnWords";
import VisibilityPicker, { type Visibility } from "./VisibilityPicker";
import Avatar from "./Avatar";
import { IconCheck, IconGlobe, IconPin, IconSparkle, IconUser } from "./Icons";

/**
 * Getting somebody onto the map, one answer at a time.
 *
 * The long form this replaces asked six sections' worth of questions and
 * saved none of them until the last button. Eight of the first twenty-three
 * accounts have no name at all; eleven more filled something in, met a save
 * that refused them, and left with nothing recorded. Both failures have the
 * same shape — everything or nothing — and a progress bar on its own would
 * not have changed either.
 *
 * So the order of business here is:
 *
 * 1. **Every step saves.** Somebody who stops after the first screen has a
 *    name and a headline in the table, is in the directory, and can be
 *    written to. Partial progress is the product's second-best outcome and
 *    it used to be indistinguishable from the worst one.
 * 2. **Each step makes them more visible than the last** — named, then
 *    placed, then matchable — so there is a reason to take the next one
 *    rather than only a bar that moves.
 * 3. **Nothing is asked twice and nothing is asked early.** Three
 *    questions, in the order the product needs them.
 *
 * Resuming is free: the step to open on is worked out from what is already
 * filled in, so coming back lands where they stopped rather than at the
 * beginning of a form they have already half answered.
 */

export type Draft = {
  name: string;
  headline: string;
  company: string;
  workingOn: string;
  photoUrl: string | null;
  avatarStyle: string;
  lookingFor: string[];
  canHelpWith: string[];
  customLookingFor: string[];
  customCanHelpWith: string[];
  locationLabel: string | null;
  lat: number | null;
  lng: number | null;
  baseLabel: string | null;
  baseLat: number | null;
  baseLng: number | null;
  visibility: Visibility;
  publicOptIn: boolean;
};

const STEPS = [
  { id: "you", title: "Who you are", blurb: "Your name and one line. This is what a stranger reads first." },
  { id: "where", title: "Where you are", blurb: "A city is enough. It is what puts you on the map." },
  {
    id: "what",
    title: "What you're after",
    blurb: "The two answers every introduction here is made of, in both directions.",
  },
] as const;

type StepId = (typeof STEPS)[number]["id"];

/** Where to resume. The first question they haven't answered. */
export function firstUnanswered(d: Draft): number {
  if (d.name.trim().length < 2 || d.headline.trim().length < 2) return 0;
  if (!onTheMap(d)) return 1;
  return 2;
}

/**
 * Whether onboarding is still the right surface for this person.
 *
 * Named, placed, and not hidden — that is the whole bar, and it is
 * deliberately not "has filled in everything". Somebody who reaches the
 * map and skips the last question should get the edit form and its
 * "next: add what you're looking for" nudge, not be dropped back at the
 * start of a flow they have already finished. Anything stricter is a loop.
 */
export function onTheMap(d: {
  name: string;
  visibility: string;
  lat: number | null;
  baseLat: number | null;
}): boolean {
  return d.name.trim().length >= 2 && d.visibility !== "off" && (d.baseLat != null || d.lat != null);
}

export default function Onboarding({
  draft,
  setDraft,
  needsConsent,
  peerCount,
  near = null,
  onStepSaved,
  onFinished,
}: {
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  /** They have not agreed to the current wording. Asked once, on step one. */
  needsConsent: boolean;
  /** How many people are already on the map. The reason to bother. */
  peerCount: number;
  /**
   * Where the map is looking, used only to rank search results.
   *
   * Not a guess about where the person is and never saved as one — but a
   * search with no bias at all ranked a Virginia realtor above the city
   * of Pune, and the part of the world already on their screen is a far
   * better tiebreak than nothing.
   */
  near?: { lat: number; lng: number } | null;
  /** Fired after each successful save, so the map behind updates as they go. */
  onStepSaved: () => void;
  onFinished: () => void;
}) {
  const [i, setI] = useState(() => firstUnanswered(draft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);
  const consentRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const step = STEPS[i];
  /**
   * What the location picker is showing, which is not what the draft says
   * until somebody touches it.
   *
   * `off` is the column default, and the picker renders "my city only" as
   * selected so the gentlest option is the one already chosen. Reading the
   * draft at save time instead wrote `off` for anybody who picked a city
   * and never touched the radio — a profile saved as hidden by somebody
   * looking at a screen that said otherwise.
   */
  const visibility: Visibility = draft.visibility === "off" ? "base" : draft.visibility;
  const hasBase = draft.baseLat != null && (draft.baseLabel?.length ?? 0) > 0;
  const hasExact = draft.lat != null && (draft.locationLabel?.length ?? 0) > 0;
  /**
   * What it is safe to *send*, which is not always what is shown.
   *
   * The server refuses a visibility it has no coordinates for, and rightly
   * — a setting that claims a pin nobody has is a privacy setting that
   * lies in the reassuring direction. So step one, where the picker has
   * not been reached yet, sends `off` rather than the `base` the later
   * step will display. Coercing it everywhere made the very first save
   * fail with a message about a city nobody had been asked for yet.
   */
  const sending: Visibility =
    visibility === "exact" ? (hasExact ? "exact" : "off") : hasBase ? visibility : "off";
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  /**
   * What is wrong with this step, in the words the person needs.
   *
   * Returned rather than used to disable the button. A disabled control
   * states that an action is unavailable and never says why — that exact
   * mistake shipped once here and cost a fortnight of signups.
   */
  function problem(id: StepId): { message: string; focus?: () => void } | null {
    if (id === "you") {
      if (draft.name.trim().length < 2) {
        return { message: "Tell us your name.", focus: () => nameRef.current?.focus() };
      }
      if (draft.headline.trim().length < 2) return { message: "Add a one-line headline." };
      if (needsConsent && !agreed) {
        return {
          message: "Please accept the Terms & Conditions and Privacy Policy to continue.",
          focus: () => {
            consentRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
            consentRef.current?.focus();
          },
        };
      }
    }
    if (id === "where") {
      if (visibility === "exact" && !hasExact) return { message: "Pick your location from the list." };
      if (visibility !== "exact" && !hasBase) return { message: "Pick your city from the list." };
    }
    return null;
  }

  async function saveAnd(next: () => void) {
    const bad = problem(step.id);
    if (bad) {
      setError(bad.message);
      bad.focus?.();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `sending`, not `draft.visibility` — see above.
        body: JSON.stringify({ ...draft, visibility: sending, acceptTerms: needsConsent ? agreed : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't save that.");
      onStepSaved();
      next();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <Finished name={draft.name} photoUrl={draft.photoUrl} peerCount={peerCount} onGo={onFinished} />;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* ── the progress ──
          A step count and a bar, and the bar is the smaller half of it.
          "Step 2 of 3" is a promise about how much is left; a percentage
          on its own is a score, and nobody has ever been encouraged by
          being told they are 33%. */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[12px] font-semibold tracking-wide text-[var(--ink-soft)]">
            STEP {i + 1} OF {STEPS.length}
          </p>
          <p className="text-[11.5px] text-[var(--ink-soft)]">
            {peerCount > 0 ? `${peerCount} already here` : "Be the first"}
          </p>
        </div>
        <div className="mt-2 flex gap-1.5">
          {STEPS.map((s, n) => (
            <span
              key={s.id}
              className="h-1.5 flex-1 overflow-hidden rounded-full"
              style={{ background: "var(--line)" }}
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: n < i ? "100%" : n === i ? "35%" : "0%",
                  background: "linear-gradient(90deg, var(--brand), var(--brand-deep))",
                  transition: "width 420ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </span>
          ))}
        </div>
      </div>

      <h2 className="text-[17px] font-semibold leading-snug">{step.title}</h2>
      <p className="mt-1 max-w-[46ch] text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">{step.blurb}</p>

      <div className="mt-4 flex flex-col gap-4">
        {step.id === "you" && (
          <>
            {/* The picker explains itself; a second caption beside it was
                two paragraphs of reassurance about an optional field, at
                the top of the first screen anybody ever sees. */}
            <AvatarPicker
              name={draft.name || "You"}
              photoUrl={draft.photoUrl}
              style={draft.avatarStyle}
              onChange={(next) => setDraft((d) => ({ ...d, photoUrl: next.photoUrl, avatarStyle: next.style }))}
            />

            <div>
              <label className="label" htmlFor="o-name">
                Your name
              </label>
              <input
                ref={nameRef}
                id="o-name"
                className="input"
                value={draft.name}
                autoFocus
                onChange={(e) => set("name", e.target.value)}
                placeholder="Priya Nair"
              />
            </div>

            <div>
              <label className="label" htmlFor="o-headline">
                What you do
              </label>
              <input
                id="o-headline"
                className="input"
                value={draft.headline}
                onChange={(e) => set("headline", e.target.value)}
                placeholder="Product designer"
              />
            </div>

            <div>
              <label className="label" htmlFor="o-company">
                Where you work <span className="font-normal text-[var(--ink-soft)]">— optional</span>
              </label>
              <input
                id="o-company"
                className="input"
                value={draft.company}
                onChange={(e) => set("company", e.target.value)}
                placeholder="Acme"
              />
            </div>

            {needsConsent && (
              <label
                className="tap flex cursor-pointer items-start gap-3 rounded-xl border p-3"
                style={{ borderColor: agreed ? "var(--brand)" : "var(--line)" }}
              >
                <input
                  ref={consentRef}
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 flex-none accent-[var(--brand)]"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span className="text-[12.5px] leading-[1.5]">
                  I&rsquo;m {LEGAL.minimumAge} or older and I agree to the{" "}
                  <Link href="/terms" className="underline" target="_blank">
                    Terms &amp; Conditions
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="underline" target="_blank">
                    Privacy Policy
                  </Link>
                  .
                  <span className="mt-1 block text-[11.5px] text-[var(--ink-soft)]">
                    They open in a new tab — you won&rsquo;t lose what you&rsquo;ve typed.
                  </span>
                </span>
              </label>
            )}
          </>
        )}

        {step.id === "where" && (
          <>
            <VisibilityPicker
              value={visibility}
              onChange={(v) => set("visibility", v)}
              hasExact={draft.lat != null && draft.lng != null}
              hasBase={draft.baseLat != null && draft.baseLng != null}
            />

            {visibility !== "exact" && (
              <div>
                <label className="label" htmlFor="o-city">
                  Your city
                </label>
                <PlaceSearch
                  id="o-city"
                  kind="place"
                  near={near}
                  value={draft.baseLabel ?? ""}
                  placeholder="Hyderabad"
                  onPick={(p: Place) =>
                    setDraft((d) => ({ ...d, baseLabel: p.label, baseLat: p.lat, baseLng: p.lng }))
                  }
                />
              </div>
            )}

            {visibility === "exact" && (
              <div>
                <label className="label" htmlFor="o-exact">
                  Exact location
                </label>
                <PlaceSearch
                  id="o-exact"
                  near={near}
                  value={draft.locationLabel ?? ""}
                  placeholder="A venue, an office, a neighbourhood"
                  onPick={(p: Place) => setDraft((d) => ({ ...d, locationLabel: p.label, lat: p.lat, lng: p.lng }))}
                />
              </div>
            )}

            <label
              className="tap flex cursor-pointer items-start gap-3 rounded-xl border p-3"
              style={{
                borderColor: draft.publicOptIn ? "var(--brand)" : "var(--line)",
                background: draft.publicOptIn ? "var(--sunk)" : "var(--card)",
              }}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 flex-none accent-[var(--brand)]"
                checked={draft.publicOptIn}
                onChange={(e) => set("publicOptIn", e.target.checked)}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                  <IconGlobe size={15} />
                  Also show me on the public network
                </span>
                <span className="mt-0.5 block text-[12px] leading-[1.45] text-[var(--ink-soft)]">
                  Anybody can see your profile and, if you&rsquo;ve set one, your location — not only the
                  boards you&rsquo;ve joined. You can change this whenever you like.
                </span>
              </span>
            </label>
          </>
        )}

        {step.id === "what" && (
          <>
            <TopicPicker side="need" selected={draft.lookingFor} onChange={(v) => set("lookingFor", v)} />
            <OwnWords
              placeholder="A co-founder who has shipped hardware"
              values={draft.customLookingFor}
              onChange={(v) => set("customLookingFor", v)}
            />
            <TopicPicker side="offer" selected={draft.canHelpWith} onChange={(v) => set("canHelpWith", v)} />
            <OwnWords
              placeholder="Getting a first enterprise customer"
              values={draft.customCanHelpWith}
              onChange={(v) => set("customCanHelpWith", v)}
            />
            <div>
              <label className="label" htmlFor="o-working">
                What you&rsquo;re working on <span className="font-normal text-[var(--ink-soft)]">— optional</span>
              </label>
              <input
                id="o-working"
                className="input"
                value={draft.workingOn}
                onChange={(e) => set("workingOn", e.target.value)}
                placeholder="A marketplace for second-hand lab equipment"
              />
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="mt-3 text-[12.5px] font-medium" style={{ color: "var(--warn)" }}>
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-2">
        {i > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setError(""); setI(i - 1); }}>
            Back
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary flex-1"
          disabled={busy}
          onClick={() =>
            void saveAnd(() => {
              if (i + 1 < STEPS.length) setI(i + 1);
              else setDone(true);
            })
          }
        >
          {busy ? "Saving…" : i + 1 < STEPS.length ? "Save and continue" : "Finish"}
        </button>
      </div>

      {/*
        Said out loud, because it is the thing that makes stopping safe.
        Somebody who believes a half-filled form is worth nothing will
        close it; somebody who knows the last screen is already saved will
        come back to the next one.
      */}
      <p className="mt-2.5 text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
        {i === 0
          ? "Saved as you go — you can stop after any step and pick it up later."
          : "Everything before this step is already saved."}
      </p>
    </div>
  );
}

/**
 * The payoff.
 *
 * The last screen of a signup is the only moment somebody is certain they
 * have finished, and a form that simply stops leaves them wondering. This
 * says what changed — they are on the map — and points at the thing they
 * came for rather than at more fields.
 */
function Finished({
  name,
  photoUrl,
  peerCount,
  onGo,
}: {
  name: string;
  photoUrl: string | null;
  peerCount: number;
  onGo: () => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="rounded-2xl p-4" style={{ background: "var(--sunk)" }}>
        <div className="flex items-center gap-3">
          <Avatar name={name || "You"} photoUrl={photoUrl} size={48} />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-tight">You&rsquo;re on the map</p>
            <p className="mt-0.5 text-[12.5px] leading-[1.45] text-[var(--ink-soft)]">
              {peerCount > 0
                ? `${peerCount} ${peerCount === 1 ? "person is" : "people are"} already on it. Go and see who.`
                : "You're the first one on it. Bring somebody."}
            </p>
          </div>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5">
        {[
          { icon: <IconUser size={14} />, text: "Your name and headline are what a stranger reads first." },
          { icon: <IconPin size={14} />, text: "Your pin is only as precise as you chose — change it any time." },
          {
            icon: <IconSparkle size={14} />,
            text: "What you're after and what you offer are what every introduction here is made of.",
          },
        ].map((r, n) => (
          <li key={n} className="flex items-start gap-2.5 text-[12.5px] leading-[1.5]">
            <span className="mt-0.5 flex-none text-[var(--good)]">
              <IconCheck size={14} />
            </span>
            <span>
              <span className="mr-1.5 inline-flex align-[-2px] text-[var(--ink-soft)]">{r.icon}</span>
              {r.text}
            </span>
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn-primary mt-5 w-full" onClick={onGo}>
        Show me who&rsquo;s nearby
      </button>
      <p className="mt-2.5 text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
        You can add more to your profile any time — the more it says, the better the introductions get.
      </p>
    </div>
  );
}
