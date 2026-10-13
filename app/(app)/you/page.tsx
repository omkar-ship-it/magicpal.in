import { redirect } from "next/navigation";

/**
 * Kept as an address, not a page.
 *
 * The profile is an overlay on the map now — nothing in this product is
 * shown without the map behind it — but /you was already in links, bookmarks
 * and the sign-in flow, so it stays a working URL that opens the overlay.
 */
export default async function YouRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await searchParams;
  redirect("/?panel=profile");
}
