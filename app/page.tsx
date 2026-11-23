import { getSessionUser } from "@/lib/session";
import { parseScope, shellPayload } from "@/lib/shell";
import { DEFAULT_RADIUS_KM } from "@/lib/rules";
import MapShell from "@/components/MapShellLoader";
import { linkedinEnabled } from "@/lib/linkedin";
import { getBrainMate } from "@/lib/brainMate/server";
import { resultFor } from "@/lib/brainMate/score";
import { ARCHETYPES } from "@/lib/brainMate/archetypes";

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
  searchParams: Promise<{ net?: string; panel?: string; join?: string; event?: string; li?: string; bm?: string; wl?: string }>;
}) {
  const { net, panel, join, event, li, bm: bmParam, wl } = await searchParams;
  // Brain-Mate opens as a window over this map: ?bm=play | card, or ?wl=<link>.
  const brainMateOpen =
    wl && /^[a-z0-9-]{3,64}$/.test(wl)
      ? ({ kind: "link", slug: wl } as const)
      : bmParam === "card"
        ? ({ kind: "card" } as const)
        : bmParam === "play"
          ? ({ kind: "play" } as const)
          : null;
  const user = await getSessionUser();

  // Brain-Mate: a prominent invitation on the map for members who haven't
  // played the current version; for those who have, it lives in their
  // profile. Read here so it's in the first paint, not a second request.
  const bm = user ? await getBrainMate(user.id).catch(() => null) : null;
  const brainMate = !user
    ? null
    : !bm
      ? ({ state: "new" } as const)
      : bm.current
        ? ({
            state: "played",
            archetype: bm.archetype,
            mix: resultFor(bm.answers).mix.map((m) => `${m.pct}% ${ARCHETYPES[m.id].name.replace("The ", "")}`).join(" · "),
          } as const)
        : ({ state: "retake", archetype: bm.archetype } as const);

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
  // "alerts" and "forYou" are where a push notification lands.
  const overlay =
    panel === "profile" || panel === "signin" || panel === "alerts" || panel === "forYou" ? panel : null;

  return (
    <MapShell
      initial={initial}
      // Signing in is meaningless once you have, and asking somebody to
      // sign in again reads as having been signed out. A stale ?panel=signin
      // in the URL — after a reload, or a shared link — opens nothing.
      initialOverlay={
        user
          ? overlay === "signin"
            ? null
            : overlay
          : // Nothing behind the sign-in wall opens for a signed-out
            // visitor; they get the door instead of a locked room.
            overlay === null
            ? null
            : "signin"
      }
      linkedin={linkedinEnabled}
      linkedinError={li ?? null}
      pendingJoin={join ?? null}
      initialEvent={event ?? null}
      signedIn={Boolean(user)}
      onboarded={Boolean(user?.onboarded)}
      myVisibility={user?.visibility ?? "off"}
      me={user ? { name: user.name ?? user.email, photoUrl: user.photoUrl } : null}
      brainMate={brainMate}
      brainMateOpen={brainMateOpen}
    />
  );
}
