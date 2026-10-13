"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SECTORS, STAGES } from "@/lib/intents";
import { MAX_INTERESTS } from "@/lib/rules";
import type { NetworkOption } from "@/lib/shell";
import AvatarPicker from "./AvatarPicker";
import PlaceSearch, { type Place } from "./PlaceSearch";
import TopicPicker from "./TopicPicker";
import VisibilityPicker, { type Visibility } from "./VisibilityPicker";
import CreateBoard from "./CreateBoard";
import BoardQR from "./BoardQR";
import PanelNote from "./PanelNote";
import Avatar from "./Avatar";
import { IconCheck, IconPeople, IconPin, IconPlus, IconSparkle, IconUser } from "./Icons";

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
  lookingFor: string[];
  canHelpWith: string[];
  interests: string[];
  stage: string;
  locationLabel: string | null;
  lat: number | null;
  lng: number | null;
  baseLabel: string | null;
  baseLat: number | null;
  baseLng: number | null;
  visibility: Visibility;
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

  useEffect(() => {
    let alive = true;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((json) => {
        if (!alive || !json.profile) return;
        const p = json.profile;
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
          lookingFor: p.lookingFor,
          canHelpWith: p.canHelpWith,
          interests: p.interests,
          stage: p.stage,
          locationLabel: p.locationLabel,
          lat: p.lat,
          lng: p.lng,
          baseLabel: p.baseLabel,
          baseLat: p.baseLat,
          baseLng: p.baseLng,
          visibility: p.visibility,
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
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't save that.");
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

  const visibilityLine =
    d.visibility === "off"
      ? "Not on the public map"
      : d.visibility === "base"
        ? `Showing ${d.baseLabel ?? "your city"}`
        : d.visibility === "live"
          ? "Sharing live location"
          : `Pinned at ${d.locationLabel ?? "your location"}`;

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
            <TopicPicker side="need" selected={d.lookingFor} onChange={(v) => set("lookingFor", v)} />
            <TopicPicker side="offer" selected={d.canHelpWith} onChange={(v) => set("canHelpWith", v)} />

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
            hint="The public map only. Networks you join always show you — that's what joining one means."
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
              <PlaceSearch
                id="p-city"
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
                value={d.locationLabel}
                placeholder="A venue, an office, a neighbourhood"
                onPick={(p: Place) => setD((prev) => (prev ? { ...prev, locationLabel: p.label, lat: p.lat, lng: p.lng } : prev))}
              />
            </div>
          </div>
        </section>

        {error && <p className="text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}

        <div className="sticky bottom-0 flex items-center gap-3 border-t border-[var(--line)] bg-[var(--card)] py-2.5">
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
            {busy ? "Saving…" : "Save profile"}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: "var(--good)" }}>
              <IconCheck size={13} /> Saved
            </span>
          )}
        </div>
      </form>

      {/* ------------------------------------------------- your networks */}
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
                    <span
                      className="grid h-8 w-8 flex-none place-items-center rounded-xl"
                      style={{ background: "var(--sunk)", color: "var(--layer-event)" }}
                    >
                      <IconPeople size={15} />
                    </span>
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
    </div>
  );
}
