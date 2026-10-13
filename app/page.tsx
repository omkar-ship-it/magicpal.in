import { getSessionUser } from "@/lib/session";
import { parseScope, shellPayload } from "@/lib/shell";
import { DEFAULT_RADIUS_KM } from "@/lib/rules";
import MapShell from "@/components/MapShellLoader";

/**
 * The app opens on the map — no landing page.
 *
 * A marketing page in front of a map costs the one thing this product has
 * to prove in the first three seconds: that real people are already on it.
 *
 * `?net=<slug>` picks the network, so a board is a shareable address of
 * this same screen rather than a different one.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ net?: string; panel?: string; join?: string; event?: string }>;
}) {
  const { net, panel, join, event } = await searchParams;
  const user = await getSessionUser();

  // Fetched here rather than in the client: the first thing a visitor has
  // to believe is that real people are already on this map, and that is a
  // much easier case to make if they are there in the first paint.
  const initial = await shellPayload({
    userId: user?.id,
    scope: parseScope(net),
    radiusKm: DEFAULT_RADIUS_KM,
  });

  // `panel` keeps /you and /login working as real addresses — they redirect
  // here rather than rendering a mapless page.
  const overlay = panel === "profile" || panel === "signin" ? panel : null;

  return (
    <MapShell
      initial={initial}
      initialOverlay={user ? overlay : overlay === "profile" ? "signin" : overlay}
      pendingJoin={join ?? null}
      initialEvent={event ?? null}
      signedIn={Boolean(user)}
      onboarded={Boolean(user?.onboarded)}
      myVisibility={user?.visibility ?? "off"}
      me={user ? { name: user.name ?? user.email, photoUrl: user.photoUrl } : null}
    />
  );
}
