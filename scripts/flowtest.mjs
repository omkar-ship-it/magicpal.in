// End-to-end coverage for the promises the product actually makes: sign in,
// state your intents, join a board, get recommended somebody with a reason,
// and — most of all — appear exactly where you agreed to appear and nowhere
// else. Runs against a real server this script spawns itself (on its own
// port, so it doesn't collide with a dev server you already have open) and a
// real Postgres database.
//
// The privacy assertions are the point of this file. Most of what can go
// wrong in this product is invisible in the UI and only shows up as a row
// in a JSON response that should not have been there.
//
// OTP codes never touch the database in plaintext (they're scrypt-hashed),
// so this reads them the same way a developer would with no email provider
// configured: straight out of the server's console log.

import { spawn } from "node:child_process";
import pg from "pg";

const ALERT_CROWD_THRESHOLD = 3;
const ALERT_DAILY_CAP = 5;
const PORT = 3177;
const BASE = `http://localhost:${PORT}`;
const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

if (!url) {
  console.error("No DATABASE_URL/POSTGRES_URL set — run with .env.local loaded.");
  process.exit(1);
}
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error("Refusing to run flow tests against a non-local database.");
  process.exit(1);
}

let pass = 0;
let fail = 0;
function assert(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}

// ---------------------------------------------------------- tiny cookie jar
function makeJar() {
  let cookie = "";
  return {
    headers: () => (cookie ? { Cookie: cookie } : {}),
    capture: (res) => {
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
    },
  };
}

async function api(path, { method = "GET", jar, body } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(BASE + path, {
        method,
        headers: { "Content-Type": "application/json", ...(jar ? jar.headers() : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (jar) jar.capture(res);
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastErr;
}

// --------------------------------------------------------------- otp codes
let serverLog = "";
function waitForOtp(email, timeoutMs = 5000) {
  const re = new RegExp(`login code for ${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} is (\\d{6})`);
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const m = serverLog.match(re);
      if (m) return resolve(m[1]);
      if (Date.now() - start > timeoutMs) return reject(new Error(`Timed out waiting for OTP for ${email}`));
      setTimeout(tick, 100);
    };
    tick();
  });
}

async function signUp(email) {
  const jar = makeJar();
  await api("/api/auth/request-otp", { method: "POST", jar, body: { email } });
  const code = await waitForOtp(email);
  const { data } = await api("/api/auth/verify-otp", { method: "POST", jar, body: { email, code } });
  return { jar, userId: null, email, onboarded: data.onboarded };
}

/**
 * Walk a redirect chain by hand, with a hop limit.
 *
 * Added after /join and /login were each written to redirect to the other,
 * which turned every QR scan by a signed-out visitor into an infinite
 * redirect. Nothing in the API tests could see it: they authenticate
 * directly and never walk the page graph. Any entry point a person can
 * actually arrive at has to terminate, and that is only checkable here.
 */
async function followChain(path, { jar, max = 6 } = {}) {
  const chain = [path];
  let url = BASE + path;
  for (let i = 0; i < max; i++) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { ...(jar ? jar.headers() : {}) },
    });
    const next = res.headers.get("location");
    if (!next) return { chain, status: res.status, looped: false };
    const resolved = new URL(next, url);
    const rel = resolved.pathname + resolved.search;
    if (chain.includes(rel)) return { chain: [...chain, rel], status: res.status, looped: true };
    chain.push(rel);
    url = resolved.toString();
  }
  return { chain, status: 0, looped: true };
}

async function main() {
  console.log(`Starting server on :${PORT}…`);
  const server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => (serverLog += d.toString()));
  server.stderr.on("data", (d) => (serverLog += d.toString()));

  await new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (/Another next dev server is already running/.test(serverLog)) {
        return reject(new Error("Another `next dev` is already running for this project — stop it first (Next.js only allows one per project dir)."));
      }
      if (/Ready in/.test(serverLog)) return resolve();
      if (Date.now() - start > 30000) return reject(new Error("Server didn't start in time"));
      setTimeout(tick, 150);
    };
    tick();
  });
  await new Promise((r) => setTimeout(r, 1000));

  const pool = new pg.Pool({ connectionString: url });
  const stamp = Date.now();
  const emailA = `flowtest.a.${stamp}@example.com`;
  const emailB = `flowtest.b.${stamp}@example.com`;
  const emailC = `flowtest.c.${stamp}@example.com`;
  const emails = [emailA, emailB, emailC];
  const slugs = [];

  // Far enough from the seed data that its people can't accidentally satisfy
  // an assertion — these tests must pass on an unseeded database too.
  const HERE = { lat: 28.6139, lng: 77.209, label: "Connaught Place, Delhi" };
  const CITY = { lat: 28.7041, lng: 77.1025, label: "Delhi" };

  try {
    console.log("\nAuth + onboarding");
    const a = await signUp(emailA);
    assert(a.onboarded === false, "new account starts un-onboarded");

    const noIntent = await api("/api/profile", { method: "POST", jar: a.jar, body: { name: "X" } });
    assert(noIntent.status === 400, "a profile without a headline is rejected");

    const profileA = await api("/api/profile", {
      method: "POST",
      jar: a.jar,
      body: {
        name: "Flow Alice",
        headline: "Founder, test co",
        workingOn: "Raising a seed round",
        lookingFor: ["funding"],
        canHelpWith: ["product"],
        lat: HERE.lat, lng: HERE.lng, locationLabel: HERE.label,
        baseLat: CITY.lat, baseLng: CITY.lng, baseLabel: CITY.label,
        visibility: "exact",
      },
    });
    assert(profileA.status === 200, "profile saves with intents and a location");

    console.log("\nIntents are a closed vocabulary");
    await api("/api/profile", {
      method: "POST", jar: a.jar,
      body: { name: "Flow Alice", headline: "Founder, test co", lookingFor: ["funding", "not-a-real-topic"], canHelpWith: ["product"],
              lat: HERE.lat, lng: HERE.lng, locationLabel: HERE.label, visibility: "exact" },
    });
    const { rows: ir } = await pool.query("select looking_for from users where email = $1", [emailA]);
    assert(ir[0].looking_for.length === 1 && ir[0].looking_for[0] === "funding", "an unknown topic id is dropped rather than stored");

    console.log("\nInterests and stage are closed vocabularies too");
    await api("/api/profile", {
      method: "POST", jar: a.jar,
      body: {
        name: "Flow Alice", headline: "Founder, test co",
        lookingFor: ["funding"], canHelpWith: ["product"],
        interests: ["fintech", "not-a-sector"], stage: "not-a-stage",
        lat: HERE.lat, lng: HERE.lng, locationLabel: HERE.label, visibility: "exact",
      },
    });
    const { rows: sig } = await pool.query("select interests, stage from users where email = $1", [emailA]);
    assert(sig[0].interests.length === 1 && sig[0].interests[0] === "fintech", "an unknown sector is dropped rather than stored");
    assert(sig[0].stage === null, "an unknown stage is stored as null rather than echoed back");

    await api("/api/profile", {
      method: "POST", jar: a.jar,
      body: {
        name: "Flow Alice", headline: "Founder, test co",
        lookingFor: ["funding"], canHelpWith: ["product"],
        interests: ["fintech"], stage: "founder",
        lat: HERE.lat, lng: HERE.lng, locationLabel: HERE.label, visibility: "exact",
      },
    });
    const { rows: sig2 } = await pool.query("select stage from users where email = $1", [emailA]);
    assert(sig2[0].stage === "founder", "a known stage is stored");

    console.log("\nVisibility is the product's actual promise");
    const b = await signUp(emailB);
    const saveB = (visibility) => api("/api/profile", {
      method: "POST", jar: b.jar,
      body: {
        name: "Flow Bob", headline: "Angel investor",
        lookingFor: ["product"], canHelpWith: ["funding"],
        lat: HERE.lat + 0.004, lng: HERE.lng + 0.004, locationLabel: "Barakhamba, Delhi",
        baseLat: CITY.lat, baseLng: CITY.lng, baseLabel: CITY.label,
        visibility,
      },
    });

    assert((await saveB("exact")).status === 200, "bob saves as exact");
    let map = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`, { jar: a.jar });
    let bob = map.data.people.find((p) => p.name === "Flow Bob");
    assert(Boolean(bob), "an `exact` profile appears on the open map");
    assert(bob.lat === HERE.lat + 0.004 && bob.lng === HERE.lng + 0.004, "`exact` means exact — the pin is not jittered");
    assert(bob.placed === "exact" && bob.locationLabel === "Barakhamba, Delhi", "the label describes the shown position");

    assert((await saveB("base")).status === 200, "bob switches to city-only");
    map = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`, { jar: a.jar });
    bob = map.data.people.find((p) => p.name === "Flow Bob");
    assert(Boolean(bob), "a `base` profile still appears on the open map");
    assert(bob.lat === CITY.lat && bob.lng === CITY.lng, "`base` returns the city centroid, never the street-level pin");
    assert(bob.locationLabel === CITY.label, "`base` returns the city's name, never the neighbourhood's");
    assert(bob.placed === "base", "the response says which precision it is");

    assert((await saveB("off")).status === 200, "bob goes off the map");
    map = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`, { jar: a.jar });
    assert(!map.data.people.some((p) => p.name === "Flow Bob"), "an `off` profile is absent from the open map entirely");

    console.log("\nConsent is logged, not just toggled");
    const { rows: cr } = await pool.query(
      "select kind, granted from consents where user_id = (select id from users where email = $1) order by created_at",
      [emailB]
    );
    assert(cr.length >= 3, "each visibility change appends a consent row");
    assert(cr[cr.length - 1].kind === "open_map_off" && cr[cr.length - 1].granted === false, "the final row records the withdrawal");

    console.log("\nBoards");
    const noBoard = await api("/api/boards", { method: "POST", body: { type: "event", name: "Nope", startsAt: new Date().toISOString() } });
    assert(noBoard.status === 401, "a signed-out visitor can't create a board");

    const undated = await api("/api/boards", { method: "POST", jar: a.jar, body: { type: "event", name: "No Date Event" } });
    assert(undated.status === 400, "an event without a start time is rejected");

    const made = await api("/api/boards", {
      method: "POST", jar: a.jar,
      body: { type: "event", name: "Flowtest Meetup", blurb: "A test", place: "Delhi",
              lat: HERE.lat, lng: HERE.lng, startsAt: new Date(Date.now() - 3600_000).toISOString() },
    });
    assert(made.status === 200 && typeof made.data.slug === "string", "a signed-in member can create an event board");
    const slug = made.data.slug;
    slugs.push(slug);
    assert(/-[a-z0-9]{4}$/.test(slug), "the slug carries a random salt so it can't be guessed by counting");

    const { rows: hostRow } = await pool.query(
      "select role from memberships m join boards bd on bd.id = m.board_id where bd.slug = $1 and m.user_id = (select id from users where email = $2)",
      [slug, emailA]
    );
    assert(hostRow[0]?.role === "host", "the creator is a host member of their own board");

    console.log("\nJoining");
    const joined = await api(`/api/boards/${slug}/join`, { method: "POST", jar: b.jar });
    assert(joined.status === 200, "a signed-in member can join from the link");
    const again = await api(`/api/boards/${slug}/join`, { method: "POST", jar: b.jar });
    assert(again.status === 200, "joining twice is idempotent, not an error");
    const { rows: mc } = await pool.query(
      "select count(*)::int n from memberships m join boards bd on bd.id = m.board_id where bd.slug = $1", [slug]
    );
    assert(mc[0].n === 2, "a second join doesn't create a second membership row");

    const anonJoin = await api(`/api/boards/${slug}/join`, { method: "POST" });
    assert(anonJoin.status === 401, "a signed-out visitor can't join");
    const ghost = await api(`/api/boards/does-not-exist-xxxx/join`, { method: "POST", jar: b.jar });
    assert(ghost.status === 404, "joining a board that doesn't exist 404s");

    console.log("\nThe asymmetry: off the open map, present on your board");
    const boardPage = await fetch(`${BASE}/b/${slug}`, { headers: a.jar.headers() });
    const html = await boardPage.text();
    assert(boardPage.status === 200, "a member can load the board");
    assert(html.includes("Flow Bob"), "a member set to `off` is still visible to their own board");
    map = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`, { jar: a.jar });
    assert(!map.data.people.some((p) => p.name === "Flow Bob"), "…and still absent from the open map at the same moment");

    console.log("\nA non-member can't see who's on a board");
    const c = await signUp(emailC);
    await api("/api/profile", { method: "POST", jar: c.jar,
      body: { name: "Flow Carol", headline: "Curious stranger", lookingFor: ["peers"], canHelpWith: ["peers"], visibility: "off" } });
    const peek = await fetch(`${BASE}/b/${slug}`, { headers: c.jar.headers() });
    const peekHtml = await peek.text();
    assert(peek.status === 200, "a non-member sees the board's landing page");
    assert(!peekHtml.includes("Flow Bob"), "a non-member cannot see the member list");
    assert(peekHtml.includes("on this board"), "…but is told how many people are on it");

    console.log("\nCheck-in");
    const anonHere = await api(`/api/boards/${slug}/checkin`, { method: "POST", body: { here: true } });
    assert(anonHere.status === 401, "a signed-out visitor can't check in");
    const strangerHere = await api(`/api/boards/${slug}/checkin`, { method: "POST", jar: c.jar, body: { here: true } });
    assert(strangerHere.status === 403, "a non-member can't check in to a board they haven't joined");
    const here = await api(`/api/boards/${slug}/checkin`, { method: "POST", jar: b.jar, body: { here: true } });
    assert(here.status === 200, "a member can say they're here");
    const { rows: ci } = await pool.query(
      "select checked_in_at from memberships m join boards bd on bd.id = m.board_id where bd.slug = $1 and m.user_id = (select id from users where email = $2)",
      [slug, emailB]
    );
    assert(ci[0].checked_in_at !== null, "check-in is stored as a timestamp that can expire on its own");

    console.log("\nRecommendations");
    // Alice is raising; Bob invests. That is the whole mechanism.
    const boardHtml = await (await fetch(`${BASE}/b/${slug}`, { headers: a.jar.headers() })).text();
    assert(/You&#x27;re raising|You're raising/.test(boardHtml), "the board explains the match in words, not a score");
    assert(!/\b\d{1,3}% match\b/.test(boardHtml), "no score is ever rendered");

    console.log("\nA community board's events stay private to it");
    const comm = await api("/api/boards", { method: "POST", jar: a.jar, body: { type: "community", name: "Flowtest Community", place: "Everywhere" } });
    assert(comm.status === 200, "a community board can be created");
    slugs.push(comm.data.slug);
    const childEvent = await api("/api/boards", {
      method: "POST", jar: a.jar,
      body: { type: "event", name: "Members Only Evening", startsAt: new Date(Date.now() + 86400_000).toISOString(), parentSlug: comm.data.slug },
    });
    assert(childEvent.status === 200, "a member can create an event inside a community");
    slugs.push(childEvent.data.slug);
    const outsider = await api("/api/boards", {
      method: "POST", jar: c.jar,
      body: { type: "event", name: "Gatecrash", startsAt: new Date(Date.now() + 86400_000).toISOString(), parentSlug: comm.data.slug },
    });
    assert(outsider.status === 403, "a non-member can't hang an event off someone else's community");

    const anonMap = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`);
    assert(anonMap.status === 200, "signed-out visitors can load the open map without a 401");
    assert(anonMap.data.matches.length === 0, "…but get no recommendations, having stated no intent");
    assert(
      !anonMap.data.events.some((e) => e.name === "Members Only Evening"),
      "an event inside a community never appears on the public events list"
    );
    assert(anonMap.data.events.some((e) => e.name === "Flowtest Meetup"), "a parentless event does appear publicly");

    console.log("\nFor you is a run you aim, inside one scope");
    const anonRun = await api("/api/recommendations");
    assert(anonRun.status === 401, "a signed-out visitor can't run recommendations");

    const openRun = await api("/api/recommendations", { jar: a.jar });
    assert(openRun.status === 200, "the open network runs");
    assert(openRun.data.scopeKey === "open", "memory for the open map is its own scope");
    assert(openRun.data.run.reach === "km5", "the open map opens on a radius — proximity is the whole bond");
    assert(
      !openRun.data.run.reaches.includes("anywhere"),
      "…and the ladder stops at the city: past that, a stranger with no shared anything is noise"
    );
    assert(
      !openRun.data.run.deck.some((p) => p.name === "Flow Bob"),
      "somebody off the open map is not recommended on it"
    );

    const eventRun = await api(`/api/recommendations?event=${slug}`, { jar: a.jar });
    assert(eventRun.status === 200, "an event board runs");
    assert(eventRun.data.scopeKey === `event:${slug}`, "an event remembers separately from its community");
    assert(eventRun.data.run.reach === "roster", "an event opens on everyone attending, so a run before it isn't empty");
    assert(
      eventRun.data.run.reaches.join(",") === "here,roster",
      "an event's ladder is presence and the roster — metres are meaningless in one room"
    );
    assert(
      eventRun.data.run.deck.some((p) => p.name === "Flow Bob"),
      "the same person, off the open map, is reachable inside the board he joined"
    );
    const bobCard = eventRun.data.run.deck.find((p) => p.name === "Flow Bob");
    assert(bobCard.twoWay === true, "the exchange is named as going both ways when it does");
    assert(/raising|invest/i.test(bobCard.reason), "every card carries a reason in words");
    assert(!/\d+%/.test(bobCard.reason), "…and never a score");

    const outsiderRun = await api(`/api/recommendations?event=${slug}`, { jar: c.jar });
    assert(outsiderRun.status === 404, "a non-member has nothing to run against — reach can't widen a scope");

    console.log("\nA community is bound by identity, not by distance");
    const commRun = await api(`/api/recommendations?net=${comm.data.slug}`, { jar: a.jar });
    assert(commRun.data.run.reach === "anywhere", "a community opens at the bond, not at a radius");
    assert(commRun.data.run.eligible === 0, "…and Alice is alone on hers");
    assert(
      /Nobody else is on this board yet/.test(commRun.data.run.blocked.line),
      "an empty board says it's empty rather than telling you to ask for less"
    );

    await api(`/api/boards/${comm.data.slug}/join`, { method: "POST", jar: b.jar });
    const commRun2 = await api(`/api/recommendations?net=${comm.data.slug}`, { jar: a.jar });
    assert(
      commRun2.data.run.deck.some((p) => p.name === "Flow Bob"),
      "a member who publishes no location at all is still matchable inside the community"
    );
    const cityRun = await api(`/api/recommendations?net=${comm.data.slug}&reach=city`, { jar: a.jar });
    assert(
      !cityRun.data.run.deck.some((p) => p.name === "Flow Bob"),
      "…but can't answer “my city”, because he never said where he is"
    );

    console.log("\nIn a room, presence is a check-in and not a GPS reading");
    const hereRun = await api(`/api/recommendations?event=${slug}&reach=here`, { jar: a.jar });
    assert(hereRun.data.run.reach === "here", "presence is a reach of its own");
    const herePresent = hereRun.data.run.deck.find((p) => p.name === "Flow Bob");
    assert(Boolean(herePresent) && herePresent.hereNow === true, "somebody checked in is in the room");
    const bobsHereRun = await api(`/api/recommendations?event=${slug}&reach=here`, { jar: b.jar });
    assert(bobsHereRun.data.run.total === 0, "somebody who only RSVP'd is not in the room");
    assert(
      /checked in/.test(bobsHereRun.data.run.blocked.line),
      "…and an empty room names the mechanism instead of blaming the filters"
    );
    assert(bobsHereRun.data.run.blocked.widenTo === "roster", "…offering the roster, which is the loosening");

    console.log("\nThe deck remembers, and a run never advances it on its own");
    const bobUserId = (await pool.query("select id from users where email = $1", [emailB])).rows[0].id;
    const recState = () =>
      pool.query(
        "select state from recommendation_state where user_id = (select id from users where email = $1) and scope_key = $2 and subject_id = $3",
        [emailA, `event:${slug}`, bobUserId]
      );
    assert((await recState()).rowCount === 0, "running records nothing — a refresh must not advance a deck nobody read");

    const marked = await api("/api/recommendations", {
      method: "POST", jar: a.jar,
      body: { scope: `event=${slug}`, state: "shown", ids: [bobUserId] },
    });
    assert(marked.status === 200 && (await recState()).rows[0].state === "shown", "being shown is recorded explicitly");

    const afterShown = await api(`/api/recommendations?event=${slug}`, { jar: a.jar });
    assert(
      !afterShown.data.run.deck.some((p) => p.name === "Flow Bob"),
      "“skip people I've seen” means seen — otherwise the top five stay the top five forever"
    );
    assert(
      afterShown.data.run.followUp.some((p) => p.name === "Flow Bob"),
      "…and whoever the deck moved past becomes the follow-up list, which is “who did I miss”"
    );

    const withSeen = await api(`/api/recommendations?event=${slug}&skipSeen=0`, { jar: a.jar });
    assert(withSeen.data.run.deck.some((p) => p.name === "Flow Bob"), "turning the skip off shows them again");

    await api("/api/recommendations", {
      method: "POST", jar: a.jar,
      body: { scope: `event=${slug}`, state: "dismissed", ids: [bobUserId] },
    });
    await api("/api/recommendations", {
      method: "POST", jar: a.jar,
      body: { scope: `event=${slug}`, state: "shown", ids: [bobUserId] },
    });
    assert((await recState()).rows[0].state === "dismissed", "being rendered again never quietly un-dismisses somebody");

    const badIds = await api("/api/recommendations", {
      method: "POST", jar: a.jar,
      body: { scope: `event=${slug}`, state: "shown", ids: ["not-a-uuid"] },
    });
    assert(badIds.status === 400, "a malformed id is a bad request, not a 500");

    await api("/api/recommendations", { method: "POST", jar: a.jar, body: { scope: `event=${slug}`, reset: true } });
    assert((await recState()).rowCount === 0, "starting the board over forgets it");
    const afterReset = await api(`/api/recommendations?event=${slug}`, { jar: a.jar });
    assert(
      afterReset.data.run.deck.some((p) => p.name === "Flow Bob"),
      "…and brings back the people you passed on, which is the only way back to them"
    );

    console.log("\nA run's criteria are for that run, not for your profile");
    const narrowed = await api(`/api/recommendations?event=${slug}&looking=role`, { jar: a.jar });
    assert(
      narrowed.data.run.criteria.lookingFor.join(",") === "role",
      "the run reports what it actually scored, so the controls can't lie about it"
    );
    const { rows: stillA } = await pool.query("select looking_for from users where email = $1", [emailA]);
    assert(
      stillA[0].looking_for.join(",") === "funding",
      "…and asking for something else today never changes how everybody else sees you"
    );
    // The exact shape the panel puts on the wire: a present-but-empty param
    // so that clearing every chip reads as "nothing", rather than being
    // dropped and silently re-seeded from the profile.
    const cleared = await api(`/api/recommendations?event=${slug}&looking=`, { jar: a.jar });
    assert(cleared.data.run.criteria.lookingFor.length === 0, "clearing every chip means none, not “back to your profile”");
    const appended = await api(`/api/recommendations?event=${slug}&looking=&looking=role`, { jar: a.jar });
    assert(appended.data.run.criteria.lookingFor.join(",") === "role", "…and the empty marker doesn't eat the real values beside it");

    const junkRun = await api(`/api/recommendations?event=${slug}&looking=not-a-real-topic&reach=moon`, { jar: a.jar });
    assert(junkRun.status === 200, "junk criteria don't break the run");
    assert(junkRun.data.run.criteria.lookingFor.length === 0, "…an unknown topic is dropped, not honoured");
    assert(junkRun.data.run.reach === "roster", "…and an unknown reach falls back to the scope's default");
    console.log("\nA community's own mark");
    const logoSlug = comm.data.slug;
    const logoPng = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001" +
        "0d0a2db40000000049454e44ae426082",
      "hex"
    );
    const asFile = (bytes, type, name) => {
      const form = new FormData();
      form.append("file", new File([bytes], name, { type }));
      return form;
    };
    const postLogo = (slug, jar, form) =>
      fetch(`${BASE}/api/boards/${slug}/logo`, { method: "POST", headers: jar ? jar.headers() : {}, body: form })
        .then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));

    const anonLogo = await postLogo(logoSlug, null, asFile(logoPng, "image/png", "l.png"));
    assert(anonLogo.status === 401, "a signed-out visitor can't set a logo");
    const strangerLogo = await postLogo(logoSlug, c.jar, asFile(logoPng, "image/png", "l.png"));
    assert(strangerLogo.status === 403, "neither can a member who doesn't run it");

    const notAnImage = await postLogo(logoSlug, a.jar, asFile(Buffer.from("not an image"), "text/plain", "l.txt"));
    assert(notAnImage.status === 400, "a file that isn't an image is refused");
    const tooBig = await postLogo(
      logoSlug, a.jar,
      asFile(Buffer.alloc(3 * 1024 * 1024, 1), "image/png", "big.png")
    );
    assert(tooBig.status === 400, "an oversized image is refused before it reaches storage");

    const hostLogo = await postLogo(logoSlug, a.jar, asFile(logoPng, "image/png", "l.png"));
    // Blob storage needs a token; locally there usually isn't one, and the
    // route says so rather than half-succeeding. Either answer is correct —
    // what must never happen is a 200 with no stored URL, or a 500.
    assert(
      hostLogo.status === 200 || hostLogo.status === 503,
      `the host's upload either stores it or says storage isn't configured (got ${hostLogo.status})`
    );
    const { rows: logoRow } = await pool.query("select logo_url from boards where slug = $1", [logoSlug]);
    if (hostLogo.status === 200) {
      assert(typeof logoRow[0].logo_url === "string" && logoRow[0].logo_url.length > 0, "…and the row carries the URL");
      const gone = await fetch(`${BASE}/api/boards/${logoSlug}/logo`, { method: "DELETE", headers: a.jar.headers() });
      assert(gone.status === 200, "the host can remove it again");
      const { rows: cleared } = await pool.query("select logo_url from boards where slug = $1", [logoSlug]);
      assert(cleared[0].logo_url === null, "…and the row is cleared");
    } else {
      assert(logoRow[0].logo_url === null, "…and nothing is written when storage is unavailable");
    }

    const logoDelete = await fetch(`${BASE}/api/boards/${logoSlug}/logo`, { method: "DELETE", headers: c.jar.headers() });
    assert(logoDelete.status === 403, "only the host can remove a logo");
    const ghostLogo = await postLogo("no-such-board-xxxx", a.jar, asFile(logoPng, "image/png", "l.png"));
    assert(ghostLogo.status === 404, "a board that doesn't exist 404s rather than creating anything");

    // The payload the community page draws itself from.
    const commShell = await api(`/api/map?net=${logoSlug}`, { jar: a.jar });
    assert("logoUrl" in commShell.data.scope, "the shell's scope carries the logo field");
    assert(
      commShell.data.networks.some((n) => n.slug === logoSlug && "logoUrl" in n),
      "…and so does every network in the picker"
    );
    console.log("\nYour own words, where the vocabulary runs out");
    const ownWordsSave = await api("/api/profile", {
      method: "POST", jar: a.jar,
      body: {
        name: "Flow Alice", headline: "Founder, test co",
        lookingFor: ["funding"], canHelpWith: ["product"],
        customLookingFor: ["  Warehouse  automation ", "warehouse AUTOMATION", "", "   ", "x".repeat(80), "a", "b", "c"],
        customCanHelpWith: ["Carnatic music"],
        customInterests: ["Climate finance", "climate & finance"],
        lat: HERE.lat, lng: HERE.lng, locationLabel: HERE.label, visibility: "exact",
      },
    });
    assert(ownWordsSave.status === 200, "a profile saves with free-text entries beside the chips");
    const { rows: own } = await pool.query(
      "select custom_looking_for c1, custom_can_help_with c2, custom_interests c3 from users where email = $1",
      [emailA]
    );
    assert(own[0].c1[0] === "Warehouse automation", "whitespace is collapsed and trimmed, so two typists match");
    assert(own[0].c1.length === 3, `capped at ${3} entries, not however many were posted`);
    assert(!own[0].c1.includes(""), "empty strings never become tags");
    assert(own[0].c1.every((v) => v.length <= 32), "each entry is length-capped");
    assert(
      own[0].c1.filter((v) => v.toLowerCase().startsWith("warehouse")).length === 1,
      "a case-only repeat is a duplicate, not a second tag"
    );
    assert(own[0].c3.length === 1, "“climate & finance” and “climate finance” are the same claim");

    // The separation that keeps the matcher honest: a typed phrase must
    // never end up anywhere the vocabulary is read from.
    const { rows: vocab } = await pool.query("select looking_for from users where email = $1", [emailA]);
    assert(
      vocab[0].looking_for.join(",") === "funding",
      "a free-text phrase never leaks into the enumerated vocabulary"
    );

    console.log("\nA phrase two people typed is a real match, and says so");
    await api("/api/profile", {
      method: "POST", jar: b.jar,
      body: {
        name: "Flow Bob", headline: "Angel investor",
        lookingFor: ["product"], canHelpWith: ["funding"],
        // Spelled differently on purpose: same claim, different typing.
        customCanHelpWith: ["warehouse automation"],
        customInterests: ["Climate Finance"],
        lat: HERE.lat + 0.004, lng: HERE.lng + 0.004, locationLabel: "Barakhamba, Delhi",
        visibility: "exact",
      },
    });
    const ownRun = await api(`/api/recommendations?event=${slug}&skipSeen=0`, { jar: a.jar });
    const bobOwn = ownRun.data.run.deck.find((p) => p.name === "Flow Bob");
    assert(Boolean(bobOwn), "the match still lands");
    assert(
      /warehouse automation/i.test(bobOwn.reason) || /raising|invest/i.test(bobOwn.reason),
      "the reason names something checkable on their profile"
    );

    // Alice needs only the typed phrase now — no vocabulary overlap at all,
    // which is the case that would have returned nothing before.
    await api("/api/profile", {
      method: "POST", jar: a.jar,
      body: {
        name: "Flow Alice", headline: "Founder, test co",
        lookingFor: [], canHelpWith: [], interests: [],
        customLookingFor: ["Warehouse automation"],
        customCanHelpWith: [], customInterests: [],
        lat: HERE.lat, lng: HERE.lng, locationLabel: HERE.label, visibility: "exact",
      },
    });
    const onlyOwn = await api(`/api/recommendations?event=${slug}&skipSeen=0`, { jar: a.jar });
    const bobOnly = onlyOwn.data.run.deck.find((p) => p.name === "Flow Bob");
    assert(Boolean(bobOnly), "somebody whose only stated need is hand-typed still gets matched");
    assert(
      /warehouse automation/i.test(bobOnly.reason),
      "…and the reason quotes the phrase, which is what makes it checkable"
    );
    assert(!/\d+%/.test(bobOnly.reason), "…with no score, as everywhere else");

    const openOwn = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`, { jar: a.jar });
    assert(openOwn.data.hasSignals === true, "typed words count as having stated something to match on");
    const bobOnMap = openOwn.data.people.find((p) => p.name === "Flow Bob");
    assert(
      bobOnMap.customCanHelpWith.join(",") === "warehouse automation",
      "the map payload carries them, so cards can show them"
    );

    console.log("\nA phrase nobody else typed matches nobody, rather than guessing");
    await api("/api/profile", {
      method: "POST", jar: c.jar,
      body: {
        name: "Flow Carol", headline: "Curious stranger",
        lookingFor: [], canHelpWith: [], interests: [],
        customLookingFor: ["Antique clock repair"],
        lat: HERE.lat, lng: HERE.lng, locationLabel: HERE.label, visibility: "exact",
      },
    });
    const carolRun = await api("/api/recommendations", { jar: c.jar });
    assert(
      carolRun.data.run.deck.every((p) => !/antique clock/i.test(p.reason)),
      "an unmatched phrase is never stretched into a reason about somebody else"
    );

    // Restore Alice and Bob for everything downstream. Every field the
    // earlier sections asserted on has to be named here: the profile route
    // writes the whole vocabulary on every save, so a field left out of
    // this body is a field this section quietly erased.
    await api("/api/profile", {
      method: "POST", jar: a.jar,
      body: {
        name: "Flow Alice", headline: "Founder, test co", workingOn: "Raising a seed round",
        lookingFor: ["funding"], canHelpWith: ["product"],
        interests: ["fintech"], stage: "founder",
        customLookingFor: [], customCanHelpWith: [], customInterests: [],
        lat: HERE.lat, lng: HERE.lng, locationLabel: HERE.label,
        baseLat: CITY.lat, baseLng: CITY.lng, baseLabel: CITY.label, visibility: "exact",
      },
    });
    await api("/api/profile", {
      method: "POST", jar: b.jar,
      body: {
        name: "Flow Bob", headline: "Angel investor",
        lookingFor: ["product"], canHelpWith: ["funding"],
        customLookingFor: [], customCanHelpWith: [], customInterests: [],
        lat: HERE.lat + 0.004, lng: HERE.lng + 0.004, locationLabel: "Barakhamba, Delhi",
        baseLat: CITY.lat, baseLng: CITY.lng, baseLabel: CITY.label, visibility: "off",
      },
    });
    await api("/api/profile", {
      method: "POST", jar: c.jar,
      body: { name: "Flow Carol", headline: "Curious stranger", lookingFor: ["peers"], canHelpWith: ["peers"],
              customLookingFor: [], visibility: "off" },
    });
    console.log("\nA missing coordinate is missing, not the Gulf of Guinea");
    // The bug this covers shipped: `Number(null)` is 0 and 0 is finite, so
    // every place search read as a reverse-geocode of 0°, 0° and the text
    // branch was unreachable. Real members ended up pinned at Null Island.
    const textSearch = await api("/api/geocode?q=Hyderabad");
    assert(textSearch.status === 200, "a text search answers");
    assert(
      !textSearch.data.results?.some((r) => r.lat === 0 && r.lng === 0),
      "…and never answers a place name with 0,0"
    );
    assert(
      !textSearch.data.results?.some((r) => /^-?\d+\.\d+, *-?\d+\.\d+$/.test(r.label ?? "")),
      "…nor with a label that is just the coordinates it failed to find"
    );

    const nullIsland = await api("/api/profile", {
      method: "POST", jar: a.jar,
      body: {
        name: "Flow Alice", headline: "Founder, test co",
        lookingFor: ["funding"], canHelpWith: ["product"], interests: ["fintech"], stage: "founder",
        lat: 0, lng: 0, locationLabel: "0.0000, 0.0000", visibility: "exact",
      },
    });
    assert(nullIsland.status === 400, "0,0 is refused as a location — it is the sentinel for 'none'");
    const { rows: stillPlaced } = await pool.query("select lat, lng from users where email = $1", [emailA]);
    assert(stillPlaced[0].lat !== 0, "…and the real pin that was already there survives the attempt");

    const nullCoords = await api("/api/profile", {
      method: "POST", jar: a.jar,
      body: {
        name: "Flow Alice", headline: "Founder, test co",
        lookingFor: ["funding"], canHelpWith: ["product"], interests: ["fintech"], stage: "founder",
        lat: null, lng: null, locationLabel: "Somewhere", visibility: "exact",
      },
    });
    assert(nullCoords.status === 200, "a save with no coordinates is allowed — the old pin stands");
    const { rows: untouched } = await pool.query("select lat, lng from users where email = $1", [emailA]);
    assert(
      untouched[0].lat !== 0 && untouched[0].lat !== null,
      "…and a null coordinate never coerces into a pin at zero"
    );

    console.log("\nLive sharing has to have somewhere to fall back to");
    // Live decays to the city by design, so a live profile with no city
    // vanishes from the map the moment the tab closes — which happened to a
    // real member who had picked the most visible setting there is.
    const d = await signUp(`flowtest.d.${stamp}@example.com`);
    emails.push(`flowtest.d.${stamp}@example.com`);
    const liveNoCity = await api("/api/profile", {
      method: "POST", jar: d.jar,
      body: {
        name: "Flow Dana", headline: "Nomad", lookingFor: ["peers"], canHelpWith: ["peers"],
        lat: HERE.lat, lng: HERE.lng, locationLabel: HERE.label, visibility: "live",
      },
    });
    assert(liveNoCity.status === 400, "live without a city is refused");
    assert(/city/i.test(liveNoCity.data.error ?? ""), "…and says which thing is missing");

    const liveWithCity = await api("/api/profile", {
      method: "POST", jar: d.jar,
      body: {
        name: "Flow Dana", headline: "Nomad", lookingFor: ["peers"], canHelpWith: ["peers"],
        lat: HERE.lat, lng: HERE.lng, locationLabel: HERE.label,
        baseLat: CITY.lat, baseLng: CITY.lng, baseLabel: CITY.label, visibility: "live",
      },
    });
    assert(liveWithCity.status === 200, "live with a city is fine");
    const nullLivePush = await api("/api/live", { method: "POST", jar: d.jar, body: { lat: null, lng: null } });
    assert(nullLivePush.status === 400, "a live push with no coordinates is refused, not stored at 0,0");
    const { rows: notMoved } = await pool.query("select lat from users where email = $1", [
      `flowtest.d.${stamp}@example.com`,
    ]);
    assert(notMoved[0].lat !== 0, "…and the position already there is not overwritten with zero");
    // And the fallback actually works: age the heartbeat past the window.
    await pool.query("update users set live_at = now() - interval '1 day' where email = $1", [
      `flowtest.d.${stamp}@example.com`,
    ]);
    const staleLive = await api(`/api/map?lat=${CITY.lat}&lng=${CITY.lng}&radiusKm=50`, { jar: a.jar });
    const dana = staleLive.data.people.find((p) => p.name === "Flow Dana");
    assert(Boolean(dana), "somebody whose live session lapsed is still on the map, at their city");
    assert(dana.placed === "base", "…shown at city precision, never at the stale street-level pin");
    console.log("\nNot having answered is not the same as having said no");
    // Almost everybody sitting at `off` never reached the location step —
    // `off` is the column default. They have declined nothing, and leaving
    // them out of the directory makes the network look empty while real
    // members with stated needs sit in it unreachable. Somebody who
    // *actually* turned the map off is a different person, and the consents
    // log is what separates them.
    const emailE = `flowtest.e.${stamp}@example.com`;
    emails.push(emailE);
    const e = await signUp(emailE);
    await api("/api/profile", {
      method: "POST", jar: e.jar,
      body: {
        name: "Flow Evan", headline: "Never finished onboarding",
        lookingFor: ["funding"], canHelpWith: ["technical"], interests: ["ai"],
        // No coordinates at all, and visibility left at the default.
      },
    });
    const { rows: evanRow } = await pool.query(
      "select visibility, lat, base_lat from users where email = $1", [emailE]
    );
    assert(evanRow[0].visibility === "off", "the default really is off");
    assert(evanRow[0].lat === null && evanRow[0].base_lat === null, "…with no position of any kind");
    const { rows: evanConsent } = await pool.query(
      "select count(*)::int n from consents where kind = 'open_map_off' and user_id = (select id from users where email = $1)",
      [emailE]
    );
    assert(evanConsent[0].n === 0, "…and no consent row, because no choice was ever made");

    const dir = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`, { jar: a.jar });
    const evan = dir.data.people.find((p) => p.name === "Flow Evan");
    assert(Boolean(evan), "somebody who never answered is listed in the directory");
    assert(evan.unplaced === true, "…flagged as having no pin, so no surface tries to draw one");
    assert(evan.locationLabel === null, "…with no invented location label");
    assert(evan.lat === 0 && evan.lng === 0, "…and coordinates that are a carrier for 'absent'");
    assert(
      !dir.data.matches.some((m) => m.id === evan.id),
      "…but not recommended on the open map, where proximity is the whole bond"
    );

    // The promise, kept. Carol turns the map off on purpose.
    await api("/api/profile", {
      method: "POST", jar: c.jar,
      body: {
        name: "Flow Carol", headline: "Curious stranger", lookingFor: ["peers"], canHelpWith: ["peers"],
        baseLat: CITY.lat, baseLng: CITY.lng, baseLabel: CITY.label, visibility: "base",
      },
    });
    const visible = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=50`, { jar: a.jar });
    assert(visible.data.people.some((p) => p.name === "Flow Carol"), "Carol is on the map while she says so");
    await api("/api/profile", {
      method: "POST", jar: c.jar,
      body: {
        name: "Flow Carol", headline: "Curious stranger", lookingFor: ["peers"], canHelpWith: ["peers"],
        baseLat: CITY.lat, baseLng: CITY.lng, baseLabel: CITY.label, visibility: "off",
      },
    });
    const { rows: carolConsent } = await pool.query(
      "select granted from consents where kind = 'open_map_off' and user_id = (select id from users where email = $1)",
      [emailC]
    );
    assert(carolConsent.length > 0 && carolConsent[0].granted === false, "turning it off is logged as a refusal");
    const afterOff = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=50`, { jar: a.jar });
    assert(
      !afterOff.data.people.some((p) => p.name === "Flow Carol"),
      "somebody who turned the map off is gone from the directory too, not merely from the pins"
    );
    assert(
      afterOff.data.people.some((p) => p.name === "Flow Evan"),
      "…while the person who simply never answered is still listed"
    );
    console.log("\nThe directory is a list of people, not a list of people nearby");
    // Bob at a distance: far enough that any sane radius would have cut him,
    // close enough that this doesn't depend on which default is in force.
    const FAR = { lat: 19.076, lng: 72.8777, label: "Mumbai" }; // ~710km from Delhi
    await api("/api/profile", {
      method: "POST", jar: b.jar,
      body: {
        name: "Flow Bob", headline: "Angel investor",
        lookingFor: ["product"], canHelpWith: ["funding"],
        lat: FAR.lat, lng: FAR.lng, locationLabel: FAR.label,
        baseLat: FAR.lat, baseLng: FAR.lng, baseLabel: FAR.label,
        visibility: "exact",
      },
    });

    const near = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=2`, { jar: a.jar });
    const farBob = near.data.people.find((p) => p.name === "Flow Bob");
    assert(Boolean(farBob), "somebody 700km away is still in the directory");
    assert(farBob.distanceKm > 500, "…carrying the real distance, so a filter can act on it");

    // And the map's own centre doesn't decide who exists.
    const fromMumbai = await api(`/api/map?lat=${FAR.lat}&lng=${FAR.lng}`, { jar: a.jar });
    const sameFromThere = fromMumbai.data.people.find((p) => p.name === "Flow Bob");
    assert(Boolean(sameFromThere), "…and he's there whichever way the map is pointed");
    assert(
      sameFromThere.distanceKm < 5,
      "…with the distance recomputed from wherever the reader is looking"
    );

    // Nearest-first is what makes the result cap defensible when it bites.
    const placedOnly = fromMumbai.data.people.filter((p) => p.distanceKm != null);
    const ordered = placedOnly.every(
      (p, i) => i === 0 || placedOnly[i - 1].distanceKm <= p.distanceKm
    );
    assert(ordered, "the list comes back nearest-first");

    // Put Bob back where the rest of the suite expects him.
    await api("/api/profile", {
      method: "POST", jar: b.jar,
      body: {
        name: "Flow Bob", headline: "Angel investor",
        lookingFor: ["product"], canHelpWith: ["funding"],
        lat: HERE.lat + 0.004, lng: HERE.lng + 0.004, locationLabel: "Barakhamba, Delhi",
        baseLat: CITY.lat, baseLng: CITY.lng, baseLabel: CITY.label, visibility: "off",
      },
    });
    console.log("\nFeed is scoped and private");
    const openFeed = await api("/api/feed", { jar: a.jar });
    assert(openFeed.status === 200, "the open network's feed loads");
    assert(
      openFeed.data.items.every((i) => i.person?.name !== "Flow Alice"),
      "your own actions are not in your own feed"
    );
    const privateFeed = await api(`/api/feed?net=${comm.data.slug}`, { jar: c.jar });
    assert(privateFeed.status === 403, "a non-member can't read a community's feed");
    const memberFeed = await api(`/api/feed?net=${comm.data.slug}`, { jar: a.jar });
    assert(memberFeed.status === 200, "a member can");

    console.log("\nMessaging needs an accepted connection");
    const noThreads = await api("/api/threads");
    assert(noThreads.status === 401, "threads need a session");

    const req = await api("/api/connections", { method: "POST", jar: a.jar, body: { toUserId: null } });
    assert(req.status >= 400, "a connection request needs a real recipient");

    // Alice asks Bob; the thread must stay shut until he accepts.
    const bobId = (await pool.query("select id from users where email = $1", [emailB])).rows[0].id;
    const ask = await api("/api/connections", {
      method: "POST", jar: a.jar, body: { toUserId: bobId, note: "Flowtest hello" },
    });
    assert(ask.status === 200, "a connection request sends");
    const connId = (await pool.query(
      "select id from connections where requester_id = (select id from users where email = $1)", [emailA]
    )).rows[0].id;

    const early = await api("/api/messages", { method: "POST", jar: a.jar, body: { connectionId: connId, body: "hi" } });
    assert(early.status === 403, "you can't message before they accept");

    const snoop = await api(`/api/messages?connectionId=${connId}`, { jar: c.jar });
    assert(snoop.status === 404, "a stranger can't read someone else's thread");

    await api(`/api/connections/${connId}/respond`, { method: "POST", jar: b.jar, body: { accept: true } });
    const nowOk = await api("/api/messages", { method: "POST", jar: a.jar, body: { connectionId: connId, body: "hi" } });
    assert(nowOk.status === 200, "…and can once they have");

    const thread = await api(`/api/messages?connectionId=${connId}`, { jar: b.jar });
    assert(
      thread.data.messages.some((m) => m.body === "Flowtest hello"),
      "the request note is delivered as the thread's first message"
    );
    const snoopAfter = await api("/api/messages", {
      method: "POST", jar: c.jar, body: { connectionId: connId, body: "butting in" },
    });
    assert(snoopAfter.status === 404, "a stranger still can't post into it");

    console.log("\nAttachments");
    const BLOB = "https://x1ui46jl4bfgodpy.public.blob.vercel-storage.com/chat/a-1.png";
    const img = { kind: "image", url: BLOB, name: "whiteboard.png", mime: "image/png", size: 2048 };

    const empty = await api("/api/messages", { method: "POST", jar: a.jar, body: { connectionId: connId, body: "  " } });
    assert(empty.status === 400, "a message with no words and no files is refused");

    const justFile = await api("/api/messages", {
      method: "POST", jar: a.jar, body: { connectionId: connId, body: "", attachments: [img] },
    });
    assert(justFile.status === 200, "…but a photo on its own is a message");

    const withFile = await api(`/api/messages?connectionId=${connId}`, { jar: b.jar });
    const got = withFile.data.messages.find((m) => (m.attachments ?? []).length > 0);
    assert(Boolean(got), "attachments come back with the thread");
    assert(got.attachments[0].name === "whiteboard.png", "…with the name they were sent under");
    assert(got.attachments[0].kind === "image", "…and the kind that decides how they render");

    // The control that matters: the send endpoint takes URLs from the client,
    // so anything not on our own blob host would be a phishing surface
    // wearing our chrome.
    const foreign = await api("/api/messages", {
      method: "POST", jar: a.jar,
      body: { connectionId: connId, body: "", attachments: [{ ...img, url: "https://evil.example.com/x.png" }] },
    });
    assert(foreign.status === 400, "an attachment pointing off our blob host is dropped, leaving nothing to send");

    const lookalike = await api("/api/messages", {
      method: "POST", jar: a.jar,
      body: {
        connectionId: connId, body: "",
        attachments: [{ ...img, url: "https://x.public.blob.vercel-storage.com.evil.com/x.png" }],
      },
    });
    assert(lookalike.status === 400, "…and a hostname that merely starts the same way doesn't pass either");

    const script = await api("/api/messages", {
      method: "POST", jar: a.jar,
      body: { connectionId: connId, body: "", attachments: [{ ...img, mime: "image/svg+xml", name: "x.svg" }] },
    });
    assert(script.status === 400, "svg is refused — it runs script when opened");

    const many = await api("/api/messages", {
      method: "POST", jar: a.jar,
      body: {
        connectionId: connId, body: "lots",
        attachments: [1, 2, 3, 4, 5, 6].map((n) => ({ ...img, url: `${BLOB}?${n}` })),
      },
    });
    assert(many.status === 200, "an over-full message still sends");
    const capped = await api(`/api/messages?connectionId=${connId}`, { jar: b.jar });
    const last = capped.data.messages.filter((m) => m.body === "lots")[0];
    assert(last.attachments.length === 4, "…with the attachment count capped rather than the message rejected");

    const huge = await api("/api/messages", {
      method: "POST", jar: a.jar,
      body: { connectionId: connId, body: "", attachments: [{ ...img, size: 99 * 1024 * 1024 }] },
    });
    assert(huge.status === 400, "a file claiming to be 99MB is dropped");

    console.log("\nShared interests are a matching signal of their own");
    // Carol shares a sector with Alice but needs nothing Alice offers, so
    // she can only surface through the symmetric interest signal.
    await api("/api/profile", {
      method: "POST", jar: c.jar,
      body: {
        name: "Flow Carol", headline: "Curious stranger",
        lookingFor: [], canHelpWith: [], interests: ["fintech"], stage: "operator",
        lat: HERE.lat + 0.002, lng: HERE.lng + 0.002, locationLabel: "Near Alice",
        baseLat: CITY.lat, baseLng: CITY.lng, baseLabel: CITY.label,
        visibility: "exact",
      },
    });
    const withShared = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`, { jar: a.jar });
    const carol = withShared.data.matches.find((m) =>
      withShared.data.people.find((p) => p.id === m.id && p.name === "Flow Carol")
    );
    assert(Boolean(carol), "someone with no complementary need still matches on a shared interest");
    assert(
      Boolean(carol) && /both into fintech/i.test(carol.reason),
      "…and the reason says why, rather than falling back to 'no overlap'"
    );

    console.log("\nYou can always see yourself");
    const mine = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`, { jar: a.jar });
    assert(Boolean(mine.data.you), "the payload carries your own marker");
    assert(mine.data.you.id && mine.data.you.name === "Flow Alice", "…and it's you");
    assert(
      !mine.data.people.some((p) => p.id === mine.data.you.id),
      "you are not also in the people list — one marker, not two"
    );

    // Going dark must not hide you from your own screen: the only way to
    // check a privacy setting is to see what it did.
    await api("/api/profile", {
      method: "POST", jar: a.jar,
      body: {
        name: "Flow Alice", headline: "Founder, test co",
        lookingFor: ["funding"], canHelpWith: ["product"], interests: ["fintech"],
        lat: HERE.lat, lng: HERE.lng, locationLabel: HERE.label,
        baseLat: CITY.lat, baseLng: CITY.lng, baseLabel: CITY.label,
        visibility: "off",
      },
    });
    const dark = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`, { jar: a.jar });
    assert(Boolean(dark.data.you), "you still see yourself when you're off the map");
    assert(dark.data.you.visibility === "off", "…labelled as hidden, so the setting is checkable");
    const seenByOther = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`, { jar: b.jar });
    assert(
      !seenByOther.data.people.some((p) => p.name === "Flow Alice"),
      "…while nobody else sees you at all"
    );

    console.log("\nNo stated signals is a different problem from no matches");
    assert(dark.data.hasSignals === true, "someone with intents has signals");
    await api("/api/profile", {
      method: "POST", jar: a.jar,
      body: {
        name: "Flow Alice", headline: "Founder, test co",
        lookingFor: [], canHelpWith: [], interests: [],
        lat: HERE.lat, lng: HERE.lng, locationLabel: HERE.label, visibility: "exact",
      },
    });
    const blank = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`, { jar: a.jar });
    assert(blank.data.hasSignals === false, "someone who stated nothing is flagged, not blamed on the room");

    console.log("\nEvents carry their details, and take an RSVP");
    const rich = await api("/api/boards", {
      method: "POST", jar: a.jar,
      body: {
        type: "event", name: "Flowtest Dinner", blurb: "Long overdue",
        details: "Dinner then drinks.", address: "2nd floor, ring the bell",
        url: "lu.ma/flowtest", capacity: 2, place: "Delhi",
        lat: HERE.lat, lng: HERE.lng,
        startsAt: new Date(Date.now() + 86400_000).toISOString(),
        endsAt: new Date(Date.now() + 90000_000).toISOString(),
      },
    });
    assert(rich.status === 200, "an event saves with details, address, capacity and a link");
    slugs.push(rich.data.slug);
    const { rows: evRow } = await pool.query(
      "select details, address, url, capacity, ends_at from boards where slug = $1", [rich.data.slug]
    );
    assert(evRow[0].details === "Dinner then drinks.", "details persist");
    assert(evRow[0].address === "2nd floor, ring the bell", "the how-to-get-in note persists");
    assert(evRow[0].url === "https://lu.ma/flowtest", "a bare link is given a scheme");
    assert(evRow[0].capacity === 2, "capacity persists");
    assert(evRow[0].ends_at !== null, "an end time persists");

    const anonRsvp = await api(`/api/boards/${rich.data.slug}/rsvp`, { method: "POST", body: { rsvp: "going" } });
    assert(anonRsvp.status === 401, "a signed-out visitor can't RSVP");
    const badRsvp = await api(`/api/boards/${rich.data.slug}/rsvp`, { method: "POST", jar: b.jar, body: { rsvp: "perhaps" } });
    assert(badRsvp.status === 400, "an invented answer is refused");

    // Bob isn't a member yet: saying "going" has to join him, not fail.
    const bobGoing = await api(`/api/boards/${rich.data.slug}/rsvp`, { method: "POST", jar: b.jar, body: { rsvp: "going" } });
    assert(bobGoing.status === 200, "a non-member saying 'going' is joined, not rejected");
    const { rows: rsvpRow } = await pool.query(
      "select rsvp from memberships m join boards bd on bd.id = m.board_id where bd.slug = $1 and m.user_id = (select id from users where email = $2)",
      [rich.data.slug, emailB]
    );
    assert(rsvpRow[0]?.rsvp === "going", "…and the answer is recorded");

    const communityRsvp = await api(`/api/boards/${comm.data.slug}/rsvp`, { method: "POST", jar: a.jar, body: { rsvp: "going" } });
    assert(communityRsvp.status === 400, "a community doesn't take an RSVP — only events do");

    console.log("\nLive location can't be pushed unless you turned it on");
    const liveOff = await api("/api/live", { method: "POST", jar: b.jar, body: { lat: 28.6, lng: 77.2 } });
    assert(liveOff.status === 409, "a stale tab can't keep writing a position after you go private");
    const goLive = await api("/api/profile", {
      method: "POST", jar: b.jar,
      body: {
        name: "Flow Bob", headline: "Angel investor", lookingFor: ["product"], canHelpWith: ["funding"],
        baseLat: CITY.lat, baseLng: CITY.lng, baseLabel: CITY.label, visibility: "live",
      },
    });
    assert(goLive.status === 200, "switching to live sharing saves");
    const liveOn = await api("/api/live", { method: "POST", jar: b.jar, body: { lat: 28.6, lng: 77.2 } });
    assert(liveOn.status === 200, "…and can once live sharing is on");
    const liveBad = await api("/api/live", { method: "POST", jar: b.jar, body: { lat: 999, lng: 77.2 } });
    assert(liveBad.status === 400, "nonsense coordinates are refused");
    const { rows: liveRow } = await pool.query("select live_at from users where email = $1", [emailB]);
    assert(liveRow[0].live_at !== null, "the position is stamped so it can expire on its own");
    const stopped = await api("/api/live", { method: "DELETE", jar: b.jar });
    assert(stopped.status === 200, "stopping works");
    const { rows: afterStop } = await pool.query("select visibility, live_at from users where email = $1", [emailB]);
    assert(
      afterStop[0].visibility === "base" && afterStop[0].live_at === null,
      "…and drops you to your city rather than off the map entirely"
    );

    console.log("\nConnections are counted");
    const counted = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`, { jar: a.jar });
    assert(typeof counted.data.connections === "number", "the payload carries a connection count");
    assert(counted.data.connections >= 1, "…and it counts the accepted one from earlier");

    // "My network" is a filter over the payload, so what it needs from the
    // server is that every person says whether they're connected to the
    // reader — and that `connected` is the word, since `accepted` is a
    // status this never emits.
    const everyone = counted.data.people;
    assert(
      everyone.every((p) => ["connected", "pending", "none"].includes(p.connectionStatus)),
      "every person on the open map carries their connection status to the reader"
    );
    const connectedToAlice = everyone.filter((p) => p.connectionStatus === "connected");
    assert(connectedToAlice.length >= 1, "…and somebody Alice accepted reads as connected");
    assert(
      connectedToAlice.every((p) => p.id !== counted.data.you?.id),
      "…never the reader themselves, who is not in the list at all"
    );

    // Signed out there is no such thing as "my network".
    const anonStatus = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`);
    assert(
      anonStatus.data.people.every((p) => p.connectionStatus === "none"),
      "a signed-out visitor is connected to nobody, rather than inheriting somebody else's network"
    );

    console.log("\nCommunities are networks; events happen inside them");
    const nets = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`, { jar: a.jar });
    assert(
      nets.data.networks.every((n) => n.slug === null || n.type === "community"),
      "the switcher lists communities only, never one-evening events"
    );
    assert(
      nets.data.networks.some((n) => n.slug === comm.data.slug),
      "…and does list the community"
    );

    // Scanning an event's QR joins the event, its community, and RSVPs.
    const inner = await api("/api/boards", {
      method: "POST", jar: a.jar,
      body: {
        type: "event", name: "Members Evening Two", parentSlug: comm.data.slug,
        startsAt: new Date(Date.now() + 86400_000).toISOString(),
      },
    });
    assert(inner.status === 200, "an event can be created inside a community");
    slugs.push(inner.data.slug);

    const scan = await followChain(`/join/${inner.data.slug}`, { jar: b.jar });
    assert(!scan.looped, "scanning an event's code doesn't loop");
    const landed = scan.chain[scan.chain.length - 1];
    assert(landed.includes(`net=${comm.data.slug}`), "it lands on the community, not a network of one evening");
    assert(landed.includes(`event=${inner.data.slug}`), "…opened on the event that was scanned");

    const { rows: afterScan } = await pool.query(
      `select bd.slug, m.rsvp from memberships m join boards bd on bd.id = m.board_id
       where m.user_id = (select id from users where email = $1) and bd.slug = any($2)`,
      [emailB, [inner.data.slug, comm.data.slug]]
    );
    assert(afterScan.length === 2, "the scan joined both the event and its community");
    assert(
      afterScan.find((r) => r.slug === inner.data.slug)?.rsvp === "going",
      "…and recorded them as going"
    );

    console.log("\nPosting to a community's feed");
    const stranger = await api("/api/posts", {
      method: "POST", jar: c.jar, body: { boardSlug: comm.data.slug, body: "let me in" },
    });
    assert(stranger.status === 403, "a non-member can't post to a community");
    const anonPost = await api("/api/posts", { method: "POST", body: { boardSlug: comm.data.slug, body: "hi" } });
    assert(anonPost.status === 401, "a signed-out visitor can't post");
    const emptyPost = await api("/api/posts", {
      method: "POST", jar: a.jar, body: { boardSlug: comm.data.slug, body: "   " },
    });
    assert(emptyPost.status === 400, "an empty post is refused");

    const posted = await api("/api/posts", {
      method: "POST", jar: a.jar,
      body: { boardSlug: comm.data.slug, body: "Dinner photos are up", url: "rgukt.ac.in/alumni" },
    });
    assert(posted.status === 200, "a member can post");

    const feedAfter = await api(`/api/feed?net=${comm.data.slug}`, { jar: a.jar });
    const mine2 = feedAfter.data.items.find((i) => i.kind === "post");
    assert(Boolean(mine2), "the post appears in that community's feed");
    assert(mine2.post.url === "https://rgukt.ac.in/alumni", "a bare link is given a scheme");
    assert(mine2.post.canDelete === true, "the author may remove their own");

    // A post is private to its community, like everything else on a board.
    const openFeed2 = await api("/api/feed", { jar: a.jar });
    assert(
      !openFeed2.data.items.some((i) => i.kind === "post"),
      "community posts never leak onto the open network's feed"
    );

    // An event from somewhere else can't be advertised into this community.
    const wrongEvent = await api("/api/posts", {
      method: "POST", jar: a.jar,
      body: { boardSlug: comm.data.slug, body: "come along", eventSlug: slug },
    });
    assert(wrongEvent.status === 400, "an event from another community can't be attached");

    console.log("\nRemoving a post");
    const notYours = await api(`/api/posts/${mine2.post.id}`, { method: "DELETE", jar: c.jar });
    assert(notYours.status === 403, "a stranger can't remove somebody else's post");

    // Bob joins and posts; Alice hosts the community, so she can remove it.
    await api(`/api/boards/${comm.data.slug}/join`, { method: "POST", jar: b.jar });
    const bobPost = await api("/api/posts", {
      method: "POST", jar: b.jar, body: { boardSlug: comm.data.slug, body: "see you there" },
    });
    assert(bobPost.status === 200, "a newly joined member can post");
    const hostRemoved = await api(`/api/posts/${bobPost.data.id}`, { method: "DELETE", jar: a.jar });
    assert(hostRemoved.status === 200, "the community's host can remove any post on it");

    const ownRemoved = await api(`/api/posts/${mine2.post.id}`, { method: "DELETE", jar: a.jar });
    assert(ownRemoved.status === 200, "an author can remove their own");
    const feedFinal = await api(`/api/feed?net=${comm.data.slug}`, { jar: a.jar });
    assert(
      !feedFinal.data.items.some((i) => i.kind === "post"),
      "removed posts leave the feed"
    );

    console.log("\nOnly a host can edit a board");
    const anonEdit = await api(`/api/boards/${rich.data.slug}`, { method: "PATCH", body: { name: "Hijacked" } });
    assert(anonEdit.status === 401, "a signed-out visitor can't edit");
    const memberEdit = await api(`/api/boards/${rich.data.slug}`, {
      method: "PATCH", jar: b.jar, body: { name: "Hijacked" },
    });
    assert(memberEdit.status === 403, "a member who isn't the host can't edit");

    const hostEdit = await api(`/api/boards/${rich.data.slug}`, {
      method: "PATCH", jar: a.jar,
      body: { name: "Flowtest Dinner v2", address: "4th floor", lat: HERE.lat + 0.01, lng: HERE.lng + 0.01 },
    });
    assert(hostEdit.status === 200, "the host can edit");
    const { rows: edited } = await pool.query(
      "select name, address, lat, details from boards where slug = $1", [rich.data.slug]
    );
    assert(edited[0].name === "Flowtest Dinner v2", "the name changed");
    assert(edited[0].address === "4th floor", "the address changed");
    assert(Math.abs(Number(edited[0].lat) - (HERE.lat + 0.01)) < 0.0001, "the pin moved");
    // A partial form must not wipe what it didn't send.
    assert(edited[0].details === "Dinner then drinks.", "fields not in the patch are left alone");

    const badTimes = await api(`/api/boards/${rich.data.slug}`, {
      method: "PATCH", jar: a.jar,
      body: {
        startsAt: new Date(Date.now() + 90000_000).toISOString(),
        endsAt: new Date(Date.now() + 86400_000).toISOString(),
      },
    });
    assert(badTimes.status === 400, "an end before its start is refused");

    console.log("\nAn event with no venue is flagged, not silently missing");
    const noVenue = await api("/api/boards", {
      method: "POST", jar: a.jar,
      body: {
        type: "event", name: "Venue TBC", parentSlug: comm.data.slug,
        startsAt: new Date(Date.now() + 86400_000).toISOString(),
      },
    });
    assert(noVenue.status === 200, "an event can be created before the venue is known");
    slugs.push(noVenue.data.slug);
    const scoped = await api(`/api/map?net=${comm.data.slug}`, { jar: a.jar });
    const tbc = scoped.data.events.find((e) => e.slug === noVenue.data.slug);
    assert(Boolean(tbc), "it still appears in the events list");
    assert(tbc.lat === null, "…with no coordinates, which is what the UI warns about");
    assert(tbc.isHost === true, "…and the host is told so they can fix it");

    console.log("\nA phone number is earned, not published");
    await api("/api/profile", {
      method: "POST", jar: b.jar,
      body: {
        name: "Flow Bob", headline: "Angel investor", lookingFor: ["product"], canHelpWith: ["funding"],
        phone: "+91 90000 00001", phoneVisibility: "connections",
        baseLat: CITY.lat, baseLng: CITY.lng, baseLabel: CITY.label, visibility: "base",
      },
    });
    const bobId2 = (await pool.query("select id from users where email = $1", [emailB])).rows[0].id;

    const asStranger = await api(`/api/person/${bobId2}`, { jar: c.jar });
    assert(asStranger.status === 200, "anyone can read a profile");
    assert(asStranger.data.person.phone === null, "a stranger never gets the number");
    assert(asStranger.data.person.hasPhone === true, "…but is told one exists, which is what makes connecting worth it");

    const asSelf = await api(`/api/person/${bobId2}`, { jar: b.jar });
    assert(asSelf.data.person.phone === "+91 90000 00001", "you can always see your own");

    // Alice and Bob connected earlier in this run.
    const asConnection = await api(`/api/person/${bobId2}`, { jar: a.jar });
    assert(asConnection.data.connection.status === "connected", "the connection is recognised");
    assert(asConnection.data.person.phone === "+91 90000 00001", "an accepted connection gets the number");

    await api("/api/profile", {
      method: "POST", jar: b.jar,
      body: {
        name: "Flow Bob", headline: "Angel investor", lookingFor: ["product"], canHelpWith: ["funding"],
        phone: "+91 90000 00001", phoneVisibility: "private",
        baseLat: CITY.lat, baseLng: CITY.lng, baseLabel: CITY.label, visibility: "base",
      },
    });
    const afterPrivate = await api(`/api/person/${bobId2}`, { jar: a.jar });
    assert(afterPrivate.data.person.phone === null, "marking it private takes it back, even from a connection");

    // And it must never ride along in a bulk payload.
    const bulk = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=50`, { jar: a.jar });
    assert(
      !JSON.stringify(bulk.data).includes("90000 00001"),
      "a phone number never appears in the map payload, whatever the UI renders"
    );

    console.log("\nAn event page carries who's hosting and who's coming");
    const anonDetail = await api(`/api/boards/${inner.data.slug}`);
    assert(anonDetail.status === 403, "a signed-out visitor can't read an event's roster");
    const outsiderDetail = await api(`/api/boards/${inner.data.slug}`, { jar: c.jar });
    assert(outsiderDetail.status === 403, "nor can somebody who isn't on it — that's what a private event is");
    const detail = await api(`/api/boards/${inner.data.slug}`, { jar: a.jar });
    assert(detail.status === 200, "a member can");
    assert(detail.data.host?.name === "Flow Alice", "…and it names who is running it");
    assert(Array.isArray(detail.data.attendees), "…with the roster");
    assert(
      detail.data.attendees.some((x) => x.isHost),
      "…marking which of them is the host"
    );
    assert(detail.data.parent?.slug === comm.data.slug, "…and which community it belongs to");

    console.log("\nA community has a home of its own");
    const withHome = await api(`/api/map?net=${comm.data.slug}`, { jar: a.jar });
    assert(withHome.data.scope.home !== null, "a community scope carries its home data");
    assert(withHome.data.scope.home.hostName.length > 0, "…naming who runs it");
    assert(withHome.data.scope.home.isHost === true, "…and whether you do");
    const openScope = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=25`, { jar: a.jar });
    assert(openScope.data.scope.home === null, "the open network has no home — it isn't a group");

    console.log("\nA venue can be a search or a set of coordinates");
    const named = await api(`/api/geocode?q=${encodeURIComponent("Hyderabad")}`);
    assert(named.status === 200 && named.data.results.length > 0, "forward lookup still works");

    const reversed = await api(`/api/geocode?lat=${HERE.lat}&lng=${HERE.lng}`);
    assert(reversed.status === 200, "a reverse lookup answers");
    assert(reversed.data.results.length === 1, "…with exactly one place");
    assert(typeof reversed.data.results[0].label === "string" && reversed.data.results[0].label.length > 0,
      "…carrying a readable name, so nobody has to verify raw coordinates");
    // The caller's own point, not the geocoder's nearest match: somebody who
    // said "here" meant here, not the building across the road.
    assert(
      reversed.data.results[0].lat === HERE.lat && reversed.data.results[0].lng === HERE.lng,
      "…and the exact coordinates that were asked about"
    );

    const nonsense = await api(`/api/geocode?lat=999&lng=999`);
    assert(nonsense.status === 200, "out-of-range coordinates don't error");
    assert(Array.isArray(nonsense.data.results), "…they just come back empty or best-effort");

    console.log("\nAd-hoc pins: who may drop one");
    // Every assertion below turns on a distance, so positions are set here
    // rather than inherited from whatever the visibility tests left behind.
    const placeA = (pos, visibility = "exact") =>
      api("/api/profile", { method: "POST", jar: a.jar, body: {
        name: "Flow Alice", headline: "Founder, test co",
        lookingFor: ["funding"], canHelpWith: ["product"],
        lat: pos.lat, lng: pos.lng, locationLabel: "Alice's spot",
        baseLat: pos.lat, baseLng: pos.lng, baseLabel: CITY.label, visibility } });
    const placeB = (pos, visibility = "exact") =>
      api("/api/profile", { method: "POST", jar: b.jar, body: {
        name: "Flow Bob", headline: "Angel investor",
        lookingFor: ["product"], canHelpWith: ["funding"],
        lat: pos.lat, lng: pos.lng, locationLabel: "Bob's spot",
        baseLat: pos.lat, baseLng: pos.lng, baseLabel: CITY.label, visibility } });
    // Carol sits exactly where Alice does, but only ever at city resolution —
    // she is the control for "near, but not precisely known to be near".
    const placeC = (visibility) =>
      api("/api/profile", { method: "POST", jar: c.jar, body: {
        name: "Flow Carol", headline: "Curious stranger",
        lookingFor: ["peers"], canHelpWith: ["peers"],
        lat: HERE.lat, lng: HERE.lng, locationLabel: HERE.label,
        baseLat: HERE.lat, baseLng: HERE.lng, baseLabel: CITY.label, visibility } });

    // Metres, converted to degrees — a degree of latitude is ~111.2 km.
    const north = (m) => ({ lat: HERE.lat + m / 111_200, lng: HERE.lng });
    const NEAR = { lat: HERE.lat + 0.004, lng: HERE.lng + 0.004 }; // ~590 m

    const drop = (body, jar = a.jar) =>
      api("/api/pins", { method: "POST", jar, body: { lat: HERE.lat, lng: HERE.lng, placeLabel: "Roastery", ...body } });
    const pinsSeenBy = async (jar, at = HERE) =>
      (await api(`/api/pins?lat=${at.lat}&lng=${at.lng}`, jar ? { jar } : {})).data.pins;

    await placeA(HERE);
    await placeB(NEAR);
    await placeC("base");

    const anonPin = await api("/api/pins", { method: "POST", body: { message: "hi", lat: HERE.lat, lng: HERE.lng } });
    assert(anonPin.status === 401, "a signed-out visitor can't drop a pin");
    const noMsg = await drop({ message: " " });
    assert(noMsg.status === 400, "a pin with nothing to say is refused");
    const noWhere = await api("/api/pins", { method: "POST", jar: a.jar, body: { message: "in a cafe" } });
    assert(noWhere.status === 400, "a pin with no location is refused — that's the whole point of one");

    const dropped = await drop({ message: "At the Roastery, happy to talk fundraising", minutes: 60, audience: "open" });
    assert(dropped.status === 200, "a member can drop one");

    const theirs = (await pinsSeenBy(b.jar)).find((x) => x.id === dropped.data.id);
    assert(Boolean(theirs), "somebody 590 m away sees a 1 km pin");
    assert(theirs.minutesLeft > 0 && theirs.minutesLeft <= 60, "…and carries how long is left");
    assert(theirs.mine === false, "…marked as somebody else's");
    assert(theirs.reachKm === 1, "…and says how far it was meant to carry");

    console.log("\nA pin only carries as far as it was told to");
    const far = await drop({ message: "Only for this block", minutes: 60, reachKm: 0.15 });
    assert(
      !(await pinsSeenBy(b.jar)).some((x) => x.id === far.data.id),
      "590 m away is outside a building-level pin, however precise the reader"
    );
    await placeB(north(40));
    assert(
      (await pinsSeenBy(b.jar)).some((x) => x.id === far.data.id),
      "…and inside it once they're actually in the building"
    );

    // The whole reason reach is measured from the reader rather than the map
    // camera. Bob is 14 km away but asking about the café's coordinates.
    await placeB(CITY);
    assert(
      !(await pinsSeenBy(b.jar, HERE)).some((x) => x.id === far.data.id),
      "panning the map to a pin doesn't reveal it — reach follows the reader, not the camera"
    );

    // Carol's row carries an exact coordinate on top of the pin, but she
    // publishes at city resolution, so the server may only treat her as
    // somewhere-in-Delhi. A building-level claim can't be checked for her.
    assert(
      !(await pinsSeenBy(c.jar)).some((x) => x.id === far.data.id),
      "a city-level reader can't satisfy a building-level pin, even sitting on top of it"
    );
    const wide = await drop({ message: "Anywhere in town", minutes: 60, reachKm: 3 });
    assert(
      (await pinsSeenBy(c.jar)).some((x) => x.id === wide.data.id),
      "…but a 3 km pin reaches her, because 3 km doesn't need precision to be true"
    );

    const odd = await drop({ message: "Off the ladder", minutes: 60, reachKm: 7.3 });
    const { rows: oddRow } = await pool.query("select reach_km from pins where id = $1", [odd.data.id]);
    assert(Number(oddRow[0].reach_km) === 1, "a reach that isn't on the ladder falls back to the default");

    assert(
      (await pinsSeenBy(null)).length === 0,
      "a signed-out visitor sees no pins at all — a live location isn't browsable anonymously"
    );

    console.log("\nOne live pin per person");
    await placeB(NEAR);
    const second = await drop({ message: "Moved to the window seat", minutes: 60 });
    assert(second.status === 200, "dropping another works");
    const fromAlice = (await pinsSeenBy(b.jar)).filter((x) => x.person.name === "Flow Alice");
    assert(fromAlice.length === 1, "…and replaces the first rather than stacking");
    assert(fromAlice[0].message === "Moved to the window seat", "the newer one wins");

    console.log("\nJoining a pin");
    const anonPinJoin = await api(`/api/pins/${second.data.id}/join`, { method: "POST" });
    assert(anonPinJoin.status === 401, "a signed-out visitor can't join");
    const pinJoined = await api(`/api/pins/${second.data.id}/join`, { method: "POST", jar: b.jar });
    assert(pinJoined.status === 200 && pinJoined.data.state === "joined", "a member can say they're coming");
    const mine3 = (await pinsSeenBy(a.jar)).find((x) => x.id === second.data.id);
    assert(mine3.joined.length === 1, "the dropper sees who's coming");
    assert(mine3.mine === true, "…and that it's theirs");
    const left = await api(`/api/pins/${second.data.id}/join`, { method: "POST", jar: b.jar });
    assert(left.data.state === "left", "and can take it back");

    console.log("\nA pin stops existing when it ends");
    const notYourPin = await api(`/api/pins/${second.data.id}`, { method: "DELETE", jar: b.jar });
    assert(notYourPin.status === 403, "somebody else can't take your pin down");
    const removed = await api(`/api/pins/${second.data.id}`, { method: "DELETE", jar: a.jar });
    assert(removed.status === 200, "you can take your own down");
    assert(
      !(await pinsSeenBy(b.jar)).some((x) => x.id === second.data.id),
      "…and it leaves the map immediately"
    );
    const joinDead = await api(`/api/pins/${second.data.id}/join`, { method: "POST", jar: b.jar });
    assert(joinDead.status === 410, "joining an ended pin is refused — it would promise somebody who left");

    // Expiry is a read-time condition, so a pin that ran out is simply gone.
    const expired = await drop({ message: "Briefly here", minutes: 60 });
    await pool.query("update pins set expires_at = now() - interval '1 minute' where id = $1", [expired.data.id]);
    assert(
      !(await pinsSeenBy(b.jar)).some((x) => x.id === expired.data.id),
      "an expired pin disappears on its own, with no sweep"
    );

    console.log("\nA communities-only pin stays inside them");
    const privatePin = await drop({ message: "On the 3rd floor", minutes: 60, audience: "communities", reachKm: 3 });
    assert(privatePin.status === 200, "a communities-only pin drops");
    // Carol is in reach of a 3 km pin — proved two blocks up — so audience is
    // the only thing that can be keeping her out here.
    assert(
      !(await pinsSeenBy(c.jar)).some((x) => x.id === privatePin.data.id),
      "somebody in reach but sharing no community still can't see it"
    );
    // Bob joined Alice's community earlier in this run.
    assert(
      (await pinsSeenBy(b.jar)).some((x) => x.id === privatePin.data.id),
      "somebody who shares a community does"
    );

    // Wherever you wander, your own pin stays yours to see and take down.
    await placeA(CITY);
    assert(
      (await pinsSeenBy(a.jar, CITY)).some((x) => x.mine),
      "your own pin follows you even once you've left it behind"
    );
    await placeA(HERE);

    const { rows: idRows } = await pool.query("select email, id from users where email = any($1)", [
      [emailA, emailB, emailC],
    ]);
    const idOf = (e) => idRows.find((r) => r.email === e).id;
    const aId = idOf(emailA);
    const bId = idOf(emailB);

    console.log("\nA feed you can answer, not just read");
    const answerPost = await api("/api/posts", {
      method: "POST", jar: a.jar, body: { boardSlug: comm.data.slug, body: "Anyone hiring Android folks?" },
    });
    assert(answerPost.status === 200, "a member posts something answerable");
    const talkId = answerPost.data.id;

    const anonReact = await api(`/api/posts/${talkId}/react`, { method: "POST", body: { kind: "clap" } });
    assert(anonReact.status === 401, "a signed-out visitor can't react");
    const strangerReact = await api(`/api/posts/${talkId}/react`, {
      method: "POST", jar: c.jar, body: { kind: "clap" },
    });
    assert(strangerReact.status === 403, "neither can somebody outside the community");
    const madeUp = await api(`/api/posts/${talkId}/react`, {
      method: "POST", jar: b.jar, body: { kind: "shrug" },
    });
    assert(madeUp.status === 400, "reactions are a closed set — an invented one is refused");

    const reacted = await api(`/api/posts/${talkId}/react`, {
      method: "POST", jar: b.jar, body: { kind: "useful" },
    });
    assert(reacted.status === 200 && reacted.data.on === true, "a member can react");
    const withReaction = await api(`/api/feed?net=${comm.data.slug}`, { jar: b.jar });
    const talkSeen = withReaction.data.items.find((i) => i.post?.id === talkId);
    assert(talkSeen.post.reactions.useful === 1, "…and it's counted");
    assert(talkSeen.post.myReactions.includes("useful"), "…and marked as yours, so the control can show it");

    // Tapping twice is taking it back, not reacting twice.
    const reactAgain = await api(`/api/posts/${talkId}/react`, {
      method: "POST", jar: b.jar, body: { kind: "useful" },
    });
    assert(reactAgain.data.on === false, "tapping the same reaction reactAgain removes it");
    const { rows: reactRows } = await pool.query("select count(*)::int n from post_reactions where post_id = $1", [talkId]);
    assert(reactRows[0].n === 0, "…and leaves nothing behind to double-count");
    await api(`/api/posts/${talkId}/react`, { method: "POST", jar: b.jar, body: { kind: "useful" } });

    console.log("\nReplies");
    const strangerReply = await api(`/api/posts/${talkId}/comments`, {
      method: "POST", jar: c.jar, body: { body: "me!" },
    });
    assert(strangerReply.status === 403, "somebody outside the community can't reply");
    const emptyReply = await api(`/api/posts/${talkId}/comments`, {
      method: "POST", jar: b.jar, body: { body: "   " },
    });
    assert(emptyReply.status === 400, "an empty reply is refused");
    const repliedOk = await api(`/api/posts/${talkId}/comments`, {
      method: "POST", jar: b.jar, body: { body: "We are — I'll introduce you." },
    });
    assert(repliedOk.status === 200, "a member can reply");

    const withReply = await api(`/api/feed?net=${comm.data.slug}`, { jar: a.jar });
    const talkWithReply = withReply.data.items.find((i) => i.post?.id === talkId);
    assert(talkWithReply.post.commentCount === 1, "the reply is carried with the post, not fetched separately");
    assert(talkWithReply.post.comments[0].body.startsWith("We are"), "…with what was actually said");
    assert(
      talkWithReply.post.comments[0].canDelete === true,
      "the community's owner can remove any reply"
    );

    const replyId = talkWithReply.post.comments[0].id;
    const notYourReply = await api(`/api/comments/${replyId}`, { method: "DELETE", jar: c.jar });
    assert(notYourReply.status === 403, "a stranger can't remove a reply");
    const removedReply = await api(`/api/comments/${replyId}`, { method: "DELETE", jar: b.jar });
    assert(removedReply.status === 200, "its author can");
    const afterReplyGone = await api(`/api/feed?net=${comm.data.slug}`, { jar: a.jar });
    assert(
      afterReplyGone.data.items.find((i) => i.post?.id === talkId).post.commentCount === 0,
      "…and it leaves the post"
    );

    console.log("\nOne pinned post, held above everything else");
    const memberPin = await api(`/api/posts/${talkId}/pin`, { method: "POST", jar: b.jar, body: { pinned: true } });
    assert(memberPin.status === 403, "a member can't pin");
    const pinnedOk = await api(`/api/posts/${talkId}/pin`, { method: "POST", jar: a.jar, body: { pinned: true } });
    assert(pinnedOk.status === 200, "the owner can");

    // Something newerPost, to prove the pin actually overrides recency.
    const newerPost = await api("/api/posts", {
      method: "POST", jar: a.jar, body: { boardSlug: comm.data.slug, body: "Posted after the pinned one" },
    });
    assert(newerPost.status === 200, "and posts something newerPost afterwards");
    const orderedFeed = await api(`/api/feed?net=${comm.data.slug}`, { jar: a.jar });
    assert(orderedFeed.data.items[0].post?.id === talkId, "the pinned post sits above a newerPost one");
    assert(orderedFeed.data.items[0].post.pinned === true, "…and says that it's pinned");

    // A second pin replaces the first: a list of pinned things is just the
    // feed reactAgain.
    await api(`/api/posts/${newerPost.data.id}/pin`, { method: "POST", jar: a.jar, body: { pinned: true } });
    const { rows: pinRows } = await pool.query(
      "select count(*)::int n from posts p join boards bd on bd.id = p.board_id where bd.slug = $1 and p.pinned_at is not null",
      [comm.data.slug]
    );
    assert(pinRows[0].n === 1, "pinning a second post unpins the first");
    await api(`/api/posts/${newerPost.data.id}/pin`, { method: "POST", jar: a.jar, body: { pinned: false } });

    console.log("\nThe owner vouches for who's really here");
    const notOwnerVerify = await api(`/api/boards/${comm.data.slug}/members/${bId}`, {
      method: "PATCH", jar: b.jar, body: { action: "verify" },
    });
    assert(notOwnerVerify.status === 403, "a member can't hand out verification");

    const selfVerify = await api(`/api/boards/${comm.data.slug}/members/${aId}`, {
      method: "PATCH", jar: a.jar, body: { action: "verify" },
    });
    assert(selfVerify.status === 400, "the owner can't verify themselves — a vouch has to come from somebody else");

    const verified = await api(`/api/boards/${comm.data.slug}/members/${bId}`, {
      method: "PATCH", jar: a.jar, body: { action: "verify" },
    });
    assert(verified.status === 200, "the owner can verify a member");
    const seenVerified = await api(`/api/map?net=${comm.data.slug}`, { jar: a.jar });
    assert(
      seenVerified.data.people.find((p) => p.name === "Flow Bob")?.verified === true,
      "…and the badge reaches everyone's copy of that person"
    );
    const unverified = await api(`/api/boards/${comm.data.slug}/members/${bId}`, {
      method: "PATCH", jar: a.jar, body: { action: "unverify" },
    });
    assert(unverified.status === 200, "a vouch can be taken back");
    const afterUnverify = await api(`/api/map?net=${comm.data.slug}`, { jar: a.jar });
    assert(
      afterUnverify.data.people.find((p) => p.name === "Flow Bob")?.verified === false,
      "…and the badge goes with it"
    );
    await api(`/api/boards/${comm.data.slug}/members/${bId}`, { method: "PATCH", jar: a.jar, body: { action: "verify" } });

    // The badge has to reach the profile, not just the list — that is where
    // somebody decides whether to trust a stranger. And it travels attached
    // to the community that made the claim, because "verified" on its own
    // is an assertion with nobody behind it.
    const bobProfile = await api(`/api/person/${bId}`, { jar: a.jar });
    const vouching = bobProfile.data.shared.find((x) => x.slug === comm.data.slug);
    assert(vouching?.verified === true, "the profile says which community vouched for them");
    const otherBoard = bobProfile.data.shared.find((x) => x.slug !== comm.data.slug);
    assert(
      !otherBoard || otherBoard.verified === false,
      "…and a community that hasn't vouched isn't credited with it"
    );
    // The badge is viewer-relative: it means "a community you're BOTH in
    // says so". A tick visible to somebody with no shared community would
    // be an assertion from nobody — and would make the badge farmable by
    // spinning up a community and verifying yourself.
    const insiderMap = await api(`/api/map?net=${comm.data.slug}`, { jar: a.jar });
    const bobInside = insiderMap.data.people.find((p) => p.name === "Flow Bob");
    assert(bobInside?.verified === true, "a shared community's vouch reaches the map payload");
    assert(bobInside?.verifiedHere === true, "…and the board's own claim is carried separately for the owner");

    // Same person, seen from the open map rather than inside the community.
    const openView = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=50`, { jar: a.jar });
    const bobOutside = openView.data.people.find((p) => p.name === "Flow Bob");
    assert(bobOutside?.verified === true, "the badge follows them onto the open map, for people who share the community");

    const strangerMap = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}&radiusKm=50`, { jar: c.jar });
    const bobToStranger = strangerMap.data.people.find((p) => p.name === "Flow Bob");
    assert(
      !bobToStranger || bobToStranger.verified === false,
      "…but shows nothing to somebody who shares no community with them"
    );

    const strangerView = await api(`/api/person/${bId}`, { jar: c.jar });
    assert(
      strangerView.data.shared.every((x) => x.slug !== comm.data.slug),
      "somebody outside the community sees no claim from it at all"
    );

    console.log("\nLeaving is reversible; being removed is not");
    const joinedC = await api(`/api/boards/${comm.data.slug}/join`, { method: "POST", jar: c.jar });
    assert(joinedC.status === 200, "a stranger with the link can join");
    const leftC = await api(`/api/boards/${comm.data.slug}/leave`, { method: "POST", jar: c.jar });
    assert(leftC.status === 200, "and can leave again");
    const goneFromScope = await api(`/api/map?net=${comm.data.slug}`, { jar: c.jar });
    assert(goneFromScope.data.scope.kind === "open", "after leaving, that community's scope falls back to the open map");
    const rejoined = await api(`/api/boards/${comm.data.slug}/join`, { method: "POST", jar: c.jar });
    assert(rejoined.status === 200, "leaving is not a door locking behind you — the same link works again");
    await api(`/api/boards/${comm.data.slug}/leave`, { method: "POST", jar: c.jar });

    const ownerLeaves = await api(`/api/boards/${comm.data.slug}/leave`, { method: "POST", jar: a.jar });
    assert(ownerLeaves.status === 400, "the owner can't walk out and leave nobody running it");

    console.log("\nRemoval takes everything with it");
    // Carol, not Bob: Bob also shares the meetup board with Alice, so a
    // community-scoped pin would still legitimately reach him and the
    // assertion would prove nothing. Carol shares exactly one thing.
    const cId = idOf(emailC);
    await api(`/api/boards/${comm.data.slug}/join`, { method: "POST", jar: c.jar });
    await api(`/api/boards/${comm.data.slug}/members/${cId}`, {
      method: "PATCH", jar: a.jar, body: { action: "verify" },
    });

    await placeA(HERE);
    await placeC("base");
    const insidePin = await drop({ message: "Members only, 3rd floor", minutes: 60, audience: "communities", reachKm: 3 });
    assert(
      (await pinsSeenBy(c.jar)).some((x) => x.id === insidePin.data.id),
      "while a member, Carol sees the community's private pins"
    );

    const notOwnerRemove = await api(`/api/boards/${comm.data.slug}/members/${aId}`, {
      method: "PATCH", jar: c.jar, body: { action: "remove" },
    });
    assert(notOwnerRemove.status === 403, "a member can't remove anyone");

    const removedCarol = await api(`/api/boards/${comm.data.slug}/members/${cId}`, {
      method: "PATCH", jar: a.jar, body: { action: "remove" },
    });
    assert(removedCarol.status === 200, "the owner can remove a member");

    const carolNets = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}`, { jar: c.jar });
    assert(
      !carolNets.data.networks.some((n) => n.slug === comm.data.slug),
      "the community disappears from the removed member's switcher"
    );
    const carolScope = await api(`/api/map?net=${comm.data.slug}`, { jar: c.jar });
    assert(carolScope.data.scope.kind === "open", "…and asking for it by name doesn't hand back its people");
    const carolPost = await api("/api/posts", {
      method: "POST", jar: c.jar, body: { boardSlug: comm.data.slug, body: "still here?" },
    });
    assert(carolPost.status === 403, "…they can't post to it");
    const carolFeed = await api(`/api/feed?net=${comm.data.slug}`, { jar: c.jar });
    assert(carolFeed.status === 403, "…and the feed is closed to them");

    // The one a careless gate would leak: a removed member keeping sight of
    // other members' live locations.
    assert(
      !(await pinsSeenBy(c.jar)).some((x) => x.id === insidePin.data.id),
      "…and the community's private pins go dark immediately"
    );

    const rejoinBlocked = await api(`/api/boards/${comm.data.slug}/join`, { method: "POST", jar: c.jar });
    assert(rejoinBlocked.status === 403, "the invite link can't undo a removal");

    const { rows: tomb } = await pool.query(
      `select m.status, m.verified_at from memberships m
         join boards bd on bd.id = m.board_id
        where bd.slug = $1 and m.user_id = $2`,
      [comm.data.slug, cId]
    );
    assert(tomb[0]?.status === "removed", "removal leaves a tombstone rather than deleting the row");
    assert(tomb[0]?.verified_at === null, "…and drops the vouch, so the badge can't outlive the membership");

    const countAfter = await api(`/api/map?net=${comm.data.slug}`, { jar: a.jar });
    assert(
      !countAfter.data.people.some((p) => p.name === "Flow Carol"),
      "a removed member is gone from the member list the owner sees too"
    );

    console.log("\nA community's own page carries what it's for");
    const described = await api(`/api/boards/${comm.data.slug}`, {
      method: "PATCH", jar: a.jar,
      body: { details: "For people who went to RGUKT.", guidelines: "Be who you say you are." },
    });
    assert(described.status === 200, "the owner can write the objectives and the house rules");
    const home2 = await api(`/api/map?net=${comm.data.slug}`, { jar: a.jar });
    assert(home2.data.scope.home.details === "For people who went to RGUKT.", "…objectives reach the home page");
    assert(home2.data.scope.home.guidelines === "Be who you say you are.", "…and so do the rules");
    assert(home2.data.scope.home.canLeave === false, "the owner is never offered a leave button");
    const notOwnerEdit = await api(`/api/boards/${comm.data.slug}`, {
      method: "PATCH", jar: c.jar, body: { guidelines: "Anything goes." },
    });
    assert(notOwnerEdit.status === 403, "a non-owner can't rewrite the rules");

    console.log("\nOnly the host can delete an event, and it goes everywhere");
    const doomed = await api("/api/boards", {
      method: "POST", jar: a.jar,
      body: {
        type: "event", name: "Cancelled Before It Began", parentSlug: comm.data.slug,
        startsAt: new Date(Date.now() + 86400_000).toISOString(),
        lat: HERE.lat, lng: HERE.lng, place: "Somewhere",
      },
    });
    assert(doomed.status === 200, "the host creates an event");
    slugs.push(doomed.data.slug);
    await api(`/api/boards/${doomed.data.slug}/rsvp`, { method: "POST", jar: b.jar, body: { rsvp: "going" } });

    const anonDelete = await api(`/api/boards/${doomed.data.slug}`, { method: "DELETE" });
    assert(anonDelete.status === 401, "a signed-out visitor can't delete it");
    const guestDelete = await api(`/api/boards/${doomed.data.slug}`, { method: "DELETE", jar: b.jar });
    assert(guestDelete.status === 403, "neither can somebody who merely RSVP'd");
    const communityDelete = await api(`/api/boards/${comm.data.slug}`, { method: "DELETE", jar: a.jar });
    assert(communityDelete.status === 400, "a community isn't deletable through this door");

    const killed = await api(`/api/boards/${doomed.data.slug}`, { method: "DELETE", jar: a.jar });
    assert(killed.status === 200, "the host can");

    const { rows: still } = await pool.query("select archived_at from boards where slug = $1", [doomed.data.slug]);
    assert(still[0]?.archived_at !== null, "it's archived, not dropped — the RSVPs and the discussion survive");

    const listed = await api(`/api/map?net=${comm.data.slug}`, { jar: a.jar });
    assert(
      !listed.data.events.some((e) => e.slug === doomed.data.slug),
      "it leaves the community's event list"
    );

    // The half that lists alone never covered: a deleted event used to stay
    // reachable to anyone holding its link.
    const byLink = await api(`/api/boards/${doomed.data.slug}`, { jar: a.jar });
    assert(byLink.status === 404, "its own page is gone, even for the host");
    const deadRsvp = await api(`/api/boards/${doomed.data.slug}/rsvp`, {
      method: "POST", jar: b.jar, body: { rsvp: "going" },
    });
    assert(deadRsvp.status === 404, "nobody can RSVP to it any more");
    // Empty rather than an error, deliberately: a stale ?net= from a
    // bookmark should land somewhere, not on a dead screen. What matters is
    // that nothing from inside it comes back.
    const deadFeed = await api(`/api/feed?net=${doomed.data.slug}`, { jar: a.jar });
    assert(
      (deadFeed.data.items ?? []).length === 0,
      "its discussion returns nothing to anyone, host included"
    );
    const deadCheckin = await api(`/api/boards/${doomed.data.slug}/checkin`, {
      method: "POST", jar: b.jar, body: { here: true },
    });
    assert(deadCheckin.status === 404, "and nobody can check in at it");
    const deadScope = await api(`/api/map?net=${doomed.data.slug}`, { jar: a.jar });
    assert(deadScope.data.scope.kind === "open", "selecting it by name falls back to the open map");

    const twice = await api(`/api/boards/${doomed.data.slug}`, { method: "DELETE", jar: a.jar });
    assert(twice.status === 404, "deleting it again is a no-op, not an error");

    console.log("\nProximity alerts tell you who turned up, within the rules");
    // A scan runs when somebody's position changes, in both directions —
    // who should hear about the mover, and who the mover should hear about.
    const alertsSeenBy = async (email) =>
      (await pool.query(
        `select n.kind, n.distance_km, n.place_label, u.name actor
           from notifications n join users u on u.id = n.actor_id
          where n.user_id = (select id from users where email = $1)
          order by n.created_at desc`, [email]
      )).rows;

    await pool.query("delete from notifications");
    // Alice and Bob are connected by now and both want to hear about it.
    await pool.query(
      "update users set notify_connections = true, notify_matches = true, notify_radius_km = 5, visibility = 'exact', lat = $2, lng = $3, alerts_scan_at = null where email = $1",
      [emailA, HERE.lat, HERE.lng]
    );
    await pool.query(
      "update users set notify_connections = true, notify_matches = true, notify_radius_km = 5, visibility = 'exact', lat = $2, lng = $3, alerts_scan_at = null where email = $1",
      [emailB, HERE.lat + 0.004, HERE.lng + 0.004]
    );

    const livePush = await api("/api/live", { method: "POST", jar: a.jar, body: { lat: HERE.lat, lng: HERE.lng } });
    assert(livePush.status === 409 || livePush.status === 200, "a position push is accepted or refused on visibility, never 500s");
    await pool.query("update users set visibility = 'live', live_at = now() where email = any($1)", [[emailA, emailB]]);
    await pool.query("update users set alerts_scan_at = null where email = $1", [emailA]);
    await api("/api/live", { method: "POST", jar: a.jar, body: { lat: HERE.lat, lng: HERE.lng } });

    const bobHeard = await alertsSeenBy(emailB);
    assert(bobHeard.length > 0, "somebody nearby hears that a connection arrived");
    assert(bobHeard[0].kind === "connection_nearby", "…and it's filed as a connection, not a stranger match");
    assert(bobHeard[0].distance_km !== null, "…with a distance, because both publish an exact position");

    const aliceHeard = await alertsSeenBy(emailA);
    assert(aliceHeard.length > 0, "the person who moved also hears who was already there");

    console.log("\nAlerts never out-run what somebody published");
    await pool.query("delete from notifications");
    // Bob drops to city-level. He can still say he's in town; he can never
    // be reported as a number of metres away.
    await pool.query(
      "update users set visibility = 'base', base_lat = $2, base_lng = $3, base_label = 'Delhi' where email = $1",
      [emailB, HERE.lat + 0.004, HERE.lng + 0.004]
    );
    await pool.query("update users set alerts_scan_at = null where email = $1", [emailA]);
    await api("/api/live", { method: "POST", jar: a.jar, body: { lat: HERE.lat, lng: HERE.lng } });
    const coarseAlerts = (await alertsSeenBy(emailA)).filter((r) => r.actor === "Flow Bob");
    assert(coarseAlerts.length > 0, "a city-level person still triggers an alert");
    assert(
      coarseAlerts.every((r) => r.distance_km === null),
      "…carrying no distance at all, because that precision was never theirs to give"
    );

    console.log("\nAlerts stay quiet");
    await pool.query("delete from notifications");
    await pool.query("update users set visibility = 'live', live_at = now() where email = $1", [emailB]);
    await pool.query("update users set alerts_scan_at = null where email = $1", [emailA]);
    await api("/api/live", { method: "POST", jar: a.jar, body: { lat: HERE.lat, lng: HERE.lng } });
    const firstHeard = (await alertsSeenBy(emailB)).length;
    assert(firstHeard > 0, "the first arrival is announced");
    await pool.query("update users set alerts_scan_at = null where email = $1", [emailA]);
    await api("/api/live", { method: "POST", jar: a.jar, body: { lat: HERE.lat, lng: HERE.lng } });
    assert(
      (await alertsSeenBy(emailB)).length === firstHeard,
      "…and the same person arriving again says nothing — the repeat window holds"
    );

    // The throttle: without clearing alerts_scan_at, a second ping is a no-op.
    const { rows: scanStamp } = await pool.query("select alerts_scan_at from users where email = $1", [emailA]);
    assert(scanStamp[0].alerts_scan_at !== null, "a scan records when it ran, so pings don't re-scan every 90 seconds");

    console.log("\nA crowded room is one doorway, not twenty pings");
    // The scenario this was rebuilt for: a mixer. Measured before the
    // change, twenty-five arrivals filled all 200 attendees' daily budgets
    // with five arbitrary pings each.
    await pool.query("delete from notifications");
    await pool.query("delete from users where email like 'crowd%@flowtest'");
    const crowdIds = [];
    for (let i = 0; i < 12; i++) {
      const { rows } = await pool.query(
        `insert into users (email,name,headline,looking_for,can_help_with,interests,visibility,lat,lng,live_at,
           notify_connections,notify_matches,notify_interests,notify_radius_km)
         values ($1,$2,'Founder',$3,$4,$5,'live',$6,$7,now(),true,true,false,5) returning id`,
        [`crowd${i}@flowtest`, `Crowd ${i}`, ["funding"], ["funding"], ["fintech"],
         HERE.lat + (i - 6) * 0.0002, HERE.lng + (i - 6) * 0.0002]
      );
      crowdIds.push(rows[0].id);
    }
    emails.push(...Array.from({ length: 12 }, (_, i) => `crowd${i}@flowtest`));

    // Alice walks into the room.
    await pool.query(
      "update users set visibility='live', live_at=now(), lat=$2, lng=$3, looking_for=$4, can_help_with=$5, alerts_scan_at=null where email=$1",
      [emailA, HERE.lat, HERE.lng, ["funding"], ["funding"]]
    );
    await api("/api/live", { method: "POST", jar: a.jar, body: { lat: HERE.lat, lng: HERE.lng } });

    const { rows: aliceGot } = await pool.query(
      "select kind, count, place_label from notifications where user_id = (select id from users where email = $1)", [emailA]
    );
    const aliceCrowd = aliceGot.filter((r) => r.kind === "crowd_nearby");
    assert(aliceCrowd.length === 1, "a room full of matches is one notification, not one per person");
    assert(aliceCrowd[0].count > ALERT_CROWD_THRESHOLD, `…carrying how many people it stands for (${aliceCrowd[0].count})`);
    // A connection keeps its own line even in a crowd — you know them by
    // name, and that is exactly what a count destroys.
    assert(
      aliceGot.some((r) => r.kind === "connection_nearby"),
      "…while somebody she actually knows still gets named"
    );
    assert(
      !aliceGot.some((r) => r.kind === "crowd_nearby" && r.place_label !== null),
      "the crowd notice is about a room, so it carries no single person's place"
    );

    const { rows: roomMates } = await pool.query(
      "select user_id, count(*)::int n from notifications where user_id = any($1) group by user_id", [crowdIds]
    );
    assert(
      roomMates.every((r) => r.n === 1),
      "…and everybody already in the room gets one notice too, not one per arrival"
    );

    // The budgetLeft is the point: being in a crowd must not spend the day.
    const { rows: budgetLeft } = await pool.query(
      "select count(*)::int n from notifications where user_id = (select id from users where email = $1)", [emailA]
    );
    assert(
      budgetLeft[0].n < ALERT_DAILY_CAP,
      "…leaving the rest of the day's budgetLeft for something that matters"
    );

    const crowdInbox = await api("/api/alerts", { jar: a.jar });
    const doorway = crowdInbox.data.alerts.find((x) => x.kind === "crowd_nearby");
    assert(Boolean(doorway), "the crowd notice reaches the inbox");
    assert(doorway.person === null, "…with no person attached, because it's about a place");
    assert(doorway.distanceKm === null, "…and no distance, because a room isn't a point");

    await pool.query("delete from users where email like 'crowd%@flowtest'");
    await pool.query("delete from notifications");

    console.log("\nSomebody who asked not to be told, isn't");
    await pool.query("delete from notifications");
    await pool.query(
      "update users set notify_connections = false, notify_matches = false, notify_interests = false where email = $1",
      [emailB]
    );
    await pool.query("update users set alerts_scan_at = null where email = $1", [emailA]);
    await api("/api/live", { method: "POST", jar: a.jar, body: { lat: HERE.lat, lng: HERE.lng } });
    assert((await alertsSeenBy(emailB)).length === 0, "every switch off means silence");
    await pool.query("update users set notify_connections = true, notify_matches = true where email = $1", [emailB]);

    console.log("\nThe inbox");
    await pool.query("delete from notifications");
    await pool.query("update users set alerts_scan_at = null where email = $1", [emailA]);
    await api("/api/live", { method: "POST", jar: a.jar, body: { lat: HERE.lat, lng: HERE.lng } });
    const anonInbox = await api("/api/alerts");
    assert(anonInbox.status === 401, "a signed-out visitor has no inbox");
    const inboxRes = await api("/api/alerts", { jar: b.jar });
    assert(inboxRes.status === 200 && inboxRes.data.alerts.length > 0, "a member reads their own");
    assert(inboxRes.data.alerts[0].person?.name === "Flow Alice", "…naming who it's about");
    assert(inboxRes.data.alerts.every((x) => x.read === false), "…unread until opened");
    const badgedPayload = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}`, { jar: b.jar });
    assert(badgedPayload.data.alerts > 0, "the badge count rides along with the shell payload");
    await api("/api/alerts", { method: "POST", jar: b.jar });
    const afterRead = await api(`/api/map?lat=${HERE.lat}&lng=${HERE.lng}`, { jar: b.jar });
    assert(afterRead.data.alerts === 0, "…and clears once the list has been read");

    console.log("\nSigning out revokes the session, not just the cookie");
    // A spareCookie session for Carol, minted directly — this is about what
    // logout does to a session, not about how one is obtained.
    const { rows: extra } = await pool.query(
      `insert into sessions (user_id, expires_at)
       select id, now() + interval '1 day' from users where email = $1 returning id`,
      [emailC]
    );
    const spareCookie = `mp_session=${extra[0].id}`;
    const asSecond = (path, init = {}) =>
      fetch(BASE + path, { ...init, headers: { ...(init.headers ?? {}), Cookie: spareCookie } });

    assert((await asSecond("/api/profile")).status === 200, "a second session works while signed in");

    const signedOut = await asSecond("/api/auth/logout", { method: "POST" });
    assert(signedOut.status === 200, "signing out answers cleanly");

    const { rows: goneRows } = await pool.query("select count(*)::int n from sessions where id = $1", [
      extra[0].id,
    ]);
    assert(goneRows[0].n === 0, "…and deletes the session row rather than only clearing the cookie");

    // The part a cookie-only sign-out gets wrong: anybody still holding the
    // old value — a shared machine, a copied header, a stale tab — would
    // keep full access for the rest of the session's lifetime.
    assert(
      (await asSecond("/api/profile")).status === 401,
      "a captured cookie is dead the moment its owner signs out"
    );

    const otherStillIn = await api("/api/profile", { jar: c.jar });
    assert(otherStillIn.status === 200, "signing out on one device leaves that person's other sessions alone");

    const outTwice = await asSecond("/api/auth/logout", { method: "POST" });
    assert(outTwice.status === 200, "signing out twice is not an error");

    console.log("\nEvery entry point terminates");
    for (const [label, path] of [
      ["a QR scan while signed out", `/join/${slug}`],
      ["the board's own address", `/b/${slug}`],
      ["the old /login with a join target", `/login?next=${encodeURIComponent(`/join/${slug}`)}`],
      ["the old /you", "/you"],
      ["the old /boards", "/boards"],
    ]) {
      const walked = await followChain(path);
      assert(!walked.looped, `${label} doesn't loop  (${walked.chain.join(" → ")})`);
      assert(walked.status === 200, `${label} ends on a real page`);
    }

    // And signed in, where the join actually happens.
    const scanned = await followChain(`/join/${slug}`, { jar: c.jar });
    assert(!scanned.looped, "a signed-in scan doesn't loop");
    assert(
      scanned.chain.some((u) => u.startsWith("/?net=")),
      "a signed-in scan lands on the map with that board selected"
    );
    const joinedRow = await pool.query(
      "select 1 from memberships m join boards bd on bd.id = m.board_id where bd.slug = $1 and m.user_id = (select id from users where email = $2)",
      [slug, emailC]
    );
    assert(joinedRow.rowCount === 1, "…and the scan actually joined them");

    console.log(`\n${pass} passed, ${fail} failed`);
  } finally {
    await pool.query("delete from boards where slug = any($1)", [slugs]);
    await pool.query("delete from users where email = any($1)", [emails]);
    await pool.end();
    server.kill();
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
