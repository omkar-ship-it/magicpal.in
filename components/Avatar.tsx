"use client";

import { useState } from "react";
import { avatarTint, characterUrl } from "@/lib/avatar";

/**
 * Every face in the members-only experience comes through here.
 *
 * Before this each surface built its own `<span class="avatar"><img …>`, so
 * sizes, rings and fallbacks drifted apart and the characters floated on
 * transparent backgrounds like unfinished line work. One component, one
 * seeded tint behind the art, one ring — a crowd of them on the map now
 * reads as a set rather than a pile of clippings.
 */
export default function Avatar({
  name,
  photoUrl,
  style = "adventurer",
  size = 36,
  ring,
  className = "",
  title,
}: {
  /** Also the seed: the same person is the same face everywhere. */
  name: string;
  /** An uploaded photo wins over the generated character. */
  photoUrl?: string | null;
  style?: string;
  size?: number;
  /** Width of the surrounding ring in px — markers on the map want one, lists don't. */
  ring?: number;
  className?: string;
  title?: string;
}) {
  /**
   * A photo that stops loading falls back to the character, never to an
   * empty disc. LinkedIn picture links are signed and expire after a few
   * weeks, so a stored one can die without anything else changing.
   */
  const [broken, setBroken] = useState<string | null>(null);
  const photo = photoUrl && photoUrl !== broken ? photoUrl : null;
  const src = photo || characterUrl(style, name);
  return (
    <span
      className={`relative inline-block flex-none overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: avatarTint(name),
        boxShadow: ring ? `0 0 0 ${ring}px var(--card)` : undefined,
      }}
      title={title ?? name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={photo ? () => setBroken(photo) : undefined}
        // A photo that failed before hydration never fires onError; catch it here.
        ref={(el) => {
          if (photo && el?.complete && el.naturalWidth === 0) setBroken(photo);
        }}
      />
    </span>
  );
}
