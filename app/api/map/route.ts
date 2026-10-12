import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { openMapPayload } from "@/lib/openMap";
import { DEFAULT_RADIUS_KM, RADIUS_OPTIONS_KM } from "@/lib/rules";

/**
 * The open map, for every pan and radius change after the first paint.
 *
 * The first view is server-rendered by `app/page.tsx` from the same
 * `openMapPayload`, so this route exists purely to answer movement — which
 * is why it has no loading state to coordinate and no cache to invalidate.
 *
 * Deliberately open to signed-out visitors: the pitch is seeing that real
 * people are already here before committing to a signup, so it cannot sit
 * behind a login wall. They get pins and events; recommendations need a
 * profile to match against, so those come back empty.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const radiusParam = Number(url.searchParams.get("radiusKm"));
  const radiusKm = (RADIUS_OPTIONS_KM as readonly number[]).includes(radiusParam)
    ? radiusParam
    : DEFAULT_RADIUS_KM;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "A map centre is required." }, { status: 400 });
  }

  return NextResponse.json(await openMapPayload({ userId: user?.id, lat, lng, radiusKm }));
}
