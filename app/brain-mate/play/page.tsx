import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { hasAcceptedTerms } from "@/lib/profiles";
import { crowdStats, getBrainMate, getLink, stateOf } from "@/lib/brainMate/server";
import Game from "@/components/brainMate/Game";

/** The game itself. Signed-in only — sign-in happens on the landing or the invitation. */
export default async function PlayPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const user = await getSessionUser();
  const { link: slug } = await searchParams;
  if (!user) redirect(slug ? `/brain-mate/${encodeURIComponent(slug)}` : "/brain-mate");

  const [me, stats, accepted, link] = await Promise.all([
    getBrainMate(user.id),
    crowdStats(),
    hasAcceptedTerms(user.id),
    slug ? getLink(slug) : null,
  ]);

  // Only a waiting link that isn't your own carries through the game.
  let linkProp: { slug: string; sender: string } | null = null;
  if (link && link.senderId !== user.id && stateOf(link) === "waiting") {
    const sender = await getBrainMate(link.senderId);
    linkProp = { slug: link.slug, sender: (sender?.displayName ?? "Your friend").split(" ")[0] };
  }

  const defaultName =
    me?.displayName ?? (linkProp && link ? link.recipientName : null) ?? user.name?.split(" ")[0] ?? "";

  return (
    <Game
      defaultName={defaultName}
      needsTerms={!accepted}
      link={linkProp}
      stats={stats.n >= 20 ? stats : null}
      retake={Boolean(me && !me.current)}
    />
  );
}
