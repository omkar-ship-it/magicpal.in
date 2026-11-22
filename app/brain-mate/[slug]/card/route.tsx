import { ImageResponse } from "next/og";
import { comparisonFor, getLink } from "@/lib/brainMate/server";
import { CompareCard, cardFonts, siteFrom } from "@/lib/brainMate/cards";

/**
 * A finished Wavelength as a story-sized PNG. Public, like the card on the
 * link page itself: whoever has the link can already see this much.
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const link = await getLink(slug);
  const c = link ? await comparisonFor(link) : null;
  if (!link || !c) return new Response("Not finished yet.", { status: 404 });
  return new ImageResponse(<CompareCard c={c} site={siteFrom(req)} slug={slug} />, {
    width: 1080,
    height: 1920,
    fonts: await cardFonts(),
  });
}
