"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { IconCheck, IconCopy, IconDownload } from "./Icons";

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
 * Better still, they can download it — see below, where both exports are
 * derived from this same element so what prints is what was on screen.
 */

/**
 * Pixels on the longest side of the exported PNG.
 *
 * 1024 is large enough to fill a slide or print on A4 without the modules
 * going soft, and small enough that the file is still something a host can
 * paste into a WhatsApp group without it being recompressed into mush.
 */
const PNG_SIZE = 1024;
export default function BoardQR({ slug, name }: { slug: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<"png" | "svg" | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // Read at render rather than from an env var: a board gets shared from
  // wherever it's being demoed — localhost, a preview deploy, production —
  // and a hardcoded origin would print a QR code pointing at the wrong one.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const joinUrl = `${origin}/join/${slug}`;

  /**
   * The QR on screen, as a standalone file.
   *
   * Read back out of the DOM rather than re-generated, so there is exactly
   * one QR code in this component and no way for the downloaded one to
   * encode a different URL than the one the host just read off the screen.
   * The clone gets an explicit namespace: a serialised fragment without it
   * opens as markup rather than as an image in some viewers.
   */
  function svgMarkup(): string | null {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(clone);
  }

  function save(blob: Blob, ext: "png" | "svg") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-join-qr.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoked on a later tick, never synchronously: Safari hands back an
    // empty file if the object URL dies before the download has started.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setSaved(ext);
    setTimeout(() => setSaved(null), 2000);
  }

  function downloadSvg() {
    const markup = svgMarkup();
    if (markup) save(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }), "svg");
  }

  /**
   * The same code, rasterised.
   *
   * Most places a host actually puts this — a WhatsApp group, a Google
   * Slide, a printer's web form — either refuse an SVG or render it badly,
   * so PNG is the one offered first even though SVG is the better file.
   */
  function downloadPng() {
    const markup = svgMarkup();
    if (!markup) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = PNG_SIZE;
      canvas.height = PNG_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Painted white first: a transparent PNG dropped on a dark slide is a
      // QR code no phone will ever read.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, PNG_SIZE, PNG_SIZE);
      // Smoothing would blur the module edges, which is the one thing a
      // scanner cares about.
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, PNG_SIZE, PNG_SIZE);
      canvas.toBlob((blob) => blob && save(blob, "png"), "image/png");
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  }

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
        <div ref={qrRef} className="flex-none rounded-2xl bg-white p-3" style={{ boxShadow: "var(--shadow)" }}>
          {/* Fixed white ground and black modules: a QR rendered in theme
              colours fails to scan in dark mode, which is exactly when
              somebody is pointing a phone at a projector.

              The margin is part of the code rather than part of the padding
              around it. On screen the white box supplies one either way; in
              a downloaded file there is no box, and a QR printed hard
              against the edge of a slide loses its quiet zone and stops
              scanning. */}
          <QRCodeSVG
            value={joinUrl}
            size={148}
            level="M"
            marginSize={2}
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="label">The link</p>
          <p className="mono break-all rounded-xl p-2.5 text-[12px]" style={{ background: "var(--sunk)" }}>
            {joinUrl}
          </p>
        </div>
      </div>

      {/* Across the card rather than beside the link: this panel is often
          four hundred pixels wide while the viewport is not, so three
          buttons in the right-hand column stacked into three rows. */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={copy} className="btn btn-ghost btn-sm">
          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <button type="button" onClick={downloadPng} className="btn btn-ghost btn-sm">
          {saved === "png" ? <IconCheck size={13} /> : <IconDownload size={13} />}
          {saved === "png" ? "Saved" : "PNG"}
        </button>
        <button type="button" onClick={downloadSvg} className="btn btn-ghost btn-sm">
          {saved === "svg" ? <IconCheck size={13} /> : <IconDownload size={13} />}
          {saved === "svg" ? "Saved" : "SVG"}
        </button>
      </div>
      <p className="mt-2 text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
        PNG for a slide or a WhatsApp group. SVG for anything printed — it stays sharp however large you blow
        it up.
      </p>
    </div>
  );
}
