import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import {
  forgetScope,
  markState,
  runRecommendations,
  scopeKeyOf,
  type Audience,
  type Criteria,
} from "@/lib/recommendations";
import { REACH_BY_ID, type Reach } from "@/lib/rules";
import { TOPIC_BY_ID } from "@/lib/intents";

/**
 * Run a recommendation query.
 *
 * A GET because it is a read with parameters — the criteria are the query,
 * and nothing about running one changes state. Marking people shown is a
 * separate, explicit write: a background refresh must not silently advance
 * somebody's deck past people they never looked at.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const audience = readAudience(q);
  const criteria: Partial<Criteria> = {};

  const reach = q.get("reach");
  if (reach && REACH_BY_ID.has(reach as Reach)) criteria.reach = reach as Reach;
  // Topics are a closed vocabulary — an unknown id is dropped rather than
  // widening the query to something nobody asked for.
  const looking = q.getAll("looking").filter((t) => TOPIC_BY_ID.has(t));
  const offering = q.getAll("offering").filter((t) => TOPIC_BY_ID.has(t));
  if (q.has("looking")) criteria.lookingFor = looking;
  if (q.has("offering")) criteria.canHelpWith = offering;
  if (q.has("twoWay")) criteria.twoWayOnly = q.get("twoWay") === "1";
  if (q.has("skipSeen")) criteria.skipSeen = q.get("skipSeen") !== "0";

  const result = await runRecommendations({ viewerId: user.id, audience, criteria });
  if (!result) return NextResponse.json({ error: "Nothing to run against." }, { status: 404 });
  return NextResponse.json({ run: result, scopeKey: scopeKeyOf(audience) });
}

/**
 * Record what happened to somebody — or start the board over.
 *
 * Separate from the run so a refresh can't move the deck on its own.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const audience = readAudience(new URLSearchParams(body?.scope ?? ""));
  const scopeKey = scopeKeyOf(audience);

  if (body?.reset === true) {
    await forgetScope(user.id, scopeKey);
    return NextResponse.json({ ok: true });
  }

  const state = ["shown", "connected", "dismissed"].includes(body?.state) ? body.state : null;
  // Shaped before it reaches the insert: a non-uuid id would come back as a
  // Postgres type error, which is a 500 for what is plainly a bad request.
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => isUuid(x)) : [];
  if (!state || ids.length === 0) return NextResponse.json({ error: "Nothing to record." }, { status: 400 });

  await markState(user.id, scopeKey, ids.slice(0, 50), state);
  return NextResponse.json({ ok: true });
}

function isUuid(x: unknown): x is string {
  return typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
}

/** Scope comes from the shell, never from the criteria — see lib/recommendations. */
function readAudience(q: URLSearchParams): Audience {
  const event = q.get("event");
  if (event) return { kind: "event", slug: event };
  const net = q.get("net");
  if (net && net !== "open") return { kind: "community", slug: net };
  return { kind: "open" };
}
