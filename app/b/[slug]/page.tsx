import Link from "next/link";
import { notFound } from "next/navigation";
import { boardBySlug, isLive, memberCount, membershipOf } from "@/lib/boards";
import { getBoardMembers, getProfileById, touchActivity } from "@/lib/profiles";
import { getSessionUser } from "@/lib/session";
import { matchesFor } from "@/lib/matching";
import { MATCHES_SHOWN } from "@/lib/rules";
import BoardView from "@/components/BoardViewLoader";
import JoinButton from "@/components/JoinButton";
import { IconLock, IconPeople } from "@/components/Icons";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { slug } = await params;
  const { new: isNew } = await searchParams;
  const board = await boardBySlug(slug);
  if (!board || board.archivedAt) notFound();

  // `type` is a text column with a check constraint, so Postgres guarantees
  // one of these two but the driver can only promise a string.
  const boardType = board.type as "event" | "community";

  const user = await getSessionUser();
  const membership = user ? await membershipOf(board.id, user.id) : null;

  // Non-members see the board exists and how many people are on it — never
  // who they are. That's the line the product sells: a host can share a
  // link publicly without publishing their guest list.
  if (!membership) {
    const count = await memberCount(board.id);
    const host = await getProfileById(board.hostUserId);
    return (
      <div className="mx-auto max-w-lg px-5 py-12">
        <p className="label label-icon m-0">
          {boardType === "event" ? "Event board" : "Community board"}
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
            {user ? (
              <JoinButton slug={board.slug} />
            ) : (
              <Link href={`/login?next=${encodeURIComponent(`/b/${board.slug}`)}`} className="btn btn-primary w-full">
                Sign in to join
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const [members, me] = await Promise.all([
    getBoardMembers(board.id, {
      excludeUserId: user!.id,
      centerLat: board.lat ?? undefined,
      centerLng: board.lng ?? undefined,
    }),
    getProfileById(user!.id),
  ]);
  await touchActivity(user!.id);

  // The same `members` array the list renders, so a recommendation is
  // always somebody the viewer can actually scroll to and open.
  const matches =
    me && me.name
      ? matchesFor(
          { id: me.id, lookingFor: me.lookingFor, canHelpWith: me.canHelpWith },
          members,
          { surface: boardType, limit: MATCHES_SHOWN }
        ).map((m) => ({ id: m.other.id, reason: m.reason, twoWay: m.twoWay }))
      : [];

  const host = await getProfileById(board.hostUserId);

  return (
    <BoardView
      board={{
        slug: board.slug,
        type: boardType,
        name: board.name,
        blurb: board.blurb,
        place: board.place,
        lat: board.lat,
        lng: board.lng,
        startsAt: board.startsAt?.toISOString() ?? null,
        hostName: host?.name ?? "a member",
        live: isLive(board),
      }}
      members={members}
      matches={matches}
      me={{ id: user!.id, onboarded: Boolean(me?.name) }}
      checkedIn={Boolean(membership.checkedInAt)}
      isHost={membership.role === "host"}
      justCreated={isNew === "1"}
    />
  );
}
