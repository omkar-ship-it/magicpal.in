"use client";

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
  const src = photoUrl || characterUrl(style, name);
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
      <img src={src} alt="" width={size} height={size} className="h-full w-full object-cover" loading="lazy" />
    </span>
  );
}
