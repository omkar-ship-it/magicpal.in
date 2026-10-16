# MagicPal — handoff for engineers and coding agents

Everything another person (or agent) needs to pick this up without
re-deriving it. Read this before writing code; it is the only document that
explains *why* things are the way they are, and most of the traps below cost
real debugging time to find.

Last updated: 2026-10-16.

---

## 1. What this is

**MagicPal is a map-first professional networking product.** The map is not
a feature inside the app — the map *is* the app. Every surface (feed,
people, events, chats, your profile, sign-in) is a floating window on top of
a live map. There are deliberately no separate pages: `/you`, `/login`,
`/boards` all redirect into `/?panel=…`.

The thing it does that a directory can't: it knows **who is near you, right
now**, and it can tell you **why a particular stranger is worth talking to**.

### The product model, settled and load-bearing

| Concept | What it is |
|---|---|
| **Community** | A persistent group — "RGUKT Alumni". The thing in the network switcher. A `boards` row with `starts_at IS NULL`. |
| **Event** | Something that happens *inside* a community. A `boards` row with `starts_at` set and `parent_board_id` pointing at the community. |
| **Open map** | Not a board. It is a **query** — everyone who opted into public visibility, within a radius. |
| **Pin ("drop-in")** | Ad-hoc. "I'm at this café for two hours, come say hello." Expires on its own. |

Rules that fall out of this and must not be quietly broken:

- Every event belongs to a community. Scanning an event QR joins **both**.
- The network switcher lists **communities only**. Listing events made it a
  pile of one-evening entries that never go away.
- A board's slug is its authorisation. It carries a random salt so it can't
  be guessed by counting. Knowing it is enough to join (this is deliberate —
  an approval queue between scanning a QR in a venue and seeing the room is
  the end of the product).

### Live

- Production: **https://magicpal-in.vercel.app** (Vercel project `magicpal-in`)
- Repo: `github.com/omkar-ship-it/magicpal.in`
- Production DB: Neon, provisioned through the Vercel marketplace as
  `magicpal-in-db`.
- There is an **older prototype** at `magicpal.vercel.app` (separate repo,
  separate Neon project). It is a design reference only. **Do not point this
  app at the prototype's database.**

---

## 2. Stack, and the one thing that surprises everyone

- **Next.js 16.3.8**, App Router, Turbopack
- **React 19.2.8** with the **React Compiler enabled**
- TypeScript, Tailwind v4
- **Drizzle ORM** + Postgres (Neon in production, local Postgres in dev)
- **Mapbox GL** via `react-map-gl/mapbox`
- Vercel Blob for uploads, MSG91 for OTP email

> **Read `AGENTS.md` first.** It says: *this is not the Next.js you know.*
> Breaking changes from older versions are real. `params` and `searchParams`
> are **Promises** — `const { slug } = await ctx.params`. When in doubt read
> `node_modules/next/dist/docs/`.

---

## 3. Architecture

### One payload, one scope

`lib/shell.ts` → `shellPayload({ userId, scope, lat, lng, radiusKm })` builds
**everything the shell needs in one object**: scope, people, matches, events,
networks, pins, counts, your own marker.

This exists because the dock's surfaces all answer the same question about a
different set of people. If they each fetched their own data they would
disagree with each other and with the map. **Add new scoped data here, not
in a new endpoint**, unless it's per-item detail (see below).

The deliberate exception: **Chats are never scoped.** A conversation belongs
to the two people in it, not the board they met on.

### Lean list vs. full detail

The map payload carries hundreds of people and must stay small and safe.
Per-item detail gets its own endpoint:

- `GET /api/person/[id]` — one person in full (this is the **only** place a
  phone number can be returned)
- `GET /api/boards/[slug]` — one event's host, parent community and roster

A phone number in a bulk response is a phone number in every browser's
network tab, whatever the UI chose to render.

### The client shell

`components/MapShell.tsx` is the whole app: ten floating windows (home,
forYou, feed, people, pins, events, chats, alerts, person, profile, signin) over
`MapCanvas`. `FloatWindow` handles drag/resize/minimise/maximise on desktop
and turns into a bottom sheet on narrow screens (`useIsNarrow`).

---

## 4. Data model

15 tables. `lib/db/schema.ts` is the single source of truth and is heavily
commented — read it, the comments explain the non-obvious columns.

```
users  sessions  otp_codes  consents
boards  memberships
connections  messages
posts  comments  post_reactions
pins  pin_joins
notifications  matches
```

Things worth knowing without reading the file:

- **`boards`** is both events and communities, differing by `starts_at`.
  `parent_board_id` is a self-reference (needs `AnyPgColumn`).
- **`memberships.status`** is `active | left | removed`. **Never delete a
  membership row** — see §5.
- **`memberships.verified_at`** is the community owner's vouch. See §5.
- **`users.visibility`** is `off | base | exact | live` and is the product's
  central promise about location.
- **`pins.reach_km`** is how far a pin carries. See §5.
- **`messages.attachments`** is jsonb. See §5.

---

## 5. Invariants — break these and you ship a security bug

These are the rules that are easy to violate by accident. Each one already
has flow-test coverage; if you change the behaviour, change the test and say
why in the commit.

### 5.1 Membership means `status = 'active'`, not "a row exists"

A removed or departed member still has a row — that tombstone is what makes
removal mean anything, because the invite link is still in the group chat
they were removed from.

**There are eleven reads that mean "is this person in the community."** The
condition lives in `lib/membership.ts` (`isActiveMember()`, `isActive()`,
`activeAliasSql()`) and **nothing is allowed to spell it out inline.**

Four of those eleven were originally `if (await membershipOf(...))`
truthiness checks and were only found by sweeping. **If you add a twelfth,
sweep again**: `grep -rn "membershipOf" app lib components`.

Getting this wrong means a removed member keeps seeing the community's
feed, people, and — worst — other members' **live locations** via the pins
audience check.

### 5.2 Location fails closed

`place()` in `lib/profiles.ts` is the single gate that turns a stored
position into one a viewer may see.

- `exact` is never jittered (somebody asking to be findable at a venue means it)
- `base` returns the **city centroid and a coarsened label** — never
  "Banjara Hills, Hyderabad" for someone who chose city-level
- `live` **decays** to base after `LIVE_STALE_MINUTES`; nobody ever taps
  "stop sharing", they close the tab
- Anything unresolvable returns `null` and the person is dropped from the
  result, never fallen back to a precise pin

### 5.3 Pin reach is measured from the reader, never the map centre

`lib/pins.ts` resolves the **viewer's own position** from their session
inside `livePinsFor`. It is not a parameter. The map centre is a camera —
it pans, and the client picks it — so enforcing reach against it would let
anyone read a 150 m pin by scrolling to the café.

Consequences, both deliberate:
- A sub-1 km reach is **withheld** from a city-centroid reader rather than
  guessed at (a city centroid cannot answer "is this person in my building")
- **Signed-out visitors see no pins at all** — no position, nothing to be
  near, and real-time whereabouts shouldn't be anonymously scrapeable

### 5.4 Verification is viewer-relative

The badge means: *a community **you both** belong to says this person is who
they claim to be.* Computed per viewer in `lib/vouch.ts`.

- `verified` — what everyone sees (shared-community rule)
- `verifiedHere` — this board's own claim, what the **owner manages**

Keeping one field for both would have the owner's tooling and the public
badge disagreeing the first time somebody shares two communities. A bare
unattributable tick would also be farmable: make a community, verify
yourself, wear a tick everywhere.

### 5.5 Chat attachments: two separate rules

`lib/attachments.ts`.

- **What may be stored** is an *allow-list*, not a deny-list. SVG and HTML
  are excluded by name: both run script when opened and a blob host serves
  them with their real content type.
- **What may be referenced** is narrower: only our own Vercel Blob host,
  matched on **hostname, not prefix** (`…vercel-storage.com.evil.com`
  passes a `startsWith` test and is not us). The send endpoint takes URLs
  from the client, so without this anyone could render arbitrary content
  inside someone's inbox.

### 5.6 Messaging requires an accepted connection

There is no open inbox, by design. A map that shows where people are *plus*
the ability to message anyone on it is a harassment vector with extra steps.
Enforced server-side in `lib/messages.ts`, not just in the UI.

### 5.7 Proximity alerts never out-run what somebody published

`lib/alerts.ts` tells people that somebody worth meeting is near them. It
is the most dangerous code here, because it reads everyone's position and
tells other people about it. Three rules carry that:

- **Nothing escapes `place()`.** Alerts see exactly what the map would show
  that recipient. Somebody publishing only their city triggers "is in your
  city" and **never** a distance — `distance_km` is stored as null for them,
  so no UI can invent the precision later.
- **No alert is a new disclosure.** Everyone named is already visible to
  that recipient on the map. The alert changes *when* they find out, not
  *what* they may know.
- **Silence is the default for strangers.** Interests (the loosest signal)
  is opt-in; a pair can't re-fire for `ALERT_REPEAT_DAYS`; nobody gets more
  than `ALERT_DAILY_CAP` a day; the scan self-throttles per person.
- **Density becomes a doorway, not a flood.** Above `ALERT_CROWD_THRESHOLD`
  matches in a `CROWD_CLUSTER_KM` cluster, everyone gets *one* `crowd_nearby`
  notice whose count climbs as the room fills, and tapping it opens For You.
  Measured in a 200-person mixer: before this, 25 arrivals filled all 200
  attendees' daily budgets with five arbitrary pings each; after, it is one
  notice each and the day's budget is still intact. **Never add a second
  ranker here** — picking "the best three" for a notification is what For
  You already does properly, and two rankers will drift.

Scans run in **both directions** on a position change — who should hear
about the mover, and who the mover should hear about. One direction alone
would say nothing to somebody flying into a city where their connections
already live.

### 5.8 Signing out revokes the session

`destroySession()` deletes the `sessions` row **and then** the cookie.
Clearing the cookie alone leaves the session id valid for 30 days.

---

## 6. Known traps — all of these cost real time to find

### 6.1 `pg` in the client bundle (hit twice)

A **client** component importing a *value* from a module that imports the DB
drags the Postgres driver into the browser bundle: `Module not found: Can't
resolve 'dns'`.

Types are erased and are safe (`import type { X } from "@/lib/db/schema"` is
fine). **Constants are not.** That is why `lib/rules.ts` exists — pure,
client-safe constants — and why `lib/time.ts` was split out of `lib/feed.ts`.

### 6.2 `drizzle-kit push` does not diff CHECK constraint *edits*

It adds new constraints but silently leaves edited ones alone. Editing an
allowed-values list in `schema.ts` will typecheck, push "successfully", and
then 500 at runtime. Hand-written SQL for those lives in `drizzle/manual/`.

**After any push, diff the two databases' constraints.** See §8.

### 6.3 Vercel CLI rewrites `.env.local`

`vercel link` and `vercel blob create-store` **overwrite `.env.local` with
production credentials**. This points your dev server at the production
database.

Always `vercel env pull` to a **scratch path**, never the default. Verify
`.env.local` afterwards. `POSTGRES_URL` must stay **absent** locally —
`lib/db/index.ts` prefers it over `DATABASE_URL`.

### 6.4 Unlayered CSS beats Tailwind

`app/globals.css` is unlayered while `@import "tailwindcss"` is layered, so
`.label`, `.btn`, `.chip-toggle`, `.floating-panel` **beat** Tailwind
utilities on the same element. `.label { display: block }` is why section
headings once shipped with the icon stacked above the words.

### 6.5 React Compiler rejections

- `Date.now()` during render is impure → `const [now] = useState(() => Date.now())`,
  declared **above any early return** (hooks must run in the same order)
- "Cannot access refs during render"
- "Existing memoization could not be preserved" — sometimes the fix is to
  *remove* a `useMemo`

### 6.6 `react-map-gl` shadows the global `Map`

Its default export is named `Map`. Alias it: `import MapGL from
"react-map-gl/mapbox"`. Always pass `projection="mercator"`.

### 6.7 border-radius + overflow-hidden clips hit-testing

Not just paint. This is why `FloatWindow` is two elements: an outer one for
position/size with no clipping, and an inner `.floating-panel` that does the
rounding — otherwise the resize handles are unreachable at the corners.

### 6.8 Drizzle does not parenthesise raw `sql` fragments

`and(a, b, sql\`x or y\`)` splices the fragment in untouched, and **OR binds
looser than AND**, so the whole clause silently re-associates. In the
proximity scan this turned

```
id <> mover AND name NOT NULL AND (lat in box OR baseLat in box)
```

into three OR branches, two of which had **no mover guard and no name
check**. The visible symptom was somebody being notified about their own
arrival. Always write the parentheses yourself inside a `sql` fragment.

### 6.9 Marker z-order

Map markers stack by latitude by default. The meet-up pin sets an explicit
`zIndex` so "right now" doesn't lose a z-fight with ambient face stacks.

---

## 7. Local development

```bash
# 1. Local Postgres (never the production DB)
createdb magicpal_in

# 2. .env.local needs at minimum:
#    DATABASE_URL=postgres://localhost:5432/magicpal_in
#    NEXT_PUBLIC_MAPBOX_TOKEN=...
#    (POSTGRES_URL must NOT be set)

npm install
npm run db:push        # schema → local DB
npm run dev            # http://localhost:3000
```

OTP codes are printed to the dev server log when email isn't configured:
`[otp] login code for you@example.com is 123456`.

### Driving the UI as a user

The repo keeps no browser-automation dependency. The established pattern:

```bash
npm install -D playwright --no-save
# write tmp-whatever.mjs IN THE PROJECT ROOT (it needs node_modules)
node --env-file=.env.local tmp-whatever.mjs
rm -f tmp-*.mjs && npm uninstall playwright     # before committing
```

To sign in without the OTP round trip, insert a session row and set it as a
cookie:

```sql
insert into sessions (user_id, expires_at)
values ($userId, now() + interval '1 hour') returning id;
```
→ `ctx.addCookies([{ name: "mp_session", value: id, domain: "localhost", path: "/" }])`

**Always clean up test rows you create.**

---

## 8. Testing and shipping

### The gate — run all four before committing

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run test:flows
```

### `npm run test:flows`

`scripts/flowtest.mjs` — **265+ assertions** against a real server it spawns
itself on port 3177 (no other `next dev` may be running). It talks to the
real database and cleans up after itself.

It is not a unit-test suite. It exists to pin down **behaviour that would
fail silently**: who can see what, what happens after a removal, whether a
redirect chain terminates. Assertion messages are written as sentences about
the product, not about the code — keep that style.

When adding tests, beware: everything lives in one `try` block, so
**identifier collisions across sections are a syntax error.** Check first:
`grep -c "const yourName\b" scripts/flowtest.mjs`.

### Deploying

Pushing to `main` auto-deploys via Vercel.

**Schema changes must reach production *before* the code that needs them.**
This has been got wrong twice (`posts`, then `pins`), each time producing
500s on a live feature.

```bash
# 1. scratch path, NOT .env.local
npx vercel env pull /tmp/scratch/env.prod --environment=production --yes

# 2. push, with POSTGRES_URL unset
( set -a; . /tmp/scratch/env.prod; set +a; unset POSTGRES_URL; npx drizzle-kit push --force )

# 3. diff the constraints — push does not update edited CHECKs (§6.2)
#    select conname, pg_get_constraintdef(oid) from pg_constraint
#    where contype='c' and connamespace='public'::regnamespace order by 1;

# 4. delete the scratch env file, confirm .env.local is untouched
# 5. commit, push, confirm the deployment is Ready
```

> **Open task:** a build-time check that fails when `schema.ts` and the
> production database disagree. This would retire the whole ritual above and
> is the highest-value piece of infrastructure work outstanding.

---

## 9. Code map

| Path | What it owns |
|---|---|
| `lib/db/schema.ts` | Every table. Read the comments. |
| `lib/shell.ts` | The one scoped payload. |
| `lib/membership.ts` | **"Is in this community", defined once.** §5.1 |
| `lib/profiles.ts` | `place()` — the location gate. §5.2 |
| `lib/pins.ts` | Drop-ins; liveness and reach. §5.3 |
| `lib/vouch.ts` | Viewer-relative verification. §5.4 |
| `lib/alerts.ts` | **Proximity alerts** — the scan, the caps, the privacy gate. §5.7 |
| `lib/attachments.ts` | What may be uploaded and referenced. §5.5 |
| `lib/matching.ts` + `lib/intents.ts` | Recommendations and their vocabulary. §10 |
| `lib/rules.ts` | **Client-safe constants only.** Never import the DB here. §6.1 |
| `lib/boards.ts` | Communities/events, membership lifecycle, verification. |
| `lib/posts.ts` / `lib/feed.ts` | Feed, reactions, comments, pinning. |
| `components/MapShell.tsx` | The whole client app. |
| `components/FloatWindow.tsx` | Window chrome; bottom sheet on narrow. §6.7 |
| `components/Panel.tsx` | **Shared page furniture** — `Hero`, `Section`, `Facts`, `Stats`, `Row`, `Page`. Use these for any new detail page. |
| `components/Icons.tsx` | One icon set. Chrome is drawn; emoji only ever appear as *content*. |
| `app/globals.css` | Tokens, primitives, map chrome, motion. §6.4 |
| `scripts/flowtest.mjs` | The behavioural gate. |

### Design conventions

- **Comments explain *why*, never *what*.** The codebase's comments are its
  main asset — they record decisions and the bugs that motivated them. Match
  that density and tone.
- Motion is limited to four things: `.reveal` (blocks arriving), `.lift`
  (reachable), `.tap`/`.row-hit` (acknowledged), `.pop` (a number changed).
  Nothing runs longer than 260ms; transform and opacity only; everything is
  disabled under `prefers-reduced-motion`.
- Colour is semantic: brand orange = people/connections, `--layer-event`
  purple = events, `--meetup` magenta = drop-in pins, `--good` green = live
  and present, `--warn` = irreversible.
- Empty states say what the surface is *for* and never invent activity to
  look busy. A new community's feed is genuinely empty and says so.

---

## 10. Recommendations ("For you") — read this before touching it

**There is no AI call anywhere in this codebase.** This surprises people, so
be clear about it.

`matchesFor()` in `lib/matching.ts` scores overlap between **enumerated
vocabularies** in `lib/intents.ts` (`TOPICS`, `SECTORS`, `STAGES`), and
`describeOverlap()` composes the sentence from templates. "You're both into
b2b & saas" is string assembly.

Why it was built this way: every reason is **checkable and explainable** at
the moment a stranger decides whether to walk over, it costs nothing, and it
never rate-limits or hallucinates. A score is never rendered — only the
sentence.

What it is blind to: everything in free text (`workingOn`, `bio`). Two
founders whose stated topics don't interlock but who are obviously right for
each other will never surface.

**The hook for a model already exists:** `matches.reason` is a cached column
designed for exactly one model call per pair — the maths is free and redone
every request, the sentence is not and is written once per pair. Wiring an
LLM there is roughly half a day. **Do it after there is real `workingOn`
text to work with**, not before.

Ranking currently puts anyone physically present first: proximity is the
only thing this product has that a directory doesn't.

---

## 11. State of play

### Built and live

Auth (email OTP) · profiles with intent signals · the open map with
visibility controls · communities · events inside them · QR/link joining ·
member verification · member removal and leaving · house rules · the feed
(posts, images, links, reactions, one-level replies, a pinned post) ·
ad-hoc pins with reach and expiry · connections and 1:1 chat with
image/document/emoji attachments · recommendations · sign out.

### Parked, by explicit decision

| Thing | Why |
|---|---|
| Join approval queues | Valid, later phase. Open link join is correct for events. |
| 1:1 block / report | Parked by the owner. **See the risk below.** |
| Admin roles beyond the owner | Owner == `boards.hostUserId`; no second tier yet. |
| Audit log | Wanted once there are multiple admins. |
| Mentorship matching | Columns exist and collect signal; the surface needs a board with retention first. |
| GIF search | Needs a Giphy/Tenor API key. Sending a `.gif` already works. |

### Open risks — read before a wider launch

1. **No blocking.** Reporting is slow and depends on an admin being awake;
   blocking is what a member can do *right now*. On a product that
   broadcasts real-time physical location to strangers, this is a safety
   floor, not a feature. **Highest-priority gap.**
2. **Nobody moderates the open map.** Community owners only have authority
   inside their community. A report on a public profile or pin has nowhere
   to go.
3. **No rate limits anywhere.** One account can post, request connections,
   drop pins and create communities without limit.
4. **An invite link can't be rotated.** The slug *is* the password; if it
   leaks there is no revocation.
5. **No terms, privacy policy or abuse contact.** Not optional before a
   public launch, particularly for a location product in India.
6. **Ownership is a single point of failure.** No transfer; an inactive
   owner freezes their community.
7. **Notifications are in-app only.** Proximity alerts exist (§5.7) but
   only appear when somebody opens the app. Web Push is the missing half
   and is what makes "someone is near you *now*" actually work — it needs
   VAPID keys, a service worker and a subscription table. Activity
   notifications (replied-to, removed, event cancelled) are still unbuilt;
   the `notifications` table and `kind` CHECK are where they'd go.

### Suggested next order of work

1. Block between members, and report → a queue (closes risks 1 and 2)
2. Terms + privacy + abuse contact (risk 5)
3. Rate limits (risk 3)
4. Build-time schema-vs-production check (§8)
5. Notifications on moderation and replies (risk 7)
6. LLM-written match reasons, once real profile text exists (§10)

---

## 12. Working agreements

- **Ship the whole task.** If part is blocked, finish everything else and
  say explicitly what was left and why.
- **Verify before claiming.** Run the gate (§8). For UI work, drive it in a
  browser and *look at the screenshot* — several bugs here were invisible to
  passing tests and obvious in a picture.
- **Say what you found.** If existing behaviour is wrong, fix it and name it
  in the commit; don't quietly paper over it.
- Commit messages explain the decision, not the diff.
