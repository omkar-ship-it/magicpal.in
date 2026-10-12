import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { boardBySlug, membershipOf } from "@/lib/boards";
import CreateBoard from "@/components/CreateBoard";

/**
 * Creating a board, optionally inside a community.
 *
 * `?in=<slug>` is what makes "members can create events in a community"
 * work without a second concept — it just sets the parent. Membership of
 * the parent is checked here as well as in the API, so somebody who isn't
 * in the community gets told so before filling in a form rather than after.
 */
export default async function NewBoardPage({ searchParams }: { searchParams: Promise<{ in?: string }> }) {
  const { in: parentSlug } = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(parentSlug ? `/boards/new?in=${parentSlug}` : "/boards/new")}`);
  }
  if (!user.onboarded) {
    redirect(`/you?next=${encodeURIComponent("/boards/new")}`);
  }

  let parent = null;
  if (parentSlug) {
    parent = await boardBySlug(parentSlug);
    if (!parent || parent.type !== "community") notFound();
    if (!(await membershipOf(parent.id, user.id))) {
      return (
        <div className="mx-auto max-w-md pt-10">
          <h1 className="text-xl font-bold">You&rsquo;re not in that community</h1>
          <p className="mt-2 text-[13.5px] leading-[1.55] text-[var(--ink-soft)]">
            Events inside a community are only visible to its members, so only its members can add one.
          </p>
          <Link href="/boards" className="btn btn-ghost btn-sm mt-4">
            Back to boards
          </Link>
        </div>
      );
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">{parent ? `New event in ${parent.name}` : "New board"}</h1>
      <p className="mb-5 mt-1 text-[13.5px] text-[var(--ink-soft)]">
        {parent
          ? "Only members of the community will see it."
          : "You'll get a QR code and a link to share as soon as it exists."}
      </p>
      <CreateBoard parentSlug={parent?.slug} parentName={parent?.name} />
    </div>
  );
}
