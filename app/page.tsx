import { getSessionUser } from "@/lib/session";
import { getProfileById } from "@/lib/profiles";
import OpenMap from "@/components/OpenMapLoader";

/**
 * The app opens on the map — no landing page.
 *
 * A marketing page in front of a map costs the one thing this product has
 * to prove in the first three seconds: that real people are already on it.
 */
export default async function Home() {
  const user = await getSessionUser();
  const row = user ? await getProfileById(user.id) : null;

  // Centre on whatever the viewer has actually told us, in descending order
  // of how much they meant it: their exact pin, then their base city, then
  // Hyderabad — where the first boards are, so a cold visitor lands
  // somewhere with people on it rather than in the middle of the ocean.
  const center =
    row?.lat != null && row?.lng != null
      ? { lat: row.lat, lng: row.lng, label: row.locationLabel }
      : row?.baseLat != null && row?.baseLng != null
        ? { lat: row.baseLat, lng: row.baseLng, label: row.baseLabel }
        : { lat: 17.4065, lng: 78.4772, label: "Hyderabad" };

  return (
    <OpenMap
      center={center}
      signedIn={Boolean(user)}
      onboarded={Boolean(user?.onboarded)}
      myVisibility={user?.visibility ?? "off"}
    />
  );
}
