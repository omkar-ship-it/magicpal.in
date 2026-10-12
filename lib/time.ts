/**
 * Pure time formatting, deliberately in its own module.
 *
 * It lived in lib/feed.ts, which imports the database — so every client
 * component that wanted a relative timestamp pulled the Postgres driver
 * into the browser bundle and the build failed. Anything a client component
 * imports as a *value* has to be free of server-only dependencies; types
 * are erased and can keep coming from wherever they are defined.
 */

/** "3d ago", for surfaces where an exact timestamp is noise. */
export function sinceLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

/** A date somebody put on an invitation: "Mon, 13 Oct, 6:30 pm". */
export function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
