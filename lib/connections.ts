import { and, desc, eq, or } from "drizzle-orm";
import { db, hasDb } from "./db";
import { connections, messages, users } from "./db/schema";
import { orderedPair } from "./rules";

export type ConnectionWithStatus = {
  id: string;
  status: string;
  requesterId: string;
  otherUserId: string;
  otherName: string | null;
  otherHeadline: string | null;
  otherPhotoUrl: string | null;
  requestNote?: string | null;
  createdAt: Date;
};

/** The single row describing the relationship between two people, if any. */
export async function getConnectionBetween(userId: string, otherId: string) {
  if (!hasDb || !db) return null;
  const [a, b] = orderedPair(userId, otherId);
  const [row] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.userAId, a), eq(connections.userBId, b)))
    .limit(1);
  return row ?? null;
}

/**
 * Open a request. The unique index on the ordered pair is what actually
 * stops a duplicate — `onConflictDoNothing` just turns that into a quiet
 * no-op instead of a thrown constraint error, so "I already asked" and "I'm
 * asking for the first time" both come back looking like success. A note on
 * a request that already exists is silently dropped along with everything
 * else about the duplicate attempt — the first ask is the one that counts.
 */
export async function requestConnection(fromId: string, toId: string, note?: string) {
  if (!hasDb || !db) return null;
  const [a, b] = orderedPair(fromId, toId);
  const [row] = await db
    .insert(connections)
    .values({ userAId: a, userBId: b, requesterId: fromId, status: "pending", requestNote: note || null })
    .onConflictDoNothing()
    .returning();
  return row ?? (await getConnectionBetween(fromId, toId));
}

/**
 * Accepting delivers whatever note came with the request as the first
 * message in the thread — the one place a note is ever shown. This is the
 * entire answer to "can I say something before we're connected": a short
 * note travels with the request, and becomes a real message the instant
 * it's accepted, rather than needing its own separate read/reply surface.
 */
export async function respondToConnection(connectionId: string, userId: string, accept: boolean) {
  if (!hasDb || !db) return null;
  const [row] = await db
    .select()
    .from(connections)
    .where(eq(connections.id, connectionId))
    .limit(1);
  if (!row) return null;
  // Only the person who DIDN'T send it can respond to it.
  if (row.requesterId === userId) return null;
  if (row.userAId !== userId && row.userBId !== userId) return null;
  if (row.status !== "pending") return row;

  const [updated] = await db
    .update(connections)
    .set({ status: accept ? "accepted" : "declined", respondedAt: new Date() })
    .where(eq(connections.id, connectionId))
    .returning();

  if (accept && row.requestNote) {
    await db.insert(messages).values({ connectionId, senderId: row.requesterId, body: row.requestNote });
  }

  return updated;
}

/** Incoming requests waiting on this person's answer. */
export async function listIncomingRequests(userId: string): Promise<ConnectionWithStatus[]> {
  if (!hasDb || !db) return [];
  const rows = await db
    .select({
      id: connections.id,
      status: connections.status,
      requesterId: connections.requesterId,
      userAId: connections.userAId,
      userBId: connections.userBId,
      createdAt: connections.createdAt,
      requestNote: connections.requestNote,
      otherName: users.name,
      otherHeadline: users.headline,
      otherPhotoUrl: users.photoUrl,
    })
    .from(connections)
    .innerJoin(users, eq(users.id, connections.requesterId))
    .where(
      and(
        eq(connections.status, "pending"),
        or(eq(connections.userAId, userId), eq(connections.userBId, userId))
      )
    )
    .orderBy(desc(connections.createdAt));

  return rows
    .filter((r) => r.requesterId !== userId) // incoming only, not what I sent
    .map((r) => ({
      id: r.id,
      status: r.status,
      requesterId: r.requesterId,
      otherUserId: r.requesterId,
      requestNote: r.requestNote,
      otherName: r.otherName,
      otherHeadline: r.otherHeadline,
      otherPhotoUrl: r.otherPhotoUrl,
      createdAt: r.createdAt,
    }));
}

/** Requests I sent that are still waiting on an answer. */
export async function listOutgoingRequests(userId: string): Promise<ConnectionWithStatus[]> {
  if (!hasDb || !db) return [];
  const rows = await db
    .select({
      id: connections.id,
      status: connections.status,
      requesterId: connections.requesterId,
      userAId: connections.userAId,
      userBId: connections.userBId,
      createdAt: connections.createdAt,
    })
    .from(connections)
    .where(and(eq(connections.status, "pending"), eq(connections.requesterId, userId)))
    .orderBy(desc(connections.createdAt));

  const otherIds = rows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));
  if (otherIds.length === 0) return [];
  const others = await db.select().from(users).where(or(...otherIds.map((id) => eq(users.id, id))));
  const byId = new Map(others.map((o) => [o.id, o]));

  return rows.map((r) => {
    const otherId = r.userAId === userId ? r.userBId : r.userAId;
    const other = byId.get(otherId);
    return {
      id: r.id,
      status: r.status,
      requesterId: r.requesterId,
      otherUserId: otherId,
      otherName: other?.name ?? null,
      otherHeadline: other?.headline ?? null,
      otherPhotoUrl: other?.photoUrl ?? null,
      createdAt: r.createdAt,
    };
  });
}

/** People I'm actually connected to. */
export async function listAcceptedConnections(userId: string): Promise<ConnectionWithStatus[]> {
  if (!hasDb || !db) return [];
  const rows = await db
    .select({
      id: connections.id,
      status: connections.status,
      requesterId: connections.requesterId,
      userAId: connections.userAId,
      userBId: connections.userBId,
      createdAt: connections.createdAt,
    })
    .from(connections)
    .where(and(eq(connections.status, "accepted"), or(eq(connections.userAId, userId), eq(connections.userBId, userId))))
    .orderBy(desc(connections.createdAt));

  const otherIds = rows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));
  if (otherIds.length === 0) return [];
  const others = await db.select().from(users).where(or(...otherIds.map((id) => eq(users.id, id))));
  const byId = new Map(others.map((o) => [o.id, o]));

  return rows.map((r) => {
    const otherId = r.userAId === userId ? r.userBId : r.userAId;
    const other = byId.get(otherId);
    return {
      id: r.id,
      status: r.status,
      requesterId: r.requesterId,
      otherUserId: otherId,
      otherName: other?.name ?? null,
      otherHeadline: other?.headline ?? null,
      otherPhotoUrl: other?.photoUrl ?? null,
      createdAt: r.createdAt,
    };
  });
}

export type ConnectionStatusInfo = { status: string; connectionId: string; mine: boolean };

/**
 * Every relationship row touching this person, keyed by the *other*
 * person's id — one query, used to annotate a whole page of profiles with
 * "connected / pending / none" instead of N+1 lookups per pin.
 */
export async function getConnectionStatusMap(userId: string): Promise<Map<string, ConnectionStatusInfo>> {
  if (!hasDb || !db) return new Map();
  const rows = await db
    .select()
    .from(connections)
    .where(or(eq(connections.userAId, userId), eq(connections.userBId, userId)));

  const map = new Map<string, ConnectionStatusInfo>();
  for (const r of rows) {
    const otherId = r.userAId === userId ? r.userBId : r.userAId;
    map.set(otherId, { status: r.status, connectionId: r.id, mine: r.requesterId === userId });
  }
  return map;
}

export type WithConnectionStatus<T> = T & {
  connectionStatus: "connected" | "pending" | "none";
  connectionId: string | null;
  mine: boolean | null;
};

/**
 * Annotates any list of profiles with how each one relates to the caller —
 * shared by /api/nearby and /api/world so "connected" means the same thing,
 * looks the same color, and is computed the same way everywhere the map
 * shows other people, not just in the dedicated network view.
 */
export async function attachConnectionStatus<T extends { id: string }>(
  profiles: T[],
  userId: string | undefined
): Promise<WithConnectionStatus<T>[]> {
  const statusMap = userId ? await getConnectionStatusMap(userId) : new Map<string, ConnectionStatusInfo>();
  return profiles.map((p) => {
    const info = statusMap.get(p.id);
    const connectionStatus = info?.status === "accepted" ? "connected" : info?.status === "pending" ? "pending" : "none";
    return { ...p, connectionStatus, connectionId: info?.connectionId ?? null, mine: info?.mine ?? null };
  });
}

/**
 * Just the ids, for code that needs "do these two know each other" in bulk.
 *
 * `listAcceptedConnections` loads whole profiles; the proximity scan asks
 * this question four hundred times per run and needs a set, not a list.
 */
export async function connectedIds(userId: string): Promise<Set<string>> {
  if (!hasDb || !db) return new Set();
  const rows = await db
    .select({ a: connections.userAId, b: connections.userBId })
    .from(connections)
    .where(and(eq(connections.status, "accepted"), or(eq(connections.userAId, userId), eq(connections.userBId, userId))));
  return new Set(rows.map((r) => (r.a === userId ? r.b : r.a)));
}
