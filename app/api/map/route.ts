import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { validPoint } from "@/lib/geo";
import { parseScope, shellPayload } from "@/lib/shell";
import { DEFAULT_RADIUS_KM, RADIUS_OPTIONS_KM } from "@/lib/rules";

/**
 * The shell, for every pan, radius change and network switch after the
 * first paint. The first view is server-rendered from the same
 * `shellPayload`, so the two can't disagree.
 *
 * Open to signed-out visitors: the pitch is seeing that real people are
 * already here before committing to a signup. They get pins and events;
 * recommendations need a stated intent to match against, so those come back
 * empty rather than guessed.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  const url = new URL(req.url);

  // A missing centre is a missing centre, not the Gulf of Guinea: the
  // open map requires one, and `Number(null)` is 0. See lib/geo.
  const centre = validPoint(url.searchParams.get("lat"), url.searchParams.get("lng"));
  const radiusParam = Number(url.searchParams.get("radiusKm"));
  const radiusKm = (RADIUS_OPTIONS_KM as readonly number[]).includes(radiusParam)
    ? radiusParam
    : DEFAULT_RADIUS_KM;

  const scope = parseScope(url.searchParams.get("net"));
  if (scope.kind === "open" && !centre) {
    return NextResponse.json({ error: "A map centre is required." }, { status: 400 });
  }

  return NextResponse.json(
    await shellPayload({
      userId: user?.id,
      scope,
      lat: centre?.lat,
      lng: centre?.lng,
      radiusKm,
    })
  );
}
