import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db, hasDb } from "./db";
import { boards, memberships } from "./db/schema";
import { isActiveMember, MEMBER_ACTIVE, MEMBER_LEFT, MEMBER_REMOVED } from "./membership";

export type BoardType = "event" | "community";

export type Board = typeof boards.$inferSelect;

/**
 * The board's address, and the only thing a host has to communicate.
 *
 * It goes on a slide as a QR code and into a WhatsApp group as a link, so
 * it has to survive being read aloud, retyped, and screenshotted: short,
 * lowercase, no ambiguous characters. The four-character salt is what stops
 * it being guessable — a sequential id would let anyone walk the whole list
 * of private boards, and "who is in the room" is exactly the thing a
 * private board is keeping private.
 */
export function makeSlug(name: string): string {
  const stem = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 18)
    // Trimmed *after* the slice: cutting at eighteen characters often lands
    // mid-word and leaves a trailing hyphen, which reads as a typo in a URL
    // somebody is being asked to trust.
    .replace(/^-+|-+$/g, "");
  // No 0/o/1/l/i — this gets read off a projector and retyped on a phone.
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  let salt = "";
  for (let i = 0; i < 4; i++) salt += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${stem || "board"}-${salt}`;
}

export async function createBoard(input: {
  hostUserId: string;
  type: BoardType;
  name: string;
  blurb?: string | null;
  place?: string | null;
  lat?: number | null;
  lng?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  parentBoardId?: string | null;
  details?: string | null;
  address?: string | null;
  url?: string | null;
  capacity?: number | null;
}): Promise<Board | null> {
  if (!hasDb || !db) return null;

  // Retry on the vanishingly unlikely slug collision rather than trusting
  // 31^4 to never repeat — the unique index is the authority, and a second
  // attempt costs nothing compared to handing a host a 500.
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = makeSlug(input.name);
    try {
      const [row] = await db
        .insert(boards)
        .values({
          slug,
          type: input.type,
          name: input.name,
          blurb: input.blurb ?? null,
          place: input.place ?? null,
          details: input.details ?? null,
          address: input.address ?? null,
          url: input.url ?? null,
          capacity: input.capacity ?? null,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          startsAt: input.type === "event" ? (input.startsAt ?? new Date()) : null,
          endsAt: input.type === "event" ? (input.endsAt ?? null) : null,
          parentBoardId: input.parentBoardId ?? null,
          hostUserId: input.hostUserId,
        })
        .returning();

      // The host is a member of their own board. Without this they'd be
      // absent from the map they're standing in, and — worse — unmatchable
      // to the people they invited.
      await db
        .insert(memberships)
        .values({
          boardId: row.id,
          userId: input.hostUserId,
          role: "host",
          status: MEMBER_ACTIVE,
          statusAt: new Date(),
        })
        .onConflictDoNothing();

      return row;
    } catch (err) {
      const message = String((err as Error)?.message ?? "");
      if (!message.includes("boards_slug")) throw err;
    }
  }
  return null;
}

/**
 * The raw row, archived or not.
 *
 * Almost nothing wants this. "Does this board exist" and "is this board
 * still running" are different questions, and every caller that means the
 * second must use `liveBoardBySlug` — see the note there.
 */
export async function boardBySlug(slug: string): Promise<Board | null> {
  if (!hasDb || !db) return null;
  const [row] = await db.select().from(boards).where(eq(boards.slug, slug)).limit(1);
  return row ?? null;
}

/**
 * A board you may still act on, defined once.
 *
 * Archiving already removed boards from every *list* — the switcher, the
 * open map, a community's own events — but five paths resolved a board
 * straight from its slug and never asked, so a taken-down event stayed
 * reachable by anyone holding its link: its feed, its RSVP, its check-in.
 * Lists are the easy half; the by-slug paths are where this leaks.
 *
 * Same discipline as `isActiveMember` in lib/membership: one definition,
 * and nothing spells it out inline.
 */
export async function liveBoardBySlug(slug: string): Promise<Board | null> {
  const row = await boardBySlug(slug);
  return row && !row.archivedAt ? row : null;
}

/**
 * Take an event down.
 *
 * Archived, never deleted. The rows underneath — who said they were
 * coming, what was said in the discussion — are a record of something that
 * really happened, and a cascade would erase other people's words along
 * with the host's mistake. Reads simply stop returning it.
 */
export async function archiveBoard(boardId: string, userId: string): Promise<boolean> {
  if (!hasDb || !db) return false;
  const board = await boardById(boardId);
  if (!board || board.archivedAt) return false;
  // The host, and only the host — the person who made the promise is the
  // one who gets to withdraw it.
  if (board.hostUserId !== userId) return false;

  await db.update(boards).set({ archivedAt: new Date() }).where(eq(boards.id, boardId));
  return true;
}

export async function boardById(id: string): Promise<Board | null> {
  if (!hasDb || !db) return null;
  const [row] = await db.select().from(boards).where(eq(boards.id, id)).limit(1);
  return row ?? null;
}

/**
 * Join, or walk back in after leaving.
 *
 * Idempotent on purpose: the join link gets opened repeatedly — scanned
 * twice, reopened from WhatsApp, revisited after signing in — and every one
 * of those is the same person arriving, not a new member.
 *
 * Returns false for somebody the owner removed. Without that check the
 * invite link — which is still sitting in the group chat they were removed
 * from — would undo the removal on the next tap, and "remove" would mean
 * nothing at all. Rejoining after you *left* is fine and deliberately
 * frictionless: that was your own decision, not a judgement.
 */
export async function joinBoard(boardId: string, userId: string): Promise<boolean> {
  if (!hasDb || !db) return false;

  const existing = await membershipOf(boardId, userId);
  if (existing?.status === MEMBER_REMOVED) return false;
  if (existing) {
    if (existing.status !== MEMBER_ACTIVE) {
      await db
        .update(memberships)
        .set({ status: MEMBER_ACTIVE, statusAt: new Date() })
        .where(eq(memberships.id, existing.id));
    }
    return true;
  }

  await db
    .insert(memberships)
    .values({ boardId, userId, role: "member", status: MEMBER_ACTIVE, statusAt: new Date() })
    .onConflictDoNothing();
  return true;
}

/**
 * Leave, or be removed — the same tombstone, different authorship.
 *
 * The owner can't leave their own community: there would be nobody left
 * who can verify anyone or take a post down, and an ownerless group is
 * worse than a closed one. Transferring first is the honest path, and it
 * isn't built yet, so this refuses rather than orphaning the board.
 */
export async function setMemberStatus(
  boardId: string,
  userId: string,
  status: typeof MEMBER_LEFT | typeof MEMBER_REMOVED
): Promise<boolean> {
  if (!hasDb || !db) return false;
  const board = await boardById(boardId);
  if (!board || board.hostUserId === userId) return false;

  const row = await membershipOf(boardId, userId);
  if (!row) return false;

  await db
    .update(memberships)
    .set({
      status,
      statusAt: new Date(),
      // A removal also drops the vouch. Keeping a verified badge on
      // somebody the owner just threw out would be the badge lying.
      ...(status === MEMBER_REMOVED ? { verifiedAt: null, verifiedBy: null } : {}),
      checkedInAt: null,
      rsvp: null,
    })
    .where(eq(memberships.id, row.id));
  return true;
}

/** The owner vouching for a member, or taking the vouch back. */
export async function setMemberVerified(
  boardId: string,
  userId: string,
  by: string,
  verified: boolean
): Promise<boolean> {
  if (!hasDb || !db) return false;
  const row = await membershipOf(boardId, userId);
  if (!row || row.status !== MEMBER_ACTIVE) return false;

  await db
    .update(memberships)
    .set(verified ? { verifiedAt: new Date(), verifiedBy: by } : { verifiedAt: null, verifiedBy: null })
    .where(eq(memberships.id, row.id));
  return true;
}

/**
 * The raw row, whatever its status — callers that mean "is a member" must
 * test it with `isActive`, because a removed person still has a row here.
 */
export async function membershipOf(boardId: string, userId: string) {
  if (!hasDb || !db) return null;
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.boardId, boardId), eq(memberships.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Say "I'm here" at an event.
 *
 * A timestamp rather than a boolean, so it expires on its own. Nobody ever
 * taps "I've left" — they walk out — and a flag that only a user action can
 * clear would leave an event showing a full room three days later.
 */
export async function setCheckedIn(boardId: string, userId: string, here: boolean): Promise<void> {
  if (!hasDb || !db) return;
  await db
    .update(memberships)
    .set({ checkedInAt: here ? new Date() : null })
    .where(and(eq(memberships.boardId, boardId), eq(memberships.userId, userId)));
}

/** Boards this person is on, hosted ones first, then soonest or newest. */
export async function boardsForUser(userId: string): Promise<Array<Board & { role: string; memberCount: number }>> {
  if (!hasDb || !db) return [];
  const rows = await db
    .select({
      board: boards,
      role: memberships.role,
      memberCount: sql<number>`(select count(*) from ${memberships} m where m.board_id = ${boards.id} and m.status = '${sql.raw(MEMBER_ACTIVE)}')::int`,
    })
    .from(memberships)
    .innerJoin(boards, eq(boards.id, memberships.boardId))
    .where(and(eq(memberships.userId, userId), isActiveMember(), isNull(boards.archivedAt)))
    .orderBy(desc(memberships.role), desc(boards.createdAt));
  return rows.map((r) => ({ ...r.board, role: r.role, memberCount: r.memberCount }));
}

/** Set or change somebody's answer to an event. */
export async function setRsvp(boardId: string, userId: string, rsvp: string): Promise<void> {
  if (!hasDb || !db) return;
  await db
    .update(memberships)
    .set({ rsvp, rsvpAt: new Date() })
    .where(and(eq(memberships.boardId, boardId), eq(memberships.userId, userId)));
}

/** going / maybe counts for an event, plus the viewer's own answer. */
export async function rsvpSummary(
  boardId: string,
  userId?: string
): Promise<{ going: number; maybe: number; mine: string | null }> {
  if (!hasDb || !db) return { going: 0, maybe: 0, mine: null };
  const rows = await db
    .select({ rsvp: memberships.rsvp, userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.boardId, boardId), isActiveMember()));
  return {
    going: rows.filter((r) => r.rsvp === "going").length,
    maybe: rows.filter((r) => r.rsvp === "maybe").length,
    mine: rows.find((r) => r.userId === userId)?.rsvp ?? null,
  };
}

/**
 * Communities both people belong to.
 *
 * The most useful line on a stranger's profile: "you're both in RGUKT
 * Alumni" does more to explain why you should talk than any amount of
 * stated intent, because somebody already vouched for both of you.
 */
export async function sharedBoardsBetween(
  aId: string,
  bId: string
): Promise<Array<{ slug: string; name: string; type: string; verified: boolean }>> {
  if (!hasDb || !db) return [];
  const rows = await db
    .select({
      slug: boards.slug,
      name: boards.name,
      type: boards.type,
      // Whether *b* — the person being looked at — is vouched for by this
      // board. Verification is a claim a particular community makes, never
      // a global fact about somebody, so it travels attached to the board
      // that made it and the profile can name who is doing the vouching.
      verified: sql<boolean>`exists (
        select 1 from ${memberships} m3
         where m3.board_id = ${boards.id} and m3.user_id = ${bId}
           and m3.status = '${sql.raw(MEMBER_ACTIVE)}' and m3.verified_at is not null
      )`,
    })
    .from(memberships)
    .innerJoin(boards, eq(boards.id, memberships.boardId))
    .where(
      and(
        eq(memberships.userId, aId),
        isActiveMember(),
        isNull(boards.archivedAt),
        sql`exists (select 1 from ${memberships} m2 where m2.board_id = ${boards.id} and m2.user_id = ${bId} and m2.status = '${sql.raw(MEMBER_ACTIVE)}')`
      )
    );
  return rows;
}

export async function memberCount(boardId: string): Promise<number> {
  if (!hasDb || !db) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(memberships)
    .where(and(eq(memberships.boardId, boardId), isActiveMember()));
  return row?.n ?? 0;
}

/** Events inside a community, plus the community's own child events. */
export async function childEvents(parentBoardId: string): Promise<Board[]> {
  if (!hasDb || !db) return [];
  return db
    .select()
    .from(boards)
    .where(and(eq(boards.parentBoardId, parentBoardId), eq(boards.type, "event"), isNull(boards.archivedAt)))
    .orderBy(boards.startsAt);
}

/**
 * Events anyone can see on the open map.
 *
 * Only events with no parent: an event inside a community belongs to that
 * community's members, and surfacing it publicly would quietly leak a
 * private group's calendar onto the public map.
 */
export async function publicEvents(): Promise<Board[]> {
  if (!hasDb || !db) return [];
  return db
    .select()
    .from(boards)
    .where(
      and(
        eq(boards.type, "event"),
        isNull(boards.parentBoardId),
        isNull(boards.archivedAt),
        or(isNull(boards.endsAt), sql`${boards.endsAt} > now()`)
      )
    )
    .orderBy(boards.startsAt);
}

/** True while an event is worth showing "here now" for — the day of, either side. */
export function isLive(board: Board): boolean {
  if (board.type !== "event" || !board.startsAt) return false;
  const now = Date.now();
  const start = board.startsAt.getTime();
  const end = board.endsAt?.getTime() ?? start + 6 * 3600_000;
  return now > start - 2 * 3600_000 && now < end + 2 * 3600_000;
}
