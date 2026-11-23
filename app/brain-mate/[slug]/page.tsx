import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpenOnMap from "@/components/brainMate/OpenOnMap";
import { OUTCOMES } from "@/lib/brainMate/compare";
import { comparisonFor, getBrainMate, getLink } from "@/lib/brainMate/server";

/**
 * One Wavelength link — omkar-sunil-k7x — for good. This address exists for
 * its link preview (what WhatsApp draws when it's pasted); a person who
 * opens it lands on the home map with the Wavelength open over it, where
 * the overlay (components/brainMate/Overlay) handles every state.
 */

type Params = { params: Promise<{ slug: string }> };

const first = (s: string) => s.split(" ")[0];

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const link = await getLink(slug);
  if (!link) return { title: "Brain-Mate" };
  const c = await comparisonFor(link);
  if (c) {
    const o = OUTCOMES[c.outcome];
    return {
      title: `${c.a.name} × ${c.b.name}: ${o.label} — Brain-Mate`,
      description: `${c.similarity} on the same wavelength, ${c.compatibility} compatible. “${c.dynamic}” Find your Brain-Mates.`,
    };
  }
  const sender = await getBrainMate(link.senderId);
  const s = first(sender?.displayName ?? "Someone");
  return {
    title: `${s} wants to find your Wavelength — Brain-Mate`,
    description: `${s}'s type stays hidden until you play. About 3 minutes, then see how you click.`,
  };
}

/**
 * A shared Wavelength link. The metadata above gives WhatsApp its preview;
 * a person is sent to the home map with the Wavelength open over it.
 */
export default async function LinkPage({ params }: Params) {
  const { slug } = await params;
  if (!(await getLink(slug))) notFound();
  return <OpenOnMap to={`/?wl=${slug}`} />;
}
