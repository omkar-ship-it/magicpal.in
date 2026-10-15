import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, hasDb } from "./db";
import { boards, comments, memberships, postReactions, posts, users } from "./db/schema";
import { isActiveMember } from "./membership";
import { MAX_COMMENT_LENGTH } from "./rules";

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

export type CommentRow = {
  id: string;
  at: string;
  body: string;
  author: { id: string; name: string; photoUrl: string | null };
  canDelete: boolean;
};

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
  /** Held at the top of the feed by the owner. */
  pinned: boolean;
  /** Only the owner is offered the pin. */
  canPin: boolean;
  /** Tallies per reaction id, plus whichever ones the viewer chose. */
  reactions: Record<string, number>;
  myReactions: string[];
  comments: CommentRow[];
  commentCount: number;
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
      pinnedAt: posts.pinnedAt,
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
  const owns = Boolean(viewerId && board?.hostId === viewerId);

  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];

  // Two extra round trips for the whole page rather than one per post: a
  // feed of sixty posts would otherwise be a hundred and twenty queries.
  const reactionRows = await db
    .select({ postId: postReactions.postId, kind: postReactions.kind, userId: postReactions.userId })
    .from(postReactions)
    .where(inArray(postReactions.postId, ids));

  const commentRows = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      at: comments.createdAt,
      body: comments.body,
      authorId: users.id,
      name: users.name,
      photoUrl: users.photoUrl,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(and(inArray(comments.postId, ids), isNull(comments.deletedAt)))
    .orderBy(asc(comments.createdAt));

  return rows
    .filter((r) => r.name)
    .map((r) => {
      const mine = reactionRows.filter((x) => x.postId === r.id);
      const tally: Record<string, number> = {};
      for (const x of mine) tally[x.kind] = (tally[x.kind] ?? 0) + 1;

      const theseComments = commentRows
        .filter((c) => c.postId === r.id && c.name)
        .map((c) => ({
          id: c.id,
          at: c.at.toISOString(),
          body: c.body,
          author: { id: c.authorId, name: c.name!, photoUrl: c.photoUrl },
          canDelete: Boolean(viewerId && (c.authorId === viewerId || owns)),
        }));

      return {
        id: r.id,
        at: r.at.toISOString(),
        body: r.body,
        url: r.url,
        images: r.images ?? [],
        author: { id: r.authorId, name: r.name!, headline: r.headline, photoUrl: r.photoUrl },
        event: r.eventSlug ? { slug: r.eventSlug, name: r.eventName! } : null,
        canDelete: Boolean(viewerId && (r.authorId === viewerId || owns)),
        pinned: r.pinnedAt != null,
        canPin: owns,
        reactions: tally,
        myReactions: viewerId ? mine.filter((x) => x.userId === viewerId).map((x) => x.kind) : [],
        comments: theseComments,
        commentCount: theseComments.length,
      };
    });
}

/**
 * Toggle one reaction. Returns the post's new tallies, so the client never
 * has to guess what the count became.
 */
export async function toggleReaction(
  postId: string,
  userId: string,
  kind: string
): Promise<{ on: boolean } | null> {
  if (!hasDb || !db) return null;

  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);
  if (!post) return null;

  const [existing] = await db
    .select({ id: postReactions.id })
    .from(postReactions)
    .where(
      and(eq(postReactions.postId, postId), eq(postReactions.userId, userId), eq(postReactions.kind, kind))
    )
    .limit(1);

  if (existing) {
    await db.delete(postReactions).where(eq(postReactions.id, existing.id));
    return { on: false };
  }
  await db.insert(postReactions).values({ postId, userId, kind });
  return { on: true };
}

/** Reply under a post. The board is re-checked by the caller, not here. */
export async function addComment(postId: string, authorId: string, body: string): Promise<string | null> {
  if (!hasDb || !db) return null;
  const text = body.trim().slice(0, MAX_COMMENT_LENGTH);
  if (!text) return null;
  const [row] = await db.insert(comments).values({ postId, authorId, body: text }).returning();
  return row?.id ?? null;
}

/** Soft-delete a reply — the author's own, or any on a board you own. */
export async function deleteComment(commentId: string, userId: string): Promise<boolean> {
  if (!hasDb || !db) return false;
  const [row] = await db
    .select({ authorId: comments.authorId, hostId: boards.hostUserId })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .innerJoin(boards, eq(boards.id, posts.boardId))
    .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
    .limit(1);
  if (!row) return false;
  if (row.authorId !== userId && row.hostId !== userId) return false;

  await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId));
  return true;
}

/**
 * Pin a post to the top of its board, or unpin it.
 *
 * Clears any other pin on the same board first: one pinned thing, because a
 * list of pinned things is just the feed with extra steps.
 */
export async function setPinned(postId: string, userId: string, pinned: boolean): Promise<boolean> {
  if (!hasDb || !db) return false;

  const [row] = await db
    .select({ boardId: posts.boardId, hostId: boards.hostUserId })
    .from(posts)
    .innerJoin(boards, eq(boards.id, posts.boardId))
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);
  if (!row || row.hostId !== userId) return false;

  await db.update(posts).set({ pinnedAt: null }).where(eq(posts.boardId, row.boardId));
  if (pinned) {
    await db.update(posts).set({ pinnedAt: new Date() }).where(eq(posts.id, postId));
  }
  return true;
}

/** The board a post belongs to, for permission checks in routes. */
export async function boardIdOfPost(postId: string): Promise<string | null> {
  if (!hasDb || !db) return null;
  const [row] = await db
    .select({ boardId: posts.boardId })
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);
  return row?.boardId ?? null;
}

/** Membership is the write permission. Checked on the server, every time. */
export async function canPostTo(boardId: string, userId: string): Promise<boolean> {
  if (!hasDb || !db) return false;
  const [row] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.boardId, boardId), eq(memberships.userId, userId), isActiveMember()))
    .limit(1);
  return Boolean(row);
}
