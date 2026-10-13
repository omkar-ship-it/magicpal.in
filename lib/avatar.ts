/**
 * A round, deterministic generated avatar for anyone without an uploaded
 * photo — same seed always produces the same image, so a person's pin
 * looks consistent across visits without us storing anything. These are
 * stylized/illustrated (DiceBear), never a photo-realistic face, so there's
 * no implication that a real photo of a real person is being shown.
 */
export function avatarUrl(seed: string): string {
  return characterUrl("notionists", seed);
}

/**
 * The character sets a member can pick from.
 *
 * Deliberately illustrated rather than photo-like: most alumni won't upload
 * a photo, and a wall of grey initials is the thing that makes a directory
 * feel dead. A chosen character is a small act of ownership — people fiddle
 * with it, and fiddling is engagement.
 */
export const AVATAR_STYLES = [
  { id: "notionists", label: "Sketch" },
  { id: "adventurer", label: "Adventurer" },
  { id: "big-smile", label: "Big smile" },
  { id: "lorelei", label: "Line art" },
  { id: "micah", label: "Flat" },
  { id: "bottts", label: "Robot" },
  { id: "fun-emoji", label: "Faces" },
  { id: "thumbs", label: "Thumbs" },
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number]["id"];

/** The default when nobody has chosen — warmer and more legible at 40px than the sketch set. */
export const DEFAULT_AVATAR_STYLE = "adventurer";

export function characterUrl(style: string, seed: string): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`;
}

/**
 * The soft disc a character sits on.
 *
 * On a transparent background these illustrations float as loose line work
 * and read as unfinished; on a tinted disc they read as a considered object.
 * The hue comes from the seed, so a face is always the same colour and a
 * crowd of them looks varied rather than uniform.
 */
const TINTS = [198, 24, 150, 265, 42, 340, 96, 310, 14, 180];

export function avatarTint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = TINTS[h % TINTS.length];
  return `hsl(${hue} 68% 93%)`;
}
