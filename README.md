# OpenNetworks

Boards for events and communities, and a map of the people on them. You scan
a code, see the room, and get told who's worth talking to — and why, in a
sentence you can check against their profile.

## One engine, three surfaces

There is one matcher and one person-shape. What changes between surfaces is
only the candidate pool and how much proximity counts for.

| Surface | What it is | Pool | Proximity |
|---|---|---|---|
| **Event board** | One room, one afternoon | its members | being in the building dominates |
| **Community board** | A batch, a group, an alumni network | its members | a mild bonus |
| **Open map** (`/`) | Everyone who opted in | a radius | smooth distance decay |

**The open map is not a board.** A board has a host, a slug, a QR code and a
member list; the open map has none of those and is `select … where visibility
<> 'off'`. Making it a board row would have meant a fake host, a membership
row per signup, and a cascade delete that could empty the public map.

Event and community differ by one column and a date, so they share a table.
`boards.parentBoardId` is what makes "a member creates an event inside a
community" free — it's a board with a parent; an open-network event is a
board without one.

## The privacy model

This is the part most worth understanding before changing anything.

`users.visibility` is one of three values, and it is read by every query that
can put a person on a map:

- `exact` — the real pin, street level, **never jittered**. Someone who picks
  this is asking to be findable at the venue they're standing in.
- `base` — a city centroid, stored as its own coordinates rather than derived
  by rounding. Rounding leaks: a rounded coordinate still points inside the
  neighbourhood. The *label* is coarsened too — "Hyderabad", never "Banjara
  Hills, Hyderabad".
- `off` — absent from the open map entirely.

Two invariants hold everywhere, and `npm run test:flows` asserts both:

1. **Placement fails closed.** `lib/profiles.ts:place()` returns the one
   coordinate pair the viewer is allowed to see. A precise location never
   leaves that function for someone who chose city-only — so no caller can
   leak it by accident, because they never receive it.
2. **Board membership is its own, narrower consent.** A member set to `off`
   still appears to their own board and never on the public map. You agreed
   to be visible to a room you scanned into; that is not the same as agreeing
   to be on the internet.

Grants and withdrawals append to `consents`. A mutable boolean can say what
is true now but never when it was agreed, which is the only question that
table exists to answer.

## Matching

Intents are picked from a fixed vocabulary (`lib/intents.ts`), not typed
freely, and topics are **complementary**: a topic has a `need` side and an
`offer` side, and matching crosses them. Two people both looking for funding
are not a match; one looking for funding and one who invests is the entire
point.

That choice is what makes the reason checkable — "You're raising. They invest
and make intros." is verifiable against the profile beside it. **No score is
ever rendered.** A percentage invites arithmetic about strangers and loses
every argument with the reader's own judgement.

Scoring is deterministic and runs on every request — it's set intersections
over arrays already in memory. There are no embeddings and no vector
database yet, deliberately: with an enumerated vocabulary the overlap is
already exact, and free text only colours the sentence. The seam for a
model-written reason is `matches.reason`, cached per pair.

## Running it

Needs Node 20+, a local Postgres, and a Mapbox token.

```bash
createdb magicpal_in
cp .env.example .env.local     # then fill in NEXT_PUBLIC_MAPBOX_TOKEN
npm install
npm run db:push                # schema → database
npm run db:seed                # invented demo people, local DBs only
npm run dev
```

Then walk `/`, `/b/hyderabad-product-demo` (an event, live now) and
`/b/isb-pgp-2019-demo` (a community).

There is no email provider in development: the OTP sign-in code is printed
to the server console. Sign in as any seeded address — `meera@example.com`,
`divya@example.com` — or any new one.

### Checks

```bash
npx tsc --noEmit
npm run lint
npm run test:flows   # spawns its own server on :3177
```

`test:flows` needs port 3177 free **and** no other `next dev` running for
this project — Next allows only one per project directory, so stop your dev
server first or it fails on startup rather than on an assertion.

## Notes for whoever is next

- **`drizzle-kit push` does not diff CHECK constraint changes.** It adds new
  ones and silently leaves edited ones alone, so widening
  `users_visibility` to accept `live` looked applied and wasn't — every save
  failed with a bare 500 while the schema file said it was legal. Constraint
  edits go in `drizzle/manual/` and are applied with `psql`; check
  `pg_constraint` after any push that touches one.

- **This is not the Next.js you know.** See `AGENTS.md`: read
  `node_modules/next/dist/docs/` before writing app code. `params` and
  `searchParams` are Promises.
- **`app/globals.css` is unlayered**, while `@import "tailwindcss"` is
  layered. Component classes there (`.label`, `.btn`, `.chip-toggle`)
  therefore **beat** Tailwind utilities on the same element. When you need a
  utility to win, add a sibling class in that stylesheet instead of fighting
  it — `.label-icon` exists for exactly this reason. `.floating-list` is a
  fixed-position bottom sheet, not a scroll container.
- **`react-map-gl`'s default export is named `Map`** and shadows the global
  `Map`. Always `import MapGL from "react-map-gl/mapbox"`. Always
  `projection="mercator"` — the globe projection slides markers off their
  coordinates during flight.
- Anything touching Mapbox or `localStorage` needs a `dynamic(…, { ssr: false })`
  loader, or you get a hydration mismatch. See `*Loader.tsx`.
- The open map's first payload is **server-rendered** (`lib/openMap.ts`,
  shared by the page and `/api/map`) so the map arrives with people on it.
  Keep both callers on that one function or the first paint will disagree
  with the first pan.

## Deliberately not built yet

- **Mentorship.** Two columns collect the signal (`openToMentor`,
  `seekingMentor`) so it ships later as a query rather than a migration
  against a populated table. It needs a community with retention and
  verified members first.
- **In-app chat.** An empty inbox is worse than no inbox. LinkedIn is the
  handoff; `connections` stays as the one conversion metric.
- **Embeddings, PostGIS, payments.** Each is a real next step and none earns
  its setup cost until something measured says so.
