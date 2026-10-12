"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AvatarPicker from "./AvatarPicker";
import PlaceSearch, { type Place } from "./PlaceSearch";
import TopicPicker from "./TopicPicker";
import VisibilityPicker, { type Visibility } from "./VisibilityPicker";
import { IconCheck, IconSparkle } from "./Icons";

export type ProfileDraft = {
  name: string;
  headline: string;
  company: string;
  workingOn: string;
  bio: string;
  linkedinUrl: string;
  photoUrl: string | null;
  avatarStyle: string;
  lookingFor: string[];
  canHelpWith: string[];
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
 * The only form in the product, and the thing every recommendation is
 * built from.
 *
 * Ordered by what it's for rather than by what's easy to ask: who you are,
 * then the two intent questions, then location. Intents sit above location
 * on purpose — a profile with a pin and no stated intent is visible and
 * unmatchable, which is the worst state to be in here, and asking the
 * interesting question second gets it answered.
 */
export default function ProfileEditor({
  initial,
  nextUrl,
  joinedBoardName,
}: {
  initial: ProfileDraft;
  /** Where to go after saving — a board, when they arrived via a QR code. */
  nextUrl: string | null;
  /** Set when they just joined a board, so the detour explains itself. */
  joinedBoardName: string | null;
}) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [photoError, setPhotoError] = useState("");

  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  /**
   * AvatarPicker hands back a downscaled data URL, which is right for the
   * two things it does well — resizing to 256px and dropping the camera's
   * EXIF GPS tag, which matters a great deal in this product — and wrong
   * as storage. A data URL in the users table would ride along in every
   * map response, so two hundred pins would mean several megabytes of
   * base64. Upload it, keep the URL.
   */
  async function onAvatarChange(next: { photoUrl: string | null; style: string }) {
    set("avatarStyle", next.style);
    setPhotoError("");

    if (!next.photoUrl) {
      set("photoUrl", null);
      await fetch("/api/profile/photo", { method: "DELETE" }).catch(() => {});
      return;
    }
    if (!next.photoUrl.startsWith("data:")) {
      set("photoUrl", next.photoUrl);
      return;
    }

    // Shown immediately so choosing a photo feels instant; replaced by the
    // hosted URL once the upload lands.
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
      // Fall back to the generated character rather than leaving a data URL
      // that would be saved into the row on the next submit.
      set("photoUrl", null);
      setPhotoError(
        err instanceof Error ? `${err.message} Your character avatar is still fine.` : "Couldn't upload that photo."
      );
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save that.");
      setSaved(true);
      if (nextUrl) router.push(nextUrl);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6 pb-16">
      {joinedBoardName && (
        <div className="card flex items-start gap-2.5 p-3.5" style={{ background: "var(--sunk)" }}>
          <IconCheck size={15} className="mt-0.5 flex-none" style={{ color: "var(--good)" }} />
          <p className="text-[13px] leading-[1.5]">
            You&rsquo;re on <span className="font-semibold">{joinedBoardName}</span>. Answer the two questions below and
            we can tell you who&rsquo;s worth meeting there.
          </p>
        </div>
      )}

      <section className="card p-5">
        <h2 className="text-[15px] font-semibold">Who you are</h2>
        <div className="mt-4 flex flex-col gap-4">
          <AvatarPicker
            name={d.name || "You"}
            photoUrl={d.photoUrl}
            style={d.avatarStyle}
            onChange={onAvatarChange}
          />
          {photoError && (
            <p className="text-[12.5px] font-medium" style={{ color: "var(--warn)" }}>
              {photoError}
            </p>
          )}

          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input id="name" className="input" required value={d.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="headline">
              One line about you
            </label>
            <input
              id="headline"
              className="input"
              required
              placeholder="Product lead, fintech"
              value={d.headline}
              onChange={(e) => set("headline", e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="company">
              Company
            </label>
            <input id="company" className="input" value={d.company} onChange={(e) => set("company", e.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="workingOn">
              What you&rsquo;re working on right now
            </label>
            <input
              id="workingOn"
              className="input"
              placeholder="Taking our India payments stack into the UAE"
              value={d.workingOn}
              onChange={(e) => set("workingOn", e.target.value)}
            />
            {/* The one free-text field the matcher reads. It never affects
                the ranking — it's what makes the introduction sound like a
                person rather than a category. */}
            <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
              Shown on your card. The specific thing is what makes someone walk over.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="linkedinUrl">
              LinkedIn
            </label>
            <input
              id="linkedinUrl"
              className="input"
              placeholder="linkedin.com/in/you"
              value={d.linkedinUrl}
              onChange={(e) => set("linkedinUrl", e.target.value)}
            />
            <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
              How people reach you. There&rsquo;s no inbox here on purpose — this is the handoff.
            </p>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
          <IconSparkle size={14} style={{ color: "var(--brand)" }} />
          What you&rsquo;re here for
        </h2>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
          Every recommendation you get, and every one you appear in, comes from these two answers.
        </p>
        <div className="mt-4 flex flex-col gap-5">
          <TopicPicker side="need" selected={d.lookingFor} onChange={(v) => set("lookingFor", v)} />
          <TopicPicker side="offer" selected={d.canHelpWith} onChange={(v) => set("canHelpWith", v)} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-[15px] font-semibold">Where you are</h2>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
          This only affects the public map. Boards you join always show you — that&rsquo;s what joining one means.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <VisibilityPicker
            value={d.visibility}
            onChange={(v) => set("visibility", v)}
            hasExact={d.lat != null && d.lng != null}
            hasBase={d.baseLat != null && d.baseLng != null}
          />

          <div>
            <label className="label" htmlFor="city">
              Your city
            </label>
            <PlaceSearch
              id="city"
              value={d.baseLabel}
              placeholder="Hyderabad"
              onPick={(p: Place) => setD((prev) => ({ ...prev, baseLabel: p.label, baseLat: p.lat, baseLng: p.lng }))}
            />
          </div>

          <div>
            <label className="label" htmlFor="exact">
              Exact location
            </label>
            <PlaceSearch
              id="exact"
              value={d.locationLabel}
              placeholder="A venue, an office, a neighbourhood"
              onPick={(p: Place) =>
                setD((prev) => ({ ...prev, locationLabel: p.label, lat: p.lat, lng: p.lng }))
              }
            />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-[15px] font-semibold">Mentoring</h2>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
          Not switched on yet — it needs a community with some history behind it. Saying so now means you&rsquo;re in the
          first round when it is.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="chip-toggle tap"
            data-on={d.openToMentor ? "true" : "false"}
            aria-pressed={d.openToMentor}
            onClick={() => set("openToMentor", !d.openToMentor)}
          >
            {d.openToMentor && <IconCheck size={12} />} I&rsquo;d mentor someone
          </button>
          <button
            type="button"
            className="chip-toggle tap"
            data-on={d.seekingMentor ? "true" : "false"}
            aria-pressed={d.seekingMentor}
            onClick={() => set("seekingMentor", !d.seekingMentor)}
          >
            {d.seekingMentor && <IconCheck size={12} />} I&rsquo;d like a mentor
          </button>
        </div>
      </section>

      {error && <p className="text-[13px] font-medium text-[var(--warn)]">{error}</p>}

      <div className="sticky bottom-0 -mx-1 flex items-center gap-3 border-t border-[var(--line)] bg-[var(--bg)]/95 px-1 py-3 backdrop-blur">
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Saving…" : nextUrl ? "Save and see the board" : "Save profile"}
        </button>
        {saved && !nextUrl && (
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: "var(--good)" }}>
            <IconCheck size={13} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}
