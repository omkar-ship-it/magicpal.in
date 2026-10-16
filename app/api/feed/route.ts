import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { liveBoardBySlug, membershipOf } from "@/lib/boards";
import { isActive } from "@/lib/membership";
import { feedFor } from "@/lib/feed";

/**
 * Activity, scoped to the current network.
 *
 * A board's feed is checked against membership here rather than filtered in
 * the client: "who joined this community lately" is exactly the kind of
 * thing a private group expects to stay private.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  const net = new URL(req.url).searchParams.get("net");

  let boardId: string | null = null;
  if (net && net !== "open") {
    const board = await liveBoardBySlug(net);
    if (!board) return NextResponse.json({ items: [] });
    if (!user || !isActive(await membershipOf(board.id, user.id))) {
      return NextResponse.json({ error: "Join the board first." }, { status: 403 });
    }
    boardId = board.id;
  }

  return NextResponse.json({ items: await feedFor({ boardId, viewerId: user?.id }) });
}
