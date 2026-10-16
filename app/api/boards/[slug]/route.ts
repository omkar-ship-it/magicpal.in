import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, hasDb } from "@/lib/db";
import { boards } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { archiveBoard, boardById, liveBoardBySlug, membershipOf } from "@/lib/boards";
import { isActive } from "@/lib/membership";
import { getBoardMembers, getProfileById } from "@/lib/profiles";
import { attachVouches } from "@/lib/vouch";

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function normalizeUrl(v: unknown): string {
  const s = str(v, 300);
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/**
 * Edit a board — the host only.
 *
 * Mostly this exists because an event created without a venue is invisible
 * on the map, and until now there was no way to go back and add one: the
 * create form was the only chance anybody got. Details change too — rooms
 * move, times shift, an agenda firms up — and a board you can't correct is
 * one hosts stop trusting.
 *
 * Fields are applied only when present, so a form that submits a subset
 * can't blank the rest.
 */
/**
 * Everything an event page shows that the map payload shouldn't carry.
 *
 * Same split as /api/person: the shell's event list is a dozen events and
 * stays lean, this is one event and can afford the host, the full roster and
 * who has actually turned up. Members only — who else is coming is exactly
 * what a private event is keeping private.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const board = await liveBoardBySlug(slug);
  if (!board) return NextResponse.json({ error: "No such event." }, { status: 404 });

  // Checked before the membership lookup rather than folded into it: an
  // empty string reaching a uuid column is a 500, not a 403, and "who else
  // is coming" must fail closed with the same answer either way.
  const user = await getSessionUser();
  if (!user || !isActive(await membershipOf(board.id, user.id))) {
    return NextResponse.json({ error: "Join first." }, { status: 403 });
  }

  const host = await getProfileById(board.hostUserId);
  const roster = await getBoardMembers(board.id, {});
  const vouched = await attachVouches(roster, user?.id);

  return NextResponse.json({
    host: host?.name
      ? { id: host.id, name: host.name, headline: host.headline, photoUrl: host.photoUrl }
      : null,
    parent: board.parentBoardId
      ? await (async () => {
          const p = await boardById(board.parentBoardId!);
          return p ? { slug: p.slug, name: p.name } : null;
        })()
      : null,
    attendees: vouched
      // Whoever said yes first, then everyone else — the page answers "who
      // will actually be in the room", not "who is on a list".
      .sort((a, b) => Number(Boolean(b.hereNow)) - Number(Boolean(a.hereNow)))
      .map((m) => ({
        id: m.id,
        name: m.name,
        headline: m.headline,
        photoUrl: m.photoUrl,
        hereNow: Boolean(m.hereNow),
        verified: Boolean(m.verified),
        isHost: m.id === board.hostUserId,
      })),
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!hasDb || !db) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const { slug } = await ctx.params;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const board = await liveBoardBySlug(slug);
  if (!board) return NextResponse.json({ error: "No such board." }, { status: 404 });
  // The host, and nobody else. A member editing the room's address would be
  // indistinguishable from a member moving the event.
  if (board.hostUserId !== user.id) {
    return NextResponse.json({ error: "Only the host can edit this." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim().length >= 3) patch.name = str(body.name, 80);
  if ("blurb" in body) patch.blurb = str(body.blurb, 280) || null;
  if ("details" in body) patch.details = str(body.details, 2000) || null;
  if ("guidelines" in body) patch.guidelines = str(body.guidelines, 2000) || null;
  if ("address" in body) patch.address = str(body.address, 240) || null;
  if ("url" in body) patch.url = normalizeUrl(body.url) || null;
  if ("place" in body) patch.place = str(body.place, 160) || null;

  if ("capacity" in body) {
    const n = Number(body.capacity);
    patch.capacity = Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 100_000) : null;
  }

  // Coordinates move together or not at all — half a pin is a pin in the
  // Atlantic.
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    patch.lat = lat;
    patch.lng = lng;
  }

  if (board.type === "event") {
    if (typeof body.startsAt === "string") {
      const t = Date.parse(body.startsAt);
      if (Number.isFinite(t)) patch.startsAt = new Date(t);
    }
    if ("endsAt" in body) {
      const t = Date.parse(str(body.endsAt, 40));
      patch.endsAt = Number.isFinite(t) ? new Date(t) : null;
    }
    const starts = (patch.startsAt as Date) ?? board.startsAt;
    const ends = (patch.endsAt as Date | null) ?? board.endsAt;
    if (starts && ends && ends <= starts) {
      return NextResponse.json({ error: "The end has to come after the start." }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  await db.update(boards).set(patch).where(eq(boards.id, board.id));
  return NextResponse.json({ ok: true });
}

/**
 * Take an event down.
 *
 * Events only, and only the host. A community is a different decision —
 * it has members who joined it, events hanging off it and a feed that is
 * other people's words, and none of that should go because one person
 * tapped delete. That needs its own flow and isn't built.
 *
 * Archive, not drop: see `archiveBoard`. Everything underneath survives,
 * reads just stop returning it.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const board = await liveBoardBySlug(slug);
  if (!board) return NextResponse.json({ error: "No such event." }, { status: 404 });

  if (board.type !== "event") {
    return NextResponse.json({ error: "Communities can't be deleted here." }, { status: 400 });
  }
  // One 403 whether they're not the host or it isn't theirs at all.
  if (board.hostUserId !== user.id) {
    return NextResponse.json({ error: "Only the host can delete this event." }, { status: 403 });
  }

  const ok = await archiveBoard(board.id, user.id);
  if (!ok) return NextResponse.json({ error: "Couldn't delete that." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
