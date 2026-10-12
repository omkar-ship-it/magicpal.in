import { notFound, redirect } from "next/navigation";
import { boardBySlug, joinBoard, membershipOf } from "@/lib/boards";
import { getSessionUser } from "@/lib/session";

/**
 * Where every QR code points.
 *
 * It does the whole arrival in one hop — sign in if needed, join, go to the
 * board — because the person doing this is standing in a room holding a
 * phone, and each extra screen between the camera and the faces is a
 * fraction of the room that gives up. The board's own URL (`/b/[slug]`) is
 * the shareable, re-visitable address; this one is the doormat.
 *
 * Joining on a GET is deliberate. It is a side effect on a navigation,
 * which is normally worth avoiding, but the alternative is a "Confirm
 * join" button whose only possible answer is yes — and it's reachable
 * only by an authenticated session that already knows the salted slug.
 */
export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await boardBySlug(slug);
  if (!board || board.archivedAt) notFound();

  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${slug}`)}`);
  }

  if (!(await membershipOf(board.id, user.id))) {
    await joinBoard(board.id, user.id);
  }

  // A profile with no stated intent can be listed but not matched, and the
  // recommendations are the reason anybody scanned the code. Membership is
  // already saved above, so this detour can't lose them the board.
  if (!user.onboarded) {
    redirect(`/you?next=${encodeURIComponent(`/b/${slug}`)}&joined=${encodeURIComponent(board.name)}`);
  }

  redirect(`/b/${slug}`);
}
