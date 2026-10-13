import { notFound, redirect } from "next/navigation";
import { boardBySlug, joinBoard, membershipOf } from "@/lib/boards";
import { getSessionUser } from "@/lib/session";

/**
 * Where every QR code points.
 *
 * It does the whole arrival in one hop — sign in if needed, join, land on
 * the board — because the person doing this is standing in a room holding a
 * phone, and each extra screen between the camera and the faces is a
 * fraction of the room that gives up.
 *
 * Every branch ends at the map shell, never at another redirecting page.
 * This previously sent signed-out scanners to /login, which sends people
 * back to where they came from — so the two pointed at each other and a QR
 * scan became an infinite redirect. Nothing here may redirect to a route
 * that can redirect back.
 *
 * Joining on a GET is deliberate. It is a side effect on a navigation,
 * normally worth avoiding, but the alternative is a "Confirm join" button
 * whose only possible answer is yes — and it is reachable only by a session
 * that already knows the salted slug.
 */
export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await boardBySlug(slug);
  if (!board || board.archivedAt) notFound();

  const user = await getSessionUser();

  // Signed out: straight to the map with the sign-in overlay open, carrying
  // the board so the shell can finish the join the moment they're in.
  if (!user) {
    redirect(`/?panel=signin&join=${encodeURIComponent(board.slug)}`);
  }

  if (!(await membershipOf(board.id, user.id))) {
    await joinBoard(board.id, user.id);
  }

  // A profile with no stated intent can be listed but not matched, and the
  // recommendations are the reason anybody scanned the code. Membership is
  // already saved above, so this detour can't lose them the board.
  if (!user.onboarded) {
    redirect(`/?net=${encodeURIComponent(board.slug)}&panel=profile`);
  }

  redirect(`/?net=${encodeURIComponent(board.slug)}`);
}
