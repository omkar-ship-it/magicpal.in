import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db, hasDb } from "./db";
import { boards, memberships } from "./db/schema";

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
        .values({ boardId: row.id, userId: input.hostUserId, role: "host" })
        .onConflictDoNothing();

      return row;
    } catch (err) {
      const message = String((err as Error)?.message ?? "");
      if (!message.includes("boards_slug")) throw err;
    }
  }
  return null;
}

export async function boardBySlug(slug: string): Promise<Board | null> {
  if (!hasDb || !db) return null;
  const [row] = await db.select().from(boards).where(eq(boards.slug, slug)).limit(1);
  return row ?? null;
}

export async function boardById(id: string): Promise<Board | null> {
  if (!hasDb || !db) return null;
  const [row] = await db.select().from(boards).where(eq(boards.id, id)).limit(1);
  return row ?? null;
}

/**
 * Join a board, or do nothing if already on it.
 *
 * Idempotent on purpose: the join link gets opened repeatedly — scanned
 * twice, reopened from WhatsApp, revisited after signing in — and every one
 * of those is the same person arriving, not a new member.
 */
export async function joinBoard(boardId: string, userId: string): Promise<void> {
  if (!hasDb || !db) return;
  await db.insert(memberships).values({ boardId, userId, role: "member" }).onConflictDoNothing();
}

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
      memberCount: sql<number>`(select count(*) from ${memberships} m where m.board_id = ${boards.id})::int`,
    })
    .from(memberships)
    .innerJoin(boards, eq(boards.id, memberships.boardId))
    .where(and(eq(memberships.userId, userId), isNull(boards.archivedAt)))
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
    .where(eq(memberships.boardId, boardId));
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
): Promise<Array<{ slug: string; name: string; type: string }>> {
  if (!hasDb || !db) return [];
  const rows = await db
    .select({ slug: boards.slug, name: boards.name, type: boards.type })
    .from(memberships)
    .innerJoin(boards, eq(boards.id, memberships.boardId))
    .where(
      and(
        eq(memberships.userId, aId),
        isNull(boards.archivedAt),
        sql`exists (select 1 from ${memberships} m2 where m2.board_id = ${boards.id} and m2.user_id = ${bId})`
      )
    );
  return rows;
}

export async function memberCount(boardId: string): Promise<number> {
  if (!hasDb || !db) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(memberships)
    .where(eq(memberships.boardId, boardId));
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
