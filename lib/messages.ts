import { and, asc, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db, hasDb } from "./db";
import { connections, messages, users } from "./db/schema";

/**
 * Messages, scoped to an accepted connection and nothing else.
 *
 * There is no "message anyone" path here on purpose. A map that shows you
 * where people are, plus an open inbox, is a harassment vector with extra
 * steps — so the connection request (with its one optional note) is the
 * only way to reach a stranger, and the thread opens only once they said
 * yes. Every function below re-checks membership of the connection rather
 * than trusting the caller to have checked.
 */

export type Thread = {
  connectionId: string;
  other: { id: string; name: string; headline: string | null; photoUrl: string | null };
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
  /** Pending requests show as threads too, so an unanswered ask isn't invisible. */
  status: string;
  /** True when the pending request is waiting on *you*. */
  awaitingYou: boolean;
};

/** The connection row, but only if this person is actually in it. */
async function connectionFor(connectionId: string, userId: string) {
  if (!hasDb || !db) return null;
  const [row] = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.id, connectionId),
        or(eq(connections.userAId, userId), eq(connections.userBId, userId))
      )
    )
    .limit(1);
  return row ?? null;
}

/**
 * Every conversation this person has, newest first.
 *
 * Pending requests are included rather than hidden in a separate
 * "requests" screen: the thing a person wants to know when they open Chats
 * is "who is waiting on me", and splitting that across two surfaces is how
 * requests go unanswered for a week.
 */
export async function listThreads(userId: string): Promise<Thread[]> {
  if (!hasDb || !db) return [];

  const rows = await db
    .select({
      id: connections.id,
      status: connections.status,
      requesterId: connections.requesterId,
      requestNote: connections.requestNote,
      createdAt: connections.createdAt,
      aId: connections.userAId,
      bId: connections.userBId,
    })
    .from(connections)
    .where(
      and(
        or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
        ne(connections.status, "declined")
      )
    );

  if (rows.length === 0) return [];

  const otherIds = rows.map((r) => (r.aId === userId ? r.bId : r.aId));
  const people = await db
    .select({ id: users.id, name: users.name, headline: users.headline, photoUrl: users.photoUrl })
    .from(users)
    .where(sql`${users.id} in ${otherIds}`);
  const byId = new Map(people.map((p) => [p.id, p]));

  const threads: Thread[] = [];
  for (const r of rows) {
    const otherId = r.aId === userId ? r.bId : r.aId;
    const person = byId.get(otherId);
    if (!person?.name) continue;

    const [last] = await db
      .select({ body: messages.body, createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.connectionId, r.id))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(eq(messages.connectionId, r.id), ne(messages.senderId, userId), isNull(messages.readAt))
      );

    threads.push({
      connectionId: r.id,
      other: { id: person.id, name: person.name, headline: person.headline, photoUrl: person.photoUrl },
      // A pending request shows its note as the preview — it is the one
      // thing the other person actually said.
      lastMessage: last?.body ?? (r.status === "pending" ? r.requestNote : null),
      lastAt: (last?.createdAt ?? r.createdAt).toISOString(),
      unread: n,
      status: r.status,
      awaitingYou: r.status === "pending" && r.requesterId !== userId,
    });
  }

  // Anything waiting on you floats to the top regardless of age — that is
  // the whole reason to open this surface.
  return threads.sort((a, b) => {
    if (a.awaitingYou !== b.awaitingYou) return a.awaitingYou ? -1 : 1;
    return (b.lastAt ?? "").localeCompare(a.lastAt ?? "");
  });
}

export type Message = {
  id: string;
  mine: boolean;
  body: string;
  createdAt: string;
};

export async function listMessages(connectionId: string, userId: string): Promise<Message[] | null> {
  const conn = await connectionFor(connectionId, userId);
  if (!conn || !db) return null;

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.connectionId, connectionId))
    .orderBy(asc(messages.createdAt));

  // Opening the thread is reading it.
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(eq(messages.connectionId, connectionId), ne(messages.senderId, userId), isNull(messages.readAt))
    );

  return rows.map((m) => ({
    id: m.id,
    mine: m.senderId === userId,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function sendMessage(
  connectionId: string,
  userId: string,
  body: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const conn = await connectionFor(connectionId, userId);
  if (!conn || !db) return { ok: false, error: "No such conversation.", status: 404 };
  // Checked here rather than only in the UI: an accepted connection is the
  // entire authorisation model for messaging.
  if (conn.status !== "accepted") {
    return { ok: false, error: "They haven't accepted yet.", status: 403 };
  }
  const text = body.trim().slice(0, 2000);
  if (!text) return { ok: false, error: "Say something.", status: 400 };

  await db.insert(messages).values({ connectionId, senderId: userId, body: text });
  return { ok: true };
}

/** Badged on the dock, so an unanswered request is visible without opening Chats. */
export async function waitingCount(userId: string): Promise<number> {
  if (!hasDb || !db) return 0;

  const [requests] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(connections)
    .where(
      and(
        or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
        eq(connections.status, "pending"),
        ne(connections.requesterId, userId)
      )
    );

  const [unread] = await db
    .select({ n: sql<number>`count(distinct ${messages.connectionId})::int` })
    .from(messages)
    .innerJoin(connections, eq(connections.id, messages.connectionId))
    .where(
      and(
        or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
        ne(messages.senderId, userId),
        isNull(messages.readAt)
      )
    );

  return (requests?.n ?? 0) + (unread?.n ?? 0);
}
