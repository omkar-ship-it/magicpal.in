import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, hasDb } from "@/lib/db";
import { memberships } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { boardBySlug, joinBoard, membershipOf } from "@/lib/boards";

const ANSWERS = ["going", "maybe", "no"] as const;

/**
 * Answer an event invitation.
 *
 * Joining the board happens implicitly if it hasn't yet: somebody tapping
 * "going" has unambiguously asked to be in that room, and making them press
 * join first would be a second button for a decision they already made.
 * Leaving the RSVP at "no" keeps the membership — you can be in a community
 * and skip one of its evenings.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!hasDb || !db) return NextResponse.json({ error: "Not available." }, { status: 503 });
  const { slug } = await ctx.params;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const board = await boardBySlug(slug);
  if (!board || board.archivedAt) return NextResponse.json({ error: "No such event." }, { status: 404 });
  if (board.type !== "event") {
    return NextResponse.json({ error: "Only events take an RSVP." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const answer = ANSWERS.includes(body?.rsvp) ? (body.rsvp as string) : null;
  if (!answer) return NextResponse.json({ error: "Going, maybe, or no." }, { status: 400 });

  if (!(await membershipOf(board.id, user.id))) {
    await joinBoard(board.id, user.id);
  }

  await db
    .update(memberships)
    .set({ rsvp: answer, rsvpAt: new Date() })
    .where(and(eq(memberships.boardId, board.id), eq(memberships.userId, user.id)));

  return NextResponse.json({ ok: true, rsvp: answer });
}
