import "server-only";
import { and, eq, gt, isNull, or, sql, desc } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { brainMateLinks, brainMates, users } from "@/lib/db/schema";
import { ARCHETYPE_IDS, type ArchetypeId } from "./archetypes";
import { compare, type Comparison } from "./compare";
import { SINGLE_ROUNDS, SWIPE_ROUND } from "./rounds";
import { resultFor, type Answers, type CrowdStats } from "./score";

/**
 * Brain-Mate's database layer. Everything that reads or writes the two
 * tables goes through here; routes and pages stay thin.
 */

function need() {
  if (!db) throw new Error("Brain-Mate needs a database connection.");
  return db;
}

export type BrainMateRow = {
  userId: string;
  displayName: string;
  answers: Answers;
  archetype: ArchetypeId;
  streak: ArchetypeId;
};

export async function getBrainMate(userId: string): Promise<BrainMateRow | null> {
  const [row] = await need().select().from(brainMates).where(eq(brainMates.userId, userId)).limit(1);
  if (!row) return null;
  return {
    userId: row.userId,
    displayName: row.displayName,
    answers: row.answers as Answers,
    archetype: row.archetype as ArchetypeId,
    streak: row.streak as ArchetypeId,
  };
}

/** Upsert from validated answers — the archetype is always recomputed here. */
export async function saveBrainMate(userId: string, displayName: string, answers: Answers) {
  const r = resultFor(answers);
  await need()
    .insert(brainMates)
    .values({ userId, displayName, answers, archetype: r.archetype, streak: r.streak })
    .onConflictDoUpdate({
      target: brainMates.userId,
      set: { displayName, answers, archetype: r.archetype, streak: r.streak, updatedAt: new Date() },
    });
  statsCache = null;
  return r;
}

// ----------------------------------------------------------- crowd stats
let statsCache: { at: number; stats: CrowdStats } | null = null;
const STATS_TTL_MS = 5 * 60_000;

/**
 * Share of players per answer and per archetype. Read once and cached for a
 * few minutes: it drives the "only 9% chose this" lines, which don't need
 * to be live to the second, and one aggregate beats one per page view.
 */
export async function crowdStats(): Promise<CrowdStats> {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) return statsCache.stats;
  const rows = await need().select({ answers: brainMates.answers, archetype: brainMates.archetype }).from(brainMates);
  const n = rows.length;
  const counts: Record<string, number> = {};
  const arche: Record<string, number> = {};
  for (const row of rows) {
    const a = row.answers as Answers;
    for (const r of SINGLE_ROUNDS) if (a[r.id]) counts[`${r.id}:${a[r.id]}`] = (counts[`${r.id}:${a[r.id]}`] ?? 0) + 1;
    for (const c of SWIPE_ROUND.cards) {
      const v = a.r5?.[c.id];
      if (v) counts[`r5:${c.id}:${v}`] = (counts[`r5:${c.id}:${v}`] ?? 0) + 1;
    }
    arche[row.archetype] = (arche[row.archetype] ?? 0) + 1;
  }
  const share: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) share[k] = v / Math.max(1, n);
  const archetypes: Record<string, number> = {};
  for (const id of ARCHETYPE_IDS) archetypes[id] = (arche[id] ?? 0) / Math.max(1, n);
  const stats = { n, share, archetypes };
  statsCache = { at: Date.now(), stats };
  return stats;
}

// ----------------------------------------------------------------- links
export const LINK_TTL_MS = 24 * 3_600_000;

/** A sender's local calendar date — the unit the one-a-day rule counts in. */
export function localDay(tz: string, at = new Date()): { day: string; tz: string } {
  try {
    return { day: new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(at), tz };
  } catch {
    return { day: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(at), tz: "Asia/Kolkata" };
  }
}

/** "Sai Krishna" → "sai-krishna". Scripts with no Latin form fall back to "friend". */
export function slugPart(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20)
    .replace(/-+$/g, "");
  return s || "friend";
}

const SUFFIX_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
function suffix(): string {
  const bytes = randomBytes(3);
  return [...bytes].map((b) => SUFFIX_CHARS[b % SUFFIX_CHARS.length]).join("");
}

export type LinkState = "waiting" | "done" | "expired";

export type LinkRow = typeof brainMateLinks.$inferSelect;

export function stateOf(l: Pick<LinkRow, "completedAt" | "expiresAt">, now = Date.now()): LinkState {
  if (l.completedAt) return "done";
  return l.expiresAt.getTime() > now ? "waiting" : "expired";
}

export type CreateLinkResult =
  | { ok: true; slug: string }
  | { ok: false; status: number; error: string };

export async function createLink(opts: {
  senderId: string;
  recipientName: string;
  relation: "friend" | "colleague";
  tz: string;
}): Promise<CreateLinkResult> {
  const d = need();
  const me = await getBrainMate(opts.senderId);
  if (!me) return { ok: false, status: 409, error: "Play first — your answers are half of the Wavelength." };

  const name = opts.recipientName.trim().replace(/\s+/g, " ").slice(0, 40);
  if (name.length < 2) return { ok: false, status: 400, error: "Who's it for? Type their name." };

  const { day } = localDay(opts.tz);
  const [today] = await d
    .select({ slug: brainMateLinks.slug })
    .from(brainMateLinks)
    .where(and(eq(brainMateLinks.senderId, opts.senderId), eq(brainMateLinks.senderDay, day)))
    .limit(1);
  if (today) return { ok: false, status: 429, error: "Today's Wavelength is already sent. A new one at midnight." };

  const [pending] = await d
    .select({ slug: brainMateLinks.slug })
    .from(brainMateLinks)
    .where(
      and(
        eq(brainMateLinks.senderId, opts.senderId),
        sql`lower(${brainMateLinks.recipientName}) = lower(${name})`,
        isNull(brainMateLinks.completedAt),
        gt(brainMateLinks.expiresAt, new Date())
      )
    )
    .limit(1);
  if (pending) return { ok: false, status: 409, error: `${name} already has a link from you that's waiting.` };

  const base = `${slugPart(me.displayName)}-${slugPart(name)}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = `${base}-${suffix()}`;
    try {
      await d.insert(brainMateLinks).values({
        slug,
        senderId: opts.senderId,
        recipientName: name,
        relation: opts.relation,
        senderDay: day,
        expiresAt: new Date(Date.now() + LINK_TTL_MS),
      });
      return { ok: true, slug };
    } catch (e) {
      const msg = String((e as { cause?: { message?: string }; message?: string })?.cause?.message ?? (e as Error)?.message ?? e);
      // The (sender, day) index is the real one-a-day gate: a second tab
      // that got past the read above lands here.
      if (msg.includes("brain_mate_links_daily"))
        return { ok: false, status: 429, error: "Today's Wavelength is already sent. A new one at midnight." };
      if (!msg.includes("slug")) throw e;
    }
  }
  return { ok: false, status: 500, error: "Couldn't make a link. Try again." };
}

export async function getLink(slug: string): Promise<LinkRow | null> {
  if (!/^[a-z0-9-]{3,64}$/.test(slug)) return null;
  const [row] = await need().select().from(brainMateLinks).where(eq(brainMateLinks.slug, slug)).limit(1);
  return row ?? null;
}

/** The friend completes the link. Atomic: only a waiting, unexpired link can be claimed, once. */
export async function claimLink(slug: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const link = await getLink(slug);
  if (!link) return { ok: false, error: "That link doesn't exist." };
  if (link.senderId === userId) return { ok: false, error: "This is your own link — send it to the person you named." };
  if (link.completedAt) return { ok: link.recipientId === userId, error: "Someone has already answered this one." };
  if (link.expiresAt.getTime() <= Date.now()) return { ok: false, error: "This link expired." };
  if (!(await getBrainMate(userId))) return { ok: false, error: "Play first." };
  const done = await need()
    .update(brainMateLinks)
    .set({ recipientId: userId, completedAt: new Date() })
    .where(and(eq(brainMateLinks.id, link.id), isNull(brainMateLinks.completedAt), gt(brainMateLinks.expiresAt, new Date())))
    .returning();
  return done.length ? { ok: true } : { ok: false, error: "Someone has already answered this one." };
}

export async function nudge(slug: string, userId: string): Promise<boolean> {
  const done = await need()
    .update(brainMateLinks)
    .set({ nudgedAt: new Date() })
    .where(
      and(
        eq(brainMateLinks.slug, slug),
        eq(brainMateLinks.senderId, userId),
        isNull(brainMateLinks.nudgedAt),
        isNull(brainMateLinks.completedAt),
        gt(brainMateLinks.expiresAt, new Date())
      )
    )
    .returning();
  return done.length > 0;
}

async function intentOf(userId: string) {
  const [u] = await need()
    .select({ lookingFor: users.lookingFor, canHelpWith: users.canHelpWith })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u ?? { lookingFor: [], canHelpWith: [] };
}

/** A finished link's comparison, sender as "a". */
export async function comparisonFor(link: LinkRow): Promise<Comparison | null> {
  if (!link.completedAt || !link.recipientId) return null;
  const [a, b] = await Promise.all([getBrainMate(link.senderId), getBrainMate(link.recipientId)]);
  if (!a || !b) return null;
  const [ia, ib, stats] = await Promise.all([intentOf(a.userId), intentOf(b.userId), crowdStats()]);
  return compare(
    { name: a.displayName, answers: a.answers, lookingFor: ia.lookingFor, canHelpWith: ia.canHelpWith },
    { name: b.displayName, answers: b.answers, lookingFor: ib.lookingFor, canHelpWith: ib.canHelpWith },
    stats
  );
}

export type MyLink = {
  slug: string;
  direction: "sent" | "received";
  otherName: string;
  relation: "friend" | "colleague";
  state: LinkState;
  expiresAt: string;
  nudged: boolean;
  createdAt: string;
  sentToday: boolean;
  /** Filled for finished links. */
  otherArchetype?: ArchetypeId;
  outcome?: Comparison["outcome"];
  similarity?: number;
};

/** Everything you've sent and answered, newest first — "My Brain-Mates". */
export async function myLinks(userId: string, tz: string): Promise<MyLink[]> {
  const rows = await need()
    .select()
    .from(brainMateLinks)
    .where(or(eq(brainMateLinks.senderId, userId), eq(brainMateLinks.recipientId, userId)))
    .orderBy(desc(brainMateLinks.createdAt))
    .limit(60);
  const { day } = localDay(tz);
  const out: MyLink[] = [];
  for (const l of rows) {
    const sent = l.senderId === userId;
    const state = stateOf(l);
    let otherName = l.recipientName;
    let extra: Partial<MyLink> = {};
    if (state === "done") {
      const c = await comparisonFor(l);
      if (c) {
        otherName = sent ? c.b.name : c.a.name;
        extra = { otherArchetype: sent ? c.b.archetype : c.a.archetype, outcome: c.outcome, similarity: c.similarity };
      }
    } else if (!sent) {
      const s = await getBrainMate(l.senderId);
      otherName = s?.displayName ?? "Someone";
    }
    out.push({
      slug: l.slug,
      direction: sent ? "sent" : "received",
      otherName: otherName.split(" ")[0],
      relation: l.relation as "friend" | "colleague",
      state,
      expiresAt: l.expiresAt.toISOString(),
      nudged: Boolean(l.nudgedAt),
      createdAt: l.createdAt.toISOString(),
      sentToday: sent && l.senderDay === day,
      ...extra,
    });
  }
  return out;
}

export async function sentToday(userId: string, tz: string): Promise<boolean> {
  const { day } = localDay(tz);
  const [row] = await need()
    .select({ id: brainMateLinks.id })
    .from(brainMateLinks)
    .where(and(eq(brainMateLinks.senderId, userId), eq(brainMateLinks.senderDay, day)))
    .limit(1);
  return Boolean(row);
}
