import { notFound, redirect } from "next/navigation";
import { liveBoardBySlug, memberCount, membershipOf } from "@/lib/boards";
import { isActive, MEMBER_REMOVED } from "@/lib/membership";
import { getProfileById } from "@/lib/profiles";
import { getSessionUser } from "@/lib/session";
import JoinButton from "@/components/JoinButton";
import { IconLock, IconPeople } from "@/components/Icons";

/**
 * Where a QR code's link lands.
 *
 * A member doesn't get a page here at all — they're sent into the map shell
 * with this board selected in the switcher, because a board is a view of
 * the one app rather than a screen beside it. What's left is the one thing
 * the shell can't show: the landing a *non*-member sees, which proves the
 * board exists and says how many people are on it without naming any of
 * them.
 */
export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await liveBoardBySlug(slug);
  if (!board) notFound();

  const user = await getSessionUser();
  const membership = user ? await membershipOf(board.id, user.id) : null;
  if (isActive(membership)) {
    redirect(`/?net=${encodeURIComponent(board.slug)}`);
  }
  // A removed person still holds the link — it's in the group chat they
  // were removed from. Saying so plainly beats a Join button that 403s.
  const removed = membership?.status === MEMBER_REMOVED;

  const count = await memberCount(board.id);
  const host = await getProfileById(board.hostUserId);

  return (
    <div className="mx-auto max-w-lg px-5 py-12">
      <p className="label label-icon m-0">
        {board.type === "event" ? "Event board" : "Community board"}
      </p>
      <h1 className="text-2xl font-bold leading-tight">{board.name}</h1>
      <p className="mt-1.5 text-[13px] text-[var(--ink-soft)]">
        {board.place ? `${board.place} · ` : ""}
        {board.startsAt
          ? `${board.startsAt.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · `
          : ""}
        Hosted by {host?.name ?? "a member"}
      </p>
      {board.blurb && <p className="mt-3 text-[14px] leading-[1.6]">{board.blurb}</p>}

      <div className="card mt-6 p-5">
        <p className="flex items-center gap-2 text-[13.5px] font-semibold">
          <IconPeople size={14} /> {count} {count === 1 ? "person is" : "people are"} on this board
        </p>
        <p className="mt-1.5 flex items-start gap-2 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
          <IconLock size={13} className="mt-0.5 flex-none" />
          Who they are is only visible to members. Join and you&rsquo;ll see the room, plus the few people worth
          finding in it.
        </p>

        <div className="mt-4">
          {removed ? (
            <p className="text-[13px] leading-[1.5] font-medium" style={{ color: "var(--warn)" }}>
              You&rsquo;re no longer a member of this community. Ask whoever runs it if you think that&rsquo;s a
              mistake.
            </p>
          ) : user ? (
            <JoinButton slug={board.slug} />
          ) : (
            // Straight to /join, which signs them in and joins in one hop —
            // the whole arrival, for somebody standing in a room with a phone.
            <a href={`/join/${board.slug}`} className="btn btn-primary w-full">
              Sign in to join
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
