import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { liveBoardBySlug } from "@/lib/boards";
import { canPostTo, createPost } from "@/lib/posts";

const MAX_BODY = 2000;
const MAX_IMAGES = 4;

/** Accepts "example.com/x" as readily as the full URL — nobody types the scheme. */
function normalizeUrl(v: unknown): string {
  const s = typeof v === "string" ? v.trim().slice(0, 300) : "";
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/**
 * Post to a community's feed.
 *
 * Membership is the permission, and it's checked here rather than inferred
 * from the client having a slug: knowing a slug is enough to *see* a board
 * you joined, and must never be enough to write to one you didn't.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!user.onboarded) return NextResponse.json({ error: "Finish your profile first." }, { status: 400 });

  const payload = await req.json().catch(() => null);
  const slug = typeof payload?.boardSlug === "string" ? payload.boardSlug : "";
  const body = typeof payload?.body === "string" ? payload.body.trim().slice(0, MAX_BODY) : "";
  const images = Array.isArray(payload?.images)
    ? payload.images
        .filter((u: unknown): u is string => typeof u === "string" && u.startsWith("https://"))
        .slice(0, MAX_IMAGES)
    : [];

  if (!body && images.length === 0) {
    return NextResponse.json({ error: "Say something, or add a picture." }, { status: 400 });
  }

  const board = await liveBoardBySlug(slug);
  if (!board) return NextResponse.json({ error: "No such community." }, { status: 404 });
  if (!(await canPostTo(board.id, user.id))) {
    return NextResponse.json({ error: "Join the community to post." }, { status: 403 });
  }

  // An attached event has to belong to this community, or a post could
  // advertise somebody else's private evening to the wrong group.
  let eventBoardId: string | null = null;
  const eventSlug = typeof payload?.eventSlug === "string" ? payload.eventSlug : "";
  if (eventSlug) {
    const ev = await liveBoardBySlug(eventSlug);
    if (!ev || ev.type !== "event" || (ev.parentBoardId !== board.id && ev.id !== board.id)) {
      return NextResponse.json({ error: "That event isn't in this community." }, { status: 400 });
    }
    eventBoardId = ev.id;
  }

  const id = await createPost({
    boardId: board.id,
    authorId: user.id,
    body,
    url: normalizeUrl(payload?.url) || null,
    eventBoardId,
    images,
  });
  if (!id) return NextResponse.json({ error: "Couldn't post that." }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}
