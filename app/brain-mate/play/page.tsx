import { redirect } from "next/navigation";

/** The game opens over the map now; old links land there. */
export default async function PlayPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const { link } = await searchParams;
  redirect(link && /^[a-z0-9-]{3,64}$/.test(link) ? `/?wl=${link}` : "/?bm=play");
}
