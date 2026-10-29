import { NextResponse } from "next/server";
import { validPoint } from "@/lib/geo";
import { BRAND_NAME } from "@/lib/brand";

type Result = {
  /** The whole thing, for callers that store one string. */
  label: string;
  /**
   * The same address split the way a result list wants to read it: the
   * thing you searched for on top, where it is underneath.
   *
   * One line of grey text is the difference between five results that all
   * look identical and five you can tell apart at a glance — "Gachibowli"
   * over "Hyderabad, Telangana" rather than a single run-on string whose
   * distinguishing half is past the truncation.
   */
  name: string;
  context: string | null;
  lat: number;
  lng: number;
};

/** Splits a one-string address into its first part and the rest. */
function split(label: string, lat: number, lng: number): Result {
  const i = label.indexOf(",");
  return i === -1
    ? { label, name: label, context: null, lat, lng }
    : { label, name: label.slice(0, i).trim(), context: label.slice(i + 1).trim(), lat, lng };
}

/**
 * Turns "Koramangala, Bengaluru" into a lat/lng. Mapbox's Geocoding API when
 * a token is configured (same token the map itself uses) — noticeably
 * better fuzzy/typo matching than the free alternative. Falls back to
 * OpenStreetMap's Nominatim (free, no key) when it isn't, the same
 * "never hard-depend on a credential nobody's set up yet" pattern as the
 * email/blob integrations elsewhere in this app.
 *
 * Proxied through our own server either way: Nominatim's usage policy
 * requires a descriptive User-Agent a browser's fetch can't set, and the
 * Mapbox token — while a public/client-safe token — has no reason to leak
 * into a second place when the map component already holds it.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Reverse: coordinates in, a place name out. Used by "use my current
  // location", where the browser gives a precise point and the person still
  // needs to see somewhere recognisable before they commit to it — nobody
  // can check that 17.4435, 78.3772 is the right café.
  // `params.get` returns null for an absent parameter and `Number(null)` is
  // 0, which is finite — so the obvious guard treated every *text* search as
  // a reverse-geocode of 0°, 0° and the branch below was unreachable. Every
  // place search on the deployment returned "0.0000, 0.0000", and the people
  // who picked it are pinned in the Gulf of Guinea.
  const here = validPoint(params.get("lat"), params.get("lng"));
  if (here) {
    try {
      const results = mapboxToken
        ? await reverseMapbox(here.lat, here.lng, mapboxToken)
        : await reverseNominatim(here.lat, here.lng);
      return NextResponse.json({ results });
    } catch {
      // A point with no name is still a usable pin, so fall back to the
      // coordinates rather than failing the whole flow.
      return NextResponse.json({
        results: [split(`${here.lat.toFixed(4)}, ${here.lng.toFixed(4)}`, here.lat, here.lng)],
      });
    }
  }

  const q = params.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  /**
   * Where to bias results towards.
   *
   * Without it the geocoder is answering "where in the world is a place
   * called this", and the honest answer to "Gachibowli" includes a road in
   * one city and a neighbourhood in another, ordered by nothing the person
   * typing cares about. With it, the answer is the one within reach —
   * which is what every map search anybody has used does, and why this felt
   * worse than the thing people compare it to.
   */
  const near = validPoint(params.get("nearLat"), params.get("nearLng"));

  try {
    const results = mapboxToken ? await geocodeMapbox(q, mapboxToken, near) : await geocodeNominatim(q, near);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}

async function reverseMapbox(lat: number, lng: number, token: string): Promise<Result[]> {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/reverse");
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", token);

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  type Feature = { properties: { full_address?: string; name?: string } };
  const f = (data.features ?? [])[0] as Feature | undefined;
  // The caller's own coordinates, not the geocoder's: a reverse lookup
  // snaps to the nearest named thing, and somebody who picked "here" meant
  // here rather than the building across the road.
  return [split(f?.properties.full_address ?? f?.properties.name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng)];
}

async function reverseNominatim(lat: number, lng: number): Promise<Result[]> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");

  const res = await fetch(url, {
    headers: { "User-Agent": `${BRAND_NAME}/1.0 (networking app; contact admin@bandicoventures.com)` },
  });
  if (!res.ok) return [];
  const d = (await res.json()) as { display_name?: string };
  return [split(d.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng)];
}

async function geocodeMapbox(
  q: string,
  token: string,
  near: { lat: number; lng: number } | null
): Promise<Result[]> {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("access_token", token);
  if (near) url.searchParams.set("proximity", `${near.lng},${near.lat}`);

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  type Feature = {
    properties: { full_address?: string; name?: string; place_formatted?: string };
    geometry: { coordinates: [number, number] };
  };
  return ((data.features ?? []) as Feature[]).map((f) => {
    const lng = f.geometry.coordinates[0];
    const lat = f.geometry.coordinates[1];
    // Mapbox already hands back the two halves separately; splitting its
    // own full_address back up would be re-deriving what it just told us.
    const name = f.properties.name;
    const label = f.properties.full_address ?? f.properties.name ?? q;
    return name
      ? { label, name, context: f.properties.place_formatted ?? null, lat, lng }
      : split(label, lat, lng);
  });
}

async function geocodeNominatim(q: string, near: { lat: number; lng: number } | null): Promise<Result[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "0");
  // Nominatim has no proximity parameter; a generous box around the same
  // point is the nearest equivalent, and unbounded so it still answers when
  // the place genuinely is somewhere else.
  if (near) {
    const d = 1.5;
    url.searchParams.set(
      "viewbox",
      `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`
    );
  }

  const res = await fetch(url, {
    headers: { "User-Agent": `${BRAND_NAME}/1.0 (networking app; contact admin@bandicoventures.com)` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((d) => split(d.display_name, Number(d.lat), Number(d.lon)));
}
