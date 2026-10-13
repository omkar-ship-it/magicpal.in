import { redirect } from "next/navigation";

/**
 * Signing in is an overlay on the map; this keeps the old address working.
 *
 * `next` is translated into shell state rather than forwarded to. Forwarding
 * it is what created an infinite redirect: a QR scan sends a signed-out
 * visitor from /join to here, and sending them back to /join sent them
 * straight back to here. This route now only ever lands on `/`, which
 * cannot bounce.
 */
export default async function LoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  // The only `next` worth preserving is a board to join — the QR path. It
  // becomes `join`, which the shell completes after a successful sign-in.
  const joining = safe?.match(/^\/join\/([^/?#]+)/)?.[1];
  if (joining) {
    redirect(`/?panel=signin&join=${encodeURIComponent(joining)}`);
  }

  const net = safe?.match(/^\/b\/([^/?#]+)/)?.[1];
  redirect(net ? `/?panel=signin&net=${encodeURIComponent(net)}` : "/?panel=signin");
}
