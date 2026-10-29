import { and, eq, inArray, isNotNull, isNull, lt, ne, notInArray, or } from "drizzle-orm";
import { db, hasDb } from "./db";
import { consents, memberships, users } from "./db/schema";
import { isActiveMember } from "./membership";
import { distanceKm } from "./geo";
import { ACTIVE_WINDOW_MINUTES, LIVE_STALE_MINUTES, MAX_MAP_RESULTS } from "./rules";
import { LEGAL_VERSION, TERMS_CONSENT_KIND } from "./legal";

export type Visibility = "off" | "base" | "exact" | "live";

/**
 * A person as the map and the matcher both see them.
 *
 * One shape for every surface — open map, event board, community board —
 * because the matcher is one function over a candidate set, and a candidate
 * from a board has to be indistinguishable from a candidate from the open
 * map for that to hold.
 */
export type MapProfile = {
  id: string;
  name: string;
  headline: string | null;
  company: string | null;
  bio: string | null;
  skills: string[];
  photoUrl: string | null;
  locationLabel: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;

  /** What the matcher scores on. */
  lookingFor: string[];
  canHelpWith: string[];
  /** Symmetric affinity — shared sectors, for people whose needs don't interlock. */
  interests: string[];
  /**
   * The same three answers in their own words. Matched by exact wording
   * against other people's custom entries, never against the vocabulary.
   */
  customLookingFor: string[];
  customCanHelpWith: string[];
  customInterests: string[];
  stage: string | null;
  workingOn: string | null;

  /**
   * Where to draw them, already resolved against their visibility choice —
   * the exact pin for `exact`, the city centroid for `base`. A caller can
   * never accidentally render a precise location for someone who asked for
   * city-level, because the precise one is not in this object.
   */
  lat: number;
  lng: number;
  /** Which precision the coordinates above actually are. */
  placed: "exact" | "base" | "live";
  /** Null when the caller gave no centre to measure from. */
  distanceKm: number | null;
  /** Heartbeat landed within ACTIVE_WINDOW_MINUTES. */
  active: boolean;
  /** Board surfaces only: physically present right now. */
  hereNow?: boolean;
  /**
   * No position to draw. Set for somebody who never published one, and for
   * a stored position that is really a missing one — see `toMapProfile`.
   */
  unplaced?: boolean;
};

const PROFILE_COLUMNS = {
  id: users.id,
  name: users.name,
  headline: users.headline,
  company: users.company,
  bio: users.bio,
  skills: users.skills,
  photoUrl: users.photoUrl,
  locationLabel: users.locationLabel,
  linkedinUrl: users.linkedinUrl,
  instagramUrl: users.instagramUrl,
  websiteUrl: users.websiteUrl,
  lookingFor: users.lookingFor,
  canHelpWith: users.canHelpWith,
  interests: users.interests,
  customLookingFor: users.customLookingFor,
  customCanHelpWith: users.customCanHelpWith,
  customInterests: users.customInterests,
  stage: users.stage,
  workingOn: users.workingOn,
  lat: users.lat,
  lng: users.lng,
  baseLat: users.baseLat,
  baseLng: users.baseLng,
  baseLabel: users.baseLabel,
  visibility: users.visibility,
  liveAt: users.liveAt,
  lastActiveAt: users.lastActiveAt,
} as const;

/**
 * Resolve a row's stored coordinates down to the one pair the viewer is
 * allowed to see.
 *
 * Fails closed, deliberately: somebody who chose `base` but has no base
 * city saved yet is dropped from the result rather than falling back to
 * their exact pin. The fallback would be the more "helpful" behaviour and
 * it would also be the exact leak the setting exists to prevent.
 */
export function placeFor(r: Parameters<typeof place>[0]) {
  return place(r);
}

function place(r: {
  visibility: string;
  lat: number | null;
  lng: number | null;
  locationLabel: string | null;
  baseLat: number | null;
  baseLng: number | null;
  baseLabel: string | null;
  liveAt?: Date | string | null;
}): { lat: number; lng: number; placed: "exact" | "base" | "live"; label: string | null } | null {
  if (r.visibility === "live") {
    // Decays on its own. Somebody who closed the tab three hours ago is not
    // "here now", and nobody ever taps stop — so a stale live position is
    // treated as no position at all rather than as a slightly old one.
    const fresh =
      r.liveAt != null && Date.now() - new Date(r.liveAt).getTime() < LIVE_STALE_MINUTES * 60_000;
    if (fresh && r.lat != null && r.lng != null) {
      return { lat: r.lat, lng: r.lng, placed: "live", label: r.locationLabel };
    }
    // Not fresh: fall back to the city they chose, never to a stale pin.
    if (r.baseLat != null && r.baseLng != null) {
      return { lat: r.baseLat, lng: r.baseLng, placed: "base", label: r.baseLabel };
    }
    return null;
  }
  if (r.visibility === "exact" && r.lat != null && r.lng != null) {
    // No jitter. Someone who picked "exact" is asking to be findable at the
    // venue they're standing in; blurring it would quietly break that deal.
    return { lat: r.lat, lng: r.lng, placed: "exact", label: r.locationLabel };
  }
  if (r.visibility === "base" && r.baseLat != null && r.baseLng != null) {
    // The city's label, not the street-level one — the whole point is that
    // the precise location does not leave this function, and that includes
    // its name. "Hyderabad", never "Banjara Hills, Hyderabad".
    return { lat: r.baseLat, lng: r.baseLng, placed: "base", label: r.baseLabel };
  }
  return null;
}

/**
 * Exactly what PROFILE_COLUMNS selects.
 *
 * Written out rather than inferred from the Drizzle select, because every
 * consumer below reads these fields by name and an inferred type would
 * make a column rename a silent `undefined` at runtime instead of a
 * compile error.
 */
type ProfileRow = {
  id: string;
  name: string | null;
  headline: string | null;
  company: string | null;
  bio: string | null;
  skills: string[] | null;
  photoUrl: string | null;
  locationLabel: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  lookingFor: string[] | null;
  canHelpWith: string[] | null;
  interests: string[] | null;
  stage: string | null;
  workingOn: string | null;
  lat: number | null;
  lng: number | null;
  baseLat: number | null;
  baseLng: number | null;
  baseLabel: string | null;
  visibility: string;
  liveAt: Date | null;
  lastActiveAt: Date | null;
  customLookingFor: string[] | null;
  customCanHelpWith: string[] | null;
  customInterests: string[] | null;
};

/**
 * A place *name*, or nothing.
 *
 * A label that is just a pair of numbers is what the geocoder produced when
 * it could not name a point, and it is not a place: it grouped real members
 * under a "0.0000" city chip in the directory. Showing coordinates where a
 * reader expects a place name tells them nothing and looks broken, so the
 * honest rendering of "we don't know what this place is called" is blank.
 */
function placeName(label: string | null): string | null {
  if (!label) return null;
  return /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(label) ? null : label;
}

function toMapProfile(r: ProfileRow, centre?: { lat: number; lng: number }): MapProfile | null {
  const placed = place(r);
  if (!placed || r.name == null) return null;
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60_000);

  // 0,0 is the sentinel for "no coordinate", not a spot in the Gulf of
  // Guinea — rows carrying it predate the parsing fix in lib/geo. Treated
  // as what it means: this person has no position, same as somebody who
  // never gave one, so no pin and no distance rather than a wrong one.
  if (placed.lat === 0 && placed.lng === 0) {
    return {
      id: r.id,
      name: r.name,
      headline: r.headline,
      company: r.company,
      bio: r.bio,
      skills: r.skills ?? [],
      photoUrl: r.photoUrl,
      locationLabel: null,
      linkedinUrl: r.linkedinUrl,
      instagramUrl: r.instagramUrl,
      websiteUrl: r.websiteUrl,
      lookingFor: r.lookingFor ?? [],
      canHelpWith: r.canHelpWith ?? [],
      interests: r.interests ?? [],
      customLookingFor: r.customLookingFor ?? [],
      customCanHelpWith: r.customCanHelpWith ?? [],
      customInterests: r.customInterests ?? [],
      stage: r.stage,
      workingOn: r.workingOn,
      lat: 0,
      lng: 0,
      placed: "base",
      distanceKm: null,
      active: Boolean(r.lastActiveAt && new Date(r.lastActiveAt) > activeSince),
      unplaced: true,
    };
  }

  return {
    id: r.id,
    name: r.name,
    headline: r.headline,
    company: r.company,
    bio: r.bio,
    skills: r.skills ?? [],
    photoUrl: r.photoUrl,
    locationLabel: placeName(placed.label),
    linkedinUrl: r.linkedinUrl,
    instagramUrl: r.instagramUrl,
    websiteUrl: r.websiteUrl,
    lookingFor: r.lookingFor ?? [],
    canHelpWith: r.canHelpWith ?? [],
    interests: r.interests ?? [],
    customLookingFor: r.customLookingFor ?? [],
    customCanHelpWith: r.customCanHelpWith ?? [],
    customInterests: r.customInterests ?? [],
    stage: r.stage,
    workingOn: r.workingOn,
    lat: placed.lat,
    lng: placed.lng,
    placed: placed.placed,
    distanceKm: centre ? distanceKm(centre.lat, centre.lng, placed.lat, placed.lng) : null,
    active: Boolean(r.lastActiveAt && new Date(r.lastActiveAt) > activeSince),
  };
}

/**
 * Onboarded people on the open network who have no position to show.
 *
 * They belong in the *directory* and nowhere near the map. The distinction
 * this function turns on is the one that matters, and it is not visible in
 * `users.visibility` alone:
 *
 *   never answered — `visibility` is `off` because that is the column's
 *                    default and they closed the app before reaching the
 *                    location step. They have declined nothing. Leaving
 *                    them out means a network that looks empty while real
 *                    members with stated needs sit in it, unreachable.
 *   actively declined — they opened the control and turned the map off,
 *                    which appends a row to `consents`. That is a promise,
 *                    and it is kept: they are not in this result.
 *
 * The consents log is what makes the two separable, which is most of the
 * reason it is append-only rather than a boolean on the user.
 *
 * Returned `unplaced`, with coordinates that are deliberately meaningless:
 * every surface must decide what to do with somebody who has no location,
 * and MapCanvas's answer is to skip them.
 */
export async function getUnplacedOpenProfiles(opts: {
  excludeUserId?: string;
}): Promise<Array<MapProfile & { unplaced: true }>> {
  if (!hasDb || !db) return [];

  const declined = db
    .select({ userId: consents.userId })
    .from(consents)
    .where(eq(consents.kind, "open_map_off"));

  const rows = await db
    .select(PROFILE_COLUMNS)
    .from(users)
    .where(
      and(
        eq(users.visibility, "off"),
        isNotNull(users.name),
        notInArray(users.id, declined),
        opts.excludeUserId ? ne(users.id, opts.excludeUserId) : undefined
      )
    )
    .limit(MAX_MAP_RESULTS);

  return rows.map((r) => ({
    id: r.id,
    name: r.name!,
    headline: r.headline,
    company: r.company,
    bio: r.bio,
    skills: r.skills ?? [],
    photoUrl: r.photoUrl,
    // Null, not a guess. They have not told anybody where they are, and a
    // blank is the honest rendering of that.
    locationLabel: null,
    linkedinUrl: r.linkedinUrl,
    instagramUrl: r.instagramUrl,
    websiteUrl: r.websiteUrl,
    lookingFor: r.lookingFor ?? [],
    canHelpWith: r.canHelpWith ?? [],
    interests: r.interests ?? [],
    customLookingFor: r.customLookingFor ?? [],
    customCanHelpWith: r.customCanHelpWith ?? [],
    customInterests: r.customInterests ?? [],
    stage: r.stage,
    workingOn: r.workingOn,
    lat: 0,
    lng: 0,
    placed: "base" as const,
    distanceKm: null,
    active: false,
    unplaced: true as const,
  }));
}

/**
 * The open map: everyone who opted in, within a radius, nearest first.
 *
 * `visibility <> 'off'` is checked here, in the one function every open-map
 * view goes through, rather than trusted to every caller — the guarantee is
 * "a profile set to off is never in this result set", not "the UI happens
 * to hide it".
 *
 * Distance is still computed in application code. The honest trade-off for
 * a first version: a bounding-box prefilter in SQL is the next step and
 * PostGIS the one after that, but neither earns its setup cost until the
 * table is large enough for a full scan to show up in a trace.
 */
export async function getOpenMapProfiles(opts: {
  /** Omit for a signed-out caller — there's no "self" to exclude. */
  excludeUserId?: string;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
}): Promise<MapProfile[]> {
  if (!hasDb || !db) return [];

  const rows = await db
    .select(PROFILE_COLUMNS)
    .from(users)
    .where(
      and(
        ne(users.visibility, "off"),
        isNotNull(users.name), // onboarded
        // Either an exact pin or a base city must actually be present, or
        // there is nothing to draw. Mirrors place() so the database does
        // not hand back rows that function is only going to discard.
        or(
          and(eq(users.visibility, "exact"), isNotNull(users.lat), isNotNull(users.lng)),
          and(eq(users.visibility, "base"), isNotNull(users.baseLat), isNotNull(users.baseLng)),
          // Live rows can resolve to either a fresh pin or their base city,
          // so both coordinate pairs are acceptable here; place() decides.
          and(
            eq(users.visibility, "live"),
            or(
              and(isNotNull(users.lat), isNotNull(users.lng)),
              and(isNotNull(users.baseLat), isNotNull(users.baseLng))
            )
          )
        ),
        opts.excludeUserId ? ne(users.id, opts.excludeUserId) : undefined
      )
    );

  const centre =
    opts.centerLat != null && opts.centerLng != null
      ? { lat: opts.centerLat, lng: opts.centerLng }
      : undefined;

  return rows
    .map((r) => toMapProfile(r, centre))
    .filter((p): p is MapProfile => p !== null)
    .filter((p) => opts.radiusKm == null || p.distanceKm == null || p.distanceKm <= opts.radiusKm)
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
    .slice(0, MAX_MAP_RESULTS);
}

/**
 * Everyone on a board.
 *
 * Note what is *not* in the where clause: `visibility`. Joining a board is
 * its own, narrower act of consent — you scanned a QR in a room and agreed
 * to be visible to that room — and it does not require being on the public
 * map. A member set to `off` still appears to their own board, which is the
 * single most important asymmetry in the product.
 *
 * Their *coordinates* still follow their visibility setting, via place():
 * on a board you are always listed, but you are only pinned where you
 * agreed to be pinned.
 */
export async function getBoardMembers(
  boardId: string,
  opts: { excludeUserId?: string; centerLat?: number; centerLng?: number } = {}
): Promise<
  Array<MapProfile & { hereNow: boolean; role: string; unplaced: boolean; verifiedHere: boolean; joinedAt: string }>
> {
  if (!hasDb || !db) return [];

  const rows = await db
    .select({
      ...PROFILE_COLUMNS,
      role: memberships.role,
      checkedInAt: memberships.checkedInAt,
      verifiedAt: memberships.verifiedAt,
      joinedAt: memberships.joinedAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.boardId, boardId),
        isActiveMember(),
        isNotNull(users.name),
        opts.excludeUserId ? ne(users.id, opts.excludeUserId) : undefined
      )
    );

  const centre =
    opts.centerLat != null && opts.centerLng != null
      ? { lat: opts.centerLat, lng: opts.centerLng }
      : undefined;

  const checkedInSince = new Date(Date.now() - 12 * 60 * 60_000);

  return rows.map((r) => {
    const mapped = toMapProfile(r, centre);
    const hereNow = Boolean(r.checkedInAt && new Date(r.checkedInAt) > checkedInSince);
    // This board's own claim about them, which is what the owner manages.
    // The badge other members see is `verified`, decided per viewer in
    // lib/vouch — a board can only vouch to people who are actually in it.
    const vouched = { verifiedHere: r.verifiedAt != null, joinedAt: r.joinedAt.toISOString() };
    if (mapped) return { ...mapped, hereNow, role: r.role, unplaced: false, ...vouched };
    // Set to `off`, or no coordinates yet. They are a real member and must
    // still be listed and matchable — they simply have no pin. The board UI
    // shows them in the list with no marker rather than dropping them, and
    // `unplaced` is what stops MapCanvas drawing them at (0, 0) in the
    // Atlantic.
    return {
      id: r.id,
      name: r.name!,
      headline: r.headline,
      company: r.company,
      bio: r.bio,
      skills: r.skills ?? [],
      photoUrl: r.photoUrl,
      locationLabel: null,
      linkedinUrl: r.linkedinUrl,
      instagramUrl: r.instagramUrl,
      websiteUrl: r.websiteUrl,
      lookingFor: r.lookingFor ?? [],
      canHelpWith: r.canHelpWith ?? [],
      interests: r.interests ?? [],
      customLookingFor: r.customLookingFor ?? [],
      customCanHelpWith: r.customCanHelpWith ?? [],
      customInterests: r.customInterests ?? [],
      stage: r.stage,
      workingOn: r.workingOn,
      lat: 0,
      lng: 0,
      placed: "base" as const,
      distanceKm: null,
      active: false,
      hereNow,
      role: r.role,
      unplaced: true,
      ...vouched,
    };
  });
}

/**
 * Mark someone as around, cheaply.
 *
 * The prototype ran a client heartbeat on a timer for this, which is a
 * websocket's worth of infrastructure to power one word on a card. Loading
 * a map *is* the activity signal, so this piggybacks on it — and the
 * WHERE clause means a user costs at most one small indexed write per
 * window however often they pan the map.
 */
export async function touchActivity(userId: string): Promise<void> {
  if (!hasDb || !db) return;
  const staleBefore = new Date(Date.now() - (ACTIVE_WINDOW_MINUTES / 2) * 60_000);
  await db
    .update(users)
    .set({ lastActiveAt: new Date() })
    .where(
      and(eq(users.id, userId), or(isNull(users.lastActiveAt), lt(users.lastActiveAt, staleBefore)))
    );
}

export async function getProfileById(id: string) {
  if (!hasDb || !db) return null;
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function getProfilesByIds(ids: string[]) {
  if (!hasDb || !db || ids.length === 0) return [];
  return db.select(PROFILE_COLUMNS).from(users).where(inArray(users.id, ids));
}

/**
 * Whether this person has accepted the *current* terms and privacy policy.
 *
 * Keyed on the version, not merely on the kind: a consent to wording that
 * has since been rewritten is a record of something that no longer exists,
 * and treating it as live agreement to the new text is exactly the move
 * that makes a consent log worthless. Raising LEGAL_VERSION therefore asks
 * everybody again, which is the intended cost of changing the words.
 */
export async function hasAcceptedTerms(userId: string): Promise<boolean> {
  if (!hasDb || !db) return true;
  const rows = await db
    .select({ granted: consents.granted })
    .from(consents)
    .where(
      and(
        eq(consents.userId, userId),
        eq(consents.kind, TERMS_CONSENT_KIND),
        eq(consents.copyVersion, LEGAL_VERSION)
      )
    )
    .limit(1);
  return rows.length > 0 && rows[0].granted;
}
