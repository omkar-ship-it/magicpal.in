/**
 * The city out of a place label, for grouping people into filter chips.
 *
 * Labels arrive in inconsistent shapes — "Mumbai, India", "Indiranagar,
 * Bengaluru", "Road No 11, Hyderabad, 500096, India" — because some come
 * from a geocoder and some from what somebody typed. Taking the first
 * segment gave a "Indiranagar" chip sitting next to a "Bengaluru" one for
 * the same city, which makes the filter row actively misleading.
 *
 * So: work from the right, which is where the broadest term lives, and skip
 * the two things that reliably aren't a city — a country and a postcode.
 * A heuristic, and deliberately a small one: chips are derived from the
 * people actually present, so a wrong guess is a slightly odd chip rather
 * than a missing person.
 */
const COUNTRYISH = new Set([
  "india",
  "usa",
  "united states",
  "united kingdom",
  "uk",
  "uae",
  "united arab emirates",
  "singapore",
  "canada",
  "australia",
  "germany",
  "france",
]);

/** A postcode, a house number, half a coordinate — never a place name. */
const NUMERIC = /^[\d\s.,-]+$/;

export function cityLabel(label: string | null | undefined): string {
  if (!label) return "";
  const parts = label
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (COUNTRYISH.has(p.toLowerCase())) continue;
    // A postcode, a house number, a stray coordinate — anything that is
    // only digits. The decimal point is in the class deliberately: without
    // it "0.0000" survived as a city and two real members were filed under
    // it in the directory.
    if (NUMERIC.test(p)) continue;
    return p;
  }
  // Everything looked like a country or a number. A country is still a
  // useful chip, so fall back to it — but a number never is, and falling
  // back to one is how "0.0000" became a city with two people filed under
  // it. No name is the right answer there.
  const last = parts[parts.length - 1];
  return NUMERIC.test(last) ? "" : last;
}
