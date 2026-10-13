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
