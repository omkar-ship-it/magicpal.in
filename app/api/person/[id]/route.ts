import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getProfileById } from "@/lib/profiles";
import { getConnectionBetween } from "@/lib/connections";
import { sharedBoardsBetween } from "@/lib/boards";

/**
 * One person, in full — what the profile window shows.
 *
 * Separate from the map payload on purpose. The map carries hundreds of
 * people and must stay lean and safe; this carries everything about one,
 * including fields that are nobody else's business by default. A phone
 * number in a bulk response would be a phone number in every browser's
 * network tab, whatever the UI chose to render.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const viewer = await getSessionUser();

  const row = await getProfileById(id);
  if (!row || !row.name) return NextResponse.json({ error: "No such person." }, { status: 404 });

  const connection = viewer ? await getConnectionBetween(viewer.id, id) : null;
  const connected = connection?.status === "accepted";
  const isSelf = viewer?.id === id;

  // Contact details are the one thing gated on an accepted connection — the
  // request is what makes reaching somebody cost their consent, and handing
  // out the number regardless would make the whole exchange decorative.
  const maySeePhone = isSelf || (connected && row.phoneVisibility === "connections");

  return NextResponse.json({
    person: {
      id: row.id,
      name: row.name,
      headline: row.headline,
      company: row.company,
      bio: row.bio,
      workingOn: row.workingOn,
      photoUrl: row.photoUrl,
      stage: row.stage,
      lookingFor: row.lookingFor ?? [],
      canHelpWith: row.canHelpWith ?? [],
      interests: row.interests ?? [],
      skills: row.skills ?? [],
      linkedinUrl: row.linkedinUrl,
      websiteUrl: row.websiteUrl,
      instagramUrl: row.instagramUrl,
      // Null rather than absent, so the UI can say "shared once you connect"
      // instead of silently showing nothing.
      phone: maySeePhone ? row.phone : null,
      hasPhone: Boolean(row.phone),
      // Where they chose to be, described rather than pinpointed.
      locationLabel: row.visibility === "base" ? row.baseLabel : row.locationLabel,
      placed: row.visibility,
      joinedAt: row.createdAt.toISOString(),
      openToMentor: row.openToMentor,
      seekingMentor: row.seekingMentor,
    },
    connection: {
      status: connected ? "connected" : connection?.status === "pending" ? "pending" : "none",
      isSelf,
    },
    /** Communities you're both in — the strongest thing a stranger can read. */
    shared: viewer ? await sharedBoardsBetween(viewer.id, id) : [],
  });
}
