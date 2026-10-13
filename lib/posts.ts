import { and, desc, eq, isNull } from "drizzle-orm";
import { db, hasDb } from "./db";
import { boards, memberships, posts, users } from "./db/schema";

/**
 * Posting to a community's feed.
 *
 * Any member may post — this is a group talking to itself, not a notice
 * board. Membership is re-checked on every write rather than trusted from
 * the client, because knowing a slug is enough to *see* a board you've
 * joined and must never be enough to write to one you haven't.
 *
 * Removal is a soft delete, available to the author and to the board's
 * host. A wall where strangers meet and nothing can ever be taken down is a
 * liability, and the host is the only person placed to act on it.
 */

export type PostInput = {
  boardId: string;
  authorId: string;
  body: string;
  url?: string | null;
  eventBoardId?: string | null;
  images?: string[];
};

export async function createPost(input: PostInput): Promise<string | null> {
  if (!hasDb || !db) return null;
  const [row] = await db
    .insert(posts)
    .values({
      boardId: input.boardId,
      authorId: input.authorId,
      body: input.body,
      url: input.url ?? null,
      eventBoardId: input.eventBoardId ?? null,
      images: input.images ?? [],
    })
    .returning();
  return row?.id ?? null;
}

/**
 * Soft-delete, if this person is allowed to.
 *
 * Returns false rather than throwing when they aren't, so the route can
 * answer 403 without distinguishing "not yours" from "doesn't exist" —
 * which would confirm a post exists on a board the caller can't see.
 */
export async function deletePost(postId: string, userId: string): Promise<boolean> {
  if (!hasDb || !db) return false;

  const [row] = await db
    .select({ authorId: posts.authorId, boardId: posts.boardId, hostId: boards.hostUserId })
    .from(posts)
    .innerJoin(boards, eq(boards.id, posts.boardId))
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);
  if (!row) return false;
  if (row.authorId !== userId && row.hostId !== userId) return false;

  await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, postId));
  return true;
}

export type PostRow = {
  id: string;
  at: string;
  body: string;
  url: string | null;
  images: string[];
  author: { id: string; name: string; headline: string | null; photoUrl: string | null };
  event: { slug: string; name: string } | null;
  /** Whether the viewer may remove it — their own, or their board. */
  canDelete: boolean;
};

export async function postsFor(boardId: string, viewerId?: string): Promise<PostRow[]> {
  if (!hasDb || !db) return [];

  const rows = await db
    .select({
      id: posts.id,
      at: posts.createdAt,
      body: posts.body,
      url: posts.url,
      images: posts.images,
      authorId: users.id,
      name: users.name,
      headline: users.headline,
      photoUrl: users.photoUrl,
      eventSlug: boards.slug,
      eventName: boards.name,
      hostId: boards.hostUserId,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    // The attached event, when there is one. Left join: most posts are just
    // something somebody said.
    .leftJoin(boards, eq(boards.id, posts.eventBoardId))
    .where(and(eq(posts.boardId, boardId), isNull(posts.deletedAt)))
    .orderBy(desc(posts.createdAt))
    .limit(60);

  // The host of the *board being read*, not of the attached event.
  const [board] = await db
    .select({ hostId: boards.hostUserId })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);

  return rows
    .filter((r) => r.name)
    .map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      body: r.body,
      url: r.url,
      images: r.images ?? [],
      author: { id: r.authorId, name: r.name!, headline: r.headline, photoUrl: r.photoUrl },
      event: r.eventSlug ? { slug: r.eventSlug, name: r.eventName! } : null,
      canDelete: Boolean(viewerId && (r.authorId === viewerId || board?.hostId === viewerId)),
    }));
}

/** Membership is the write permission. Checked on the server, every time. */
export async function canPostTo(boardId: string, userId: string): Promise<boolean> {
  if (!hasDb || !db) return false;
  const [row] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.boardId, boardId), eq(memberships.userId, userId)))
    .limit(1);
  return Boolean(row);
}
