"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SECTORS, STAGES } from "@/lib/intents";
import { ALERT_KINDS, ALERT_RADII, DEFAULT_ALERT_RADIUS_KM, MAX_INTERESTS } from "@/lib/rules";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import OwnWords from "./OwnWords";
import BoardLogo from "./BoardLogo";
import type { NetworkOption } from "@/lib/shell";
import AvatarPicker from "./AvatarPicker";
import PlaceSearch, { type Place } from "./PlaceSearch";
import TopicPicker from "./TopicPicker";
import VisibilityPicker, { type Visibility } from "./VisibilityPicker";
import CreateBoard from "./CreateBoard";
import BoardQR from "./BoardQR";
import SignOut from "./SignOut";
import PanelNote from "./PanelNote";
import Avatar from "./Avatar";
import { IconBeacon, IconCheck, IconGlobe, IconPeople, IconPin, IconPlus, IconSparkle, IconUser } from "./Icons";

/** One heading shape for every section, so the long form reads as a list. */
function SectionTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div>
      <h2 className="flex items-center gap-1.5 text-[14px] font-semibold">
        <span style={{ color: "var(--brand)" }}>{icon}</span>
        {title}
      </h2>
      {hint && <p className="mt-1 text-[12px] leading-[1.5] text-[var(--ink-soft)]">{hint}</p>}
    </div>
  );
}

type Draft = {
  name: string;
  headline: string;
  company: string;
  workingOn: string;
  linkedinUrl: string;
  phone: string;
  phoneVisibility: "private" | "connections";
  photoUrl: string | null;
  avatarStyle: string;
  notifyConnections: boolean;
  notifyMatches: boolean;
  notifyInterests: boolean;
  notifyRadiusKm: number;
  lookingFor: string[];
  canHelpWith: string[];
  interests: string[];
  /** The same three answers, in their own words. See lib/intents. */
  customLookingFor: string[];
  customCanHelpWith: string[];
  customInterests: string[];
  stage: string;
  locationLabel: string | null;
  lat: number | null;
  lng: number | null;
  baseLabel: string | null;
  baseLat: number | null;
  baseLng: number | null;
  visibility: Visibility;
  publicOptIn: boolean;
  openToMentor: boolean;
  seekingMentor: boolean;
};

/**
 * Your profile, your signals, and your networks — over the map, never
 * instead of it.
 *
 * Ordered by what it is for rather than by what is easy to ask: who you
 * are, then the signals the matcher runs on, then where you'll appear, then
 * the boards you run. Signals sit above location deliberately — a profile
 * with a pin and no stated intent is visible and unmatchable, which is the
 * worst state to be in here.
 */
export default function ProfilePanel({
  networks,
  connections,
  onSaved,
  onOpenNetwork,
}: {
  networks: NetworkOption[];
  /** Accepted connections — the one number that says the product worked. */
  connections: number;
  onSaved: () => void;
  onOpenNetwork: (slug: string) => void;
}) {
  const router = useRouter();
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [creating, setCreating] = useState(false);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  /**
   * Whether this person has already agreed to the current terms and privacy
   * policy. Null while we are still asking the server — the checkbox must
   * not flash into view for somebody who accepted months ago, and must not
   * be skippable for somebody who hasn't.
   */
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [agreed, setAgreed] = useState(false);
  const consentRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((json) => {
        if (!alive || !json.profile) return;
        const p = json.profile;
        setEmail(p.email ?? "");
        setTermsAccepted(Boolean(json.termsAccepted));
        setD({
          name: p.name,
          headline: p.headline,
          company: p.company,
          workingOn: p.workingOn,
          linkedinUrl: p.linkedinUrl,
          phone: p.phone ?? "",
          phoneVisibility: p.phoneVisibility ?? "connections",
          photoUrl: p.photoUrl,
          avatarStyle: "notionists",
          notifyConnections: p.notifyConnections ?? true,
          notifyMatches: p.notifyMatches ?? true,
          notifyInterests: p.notifyInterests ?? false,
          notifyRadiusKm: p.notifyRadiusKm ?? DEFAULT_ALERT_RADIUS_KM,
          lookingFor: p.lookingFor,
          canHelpWith: p.canHelpWith,
          interests: p.interests,
          customLookingFor: p.customLookingFor ?? [],
          customCanHelpWith: p.customCanHelpWith ?? [],
          customInterests: p.customInterests ?? [],
          stage: p.stage,
          locationLabel: p.locationLabel,
          lat: p.lat,
          lng: p.lng,
          baseLabel: p.baseLabel,
          baseLat: p.baseLat,
          baseLng: p.baseLng,
          visibility: p.visibility,
          publicOptIn: p.publicOptIn ?? true,
          openToMentor: p.openToMentor,
          seekingMentor: p.seekingMentor,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!d) return <PanelNote title="Loading your profile…" />;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => (p ? { ...p, [k]: v } : p));

  /**
   * AvatarPicker returns a downscaled data URL, which is right for the two
   * things it does well — resizing and dropping the camera's EXIF GPS tag,
   * which matters a lot here — and wrong as storage: a data URL in the row
   * would ride along in every map response.
   */
  async function onAvatar(next: { photoUrl: string | null; style: string }) {
    set("avatarStyle", next.style);
    setPhotoError("");
    if (!next.photoUrl) {
      set("photoUrl", null);
      await fetch("/api/profile/photo", { method: "DELETE" }).catch(() => {});
      return;
    }
    if (!next.photoUrl.startsWith("data:")) return set("photoUrl", next.photoUrl);
    set("photoUrl", next.photoUrl);
    try {
      const blob = await (await fetch(next.photoUrl)).blob();
      const form = new FormData();
      form.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/profile/photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't upload that photo.");
      set("photoUrl", data.photoUrl);
    } catch (err) {
      set("photoUrl", null);
      setPhotoError(err instanceof Error ? `${err.message} Your character avatar still works.` : "Upload failed.");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();

    /**
     * Checked here rather than by disabling the button.
     *
     * It *was* a disabled button, and that shipped a profile form nobody
     * could submit: a new member filled in their name, their city and their
     * visibility, pressed a grey button that did nothing, and left. Every
     * account created after it went out has no name and no location, and
     * one of them is a member of a live board who was reported as "joined
     * but not on the map".
     *
     * A disabled control states that an action is unavailable and never
     * says why. The fix is the ordinary one: let the button be pressed, and
     * answer the press — with the reason, at the control that needs
     * attention, focused so the next keystroke acts on it.
     */
    if (termsAccepted === false && !agreed) {
      setError("Please accept the Terms & Conditions and Privacy Policy to continue.");
      consentRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      consentRef.current?.focus();
      return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, acceptTerms: termsAccepted === true ? undefined : agreed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't save that.");
      // The row has landed, so stop asking. Without this the agreement
      // block stayed on screen after a successful save, which reads as the
      // tick not having registered and invites a second, pointless one.
      setTermsAccepted(true);
      setSaved(true);
      router.refresh();
      onSaved();
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function toggleInterest(id: string) {
    const on = d!.interests.includes(id);
    if (!on && d!.interests.length >= MAX_INTERESTS) return;
    set("interests", on ? d!.interests.filter((x) => x !== id) : [...d!.interests, id]);
  }

  const myBoards = networks.filter((n) => n.slug !== null);

  /**
   * Somewhere to rank place results around: their city if they have one,
   * otherwise their pin. Null on a first profile, which is correct — there
   * is nothing to bias towards yet and guessing from an IP would be a
   * worse answer stated with more confidence.
   */
  const near =
    d.baseLat != null && d.baseLng != null
      ? { lat: d.baseLat, lng: d.baseLng }
      : d.lat != null && d.lng != null
        ? { lat: d.lat, lng: d.lng }
        : null;

  const visibilityLine =
    d.visibility === "off"
      ? "Not on the public map"
      : d.visibility === "base"
        ? `Showing ${d.baseLabel ?? "your city"}`
        : d.visibility === "live"
          ? "Sharing live location"
          : `Pinned at ${d.locationLabel ?? "your location"}`;

  // What's actually missing, named rather than scored. A bare percentage
  // tells somebody they're incomplete without telling them what to do; the
  // first unfilled item is the only useful part of the number, so that is
  // the part this shows.
  const steps: Array<{ done: boolean; label: string }> = [
    { done: Boolean(d.name && d.headline), label: "your name and a line about you" },
    { done: d.lookingFor.length + d.customLookingFor.length > 0, label: "what you're looking for" },
    { done: d.canHelpWith.length + d.customCanHelpWith.length > 0, label: "what you can help with" },
    { done: d.interests.length + d.customInterests.length > 0, label: "what you're into" },
    { done: Boolean(d.workingOn), label: "what you're working on" },
    { done: Boolean(d.photoUrl || d.avatarStyle), label: "a picture" },
    { done: d.visibility !== "off", label: "where you appear" },
  ];
  const doneCount = steps.filter((x) => x.done).length;
  const nextUp = steps.find((x) => !x.done);
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* A standing summary, so the long form below is something you scroll
          into rather than the first thing you meet. */}
      <div className="mb-4 flex items-center gap-3 rounded-2xl p-3" style={{ background: "var(--sunk)" }}>
        <Avatar name={d.name || "You"} photoUrl={d.photoUrl} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{d.name || "Your profile"}</p>
          <p className="truncate text-[12px] text-[var(--ink-soft)]">
            {d.headline || "Add a line about yourself"}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--ink-soft)]">
            <span>
              <span className="font-semibold text-[var(--ink)]">{connections}</span>{" "}
              {connections === 1 ? "connection" : "connections"}
            </span>
            <span aria-hidden="true">·</span>
            <span
              style={{ color: d.visibility === "off" ? "var(--ink-soft)" : "var(--good)" }}
            >
              {visibilityLine}
            </span>
          </p>
        </div>
      </div>

      {/* The bar exists to answer "why bother" — every unfilled line is a
          recommendation that can't be made, in either direction. It
          disappears entirely once there's nothing left to say. */}
      {nextUp && (
        <div className="mb-4 rounded-2xl p-3" style={{ background: "var(--sunk)" }}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[12.5px] font-semibold">Your profile is {pct}% there</p>
            <p className="mono text-[11.5px] text-[var(--ink-soft)]">
              {doneCount}/{steps.length}
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, var(--brand), var(--brand-deep))",
                transition: "width 420ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>
          <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
            Next: add {nextUp.label}.
          </p>
        </div>
      )}

      <form onSubmit={save} className="flex flex-col gap-5 pb-2">
        {/* ------------------------------------------------- who you are */}
        <section>
          <SectionTitle icon={<IconUser size={13} />} title="Who you are" />
          <div className="mt-3 flex flex-col gap-3">
            <AvatarPicker name={d.name || "You"} photoUrl={d.photoUrl} style={d.avatarStyle} onChange={onAvatar} />
            {photoError && <p className="text-[12px] font-medium text-[var(--warn)]">{photoError}</p>}

            <div>
              <label className="label" htmlFor="p-name">
                Name
              </label>
              <input id="p-name" className="input" required value={d.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="p-headline">
                One line about you
              </label>
              <input
                id="p-headline"
                className="input"
                required
                placeholder="Product lead, fintech"
                value={d.headline}
                onChange={(e) => set("headline", e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="p-company">
                Company
              </label>
              <input id="p-company" className="input" value={d.company} onChange={(e) => set("company", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="p-linkedin">
                LinkedIn
              </label>
              <input
                id="p-linkedin"
                className="input"
                placeholder="linkedin.com/in/you"
                value={d.linkedinUrl}
                onChange={(e) => set("linkedinUrl", e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="p-phone">
                Phone
              </label>
              <input
                id="p-phone"
                className="input"
                inputMode="tel"
                placeholder="+91 98765 43210"
                value={d.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
              {/* Never in a map payload — it leaves the server only to you
                  or to somebody you've accepted. Said here because a phone
                  number is the field people most want to be sure about. */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ["connections", "Visible to connections"],
                    ["private", "Private — only me"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className="chip-toggle tap"
                    data-on={d.phoneVisibility === id ? "true" : "false"}
                    aria-pressed={d.phoneVisibility === id}
                    onClick={() => set("phoneVisibility", id)}
                  >
                    {d.phoneVisibility === id && <IconCheck size={11} />}
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
                Never shown on the map or in any list. Shared only after someone you accepted asks.
              </p>
            </div>
          </div>
        </section>

        {/* --------------------------------------------- what drives match */}
        <section>
          <SectionTitle
            icon={<IconSparkle size={13} />}
            title="What you're here for"
            hint="Every recommendation you get — and every one you appear in — is built from these."
          />

          <div className="mt-3 flex flex-col gap-4">
            <div>
              <TopicPicker side="need" selected={d.lookingFor} onChange={(v) => set("lookingFor", v)} />
              <OwnWords
                values={d.customLookingFor}
                placeholder="A distribution partner in the Gulf"
                hint="Not on the list? Say it your way. It finds people who wrote the same thing."
                onChange={(v) => set("customLookingFor", v)}
              />
            </div>
            <div>
              <TopicPicker side="offer" selected={d.canHelpWith} onChange={(v) => set("canHelpWith", v)} />
              <OwnWords
                values={d.customCanHelpWith}
                placeholder="Warehouse automation"
                hint="The specific thing you'd actually help a stranger with."
                onChange={(v) => set("customCanHelpWith", v)}
              />
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p className="label m-0">I&rsquo;m interested in</p>
                <span className="text-[11.5px] text-[var(--ink-soft)]">
                  {d.interests.length} of {MAX_INTERESTS}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SECTORS.map((s) => {
                  const on = d.interests.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="chip-toggle tap"
                      data-on={on ? "true" : "false"}
                      aria-pressed={on}
                      disabled={!on && d.interests.length >= MAX_INTERESTS}
                      onClick={() => toggleInterest(s.id)}
                    >
                      {on && <IconCheck size={11} />}
                      {s.label}
                    </button>
                  );
                })}
              </div>
              {/* The only symmetric signal: it finds people worth meeting
                  even when neither of you needs what the other offers. */}
              <p className="mt-2 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
                Finds people worth an hour even when neither of you needs what the other offers.
              </p>
              <OwnWords
                values={d.customInterests}
                placeholder="Carnatic music"
                hint="Anything you'd happily lose an hour to. Matches people who wrote the same."
                onChange={(v) => set("customInterests", v)}
              />
            </div>

            <div>
              <p className="label">Where you are right now</p>
              <div className="flex flex-wrap gap-1.5">
                {STAGES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="chip-toggle tap"
                    data-on={d.stage === s.id ? "true" : "false"}
                    aria-pressed={d.stage === s.id}
                    onClick={() => set("stage", d.stage === s.id ? "" : s.id)}
                  >
                    {d.stage === s.id && <IconCheck size={11} />}
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="p-working">
                What you&rsquo;re working on
              </label>
              <input
                id="p-working"
                className="input"
                placeholder="Taking our payments stack into the UAE"
                value={d.workingOn}
                onChange={(e) => set("workingOn", e.target.value)}
              />
              <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
                Shown on your card. The specific thing is what makes someone walk over.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- where you are */}
        <section>
          <SectionTitle
            icon={<IconPin size={13} />}
            title="Where you appear"
            hint="Your location is shown to the boards you've joined. The public network is a separate choice, below."
          />
          <div className="mt-3 flex flex-col gap-3">
            <VisibilityPicker
              value={d.visibility}
              onChange={(v) => set("visibility", v)}
              hasExact={d.lat != null && d.lng != null}
              hasBase={d.baseLat != null && d.baseLng != null}
            />
            <div>
              <label className="label" htmlFor="p-city">
                Your city
              </label>
              {/* Biased towards wherever they already are, if anywhere —
                  a returning member correcting their city should not have
                  to disambiguate it from the same name on another
                  continent. */}
              <PlaceSearch
                id="p-city"
                near={near}
                value={d.baseLabel}
                placeholder="Hyderabad"
                onPick={(p: Place) => setD((prev) => (prev ? { ...prev, baseLabel: p.label, baseLat: p.lat, baseLng: p.lng } : prev))}
              />
            </div>
            <div>
              <label className="label" htmlFor="p-exact">
                Exact location
              </label>
              <PlaceSearch
                id="p-exact"
                near={near}
                value={d.locationLabel}
                placeholder="A venue, an office, a neighbourhood"
                onPick={(p: Place) => setD((prev) => (prev ? { ...prev, locationLabel: p.label, lat: p.lat, lng: p.lng } : prev))}
              />
            </div>

            {/* A second consent, asked as one.

                Joining a board is agreeing to be seen by that room. Being
                on the open network is agreeing to be seen by strangers, and
                it used to be the same switch as the location precision
                above — so anybody who wanted a pin on their own board was
                published to the public map without being asked. */}
            <label
              className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 tap"
              style={{
                borderColor: d.publicOptIn ? "var(--brand)" : "var(--line)",
                background: d.publicOptIn ? "var(--sunk)" : "var(--card)",
              }}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 flex-none accent-[var(--brand)]"
                checked={d.publicOptIn}
                onChange={(e) => set("publicOptIn", e.target.checked)}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                  <IconGlobe size={15} />
                  Also show me on the public network
                </span>
                <span className="mt-0.5 block text-[12px] leading-[1.45] text-[var(--ink-soft)]">
                  Anybody can see your profile and, if you&rsquo;ve set one, your location — not only the
                  boards you&rsquo;ve joined. Untick it and you&rsquo;re visible only inside the boards you
                  joined; you can change it back whenever you like.
                </span>
              </span>
            </label>
          </div>
        </section>

        {/* ------------------------------------------------- the agreement

            Asked once, here, because this form is also the onboarding step —
            the account exists from the moment a sign-in code is verified,
            but nothing is published until a profile is saved, and this is
            that moment. Unticked, the save is refused by the server as well
            as by the button: a gate only the browser enforces is a prompt,
            not a consent.

            It reappears, already unticked, when the wording changes. */}
        {termsAccepted === false && (
          <label
            className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3"
            style={{ borderColor: agreed ? "var(--brand)" : "var(--line)", background: "var(--sunk)" }}
          >
            <input
              ref={consentRef}
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setError("");
              }}
              className="mt-0.5 h-4 w-4 flex-none accent-[var(--brand)]"
            />
            <span className="text-[12.5px] leading-[1.5]">
              I am {LEGAL.minimumAge} or older, and I agree to the{" "}
              <Link href="/terms" target="_blank" className="underline font-medium">
                Terms &amp; Conditions
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" target="_blank" className="underline font-medium">
                Privacy Policy
              </Link>
              .
              <span className="mt-1 block text-[11.5px] text-[var(--ink-soft)]">
                Worth two minutes of your time: the privacy policy is where it says exactly what other members
                can see, and how to take any of it back.
              </span>
            </span>
          </label>
        )}

        {error && <p className="text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}

        <div className="sticky bottom-0 flex items-center gap-3 border-t border-[var(--line)] bg-[var(--card)] py-2.5">
          {/* Disabled only while a save is actually in flight. Anything
              else the form wants is answered when it is pressed. */}
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
            {busy ? "Saving…" : "Save profile"}
          </button>
          {saved &&
            (d.visibility === "off" ? (
              /* Saved, and still invisible. Worth saying out loud: the
                 default is off, so a member who never opened this section
                 has done everything the form asked and is on no map at all
                 — which is exactly how it looks from the outside when
                 somebody "joined but isn't showing up". */
              <span className="text-[12.5px] font-medium" style={{ color: "var(--warn)" }}>
                Saved — but you&rsquo;re off the public map. Pick a city above to appear on it.
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: "var(--good)" }}>
                <IconCheck size={13} /> Saved
              </span>
            ))}
        </div>
      </form>

      {/* ------------------------------------------------- your networks */}
        {/* ------------------------------------------- what you're told */}
        <section>
          <SectionTitle
            icon={<IconBeacon size={13} />}
            title="Tell me when someone's near"
            hint="Proximity is the one thing a directory can't do — but only if you hear about it while you're still there."
          />
          <div className="mt-3 flex flex-col gap-2.5">
            {ALERT_KINDS.map((k) => {
              const on = Boolean(d[k.pref as "notifyConnections"]);
              return (
                <button
                  key={k.id}
                  type="button"
                  className="lift rounded-xl border p-3 text-left tap"
                  style={{
                    borderColor: on ? "var(--brand)" : "var(--line)",
                    background: on ? "color-mix(in srgb, var(--brand) 7%, transparent)" : "transparent",
                  }}
                  aria-pressed={on}
                  onClick={() => set(k.pref as "notifyConnections", !on)}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="grid h-4 w-4 flex-none place-items-center rounded-full"
                      style={{
                        background: on ? "var(--brand)" : "transparent",
                        border: on ? "none" : "1.5px solid var(--line)",
                        color: "#fff",
                      }}
                    >
                      {on && <IconCheck size={10} strokeWidth={3} />}
                    </span>
                    <span className="text-[12.5px] font-semibold">{k.label}</span>
                  </span>
                  <span className="mt-1 block pl-6 text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
                    {k.detail}
                  </span>
                </button>
              );
            })}

            <div>
              <p className="label">How near is near</p>
              <div className="flex flex-wrap gap-1.5">
                {ALERT_RADII.map((km) => (
                  <button
                    key={km}
                    type="button"
                    className="chip-toggle tap"
                    data-on={d.notifyRadiusKm === km ? "true" : "false"}
                    aria-pressed={d.notifyRadiusKm === km}
                    onClick={() => set("notifyRadiusKm", km)}
                  >
                    {d.notifyRadiusKm === km && <IconCheck size={11} />}
                    {km} km
                  </button>
                ))}
              </div>
              {/* The honest limit, said where the choice is made. */}
              <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
                Somebody showing only their city can still tell you they&rsquo;re in town, but never how close —
                that precision was never theirs to give.
              </p>
            </div>
          </div>
        </section>

      <section className="mt-5 border-t border-[var(--line)] pt-4">
        <SectionTitle
          icon={<IconPeople size={13} />}
          title="Your communities"
          hint="A community is a group with its own map. Share the link or QR and people land straight on it. Events live inside one."
        />

        {myBoards.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {myBoards.map((b) => (
              <li key={b.slug}>
                <div className="card p-3">
                  <div className="flex items-center gap-2.5">
                    <BoardLogo name={b.name} logoUrl={b.logoUrl} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{b.name}</span>
                      <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">
                        {b.type === "event" ? "Event" : "Community"} · {b.memberCount}{" "}
                        {b.memberCount === 1 ? "member" : "members"}
                      </span>
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onOpenNetwork(b.slug!)}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShareSlug(shareSlug === b.slug ? null : b.slug)}
                    >
                      {shareSlug === b.slug ? "Hide code" : "Share"}
                    </button>
                  </div>
                  {shareSlug === b.slug && (
                    <div className="mt-2.5">
                      <BoardQR slug={b.slug!} name={b.name} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3">
          {creating ? (
            <CreateBoard
              onCreated={(slug) => {
                setCreating(false);
                setShareSlug(slug);
                // Refreshes the switcher so the new network is immediately
                // somewhere you can go, not just something you made.
                onSaved();
              }}
            />
          ) : (
            <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => setCreating(true)}>
              <IconPlus size={13} /> Create a community
            </button>
          )}
        </div>
      </section>

      <SignOut email={email} live={d.visibility === "live"} />
    </div>
  );
}
