/**
 * A LinkedIn profile link, required of every member and shown on their
 * profile so people can check who they are about to meet.
 *
 * People paste it every way there is — with or without https, www, a
 * country or mobile subdomain, a trailing slash, tracking parameters — so
 * all of those are accepted and stored as one canonical address. What is
 * refused is anything that isn't a personal profile: a company page, a
 * post, a search, another site.
 */

const HOST = /^(?:[a-z]{2,3}\.|www\.|m\.)?linkedin\.com$/i;
const SLUG = /^[\p{L}\p{N}\-_%.]{2,100}$/u;

/** The canonical `https://www.linkedin.com/in/<slug>`, or null if it isn't a profile link. */
export function normalizeLinkedin(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!HOST.test(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2 || parts[0].toLowerCase() !== "in") return null;
  let slug = parts[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    /* keep it as written */
  }
  if (!SLUG.test(slug)) return null;
  return `https://www.linkedin.com/in/${encodeURIComponent(slug)}`;
}

export const LINKEDIN_HELP = "Add your LinkedIn profile link — it looks like linkedin.com/in/your-name.";
