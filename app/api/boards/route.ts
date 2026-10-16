import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { liveBoardBySlug, createBoard, membershipOf } from "@/lib/boards";
import { isActive } from "@/lib/membership";

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Accepts "example.com/x" as readily as the full URL — nobody types the scheme. */
function normalizeUrl(v: unknown, max = 300): string {
  const s = str(v, max);
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/**
 * Create a board.
 *
 * Open to any signed-in member, not just an "organiser" account type —
 * use case four is members creating events, and a separate host role would
 * mean a person who runs one meetup a year needs a different kind of
 * account than the person who attends them. The host of a board is simply
 * whoever made it.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!user.onboarded) {
    return NextResponse.json({ error: "Finish your profile first." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const type = body?.type === "community" ? "community" : "event";
  const name = str(body?.name, 80);
  const blurb = str(body?.blurb, 280);
  const place = str(body?.place, 160);
  const details = str(body?.details, 2000);
  const address = str(body?.address, 240);
  const url = normalizeUrl(body?.url);
  const capRaw = Number(body?.capacity);
  const capacity = Number.isFinite(capRaw) && capRaw > 0 ? Math.min(Math.round(capRaw), 100_000) : null;
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);

  if (name.length < 3) {
    return NextResponse.json({ error: "Give it a name people will recognise." }, { status: 400 });
  }

  // An event needs a time or it can't be placed on a timeline, can't decide
  // whether "here now" is meaningful, and can't expire off the public list.
  let startsAt: Date | null = null;
  let endsAt: Date | null = null;
  if (type === "event") {
    const t = Date.parse(str(body?.startsAt, 40));
    if (!Number.isFinite(t)) {
      return NextResponse.json({ error: "When is it?" }, { status: 400 });
    }
    startsAt = new Date(t);
    const e = Date.parse(str(body?.endsAt, 40));
    endsAt = Number.isFinite(e) ? new Date(e) : null;
    if (endsAt && endsAt <= startsAt) {
      return NextResponse.json({ error: "The end has to come after the start." }, { status: 400 });
    }
  }

  // Nesting an event inside a community is what makes it private to that
  // community — so the caller has to actually be a member of the parent,
  // or anyone could hang an event off someone else's group and inherit its
  // audience.
  let parentBoardId: string | null = null;
  const parentSlug = str(body?.parentSlug, 80);
  if (parentSlug) {
    const parent = await liveBoardBySlug(parentSlug);
    if (!parent || parent.type !== "community") {
      return NextResponse.json({ error: "That community doesn't exist." }, { status: 404 });
    }
    if (!isActive(await membershipOf(parent.id, user.id))) {
      return NextResponse.json({ error: "You're not a member of that community." }, { status: 403 });
    }
    parentBoardId = parent.id;
  }

  const board = await createBoard({
    hostUserId: user.id,
    type,
    name,
    blurb: blurb || null,
    place: place || null,
    details: details || null,
    address: address || null,
    url: url || null,
    capacity,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    startsAt,
    endsAt,
    parentBoardId,
  });

  if (!board) return NextResponse.json({ error: "Couldn't create that board." }, { status: 500 });
  return NextResponse.json({ slug: board.slug });
}
