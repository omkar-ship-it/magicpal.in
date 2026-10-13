"use client";

import { useRef, useState } from "react";
import { AVATAR_STYLES } from "@/lib/avatar";
import Avatar from "./Avatar";
import { IconCheck, IconPlus, IconX } from "./Icons";

/** Longest edge of a stored photo. Enough for a 72px avatar at 3x, small enough for localStorage. */
const MAX_EDGE = 256;

/**
 * Downscale and re-encode in the browser before storing.
 *
 * A phone photo is several megabytes and localStorage gives you about five,
 * so storing the original would fill the quota on the first upload and throw
 * on the second. This also strips EXIF — including the GPS tag a camera
 * writes — which matters rather a lot in a product whose entire pitch is
 * that you control what it knows about where you are.
 */
function toThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("That doesn't look like an image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Couldn't process that image."));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function AvatarPicker({
  name,
  photoUrl,
  style,
  onChange,
}: {
  name: string;
  photoUrl: string | null;
  style: string;
  onChange: (next: { photoUrl: string | null; style: string }) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** Lets someone cycle characters within a style without renaming themselves. */
  const [variant, setVariant] = useState(0);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange({ photoUrl: await toThumbnail(file), style });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't use that image.");
    } finally {
      setBusy(false);
    }
  }

  const seed = variant === 0 ? name : `${name}-${variant}`;

  return (
    <div>
      <div className="flex items-center gap-3">
        <Avatar name={seed} photoUrl={photoUrl} style={style} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn-ghost btn-sm flex items-center gap-1.5">
              <IconPlus size={14} /> {busy ? "Working…" : photoUrl ? "Replace photo" : "Upload a photo"}
            </button>
            {photoUrl && (
              <button onClick={() => onChange({ photoUrl: null, style })} className="btn btn-ghost btn-sm flex items-center gap-1.5">
                <IconX size={14} /> Remove
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-[var(--ink-soft)]">
            Shrunk and stripped in your browser before upload — the location tag your camera writes never leaves your phone.
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {error && (
        <p className="mt-2 text-[11.5px] font-medium" style={{ color: "var(--warn)" }}>
          {error}
        </p>
      )}

      {/* Collapsed by default. Eight character tiles are a pleasant thing to
          browse once and a wall between the reader and the fields that
          actually drive matching every time after that. */}
      <details className="mt-3">
        <summary className="label cursor-pointer select-none">Or pick a character</summary>

        <div className="mt-2 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setVariant((v) => (v + 1) % 8)}
            className="text-[11.5px] font-semibold"
            style={{ color: "var(--brand)" }}
          >
            Shuffle
          </button>
        </div>

        <div className="mt-2 grid grid-cols-4 gap-2">
        {AVATAR_STYLES.map((st) => {
          const on = !photoUrl && style === st.id;
          return (
            <button
              key={st.id}
              onClick={() => onChange({ photoUrl: null, style: st.id })}
              className="group relative flex flex-col items-center gap-1 rounded-2xl border p-2 transition-transform active:scale-95"
              style={on ? { borderColor: "var(--brand)", background: "color-mix(in srgb, var(--brand) 7%, var(--card))" } : { borderColor: "var(--line)" }}
              aria-pressed={on}
            >
              <Avatar name={seed} style={st.id} size={40} className="transition-transform group-hover:scale-105" />
              <span className="w-full truncate text-center text-[10.5px] font-semibold" style={{ color: on ? "var(--brand)" : "var(--ink-soft)" }}>
                {st.label}
              </span>
              {on && (
                <span
                  className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full text-white"
                  style={{ background: "var(--brand)" }}
                >
                  <IconCheck size={10} />
                </span>
              )}
            </button>
          );
        })}
        </div>
      </details>
    </div>
  );
}
