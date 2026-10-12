"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { IconCheck, IconCopy } from "./Icons";

/**
 * What a host puts on a slide, a poster, or into a WhatsApp group.
 *
 * The QR points at `/join/<slug>`, not at the board itself, so a scan does
 * the whole arrival in one hop — sign in if needed, join, land on the
 * people. Pointing it at the board would make every scanner find and press
 * a join button, which is a step too many for somebody holding a drink.
 *
 * Rendered as SVG rather than canvas so it stays sharp when the host does
 * the thing every host does: screenshots it and scales it onto a slide.
 */
export default function BoardQR({ slug, name }: { slug: string; name: string }) {
  const [copied, setCopied] = useState(false);

  // Read at render rather than from an env var: a board gets shared from
  // wherever it's being demoed — localhost, a preview deploy, production —
  // and a hardcoded origin would print a QR code pointing at the wrong one.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const joinUrl = `${origin}/join/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied — the link is on screen and selectable anyway.
    }
  }

  return (
    <div className="card p-5">
      <h2 className="text-[15px] font-semibold">Share it</h2>
      <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
        Anyone who scans this joins {name} and sees the room. Nobody who hasn&rsquo;t can see who&rsquo;s on it.
      </p>

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex-none rounded-2xl bg-white p-3" style={{ boxShadow: "var(--shadow)" }}>
          {/* Fixed white ground and black modules: a QR rendered in theme
              colours fails to scan in dark mode, which is exactly when
              somebody is pointing a phone at a projector. */}
          <QRCodeSVG value={joinUrl} size={148} level="M" bgColor="#ffffff" fgColor="#000000" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="label">The link</p>
          <p className="mono break-all rounded-xl p-2.5 text-[12px]" style={{ background: "var(--sunk)" }}>
            {joinUrl}
          </p>
          <button type="button" onClick={copy} className="btn btn-ghost btn-sm mt-2.5">
            {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
