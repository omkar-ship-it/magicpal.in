import type { ChatAttachment } from "./db/schema";

/**
 * What may be attached to a message, and what may not.
 *
 * Two separate jobs here, and both matter.
 *
 * The allow-list decides what can be *stored*. It is a list of things we
 * want rather than a list of things we fear, because a deny-list for file
 * uploads is a game you lose. SVG and HTML are the specific exclusions
 * worth naming: both execute script when opened, and a blob host serves
 * them with their real content type.
 *
 * `isOurs` decides what can be *referenced*. The send endpoint takes URLs
 * from the client, so without it anybody could post a message pointing at
 * any URL on the internet and have it render inside somebody's inbox —
 * which is a phishing surface wearing our chrome. Only our own blob host.
 */

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 4;

/** Images render inline. Everything else is a link with a name on it. */
export const IMAGE_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"] as const;

export const FILE_MIMES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

/** What the file pickers offer, so the dialog matches what the server takes. */
export const IMAGE_ACCEPT = IMAGE_MIMES.join(",");
export const FILE_ACCEPT = FILE_MIMES.join(",");

export function kindFor(mime: string): "image" | "file" | null {
  if ((IMAGE_MIMES as readonly string[]).includes(mime)) return "image";
  if ((FILE_MIMES as readonly string[]).includes(mime)) return "file";
  return null;
}

/**
 * Vercel Blob public URLs, and nothing else.
 *
 * Checked on the hostname rather than with `startsWith`, because
 * `https://our-host.public.blob.vercel-storage.com.evil.com/x` passes a
 * prefix test and is not our host.
 */
export function isOurs(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (u.hostname.endsWith(".public.blob.vercel-storage.com") ||
        u.hostname === "public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

/** Keep only attachments that are well-formed, ours, and of a kind we allow. */
export function cleanAttachments(input: unknown): ChatAttachment[] {
  if (!Array.isArray(input)) return [];
  const out: ChatAttachment[] = [];
  for (const a of input.slice(0, MAX_ATTACHMENTS)) {
    if (!a || typeof a !== "object") continue;
    const { url, name, mime, size } = a as Record<string, unknown>;
    if (typeof url !== "string" || !isOurs(url)) continue;
    if (typeof mime !== "string") continue;
    const kind = kindFor(mime);
    if (!kind) continue;
    const bytes = Number(size);
    if (!Number.isFinite(bytes) || bytes < 0 || bytes > MAX_ATTACHMENT_BYTES) continue;
    out.push({
      kind,
      url,
      name: typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : "Attachment",
      mime,
      size: Math.round(bytes),
    });
  }
  return out;
}

/** "2.4 MB" — shown next to a file nobody can preview before downloading. */
export function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
