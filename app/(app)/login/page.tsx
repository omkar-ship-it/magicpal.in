import { redirect } from "next/navigation";

/** Signing in is an overlay on the map; this keeps the old address working. */
export default async function LoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  // A QR scan that needed a sign-in detour comes back with ?next= pointing
  // at the board; carry it so the overlay opens on top of the right map.
  redirect(safe ? `${safe}${safe.includes("?") ? "&" : "?"}panel=signin` : "/?panel=signin");
}
