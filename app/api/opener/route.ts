import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getProfileById } from "@/lib/profiles";
import {
  customOverlaps,
  draftOpener,
  overlaps,
  sharedCustomInterests,
  sharedInterests,
} from "@/lib/intents";
import { firstName } from "@/lib/matching";
import { canWrite, writeOpener } from "@/lib/ai";

/**
 * The first line, drafted.
 *
 * On demand, never in the map payload. The matcher runs for every person
 * on every page load; a model call in that path would be slow, expensive
 * and almost entirely wasted, since a reader opens one card out of
 * fifteen. This is called once, when somebody is actually looking at a
 * person and the message box needs filling.
 *
 * The facts are computed here, deterministically, from what both people
 * ticked and typed. The model is handed those facts and asked to phrase
 * them — it never decides *why* two people match, only how to say it.
 * On any failure the templated line is returned instead, so the box is
 * never empty and the caller never has to care which wrote it.
 */
export async function POST(req: Request) {
  const viewer = await getSessionUser();
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.personId === "string" ? body.personId : "";
  if (!id || id === viewer.id) return NextResponse.json({ error: "Who?" }, { status: 400 });

  const [me, them] = await Promise.all([getProfileById(viewer.id), getProfileById(id)]);
  if (!me || !them?.name) return NextResponse.json({ error: "No such person." }, { status: 404 });

  const list = overlaps(me, them);
  const custom = customOverlaps(me, them);
  const shared = sharedInterests(me.interests ?? [], them.interests ?? []);
  const sharedCustom = sharedCustomInterests(me.customInterests, them.customInterests);
  const their = firstName(them.name);

  /** The templated line is the floor, and it is returned whenever the model isn't. */
  const fallback = draftOpener({
    list,
    custom,
    firstName: their,
    other: { workingOn: them.workingOn },
    shared,
    sharedCustom,
  });

  /**
   * Stated as facts about two people, which is all the model may use.
   *
   * Written from the overlaps rather than by handing over both profiles
   * wholesale: a model given everything will reach for whatever reads
   * best, and "you both went to the same university" is a lovely sentence
   * to receive and a disaster if nobody said it.
   */
  const facts: string[] = [];
  for (const o of list) {
    if (o.direction === "mine-wants-theirs") facts.push(`I need ${o.topic.need.toLowerCase()}; they offer ${o.topic.offer.toLowerCase()}`);
    else if (o.direction === "theirs-wants-mine") facts.push(`They need ${o.topic.need.toLowerCase()}; I offer ${o.topic.offer.toLowerCase()}`);
    else facts.push(`We are both after ${o.topic.need.toLowerCase()}`);
  }
  for (const c of custom) {
    if (c.direction === "mine-wants-theirs") facts.push(`I wrote that I am looking for "${c.label}", and that is what they offer`);
    else if (c.direction === "theirs-wants-mine") facts.push(`They wrote that they are looking for "${c.label}", and that is something I offer`);
    else facts.push(`We both wrote "${c.label}"`);
  }
  for (const s of shared.slice(0, 2)) facts.push(`We are both interested in ${s.label.toLowerCase()}`);
  for (const s of sharedCustom.slice(0, 2)) facts.push(`We both wrote "${s}" as an interest`);

  if (!canWrite || facts.length === 0) {
    return NextResponse.json({ opener: fallback, written: false });
  }

  const written = await writeOpener({ theirName: their, facts });
  return NextResponse.json({ opener: written ?? fallback, written: Boolean(written) });
}
