"use client";

import { useRef, useState } from "react";
import type { EventRef } from "@/lib/shell";
import { IconCalendar, IconPlus, IconSend, IconX } from "./Icons";

const MAX_IMAGES = 4;

/**
 * Saying something to your community.
 *
 * Images upload as they're picked rather than on submit, so the slow part
 * happens while the person is still typing and the post itself is instant.
 * An abandoned draft leaves a stray blob, which is a far better trade than
 * a submit button that hangs for ten seconds on a phone.
 */
export default function PostComposer({
  boardSlug,
  boardName,
  events,
  onPosted,
}: {
  boardSlug: string;
  boardName: string;
  /** Attachable events — this community's own. */
  events: EventRef[];
  onPosted: () => void;
}) {
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [eventSlug, setEventSlug] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function addImage(file: File | undefined) {
    if (!file || images.length >= MAX_IMAGES) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't upload that.");
      setImages((prev) => [...prev, data.url].slice(0, MAX_IMAGES));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && images.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardSlug, body, url, eventSlug: eventSlug || undefined, images }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't post that.");
      setBody("");
      setUrl("");
      setEventSlug("");
      setImages([]);
      setOpen(false);
      onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-left text-[12.5px] text-[var(--ink-soft)] tap hover:bg-[var(--sunk)]"
      >
        Post something to {boardName}…
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-2.5 p-3">
      <textarea
        className="input"
        rows={3}
        autoFocus
        placeholder={`What's happening in ${boardName}?`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
      />

      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((src) => (
            <span key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((u) => u !== src))}
                className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full text-white"
                style={{ background: "var(--ink)" }}
                aria-label="Remove image"
              >
                <IconX size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        className="input"
        placeholder="A link (optional)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

      {events.length > 0 && (
        <label className="flex items-center gap-2 text-[12.5px]">
          <IconCalendar size={13} className="flex-none text-[var(--ink-soft)]" />
          <select
            className="input flex-1"
            value={eventSlug}
            onChange={(e) => setEventSlug(e.target.value)}
            aria-label="Attach an event"
          >
            <option value="">No event attached</option>
            {events.map((ev) => (
              <option key={ev.slug} value={ev.slug}>
                {ev.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="text-[12px] font-medium text-[var(--warn)]">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={uploading || images.length >= MAX_IMAGES}
          onClick={() => fileRef.current?.click()}
        >
          <IconPlus size={13} /> {uploading ? "Uploading…" : "Photo"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void addImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <span className="flex-1" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={busy || uploading || (!body.trim() && images.length === 0)}
        >
          <IconSend size={13} /> {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
