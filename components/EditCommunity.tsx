"use client";

import { useRef, useState } from "react";
import PlaceSearch, { type Place } from "./PlaceSearch";
import BoardLogo from "./BoardLogo";
import { IconChevronLeft, IconImage } from "./Icons";

/**
 * The owner editing their own community.
 *
 * The API for this has existed since communities did; what was missing was
 * anywhere to call it from, so a community's description was fixed at the
 * moment of creation — when the owner knew least about what it was for.
 *
 * Four fields, in the order somebody actually decides them: what it's
 * called, the one line that goes under the name, what it's for, and the
 * rules. Guidelines sit last and get the most room, because they're the
 * only field here that has to survive being quoted back to somebody.
 */
export default function EditCommunity({
  slug,
  initial,
  onCancel,
  onSaved,
}: {
  slug: string;
  initial: {
    name: string;
    blurb: string | null;
    details: string | null;
    guidelines: string | null;
    place: string | null;
    logoUrl: string | null;
  };
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [blurb, setBlurb] = useState(initial.blurb ?? "");
  const [details, setDetails] = useState(initial.details ?? "");
  const [guidelines, setGuidelines] = useState(initial.guidelines ?? "");
  const [place, setPlace] = useState<string | null>(initial.place);
  const [coords, setCoords] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The logo saves on its own, the moment a file is picked — it's a
  // multipart upload, and holding it until "Save changes" would mean a
  // half-saved form if the text fields failed validation.
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    setLogoBusy(true);
    setLogoError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/boards/${slug}/logo`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't upload that.");
      setLogoUrl(data.logoUrl);
      onSaved();
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLogoBusy(false);
      // Cleared so picking the same file twice still fires a change event.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeLogo() {
    setLogoBusy(true);
    setLogoError("");
    try {
      const res = await fetch(`/api/boards/${slug}/logo`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't remove it.");
      setLogoUrl(null);
      onSaved();
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLogoBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/boards/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          blurb,
          details,
          guidelines,
          place: coords?.label ?? place ?? "",
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save that.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <button type="button" className="btn btn-ghost btn-sm self-start" onClick={onCancel}>
        <IconChevronLeft size={13} /> Back
      </button>

      {/* First, because it's the thing that makes the page look like the
          group's own rather than a generic list. */}
      <div>
        <p className="label">Logo</p>
        <div className="flex items-center gap-3">
          <BoardLogo name={name || "?"} logoUrl={logoUrl} size={56} />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={logoBusy}
                onClick={() => fileInput.current?.click()}
              >
                <IconImage size={13} /> {logoBusy ? "Uploading…" : logoUrl ? "Replace" : "Upload"}
              </button>
              {logoUrl && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={logoBusy} onClick={removeLogo}>
                  Remove
                </button>
              )}
            </div>
            <p className="text-[11.5px] leading-[1.4] text-[var(--ink-soft)]">
              {logoError ? (
                <span style={{ color: "var(--warn)" }}>{logoError}</span>
              ) : (
                "A square image reads best. Under 2MB. Saves straight away."
              )}
            </p>
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickLogo(e.target.files?.[0])}
        />
      </div>

      <div>
        <label className="label" htmlFor="c-name">
          Name
        </label>
        <input id="c-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <label className="label" htmlFor="c-blurb">
          One line
        </label>
        <input
          id="c-blurb"
          className="input"
          maxLength={280}
          placeholder="Alumni of RGUKT, anywhere in the world"
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
        />
        <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
          Sits under the name, and is what somebody reads before deciding to join.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="c-details">
          What this community is for
        </label>
        <textarea
          id="c-details"
          className="input"
          rows={4}
          maxLength={2000}
          placeholder="Who it's for, what people come here to do, and what they can expect to get out of it."
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="c-rules">
          House rules
        </label>
        <textarea
          id="c-rules"
          className="input"
          rows={5}
          maxLength={2000}
          placeholder={"Be who you say you are.\nNo recruiting spam in the feed.\nWhat's shared here stays here."}
          value={guidelines}
          onChange={(e) => setGuidelines(e.target.value)}
        />
        <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
          Shown on this page to everyone. Write them plainly — these are what you point at if you ever have to
          remove somebody.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="c-place">
          Where it&rsquo;s based (optional)
        </label>
        <PlaceSearch
          id="c-place"
          value={coords?.label ?? place}
          placeholder="Hyderabad, or leave blank for everywhere"
          onPick={(p) => {
            setCoords(p);
            setPlace(p.label);
          }}
          onTyped={(t) => setPlace(t)}
        />
      </div>

      {error && <p className="text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}

      <button type="submit" className="btn btn-primary btn-sm" disabled={busy || name.trim().length < 3}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
