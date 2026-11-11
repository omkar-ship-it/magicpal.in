import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { validPoint } from "@/lib/geo";
import { jobsFor, postJob } from "@/lib/jobs";
import {
  DEFAULT_JOB_DAYS,
  JOB_DURATION_DAYS,
  JOB_MODE_IDS,
  MAX_JOB_BLURB,
  MAX_JOB_COMPANY,
  MAX_JOB_TITLE,
  jobIsPlaced,
} from "@/lib/rules";

/**
 * Live roles.
 *
 * Open to signed-out visitors, unlike pins — a job advert is published
 * deliberately and is not anybody's live whereabouts. It is also one of
 * the better reasons a stranger has to sign up, and hiding it from them
 * would be hiding the pitch.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  const url = new URL(req.url);
  // Absent means "no centre to measure from", which is not a centre at
  // 0,0 — and `Number(null)` is 0. See lib/geo.
  const centre = validPoint(url.searchParams.get("lat"), url.searchParams.get("lng"));

  return NextResponse.json(
    await jobsFor({
      viewerId: user?.id,
      centerLat: centre?.lat,
      centerLng: centre?.lng,
    })
  );
}

/**
 * Only http(s), and only something that parses.
 *
 * A link is the one field here that sends a reader somewhere else, so a
 * `javascript:` URL in it would be a stored redirect out of the product
 * into whatever the poster wanted. Rejected rather than sanitised: there
 * is no partially-valid apply link worth rescuing.
 */
function cleanUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const text = raw.trim();
  try {
    const u = new URL(text.startsWith("http") ? text : `https://${text}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString().slice(0, 500);
  } catch {
    return null;
  }
}

/**
 * Post a role.
 *
 * Requires a finished profile for the same reason dropping a pin does,
 * and more sharply: the person reading is being asked to consider their
 * livelihood, and an advert from an account with no name on it is the
 * raw material of every scam board there has ever been.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!user.onboarded) {
    return NextResponse.json(
      { error: "Finish your profile first — people need to know who they'd be applying to." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, MAX_JOB_TITLE) : "";
  const company = typeof body?.company === "string" ? body.company.trim().slice(0, MAX_JOB_COMPANY) : "";
  const blurb = typeof body?.blurb === "string" ? body.blurb.trim().slice(0, MAX_JOB_BLURB) : "";
  const workMode = JOB_MODE_IDS.includes(body?.workMode) ? (body.workMode as string) : "onsite";
  const point = validPoint(body?.lat, body?.lng);
  const days = JOB_DURATION_DAYS.includes(Number(body?.days)) ? Number(body.days) : DEFAULT_JOB_DAYS;
  const rawUrl = typeof body?.applyUrl === "string" ? body.applyUrl.trim() : "";
  const applyUrl = cleanUrl(rawUrl);

  if (!title) return NextResponse.json({ error: "What's the role?" }, { status: 400 });
  if (!company) return NextResponse.json({ error: "Who's hiring?" }, { status: 400 });
  // Said rather than swallowed. Dropping an unusable link silently is fine
  // for the `javascript:` case and unkind for the far commoner one — a
  // typo — where the poster would never learn the link didn't save.
  if (rawUrl && !applyUrl) {
    return NextResponse.json(
      { error: "That link doesn't look right. Leave it empty if there's nowhere to apply." },
      { status: 400 }
    );
  }
  // The one error worth being specific about: a placed role with no place
  // saves as an advert nobody can find, which is this feature's only real
  // failure mode.
  if (jobIsPlaced(workMode) && !point) {
    return NextResponse.json(
      { error: "Pick where the work happens — or set it to Remote." },
      { status: 400 }
    );
  }

  const id = await postJob({
    userId: user.id,
    title,
    company,
    blurb: blurb || null,
    workMode,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    placeLabel: typeof body?.placeLabel === "string" ? body.placeLabel.slice(0, 160) : null,
    applyUrl,
    days,
  });
  if (!id) return NextResponse.json({ error: "Couldn't post that." }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}
