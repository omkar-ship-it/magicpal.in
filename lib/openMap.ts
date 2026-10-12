import { getOpenMapProfiles, getProfileById, touchActivity, type MapProfile } from "./profiles";
import { matchesFor } from "./matching";
import { publicEvents } from "./boards";
import { MATCHES_SHOWN } from "./rules";
import { attachConnectionStatus } from "./connections";

export type MapEventPayload = {
  slug: string;
  name: string;
  place: string | null;
  lat: number | null;
  lng: number | null;
  startsAt: string | null;
};

export type OpenMapPayload = {
  profiles: MapProfile[];
  matches: Array<{ id: string; reason: string; twoWay: boolean }>;
  events: MapEventPayload[];
  radiusKm: number;
};

/**
 * One payload for the open map, built in one place.
 *
 * Shared by the page that server-renders the first view and the route that
 * serves every pan after it. Two implementations would drift, and the
 * symptom would be a first paint that disagrees with the first pan — a
 * person appearing or vanishing for no reason the viewer can see.
 *
 * Pins, events and recommendations come back together because they are one
 * screen and have to agree: matching against the same array the map draws
 * is what guarantees a recommendation is always a pin you can click.
 */
export async function openMapPayload(opts: {
  userId?: string;
  lat: number;
  lng: number;
  radiusKm: number;
}): Promise<OpenMapPayload> {
  const profiles = await getOpenMapProfiles({
    excludeUserId: opts.userId,
    centerLat: opts.lat,
    centerLng: opts.lng,
    radiusKm: opts.radiusKm,
  });

  const me = opts.userId ? await getProfileById(opts.userId) : null;
  if (opts.userId) await touchActivity(opts.userId);

  const matches =
    me && me.name
      ? matchesFor({ id: me.id, lookingFor: me.lookingFor, canHelpWith: me.canHelpWith }, profiles, {
          surface: "open",
          limit: MATCHES_SHOWN,
        }).map((m) => ({ id: m.other.id, reason: m.reason, twoWay: m.twoWay }))
      : [];

  const withStatus = await attachConnectionStatus(profiles, opts.userId);
  const events = (await publicEvents()).map((b) => ({
    slug: b.slug,
    name: b.name,
    place: b.place,
    lat: b.lat,
    lng: b.lng,
    startsAt: b.startsAt?.toISOString() ?? null,
  }));

  return { profiles: withStatus as MapProfile[], matches, events, radiusKm: opts.radiusKm };
}
