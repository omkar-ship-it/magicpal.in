import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { boardBySlug, joinBoard } from "@/lib/boards";

/**
 * Join the board behind a scanned QR or a pasted link.
 *
 * Knowing the slug is the authorisation. That is a deliberate choice and
 * the reason the slug carries a random salt: the host's security model is
 * "I decided who to show this to", which is exactly how a WhatsApp invite
 * link already works, and anything stricter would mean an approval queue
 * between scanning a code and seeing the room — in a venue, that queue is
 * the end of the product.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const board = await boardBySlug(slug);
  if (!board || board.archivedAt) {
    return NextResponse.json({ error: "That board doesn't exist." }, { status: 404 });
  }

  await joinBoard(board.id, user.id);
  return NextResponse.json({ ok: true, slug: board.slug });
}
