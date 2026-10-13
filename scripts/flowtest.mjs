// End-to-end coverage for the promises MagicPal actually makes: sign in,
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
