import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getOpenMapProfiles, getProfileById, touchActivity } from "@/lib/profiles";
import { matchesFor } from "@/lib/matching";
import { attachConnectionStatus } from "@/lib/connections";
import { DEFAULT_RADIUS_KM, MATCHES_SHOWN, RADIUS_OPTIONS_KM } from "@/lib/rules";
import { publicEvents } from "@/lib/boards";

/**
 * The open map: pins, public events, and the viewer's recommendations, in
 * one response.
 *
 * One request rather than three because they are one screen and they must
 * agree. Fetching matches separately guarantees the moment where the map
 * recommends somebody who isn't on it — different radius, different
 * snapshot — and that single inconsistency costs more trust than the extra
 * round trip ever saved.
 *
 * Deliberately open to signed-out visitors: the pitch is seeing that real
 * people are already here before committing to a signup, so this cannot sit
 * behind a login wall. They get pins and events; recommendations need a
 * profile to match against, so those come back empty.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const radiusParam = Number(url.searchParams.get("radiusKm"));
  const radiusKm = (RADIUS_OPTIONS_KM as readonly number[]).includes(radiusParam)
    ? radiusParam
    : DEFAULT_RADIUS_KM;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "A map centre is required." }, { status: 400 });
  }

  const profiles = await getOpenMapProfiles({
    excludeUserId: user?.id,
    centerLat: lat,
    centerLng: lng,
    radiusKm,
  });

  const me = user ? await getProfileById(user.id) : null;
  if (user) await touchActivity(user.id);

  // Matched against the same `profiles` array the map is drawing, so a
  // recommendation is always a pin the viewer can actually see and click.
  const matches =
    me && me.name
      ? matchesFor(
          { id: me.id, lookingFor: me.lookingFor, canHelpWith: me.canHelpWith },
          profiles,
          { surface: "open", limit: MATCHES_SHOWN }
        ).map((m) => ({ id: m.other.id, reason: m.reason, twoWay: m.twoWay }))
      : [];

  const withStatus = await attachConnectionStatus(profiles, user?.id);
  const events = (await publicEvents()).map((b) => ({
    slug: b.slug,
    name: b.name,
    place: b.place,
    lat: b.lat,
    lng: b.lng,
    startsAt: b.startsAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ profiles: withStatus, matches, events, radiusKm });
}
