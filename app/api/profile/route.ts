import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, hasDb } from "@/lib/db";
import { consents, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { getProfileById, hasAcceptedTerms } from "@/lib/profiles";
import { validPoint } from "@/lib/geo";
import { LEGAL_VERSION, TERMS_CONSENT_KIND } from "@/lib/legal";
import { cleanCustom, STAGE_BY_ID, validSectors, validTopics } from "@/lib/intents";
import {
  ALERT_RADIUS_OPTIONS_KM,
  CONSENT_COPY_VERSION,
  MAX_CUSTOM,
  MAX_CUSTOM_LENGTH,
  MAX_INTERESTS,
  MAX_SKILLS,
  MAX_TOPICS,
} from "@/lib/rules";

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
  // Drives the consent checkbox: the form has to know whether to ask.
  const termsAccepted = await hasAcceptedTerms(user.id);
  return NextResponse.json({
    termsAccepted,
    profile: {
      // Shown on the sign-out confirmation, so somebody can see which
      // account they're about to leave before they leave it.
      email: row.email,
      name: row.name ?? "",
      headline: row.headline ?? "",
      company: row.company ?? "",
      workingOn: row.workingOn ?? "",
      bio: row.bio ?? "",
      linkedinUrl: row.linkedinUrl ?? "",
      phone: row.phone ?? "",
      phoneVisibility: row.phoneVisibility ?? "connections",
      photoUrl: row.photoUrl,
      lookingFor: row.lookingFor ?? [],
      canHelpWith: row.canHelpWith ?? [],
      interests: row.interests ?? [],
      customLookingFor: row.customLookingFor ?? [],
      customCanHelpWith: row.customCanHelpWith ?? [],
      customInterests: row.customInterests ?? [],
      stage: row.stage ?? "",
      locationLabel: row.locationLabel,
      lat: row.lat,
      lng: row.lng,
      baseLabel: row.baseLabel,
      baseLat: row.baseLat,
      baseLng: row.baseLng,
      visibility: row.visibility,
      publicOptIn: row.publicOptIn,
      openToMentor: row.openToMentor,
      seekingMentor: row.seekingMentor,
      notifyConnections: row.notifyConnections,
      notifyMatches: row.notifyMatches,
      notifyInterests: row.notifyInterests,
      notifyRadiusKm: row.notifyRadiusKm,
    },
  });
}

const VISIBILITIES = ["off", "base", "exact", "live"] as const;
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

  /**
   * Agreement to the terms and the privacy policy, taken once and recorded
   * with the version of the wording the person was actually shown.
   *
   * Enforced on the server rather than only in the form. A checkbox is a
   * prompt; the thing that makes it a consent is that the save is refused
   * without it and that a row lands saying which text was agreed to — a
   * client-side gate proves nothing afterwards, which is the only time
   * anybody ever asks.
   */
  const alreadyAccepted = await hasAcceptedTerms(user.id);
  if (!alreadyAccepted && body?.acceptTerms !== true) {
    return NextResponse.json(
      { error: "Please accept the Terms & Conditions and Privacy Policy to continue." },
      { status: 400 }
    );
  }

  const name = str(body?.name, 80);
  const headline = str(body?.headline, 120);
  const company = str(body?.company, 120);
  const bio = str(body?.bio, 600);
  const workingOn = str(body?.workingOn, 200);
  const phone = str(body?.phone, 32);
  const phoneVisibility = body?.phoneVisibility === "private" ? "private" : "connections";
  const linkedinUrl = normalizeUrl(body?.linkedinUrl);
  const instagramUrl = normalizeUrl(body?.instagramUrl);
  const websiteUrl = normalizeUrl(body?.websiteUrl);

  const lookingFor = validTopics(body?.lookingFor).slice(0, MAX_TOPICS);
  const canHelpWith = validTopics(body?.canHelpWith).slice(0, MAX_TOPICS);
  const interests = validSectors(body?.interests).slice(0, MAX_INTERESTS);
  // Trimmed, de-duplicated by comparison key and count-capped here rather
  // than trusted to the form: these are the only free-text fields the
  // matcher reads, so a stray empty string or a near-duplicate would show
  // up as a chip on somebody's card and as a phrase nothing can match.
  const customCaps = { max: MAX_CUSTOM, maxLength: MAX_CUSTOM_LENGTH };
  const customLookingFor = cleanCustom(body?.customLookingFor, customCaps);
  const customCanHelpWith = cleanCustom(body?.customCanHelpWith, customCaps);
  const customInterests = cleanCustom(body?.customInterests, customCaps);
  const stage = STAGE_BY_ID.has(body?.stage) ? (body.stage as string) : null;

  // Parsed through `validPoint`, not `Number.isFinite(Number(x))`: a null
  // coordinate coerces to 0, which is finite, so the naive guard stores a
  // missing position as a real one at 0°, 0°. See lib/geo.
  const locationLabel = str(body?.locationLabel, 160);
  const exactPoint = validPoint(body?.lat, body?.lng);
  const baseLabel = str(body?.baseLabel, 160);
  const basePoint = validPoint(body?.baseLat, body?.baseLng);

  const visibility: Visibility = VISIBILITIES.includes(body?.visibility) ? body.visibility : "off";
  /**
   * Absent means "leave it as it is", the same contract as the pin.
   *
   * It matters more here than anywhere else in this handler: a form that
   * does not render this control must not be able to publish somebody to
   * the open network by omission, and `body?.x === true` on an absent field
   * would read every partial save as a retraction instead.
   */
  const publicSent = typeof body?.publicOptIn === "boolean";

  if (name.length < 2) return NextResponse.json({ error: "Tell us your name." }, { status: 400 });
  if (headline.length < 2) return NextResponse.json({ error: "Add a one-line headline." }, { status: 400 });

  const hasExact = exactPoint !== null && locationLabel.length > 0;
  const hasBase = basePoint !== null && baseLabel.length > 0;

  // Sending nothing leaves the stored pin alone, which is how a form that
  // doesn't show these fields saves safely. Sending something that isn't a
  // usable point is a different thing entirely, and answering it with
  // "Saved" while quietly keeping the old pin is the reassuring kind of
  // lie — the person believes they have moved and they have not.
  const sent = (v: unknown) => v !== null && v !== undefined && v !== "";
  if (sent(body?.lat) && sent(body?.lng) && exactPoint === null) {
    return NextResponse.json(
      { error: "That location didn't come through — pick it from the list again." },
      { status: 400 }
    );
  }
  if (sent(body?.baseLat) && sent(body?.baseLng) && basePoint === null) {
    return NextResponse.json(
      { error: "That city didn't come through — pick it from the list again." },
      { status: 400 }
    );
  }

  // The saved row, not the session: a visibility choice has to be checked
  // against coordinates that may have been set on an earlier save, and the
  // session deliberately doesn't carry them.
  const existing = await getProfileById(user.id);
  const publicOptIn = publicSent ? body.publicOptIn === true : (existing?.publicOptIn ?? true);

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
  // Live decays to the city on purpose (see place() in lib/profiles), so a
  // live profile without one disappears from the map entirely the moment
  // the tab closes — which is what happened to a real member who had
  // picked the *most* visible setting there is. The picker already refuses
  // this combination; the server has to as well, or the one path that
  // skips the picker reintroduces it.
  if (visibility === "live" && !hasBase && existing?.baseLat == null) {
    return NextResponse.json(
      { error: "Pick your city first — live sharing falls back to it when you close the app." },
      { status: 400 }
    );
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
      phone: phone || null,
      phoneVisibility,
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
      // Same rule as the alert preferences below: the full-page editor has
      // no custom-entry controls, and a save from there must not wipe
      // phrases somebody typed into the map panel.
      ...("customLookingFor" in (body ?? {}) ? { customLookingFor } : {}),
      ...("customCanHelpWith" in (body ?? {}) ? { customCanHelpWith } : {}),
      ...("customInterests" in (body ?? {}) ? { customInterests } : {}),
      // Only written when the client actually sent them, so a save from a
      // surface that doesn't show these controls can't silently reset
      // somebody's alert preferences to the defaults.
      ...("notifyConnections" in (body ?? {}) ? { notifyConnections: Boolean(body.notifyConnections) } : {}),
      ...("notifyMatches" in (body ?? {}) ? { notifyMatches: Boolean(body.notifyMatches) } : {}),
      ...("notifyInterests" in (body ?? {}) ? { notifyInterests: Boolean(body.notifyInterests) } : {}),
      ...(ALERT_RADIUS_OPTIONS_KM.includes(Number(body?.notifyRadiusKm))
        ? { notifyRadiusKm: Number(body.notifyRadiusKm) }
        : {}),
      // Locations are only ever set from a geocoded result, so a request
      // with no valid coordinates leaves whatever was there — it never
      // wipes an existing pin to null.
      ...(hasExact ? { lat: exactPoint.lat, lng: exactPoint.lng, locationLabel } : {}),
      ...(hasBase ? { baseLat: basePoint.lat, baseLng: basePoint.lng, baseLabel } : {}),
      visibility,
      publicOptIn,
    })
    .where(eq(users.id, user.id));

  if (!alreadyAccepted) {
    await db.insert(consents).values({
      userId: user.id,
      kind: TERMS_CONSENT_KIND,
      granted: true,
      copyVersion: LEGAL_VERSION,
    });
  }

  /**
   * The public network is a second consent, logged like the first.
   *
   * Appending only on a change is what lets the log answer "when did they
   * agree to this" — a row written on every profile save answers nothing.
   */
  if (publicOptIn !== (existing?.publicOptIn ?? true)) {
    await db.insert(consents).values({
      userId: user.id,
      kind: publicOptIn ? "open_map_on" : "open_map_off",
      granted: publicOptIn,
      copyVersion: CONSENT_COPY_VERSION,
    });
  }

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
