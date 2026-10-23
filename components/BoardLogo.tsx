"use client";

import { avatarTint } from "@/lib/avatar";

/**
 * A community's mark, wherever the community appears.
 *
 * Squared rather than round, which is the whole reason this isn't `Avatar`:
 * on one screen you can be looking at a person and the group they belong to
 * at the same time, and the shape is what tells you which is which without
 * reading either label.
 *
 * No logo is the normal case, not a broken one — an initial on a tinted
 * tile, the hue seeded from the name so the same group is always the same
 * colour and a list of them reads as a set. A generated mark is also why
 * uploading one feels like an upgrade rather than a chore.
 */
export default function BoardLogo({
  name,
  logoUrl,
  size = 44,
  ring = false,
  className = "",
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  /** A card-coloured ring, for a mark that overlaps an image or a hero. */
  ring?: boolean;
  className?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "·";
  return (
    <span
      className={`relative inline-grid flex-none place-items-center overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        // Scales with the tile: a 12px radius looks like a rounded square at
        // 44px and like a circle at 24px.
        borderRadius: Math.max(6, Math.round(size * 0.26)),
        background: avatarTint(name),
        boxShadow: ring ? `0 0 0 3px var(--card)` : undefined,
      }}
      title={name}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span
          aria-hidden="true"
          className="font-semibold"
          style={{
            // Dark ink on the pale tint rather than white: the tints are
            // light by design and white would vanish into them.
            color: "color-mix(in srgb, var(--ink) 72%, transparent)",
            fontSize: Math.round(size * 0.44),
            lineHeight: 1,
          }}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
