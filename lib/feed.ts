import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, hasDb } from "./db";
import { boards, consents, memberships, users } from "./db/schema";
import { isActiveMember } from "./membership";
import { postsFor, type CommentRow } from "./posts";

/**
 * What has actually happened lately, derived rather than recorded.
 *
 * There is no `activity` table. Every item below is read from a timestamp
 * that already exists for another reason — when someone joined a board,
 * when a board was created, when somebody granted location consent — which
 * means the feed cannot drift out of sync with reality and cannot be
 * back-filled with things that did not happen.
 *
 * The prototype's feed looked busy because eighteen hundred invented people
 * generated invented activity. This one is empty until real people do real
 * things, and that is the correct behaviour: a feed that invents motion to
 * look alive is the fastest way to lose the trust the rest of the product
 * is trying to earn.
 */

export type FeedItem = {
  id: string;
  kind: "joined" | "board-created" | "on-the-map" | "post";
  at: string;
  /** Posts only — what somebody actually wrote. */
  post?: {
    id: string;
    body: string;
    url: string | null;
    images: string[];
    event: { slug: string; name: string } | null;
    canDelete: boolean;
    pinned: boolean;
    canPin: boolean;
    reactions: Record<string, number>;
    myReactions: string[];
    comments: CommentRow[];
    commentCount: number;
  };
  /** Who it happened to. Null when the person has since been deleted. */
  person: { id: string; name: string; headline: string | null; photoUrl: string | null } | null;
  /** The board it happened on, for scoped feeds and for context. */
  board: { slug: string; name: string; type: string } | null;
  line: string;
};

const LOOKBACK_DAYS = 30;

/**
 * `boardId` null means the open network: public events and people newly
 * visible on the map. Scoped to a board, it is that board's own arrivals —
 * which is the version a community actually wants, since "who's new" is
 * the question a group of two hundred can't answer about itself.
 */
export async function feedFor(opts: {
  boardId?: string | null;
  viewerId?: string;
  limit?: number;
}): Promise<FeedItem[]> {
  if (!hasDb || !db) return [];
  const limit = opts.limit ?? 30;
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
  const items: FeedItem[] = [];

  // ------------------------------------------------------------- posts
  // What members actually wrote, merged with the derived lines rather than
  // kept on a separate surface: a group's feed is one thing to its members,
  // whatever each line happens to be read from.
  if (opts.boardId) {
    for (const p of await postsFor(opts.boardId, opts.viewerId)) {
      items.push({
        id: `post-${p.id}`,
        kind: "post",
        at: p.at,
        person: p.author,
        board: null,
        line: "posted",
        post: {
          id: p.id,
          body: p.body,
          url: p.url,
          images: p.images,
          event: p.event,
          canDelete: p.canDelete,
          pinned: p.pinned,
          canPin: p.canPin,
          reactions: p.reactions,
          myReactions: p.myReactions,
          comments: p.comments,
          commentCount: p.commentCount,
        },
      });
    }
  }

  // ---------------------------------------------------------- arrivals
  const joinRows = await db
    .select({
      id: memberships.id,
      at: memberships.joinedAt,
      role: memberships.role,
      userId: users.id,
      name: users.name,
      headline: users.headline,
      photoUrl: users.photoUrl,
      slug: boards.slug,
      boardName: boards.name,
      boardType: boards.type,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(boards, eq(boards.id, memberships.boardId))
    .where(
      and(
        gt(memberships.joinedAt, since),
        // Somebody who left or was removed is not news about who's here.
        isActiveMember(),
        isNull(boards.archivedAt),
        opts.boardId ? eq(memberships.boardId, opts.boardId) : undefined,
        // Unscoped, a feed of every join across every board would leak who
        // is in somebody else's private community. Only public events —
        // boards with no parent — surface on the open network.
        opts.boardId ? undefined : and(eq(boards.type, "event"), isNull(boards.parentBoardId))
      )
    )
    .orderBy(desc(memberships.joinedAt))
    .limit(limit);

  for (const r of joinRows) {
    if (!r.name) continue;
    items.push({
      id: `join-${r.id}`,
      kind: "joined",
      at: r.at.toISOString(),
      person: { id: r.userId, name: r.name, headline: r.headline, photoUrl: r.photoUrl },
      board: { slug: r.slug, name: r.boardName, type: r.boardType },
      line: r.role === "host" ? `started ${r.boardName}` : `joined ${r.boardName}`,
    });
  }

  // ------------------------------------------------------- new boards
  if (!opts.boardId) {
    const boardRows = await db
      .select({
        id: boards.id,
        at: boards.createdAt,
        slug: boards.slug,
        name: boards.name,
        type: boards.type,
        userId: users.id,
        personName: users.name,
        headline: users.headline,
        photoUrl: users.photoUrl,
      })
      .from(boards)
      .innerJoin(users, eq(users.id, boards.hostUserId))
      .where(
        and(
          gt(boards.createdAt, since),
          isNull(boards.archivedAt),
          isNull(boards.parentBoardId),
          eq(boards.type, "event")
        )
      )
      .orderBy(desc(boards.createdAt))
      .limit(limit);

    for (const r of boardRows) {
      if (!r.personName) continue;
      items.push({
        id: `board-${r.id}`,
        kind: "board-created",
        at: r.at.toISOString(),
        person: { id: r.userId, name: r.personName, headline: r.headline, photoUrl: r.photoUrl },
        board: { slug: r.slug, name: r.name, type: r.type },
        line: `is hosting ${r.name}`,
      });
    }
  }

  // --------------------------------------------------- newly on the map
  // From the consent log, which is the only honest record of *when* this
  // became true — `users.visibility` only knows the current value.
  if (!opts.boardId) {
    const visRows = await db
      .select({
        id: consents.id,
        at: consents.createdAt,
        kind: consents.kind,
        userId: users.id,
        name: users.name,
        headline: users.headline,
        photoUrl: users.photoUrl,
        visibility: users.visibility,
      })
      .from(consents)
      .innerJoin(users, eq(users.id, consents.userId))
      .where(and(gt(consents.createdAt, since), eq(consents.granted, true)))
      .orderBy(desc(consents.createdAt))
      .limit(limit);

    for (const r of visRows) {
      // Only if they are *still* visible — a feed item pointing at someone
      // who has since gone private would undo the choice they just made.
      if (!r.name || r.visibility === "off") continue;
      items.push({
        id: `vis-${r.id}`,
        kind: "on-the-map",
        at: r.at.toISOString(),
        person: { id: r.userId, name: r.name, headline: r.headline, photoUrl: r.photoUrl },
        board: null,
        line: r.kind === "location_exact" ? "is on the map" : "is showing their city",
      });
    }
  }

  return items
    // Your own arrival isn't news to you, but your own post is — it's the
    // confirmation that it went through.
    .filter((i) => i.kind === "post" || i.person?.id !== opts.viewerId)
    // Newest first, except the pinned post, which floats regardless of age —
    // that is the entire point of pinning it. Applied here rather than in the
    // client so every reader of this feed gets the same order.
    .sort((a, b) => {
      if (Boolean(a.post?.pinned) !== Boolean(b.post?.pinned)) return a.post?.pinned ? -1 : 1;
      return b.at.localeCompare(a.at);
    })
    .slice(0, limit);
}
