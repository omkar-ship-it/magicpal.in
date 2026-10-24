/**
 * Great-circle distance in km between two points, for sorting and filtering
 * "who's near me" — accurate enough for a radius filter, no PostGIS needed
 * at this scale.
 */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * A small, fixed-per-user offset applied to a pin before it ever leaves the
 * server — nobody but the profile's own owner sees their exact coordinates.
 *
 * Deterministic rather than re-randomised on every request: a offset that
 * changes on each page load would still leak the true location, just
 * slower — average enough jittered samples and they cancel out around the
 * real point. A fixed offset, by contrast, converges on nothing no matter
 * how many times it's viewed; it just reads as "somewhere in this
 * neighbourhood" forever. The radius filter still runs against the real
 * coordinates server-side — only what's rendered on the map is moved.
 */
const JITTER_RADIUS_METERS = 350;

function seededUnit(seed: string): number {
  // FNV-1a — fast, deterministic, no crypto needed for a non-adversarial
  // "spread pins around a bit" use case.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296; // -> [0, 1)
}

export function jitterLocation(userId: string, lat: number, lng: number): { lat: number; lng: number } {
  const angle = seededUnit(`${userId}:angle`) * 2 * Math.PI;
  const radius = seededUnit(`${userId}:dist`) * JITTER_RADIUS_METERS;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  return {
    lat: lat + (radius * Math.cos(angle)) / metersPerDegreeLat,
    lng: lng + (radius * Math.sin(angle)) / (metersPerDegreeLng || 1),
  };
}

/**
 * A coordinate from untrusted input, or null.
 *
 * Exists because `Number(null)` is `0` and `Number("")` is `0`, and zero is
 * a perfectly finite number — so the obvious
 * `Number.isFinite(Number(input))` guard reads a *missing* coordinate as a
 * real position at 0°, 0°. That is not a theoretical trap: it silently
 * pinned real members in the Gulf of Guinea and made the place search
 * return "0.0000, 0.0000" for every query, because an absent `lat` param
 * made a text search look like a reverse-geocode request.
 *
 * Null Island is rejected outright for the same reason. It is the
 * canonical sentinel for "no data", nobody is standing there, and a
 * coordinate that means "missing" must never be stored as if it meant a
 * place.
 */
export function coordOf(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Both coordinates present, in range, and not the missing-data sentinel. */
export function validPoint(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = coordOf(lat);
  const b = coordOf(lng);
  if (a === null || b === null) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  if (a === 0 && b === 0) return null;
  return { lat: a, lng: b };
}
