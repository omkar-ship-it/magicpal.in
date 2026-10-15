"use client";

import { useRef, useState } from "react";
import type { ChatAttachment } from "@/lib/db/schema";
import {
  FILE_ACCEPT,
  IMAGE_ACCEPT,
  MAX_ATTACHMENTS,
  sizeLabel,
} from "@/lib/attachments";
import { IconDoc, IconImage, IconSend, IconX } from "./Icons";

/**
 * Writing a message: words, faces, pictures, files.
 *
 * Attachments upload the moment they're chosen rather than on send, so the
 * wait happens while you're still typing instead of after you've hit the
 * button — and a failed upload is something you can see and retry before
 * the message exists. The cost is a stray blob when somebody abandons a
 * draft, which is the same trade the post composer already makes.
 *
 * The emoji set is hand-picked and inline. A picker library would be a
 * megabyte and a CDN dependency to insert a character that every keyboard
 * on earth can already produce; this is the short list people actually
 * reach for in a message to someone they just met.
 */

const EMOJI = [
  "👋", "🙂", "😄", "😁", "😉", "🙌", "👏", "🤝",
  "👍", "🔥", "✨", "🎉", "💡", "🚀", "💯", "☕",
  "❤️", "😅", "😂", "🤔", "🙏", "👀", "✅", "📍",
];

export default function ChatComposer({
  onSend,
  busy,
}: {
  onSend: (body: string, attachments: ChatAttachment[]) => Promise<boolean>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [error, setError] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function take(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const room = MAX_ATTACHMENTS - pending.length;
    if (room <= 0) {
      setError(`Up to ${MAX_ATTACHMENTS} attachments per message.`);
      return;
    }
    const chosen = [...files].slice(0, room);
    setUploading((n) => n + chosen.length);
    for (const file of chosen) {
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("scope", "chat");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't upload that.");
        setPending((p) => [
          ...p,
          { kind: data.kind, url: data.url, name: data.name, mime: data.mime, size: data.size },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't upload that.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() && pending.length === 0) return;
    const ok = await onSend(draft, pending);
    if (ok) {
      setDraft("");
      setPending([]);
      setShowEmoji(false);
    }
  }

  const sendable = (draft.trim().length > 0 || pending.length > 0) && uploading === 0 && !busy;

  return (
    <div className="mt-2 flex-none">
      {/* What's going with this message, removable until it's sent. */}
      {(pending.length > 0 || uploading > 0) && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {pending.map((a) => (
            <span
              key={a.url}
              className="flex items-center gap-1.5 rounded-xl py-1 pl-1 pr-2 text-[11.5px]"
              style={{ background: "var(--sunk)" }}
            >
              {a.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" className="h-7 w-7 rounded-lg object-cover" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-lg text-[10px] font-bold" style={{ background: "var(--card)" }}>
                  {(a.name.split(".").pop() ?? "file").slice(0, 4).toUpperCase()}
                </span>
              )}
              <span className="max-w-[120px] truncate font-medium">{a.name}</span>
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                className="text-[var(--ink-soft)] hover:text-[var(--warn)]"
                onClick={() => setPending((p) => p.filter((x) => x.url !== a.url))}
              >
                <IconX size={11} />
              </button>
            </span>
          ))}
          {uploading > 0 && (
            <span className="flex items-center rounded-xl px-2.5 py-1.5 text-[11.5px] text-[var(--ink-soft)]" style={{ background: "var(--sunk)" }}>
              Uploading {uploading}…
            </span>
          )}
        </div>
      )}

      {showEmoji && (
        <div className="mb-2 grid grid-cols-8 gap-0.5 rounded-xl p-2" style={{ background: "var(--sunk)" }}>
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              className="rounded-lg py-1 text-[17px] leading-none tap hover:bg-[var(--card)]"
              onClick={() => setDraft((d) => d + e)}
              aria-label={`Add ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Icon-only: three labelled buttons left the message field about two
          words wide in a 320px panel, which is the field people came for. */}
      <form onSubmit={submit} className="flex items-center gap-1">
        <button
          type="button"
          className="composer-btn tap"
          data-on={showEmoji ? "true" : "false"}
          aria-pressed={showEmoji}
          aria-label="Emoji"
          title="Emoji"
          onClick={() => setShowEmoji((v) => !v)}
        >
          <span className="text-[15px] leading-none">🙂</span>
        </button>
        <button
          type="button"
          className="composer-btn tap"
          aria-label="Add a photo or GIF"
          title="Photo or GIF"
          onClick={() => imageInput.current?.click()}
        >
          <IconImage size={15} />
        </button>
        <button
          type="button"
          className="composer-btn tap"
          aria-label="Attach a document"
          title="Document"
          onClick={() => fileInput.current?.click()}
        >
          <IconDoc size={15} />
        </button>

        <input
          ref={imageInput}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            void take(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInput}
          type="file"
          accept={FILE_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            void take(e.target.files);
            e.target.value = "";
          }}
        />

        <input
          className="input flex-1"
          placeholder="Write a message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
        />
        <button type="submit" className="btn btn-primary btn-sm flex-none" disabled={!sendable} aria-label="Send">
          <IconSend size={14} />
        </button>
      </form>

      {error && <p className="mt-1 text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}
    </div>
  );
}

/** Attachments as they appear inside a sent bubble. */
export function MessageAttachments({ items, mine }: { items: ChatAttachment[]; mine: boolean }) {
  if (items.length === 0) return null;
  const images = items.filter((a) => a.kind === "image");
  const files = items.filter((a) => a.kind === "file");

  return (
    <div className="mt-1 flex flex-col gap-1">
      {images.length > 0 && (
        <div className={`grid gap-1 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {images.map((a) => (
            <a
              key={a.url}
              href={a.url}
              target="_blank"
              rel="noreferrer noopener"
              // Hugs the picture rather than the column, so the click target
              // is the image and not the empty space beside a portrait shot.
              className="mx-auto block w-fit overflow-hidden rounded-xl"
            >
              {/* Contained, not cropped — same reasoning as the feed: a
                  screenshot is the usual thing people send, and half of one
                  is worse than a small whole one. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.name}
                loading="lazy"
                className="mx-auto block max-h-[50vh] max-w-full rounded-xl"
              />
            </a>
          ))}
        </div>
      )}
      {files.map((a) => (
        <a
          key={a.url}
          href={a.url}
          target="_blank"
          rel="noreferrer noopener"
          download={a.name}
          className="flex items-center gap-2 rounded-xl p-2 text-[11.5px]"
          style={{
            background: mine ? "rgba(255,255,255,0.18)" : "var(--card)",
            color: mine ? "#fff" : "var(--ink)",
          }}
        >
          <span
            className="grid h-8 w-8 flex-none place-items-center rounded-lg text-[9.5px] font-bold"
            style={{ background: mine ? "rgba(255,255,255,0.22)" : "var(--sunk)" }}
          >
            {(a.name.split(".").pop() ?? "file").slice(0, 4).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{a.name}</span>
            <span className="block opacity-70">{sizeLabel(a.size)}</span>
          </span>
        </a>
      ))}
    </div>
  );
}
