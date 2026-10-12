import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getProfileById } from "@/lib/profiles";
import ProfileEditor, { type ProfileDraft } from "@/components/ProfileEditor";

export default async function YouPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; joined?: string }>;
}) {
  const { next, joined } = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/you")}`);
  }

  const row = await getProfileById(user.id);

  // Only ever an in-app path, never an absolute URL — this value arrives in
  // a query string, and a redirect that trusts it is an open redirect.
  const nextUrl = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  const initial: ProfileDraft = {
    name: row?.name ?? "",
    headline: row?.headline ?? "",
    company: row?.company ?? "",
    workingOn: row?.workingOn ?? "",
    bio: row?.bio ?? "",
    linkedinUrl: row?.linkedinUrl ?? "",
    photoUrl: row?.photoUrl ?? null,
    avatarStyle: "notionists",
    lookingFor: row?.lookingFor ?? [],
    canHelpWith: row?.canHelpWith ?? [],
    locationLabel: row?.locationLabel ?? null,
    lat: row?.lat ?? null,
    lng: row?.lng ?? null,
    baseLabel: row?.baseLabel ?? null,
    baseLat: row?.baseLat ?? null,
    baseLng: row?.baseLng ?? null,
    visibility: (row?.visibility as ProfileDraft["visibility"]) ?? "off",
    openToMentor: row?.openToMentor ?? false,
    seekingMentor: row?.seekingMentor ?? false,
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">{row?.name ? "Your profile" : "Set up your profile"}</h1>
        {row?.name && (
          <Link href="/" className="text-[12.5px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]">
            Back to the map
          </Link>
        )}
      </div>
      <ProfileEditor initial={initial} nextUrl={nextUrl} joinedBoardName={joined ?? null} />
    </div>
  );
}
