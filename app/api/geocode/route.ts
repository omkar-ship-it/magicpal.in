import { NextResponse } from "next/server";

type Result = { label: string; lat: number; lng: number };

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
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    try {
      const results = mapboxToken
        ? await reverseMapbox(lat, lng, mapboxToken)
        : await reverseNominatim(lat, lng);
      return NextResponse.json({ results });
    } catch {
      // A point with no name is still a usable pin, so fall back to the
      // coordinates rather than failing the whole flow.
      return NextResponse.json({ results: [{ label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng }] });
    }
  }

  const q = params.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  try {
    const results = mapboxToken ? await geocodeMapbox(q, mapboxToken) : await geocodeNominatim(q);
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
  return [{ label: f?.properties.full_address ?? f?.properties.name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng }];
}

async function reverseNominatim(lat: number, lng: number): Promise<Result[]> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");

  const res = await fetch(url, {
    headers: { "User-Agent": "MagicPal/1.0 (networking app; contact admin@bandicoventures.com)" },
  });
  if (!res.ok) return [];
  const d = (await res.json()) as { display_name?: string };
  return [{ label: d.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng }];
}

async function geocodeMapbox(q: string, token: string): Promise<Result[]> {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "5");
  url.searchParams.set("access_token", token);

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  type Feature = { properties: { full_address?: string; name?: string }; geometry: { coordinates: [number, number] } };
  return ((data.features ?? []) as Feature[]).map((f) => ({
    label: f.properties.full_address ?? f.properties.name ?? q,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }));
}

async function geocodeNominatim(q: string): Promise<Result[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");

  const res = await fetch(url, {
    headers: { "User-Agent": "MagicPal/1.0 (networking app; contact admin@bandicoventures.com)" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }));
}
