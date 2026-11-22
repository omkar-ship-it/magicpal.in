import { ImageResponse } from "next/og";
import { LandingWide, cardFonts } from "@/lib/brainMate/cards";

export const alt = "Brain-Mate — find your Brain-Mates";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(<LandingWide />, { ...size, fonts: await cardFonts() });
}
