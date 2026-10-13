import type { Place } from "@/components/PlaceSearch";

/**
 * Turn typed-but-unpicked venue text into coordinates.
 *
 * PlaceSearch only commits when somebody taps a suggestion, which meant a
 * host could type "T-Hub Hyderabad", submit, and get an event with no
 * coordinates — invisible on the map, with nothing in the UI to say why.
 * Forms call this on submit so the common case (type, then press the
 * button) works like people expect.
 *
 * Returns null when nothing matches, which the caller reports rather than
 * swallowing — a venue that couldn't be found is worth saying out loud.
 */
export async function resolveTypedPlace(text: string): Promise<Place | null> {
  const q = text.trim();
  if (q.length < 2) return null;
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    return (data.results?.[0] as Place | undefined) ?? null;
  } catch {
    return null;
  }
}
