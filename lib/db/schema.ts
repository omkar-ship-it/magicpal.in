import {
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  index,
  boolean,
  doublePrecision,
  integer,
  real,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------- auth
// Hand-rolled email OTP: a user row appears on first successful verify,
// codes are hashed at rest, and the session id is itself the opaque bearer
// token stored in an httpOnly cookie. No password anywhere.

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),

    // ------------------------------------------------------------ profile
    // Null until onboarding completes. A user can exist (has signed in) with
    // no profile yet — that's the state right after their first OTP verify.
    name: text("name"),
    headline: text("headline"), // "Product Manager at Acme"
    company: text("company"),
    bio: text("bio"),
    skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
    photoUrl: text("photo_url"),

    // Optional — shown as icon links on the profile card when set.
    linkedinUrl: text("linkedin_url"),
    instagramUrl: text("instagram_url"),
    websiteUrl: text("website_url"),

    // ------------------------------------------------------------- intents
    /**
     * The two halves of every match, and the only fields the matcher scores
     * on. Both are picked from the fixed vocabularies in lib/intents.ts
     * rather than typed freely — an enumerated overlap is exactly computable
     * *and* exactly explainable ("you want a technical co-founder; they've
     * shipped two Android apps"), which is what makes a recommendation
     * trustworthy at the point a stranger decides whether to walk over. Free
     * text goes in `workingOn`, which colours the reason but never the score.
     */
    lookingFor: text("looking_for").array().notNull().default(sql`'{}'::text[]`),
    canHelpWith: text("can_help_with").array().notNull().default(sql`'{}'::text[]`),
    /** One line, their words — the humanising detail in a generated intro. */
    workingOn: text("working_on"),

    /**
     * What they're into, as distinct from what they need.
     *
     * The only *symmetric* signal the matcher has: two people deep in
     * climate are worth introducing even when neither wants anything the
     * other is offering. Without it the recommender has nothing to say to
     * the large middle of any room — people whose needs don't happen to
     * interlock — and falls back to "no overlap", which is true and useless.
     *
     * Vocabulary in lib/intents.ts (SECTORS), same reasoning as topics: an
     * enumerated overlap is exactly computable and exactly explainable.
     */
    interests: text("interests").array().notNull().default(sql`'{}'::text[]`),

    /**
     * Founder, operator, investor, student… One value, from STAGES.
     *
     * Context rather than score: it rarely decides a match on its own, but
     * it is what makes a recommendation legible at a glance, and it is the
     * filter people actually reach for ("who here is an investor").
     */
    stage: text("stage"),

    /**
     * Mentorship, carried as two flags and nothing else.
     *
     * The matching surface is deliberately not built yet: it needs a board
     * that already has retention and verified members, which is months after
     * launch. Collecting the signal from day one costs one checkbox each and
     * means the feature ships later as a query over real data rather than as
     * a schema migration against a populated table.
     */
    openToMentor: boolean("open_to_mentor").notNull().default(false),
    seekingMentor: boolean("seeking_mentor").notNull().default(false),

    // -------------------------------------------------------- location
    // Exact coordinates, never sent to the client as-is for anyone but the
    // profile's own owner — see lib/geo.ts:jitter for what other people see.
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    // The human-readable place name from geocoding ("Koramangala, Bengaluru"),
    // shown instead of coordinates everywhere in the UI.
    locationLabel: text("location_label"),

    /**
     * The city the person is willing to be placed in when they don't want to
     * be findable at street level. Stored separately rather than derived by
     * rounding `lat`/`lng`, because rounding leaks: a rounded coordinate still
     * points inside the neighbourhood, and the person who chose "city only"
     * was asking us not to do that. Picked explicitly, centroid and all.
     */
    baseLat: doublePrecision("base_lat"),
    baseLng: doublePrecision("base_lng"),
    baseLabel: text("base_label"),

    /**
     * How this person appears on the open map — the promise the product makes
     * about location, so it is one column read by every query rather than a
     * UI preference:
     *
     *   live  — the device's position, refreshed while the app is open and
     *           allowed to go stale on its own (see `liveAt`). For the hours
     *           you're actually out at an event.
     *   exact — the real pin, street level. For "I'm at this venue, find me".
     *   base  — the city centroid only. Discoverable, not locatable.
     *   off   — absent from the open map entirely. Boards they joined still
     *           show them, because joining a board is its own consent.
     *
     * Defaults to `off`: the previous schema defaulted visible-on because an
     * empty map has nothing to sell, but that reasoning doesn't survive
     * contact with real users' locations. Boards solve the empty map instead
     * (an event has a room full of people on day one), which means the open
     * map can afford to be opt-in and honest.
     */
    visibility: text("visibility").notNull().default("off"),

    /**
     * When the live position was last written.
     *
     * Live location has to expire by itself. Nobody taps "stop sharing" —
     * they close the tab, put the phone away, go home — so a live pin with
     * no decay would quietly become a permanent broadcast of where somebody
     * was last Tuesday. Reads treat anything older than LIVE_STALE_MINUTES
     * as not live at all.
     */
    liveAt: timestamp("live_at", { withTimezone: true }),

    /**
     * Touched by a heartbeat ping while any authenticated page is open —
     * powers the "N people active nearby right now" pulse. Deliberately
     * bucketed to a wide window at read time (see ACTIVE_WINDOW_MINUTES in
     * rules.ts) rather than shown as an exact last-seen time: a precise
     * "active 2 min ago" reads as surveillance the way Facebook's old green
     * dot did, "active recently" reads as ambient energy.
     */
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("users_visibility", sql`${t.visibility} in ('off','base','exact','live')`)]
);

export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ----------------------------------------------------------- connections

/**
 * One row per relationship between two people, however it started.
 *
 * `userAId`/`userBId` are the two participants in a fixed canonical order
 * (A is always the lexicographically smaller id) — that's what lets a
 * single unique index stop a duplicate request in *either* direction: A
 * requesting B and B requesting A are the same pair, and the database
 * should refuse the second one, not just the application layer. Which of
 * the two actually sent the request is `requesterId`, kept separately so
 * "Jane wants to connect" can still be displayed correctly.
 */
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // pending | accepted | declined
    /**
     * An optional note attached when the request was sent — the one way to
     * say something to someone before you're connected. Delivered as the
     * first message the moment the request is accepted (see
     * lib/connections.ts:respondToConnection); never shown or sendable
     * after that point, so this column doesn't need its own read/reply UI.
     */
    requestNote: text("request_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("connections_pair_idx").on(t.userAId, t.userBId),
    check("connections_pair_order", sql`${t.userAId} < ${t.userBId}`),
  ]
);

/**
 * Only ever sent inside an accepted connection — enforced in the API route,
 * not here, since "is this connection accepted" is a runtime check against
 * another table, not something a column constraint can express.
 */
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  connectionId: uuid("connection_id")
    .notNull()
    .references(() => connections.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
});

// ---------------------------------------------------------------- boards

/**
 * A board is a bounded set of people with a host, a URL and a QR code.
 *
 * One table covers both of the things it turns out people ask for, because
 * they differ by a column and a date and nothing else:
 *
 *   event     — one room, one afternoon. `startsAt` set. The value is
 *               entirely in the first ten minutes: three hundred badges
 *               with first names on them and no way to find the four
 *               people worth crossing the room for.
 *   community — an alumni batch, a WhatsApp group, a company's ex-employees.
 *               No end date. The value is "who here is in Berlin", which
 *               the group genuinely cannot answer about itself.
 *
 * The open map is deliberately *not* a board. It has no host, no URL and
 * no member list — it is `select … where visibility <> 'off'`. Making it a
 * board row would have meant a fake host, a membership row per signup, and
 * a cascade delete that could empty the public map; a query has none of
 * those failure modes.
 *
 * `parentBoardId` is what makes "members can create events inside a
 * community" free: a community event is a board whose parent is the
 * community, an open-network event is a board with no parent at all. Same
 * row shape, same matcher, same QR.
 */
export const boards = pgTable(
  "boards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /**
     * The whole address of the product. It goes on a slide as a QR code and
     * into a WhatsApp group as a link, so it has to be short, readable, and
     * not guessable by counting up from one — a four-character random salt
     * after the slug, never a sequential id.
     */
    slug: text("slug").notNull().unique(),
    type: text("type").notNull(), // event | community
    parentBoardId: uuid("parent_board_id").references((): AnyPgColumn => boards.id, {
      onDelete: "set null",
    }),
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    blurb: text("blurb"),
    /** Free text: a venue for an event, a city or "everywhere" for a group. */
    place: text("place"),
    /** Where the board centres its map. Null for a community with no home. */
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),

    /** Events only. A board with no `startsAt` is a community. */
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** The longer description — agenda, what to expect, how to find the room. */
    details: text("details"),
    /** Street address, kept apart from `place` so the map label stays short. */
    address: text("address"),
    /** Null means no limit. Shown as "N of M going" once set. */
    capacity: integer("capacity"),
    /** Tickets, a signup form, the host's own page. */
    url: text("url"),

    /**
     * The admin pays and the members don't, because the admin is the one
     * with the problem — and a per-head price on a free WhatsApp group is a
     * product nobody buys. See lib/plans.ts for what each id allows.
     */
    plan: text("plan").notNull().default("free"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    check("boards_type", sql`${t.type} in ('event','community')`),
    // An event without a start time can't be placed on a timeline, and a
    // community with one is just an event that forgot to end.
    check(
      "boards_type_dates",
      sql`(${t.type} = 'event' and ${t.startsAt} is not null) or (${t.type} = 'community' and ${t.startsAt} is null)`
    ),
    index("boards_host_idx").on(t.hostUserId),
    index("boards_parent_idx").on(t.parentBoardId),
  ]
);

/**
 * Who is on a board, and who runs it.
 *
 * Membership is also the consent record for board visibility: a person who
 * scanned a QR and joined has agreed to be visible *to that board*, which
 * is a different and much narrower grant than appearing on the open map.
 * That's why deleting a board removes its memberships but never touches
 * `users.visibility`.
 */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // host | member
    /**
     * Set while the person is physically at the event, cleared when they
     * leave. Powers "here now", which is the difference between a directory
     * and something you use during the coffee break.
     */
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),

    /**
     * going | maybe | no — or null, meaning they joined the board but
     * haven't answered.
     *
     * Deliberately separate from membership: being on a board is "I'm part
     * of this group", RSVP is "I'll be in that room on Thursday", and
     * collapsing them would make leaving an event mean leaving the
     * community that hosts it.
     */
    rsvp: text("rsvp"),
    rsvpAt: timestamp("rsvp_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("memberships_board_user_idx").on(t.boardId, t.userId),
    check("memberships_role", sql`${t.role} in ('host','member')`),
    check("memberships_rsvp", sql`${t.rsvp} is null or ${t.rsvp} in ('going','maybe','no')`),
  ]
);

// --------------------------------------------------------------- matches

/**
 * A cached recommendation, with the sentence that justifies it.
 *
 * Scoring is deterministic (lib/matching.ts) and cheap enough to redo on
 * every request; `reason` is not — it's one model call to turn a structured
 * overlap into a sentence a human will act on, so it is written once per
 * pair and kept. That split is the whole cost model: the maths is free and
 * runs always, the prose is paid for and runs once.
 *
 * `aUserId`/`bUserId` are in canonical order (A < B) for the same reason
 * `connections` is — one pair, one row, whichever direction it was computed
 * from. `boardId` null means the pair was matched on the open map.
 */
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    boardId: uuid("board_id").references(() => boards.id, { onDelete: "cascade" }),
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    /** The generated one-liner. Null until it has been written. */
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("matches_pair_order", sql`${t.userAId} < ${t.userBId}`),
    // Two partial indexes rather than one over (board, a, b): Postgres
    // treats NULLs as distinct in a unique index, so open-map pairs — which
    // all have board_id null — would not be constrained by the first index
    // at all, and the cache would fill with duplicates of the same pair.
    uniqueIndex("matches_board_pair_idx")
      .on(t.boardId, t.userAId, t.userBId)
      .where(sql`${t.boardId} is not null`),
    uniqueIndex("matches_open_pair_idx")
      .on(t.userAId, t.userBId)
      .where(sql`${t.boardId} is null`),
  ]
);

// ----------------------------------------------------------------- posts

/**
 * What somebody actually wrote on a community's feed.
 *
 * The feed was derived-only until now: every line read a timestamp that
 * existed for another reason, so it could never show activity that hadn't
 * happened. That was the right guard against *invented* motion, and it also
 * quietly ruled out the most ordinary thing a group does — saying something
 * to itself. Posts are real activity, written by a real member, and they
 * merge into the same feed as the derived lines.
 *
 * Any member may post. `deletedAt` is a soft delete so an author can take
 * something back and a host can remove it, without the row vanishing from
 * under a reply or a report.
 */
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    /** One optional link. */
    url: text("url"),
    /**
     * An event this post is about, so "registrations open" can carry the
     * thing it's announcing and be RSVP'd from the post itself. Set null
     * rather than cascade: deleting an event shouldn't erase the
     * announcement that it happened.
     */
    eventBoardId: uuid("event_board_id").references((): AnyPgColumn => boards.id, {
      onDelete: "set null",
    }),
    /** Blob URLs. Photos from the last meetup are what bring people back. */
    images: text("images").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("posts_board_idx").on(t.boardId, t.createdAt)]
);

// -------------------------------------------------------------- consents

/**
 * One append-only row per grant or withdrawal of consent.
 *
 * Precise location is sensitive personal data under the DPDP Act, and the
 * obligation is to be able to show *what* was agreed to and *when* — which
 * a mutable boolean on `users` can never do, because it only ever knows the
 * current value. Rows are never updated or deleted, only superseded by a
 * later row for the same `kind`; `users.visibility` is the fast read, this
 * is the record. Far cheaper to write now than to reconstruct later.
 */
export const consents = pgTable(
  "consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** e.g. location_exact, location_base, open_map, terms_18plus */
    kind: text("kind").notNull(),
    granted: boolean("granted").notNull(),
    /** What the person was actually shown when they agreed. */
    copyVersion: text("copy_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("consents_user_kind_idx").on(t.userId, t.kind, t.createdAt)]
);
