import { ImageResponse } from "next/og";
import { comparisonFor, getBrainMate, getLink } from "@/lib/brainMate/server";
import { CompareWide, InvitePreview, LandingWide, cardFonts } from "@/lib/brainMate/cards";

export const alt = "Brain-Mate — find your Wavelength";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * What WhatsApp draws when the link is pasted. Waiting: the sender's type
 * face-down — the curiosity is the hook. Finished: the pair at a glance.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const link = await getLink(slug);
  const fonts = await cardFonts();
  if (!link) return new ImageResponse(<LandingWide />, { ...size, fonts });
  const c = await comparisonFor(link);
  if (c) return new ImageResponse(<CompareWide c={c} />, { ...size, fonts });
  const sender = await getBrainMate(link.senderId);
  return new ImageResponse(
    <InvitePreview sender={(sender?.displayName ?? "Someone").split(" ")[0]} recipient={link.recipientName.split(" ")[0]} />,
    { ...size, fonts }
  );
}
