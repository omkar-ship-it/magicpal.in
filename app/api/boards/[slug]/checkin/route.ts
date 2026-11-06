import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { liveBoardBySlug, membershipOf, setCheckedIn } from "@/lib/boards";
import { isActive } from "@/lib/membership";
import { CHECKIN_OPENS_MINUTES, checkInState } from "@/lib/rules";

/**
 * "I'm here" / "I've left" at an event.
 *
 * Separate from joining, and separate from location visibility, because
 * they are three different promises: joining says you're in this group,
 * visibility says where you may be drawn, and this says you're in the
 * building for the next few hours. Collapsing presence into the location
 * setting would mean checking in at a conference silently opted you onto
 * the public map.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const board = await liveBoardBySlug(slug);
  if (!board) return NextResponse.json({ error: "That board doesn't exist." }, { status: 404 });
  if (board.type !== "event") {
    return NextResponse.json({ error: "Only events have a here-now." }, { status: 400 });
  }
  if (!isActive(await membershipOf(board.id, user.id))) {
    return NextResponse.json({ error: "Join the event first." }, { status: 403 });
  }

  /**
   * Enforced here, not only in the UI.
   *
   * The matcher weights being in the building above any single shared
   * interest, so a check-in made the morning before would mislead every
   * run for the rest of the day — and the people it misleads are the
   * ones who actually turned up. Leaving is always allowed: somebody
   * walking out after the window closed should still be able to say so.
   */
  const body = await req.json().catch(() => null);
  const here = body?.here !== false;
  const state = checkInState(board);
  if (here && state !== "open") {
    return NextResponse.json(
      {
        error:
          state === "early"
            ? `Check-in opens ${CHECKIN_OPENS_MINUTES} minutes before the start.`
            : "This event is over.",
      },
      { status: 409 }
    );
  }
  await setCheckedIn(board.id, user.id, here);
  return NextResponse.json({ ok: true });
}
