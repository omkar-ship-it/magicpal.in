import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, hasDb } from "@/lib/db";
import { consents, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { getProfileById } from "@/lib/profiles";
import { STAGE_BY_ID, validSectors, validTopics } from "@/lib/intents";
import { CONSENT_COPY_VERSION, MAX_INTERESTS, MAX_SKILLS, MAX_TOPICS } from "@/lib/rules";

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Accepts "linkedin.com/in/x" as readily as "https://linkedin.com/in/x" — nobody types the scheme. */
function normalizeUrl(v: unknown, max = 300): string {
  const s = str(v, max);
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/**
 * Your own profile, for the overlay that edits it.
 *
 * Deliberately only ever yours — there is no `?userId=` here. Other people's
 * profiles reach the client through the map payload, which has already run
 * every field through the visibility rules in lib/profiles.ts.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const row = await getProfileById(user.id);
  if (!row) return NextResponse.json({ error: "No profile." }, { status: 404 });
  return NextResponse.json({
    profile: {
      name: row.name ?? "",
      headline: row.headline ?? "",
      company: row.company ?? "",
      workingOn: row.workingOn ?? "",
      bio: row.bio ?? "",
      linkedinUrl: row.linkedinUrl ?? "",
      photoUrl: row.photoUrl,
      lookingFor: row.lookingFor ?? [],
      canHelpWith: row.canHelpWith ?? [],
      interests: row.interests ?? [],
      stage: row.stage ?? "",
      locationLabel: row.locationLabel,
      lat: row.lat,
      lng: row.lng,
      baseLabel: row.baseLabel,
      baseLat: row.baseLat,
      baseLng: row.baseLng,
      visibility: row.visibility,
      openToMentor: row.openToMentor,
      seekingMentor: row.seekingMentor,
    },
  });
}

const VISIBILITIES = ["off", "base", "exact"] as const;
type Visibility = (typeof VISIBILITIES)[number];

/**
 * Create or update the signed-in person's own profile.
 *
 * One route for the whole form, since name, intents, location and
 * visibility are all edited together and a partial save would let somebody
 * end up pinned with no stated intent — visible but unmatchable, which is
 * the worst state to be in on this map. There is no "write someone else's
 * profile" path anywhere in this codebase; `getSessionUser` is the only
 * source of whose row this touches.
 */
export async function POST(req: Request) {
  if (!hasDb || !db) return NextResponse.json({ error: "Not available right now." }, { status: 503 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = str(body?.name, 80);
  const headline = str(body?.headline, 120);
  const company = str(body?.company, 120);
  const bio = str(body?.bio, 600);
  const workingOn = str(body?.workingOn, 200);
  const linkedinUrl = normalizeUrl(body?.linkedinUrl);
  const instagramUrl = normalizeUrl(body?.instagramUrl);
  const websiteUrl = normalizeUrl(body?.websiteUrl);

  const lookingFor = validTopics(body?.lookingFor).slice(0, MAX_TOPICS);
  const canHelpWith = validTopics(body?.canHelpWith).slice(0, MAX_TOPICS);
  const interests = validSectors(body?.interests).slice(0, MAX_INTERESTS);
  const stage = STAGE_BY_ID.has(body?.stage) ? (body.stage as string) : null;

  const locationLabel = str(body?.locationLabel, 160);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const baseLabel = str(body?.baseLabel, 160);
  const baseLat = Number(body?.baseLat);
  const baseLng = Number(body?.baseLng);

  const visibility: Visibility = VISIBILITIES.includes(body?.visibility) ? body.visibility : "off";

  if (name.length < 2) return NextResponse.json({ error: "Tell us your name." }, { status: 400 });
  if (headline.length < 2) return NextResponse.json({ error: "Add a one-line headline." }, { status: 400 });

  const hasExact = Number.isFinite(lat) && Number.isFinite(lng) && locationLabel.length > 0;
  const hasBase = Number.isFinite(baseLat) && Number.isFinite(baseLng) && baseLabel.length > 0;

  // The saved row, not the session: a visibility choice has to be checked
  // against coordinates that may have been set on an earlier save, and the
  // session deliberately doesn't carry them.
  const existing = await getProfileById(user.id);

  // Refuse the combination rather than silently downgrading it. Saving
  // "exact" with no pin would leave the person believing they are on the
  // map when getOpenMapProfiles will never return them — a privacy setting
  // that lies in the reassuring direction is still a setting that lies.
  if (visibility === "exact" && !hasExact && existing?.lat == null) {
    return NextResponse.json({ error: "Pick your exact location first, or choose city-only." }, { status: 400 });
  }
  if (visibility === "base" && !hasBase && existing?.baseLat == null) {
    return NextResponse.json({ error: "Pick the city you want to show in." }, { status: 400 });
  }

  const skills = Array.isArray(body?.skills)
    ? body.skills
        .filter((s: unknown) => typeof s === "string" && s.trim())
        .map((s: string) => s.trim().slice(0, 30))
        .slice(0, MAX_SKILLS)
    : [];

  await db
    .update(users)
    .set({
      name,
      headline,
      company: company || null,
      bio: bio || null,
      workingOn: workingOn || null,
      linkedinUrl: linkedinUrl || null,
      instagramUrl: instagramUrl || null,
      websiteUrl: websiteUrl || null,
      skills,
      lookingFor,
      canHelpWith,
      interests,
      stage,
      openToMentor: Boolean(body?.openToMentor),
      seekingMentor: Boolean(body?.seekingMentor),
      // Locations are only ever set from a geocoded result, so a request
      // with no valid coordinates leaves whatever was there — it never
      // wipes an existing pin to null.
      ...(hasExact ? { lat, lng, locationLabel } : {}),
      ...(hasBase ? { baseLat, baseLng, baseLabel } : {}),
      visibility,
    })
    .where(eq(users.id, user.id));

  // Append-only, and only when the setting actually moved: a log that gets
  // a row on every profile save can't answer "when did they agree to this",
  // which is the single question it exists to answer.
  if (visibility !== (existing?.visibility ?? "off")) {
    await db.insert(consents).values({
      userId: user.id,
      kind: visibility === "off" ? "open_map_off" : `location_${visibility}`,
      granted: visibility !== "off",
      copyVersion: CONSENT_COPY_VERSION,
    });
  }

  return NextResponse.json({ ok: true });
}
