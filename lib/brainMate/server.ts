import "server-only";
import { DAILY_CHALLENGES } from "./payload";
import { and, eq, gt, isNull, or, sql, desc } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { brainMateLinks, brainMates, users } from "@/lib/db/schema";
import { ARCHETYPE_IDS, type ArchetypeId } from "./archetypes";
import { compare, type Comparison } from "./compare";
import { ARCHETYPES, TRAITS } from "./archetypes";
import { CALLS, RATHER, TENDENCIES } from "./rounds";
import { howDidItKnow, isCurrent, resultFor, type Answers, type CrowdStats, type Traits } from "./score";
import type { CardPayload, LinkPayload } from "./payload";

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
  /**
   * False for a result from the first version of the questionnaire. Its
   * answers can't be scored by the current one, so the person is asked to
   * retake — and every comparison waits until both people are current.
   */
  current: boolean;
};

export async function getBrainMate(userId: string): Promise<BrainMateRow | null> {
  const [row] = await need().select().from(brainMates).where(eq(brainMates.userId, userId)).limit(1);
  if (!row) return null;
  return {
    userId: row.userId,
    displayName: row.displayName,
    answers: row.answers as Answers,
    archetype: (row.archetype in ARCHETYPES ? row.archetype : "dreamer") as ArchetypeId,
    streak: (row.streak in ARCHETYPES ? row.streak : "explorer") as ArchetypeId,
    current: isCurrent(row.answers),
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
  const all = await need().select({ answers: brainMates.answers, archetype: brainMates.archetype }).from(brainMates);
  // Only current-version results: an old answer has no meaning in the new questions.
  const rows = all.filter((r) => isCurrent(r.answers));
  const n = rows.length;
  const counts: Record<string, number> = {};
  const arche: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
  for (const row of rows) {
    const a = row.answers as Answers;
    for (const x of RATHER) if (a.rather[x.id] !== undefined) bump(`${x.id}:${a.rather[x.id]}`);
    for (const t of TENDENCIES) if (a.tend[t.id] !== undefined) bump(`${t.id}:${a.tend[t.id]}`);
    for (const c of CALLS) if (a.calls[c.id]) bump(`${c.id}:${a.calls[c.id]}`);
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

/** Wavelength challenges one person can send in a day (their local day). */
export const DAILY_CEILING = DAILY_CHALLENGES;

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

  // Three a day: enough to bring a few people in, few enough that each one
  // is still a choice.
  const { day } = localDay(opts.tz);
  const [{ sent }] = await d
    .select({ sent: sql<number>`count(*)::int` })
    .from(brainMateLinks)
    .where(and(eq(brainMateLinks.senderId, opts.senderId), eq(brainMateLinks.senderDay, day)));
  if (sent >= DAILY_CEILING) return { ok: false, status: 429, error: `You've sent your ${DAILY_CEILING} challenges for today — more tomorrow.` };

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

/**
 * Who on a finished link still has a result from the old questionnaire —
 * the link page says so instead of showing a stale comparison.
 */
export async function needsRetake(link: LinkRow): Promise<{ sender: boolean; recipient: boolean }> {
  const [a, b] = await Promise.all([getBrainMate(link.senderId), link.recipientId ? getBrainMate(link.recipientId) : null]);
  return { sender: !a?.current, recipient: !b?.current };
}

// ---------------------------------------------------------- friend's view
/** A rating as stored: -1…1 per trait. Validated, rounded. */
export function cleanView(input: unknown): Record<string, number> | null {
  if (!input || typeof input !== "object") return null;
  const out: Record<string, number> = {};
  for (const k of TRAITS) {
    const v = Number((input as Record<string, unknown>)[k]);
    if (!Number.isFinite(v) || v < -1 || v > 1) return null;
    out[k] = Math.round(v * 100) / 100;
  }
  return out;
}

/** Slider (-1…1) to standard units: the ends mean "clearly", about two spreads out. */
const viewToTraits = (v: Record<string, number>): Traits =>
  Object.fromEntries(TRAITS.map((k) => [k, (v[k] ?? 0) * 2])) as Traits;

/** Every view anyone has given of this person, across all their finished links. */
export async function viewsOf(userId: string): Promise<{ by: string; traits: Traits; raw: Record<string, number> }[]> {
  const rows = await need()
    .select()
    .from(brainMateLinks)
    .where(or(eq(brainMateLinks.senderId, userId), eq(brainMateLinks.recipientId, userId)));
  const given = rows.flatMap((l) => {
    const isSender = l.senderId === userId;
    const v = (isSender ? l.viewOfSender : l.viewOfRecipient) as Record<string, number> | null;
    const raterId = isSender ? l.recipientId : l.senderId;
    return v && raterId ? [{ v, raterId }] : [];
  });
  // In parallel — see myLinks.
  return Promise.all(
    given.map(async ({ v, raterId }) => {
      const rater = await getBrainMate(raterId);
      return { by: (rater?.displayName ?? "A friend").split(" ")[0], traits: viewToTraits(v), raw: v };
    })
  );
}

/** A player of a finished link rates the other one. Once each. */
export async function saveView(slug: string, raterId: string, view: Record<string, number>): Promise<{ ok: boolean; error?: string }> {
  const link = await getLink(slug);
  if (!link || !link.completedAt) return { ok: false, error: "This Wavelength isn't finished yet." };
  const ratingSender = link.recipientId === raterId;
  if (!ratingSender && link.senderId !== raterId) return { ok: false, error: "Only the two of you can rate each other." };
  const already = ratingSender ? link.viewOfSender : link.viewOfRecipient;
  if (already) return { ok: false, error: "You've already shared your view." };
  await need()
    .update(brainMateLinks)
    .set(ratingSender ? { viewOfSender: view } : { viewOfRecipient: view })
    .where(eq(brainMateLinks.id, link.id));
  return { ok: true };
}

/** A finished link's comparison, sender as "a". Null until both are on the current questionnaire. */
export async function comparisonFor(link: LinkRow): Promise<Comparison | null> {
  if (!link.completedAt || !link.recipientId) return null;
  const [a, b] = await Promise.all([getBrainMate(link.senderId), getBrainMate(link.recipientId)]);
  if (!a || !b || !a.current || !b.current) return null;
  const [ia, ib, stats, va, vb] = await Promise.all([intentOf(a.userId), intentOf(b.userId), crowdStats(), viewsOf(a.userId), viewsOf(b.userId)]);
  return compare(
    { name: a.displayName, answers: a.answers, lookingFor: ia.lookingFor, canHelpWith: ia.canHelpWith, views: va.map((v) => v.traits) },
    { name: b.displayName, answers: b.answers, lookingFor: ib.lookingFor, canHelpWith: ib.canHelpWith, views: vb.map((v) => v.traits) },
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
  // Every row's lookups at once, not one after another: on the production
  // database each one is a network round trip, and a member with a dozen
  // Wavelengths was waiting for them in series.
  const out: MyLink[] = await Promise.all(
    rows.map(async (l) => {
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
      return {
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
      } as MyLink;
    })
  );
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

// ----------------------------------------------------------- the overlay
/** Optional, never scored: what's taking most of their energy. Kept with their answers. */
export async function saveEnergy(userId: string, energy: string): Promise<boolean> {
  const me = await getBrainMate(userId);
  if (!me || !me.current) return false;
  await need()
    .update(brainMates)
    .set({ answers: { ...me.answers, energy } })
    .where(eq(brainMates.userId, userId));
  return true;
}

/** Everything the identity card needs, for the person themselves. */
export async function cardFor(userId: string, tz: string, origin: string): Promise<CardPayload | null> {
  const me = await getBrainMate(userId);
  if (!me || !me.current) return null;
  const [stats, links, views, intent] = await Promise.all([crowdStats(), myLinks(userId, tz), viewsOf(userId), intentOf(userId)]);
  const res = resultFor(me.answers);
  const todays = links.find((l) => l.sentToday) ?? null;
  return {
    name: me.displayName,
    answers: me.answers,
    archetype: res.archetype,
    streak: res.streak,
    cusp: res.cusp,
    mix: res.mix,
    traits: res.traits,
    rarity: stats.n >= 20 ? (stats.archetypes[res.archetype] ?? null) : null,
    know: howDidItKnow(me.answers, stats),
    views: views.map((v) => ({ by: v.by, traits: v.traits })),
    today: todays ? { slug: todays.slug, recipient: todays.otherName, state: todays.state } : null,
    sentToday: links.filter((l) => l.sentToday).length,
    links: links.map((l) => ({
      slug: l.slug,
      direction: l.direction,
      otherName: l.otherName,
      relation: l.relation,
      state: l.state,
      otherArchetype: l.otherArchetype,
      outcome: l.outcome,
      similarity: l.similarity,
    })),
    origin,
    intentMissing: !intent.lookingFor?.length || !intent.canHelpWith?.length,
    energy: me.answers.energy ?? null,
  };
}

/** One Wavelength link, as the viewer should see it. */
export async function linkFor(slug: string, viewerId: string | null, origin: string): Promise<LinkPayload | null> {
  const link = await getLink(slug);
  if (!link) return null;
  const [sender, viewer] = await Promise.all([getBrainMate(link.senderId), viewerId ? getBrainMate(viewerId) : null]);
  const state = stateOf(link);
  const role = !viewerId ? "guest" : viewerId === link.senderId ? "sender" : viewerId === link.recipientId ? "recipient" : "other";
  const comparison = state === "done" ? await comparisonFor(link) : null;
  let waitingOnRetake: string[] = [];
  if (state === "done" && !comparison) {
    const need = await needsRetake(link);
    const recipient = link.recipientId ? await getBrainMate(link.recipientId) : null;
    waitingOnRetake = [
      need.sender ? (sender?.displayName ?? "Your friend").split(" ")[0] : null,
      need.recipient ? (recipient?.displayName ?? link.recipientName).split(" ")[0] : null,
    ].filter((x): x is string => Boolean(x));
  }
  const viewGiven = role === "sender" ? Boolean(link.viewOfRecipient) : role === "recipient" ? Boolean(link.viewOfSender) : true;
  return {
    slug,
    state,
    role,
    senderName: (sender?.displayName ?? "Your friend").split(" ")[0],
    recipientName: link.recipientName.split(" ")[0],
    relation: link.relation as "friend" | "colleague",
    expiresAt: link.expiresAt.toISOString(),
    nudged: Boolean(link.nudgedAt),
    viewerPlayed: Boolean(viewer?.current),
    comparison: role === "sender" || role === "recipient" ? comparison : comparison ? { ...comparison, replay: [] } : null,
    waitingOnRetake,
    viewGiven,
    origin,
  };
}
