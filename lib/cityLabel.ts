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

/**
 * A state or union territory. A region, not a city.
 *
 * Working from the right finds the broadest term, and when a geocoder
 * includes the state that term is the state — so "Bengaluru, Karnataka,
 * India" produced a Karnataka chip while "…, Bengaluru, 560034, India"
 * produced a Bengaluru one, and the same two people appeared under both.
 * Cities are the unit this product navigates by: a chip you can walk
 * across, not one you fly across.
 *
 * India-only, because that is where the members are and a guessed list of
 * every subdivision on earth would be wrong more often than it is right.
 * Anywhere else keeps the old behaviour, which is the broadest term and a
 * slightly coarse chip — the failure this guards against is two chips for
 * one place, and that needs a name to recognise.
 */
const STATEISH = new Set([
  "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa",
  "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka", "kerala",
  "madhya pradesh", "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland",
  "odisha", "punjab", "rajasthan", "sikkim", "tamil nadu", "telangana", "tripura",
  "uttar pradesh", "uttarakhand", "west bengal",
  "andaman and nicobar islands", "chandigarh", "dadra and nagar haveli and daman and diu",
  "delhi", "jammu and kashmir", "ladakh", "lakshadweep", "puducherry",
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

  /** Is there anything further left that could be a place name at all? */
  const nameToTheLeft = (i: number) =>
    parts.slice(0, i).some((p) => !COUNTRYISH.has(p.toLowerCase()) && !NUMERIC.test(p));

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (COUNTRYISH.has(p.toLowerCase())) continue;
    // A postcode, a house number, a stray coordinate — anything that is
    // only digits. The decimal point is in the class deliberately: without
    // it "0.0000" survived as a city and two real members were filed under
    // it in the directory.
    if (NUMERIC.test(p)) continue;
    // Step past a state only when something to its left can take its
    // place. "Telangana, India" on its own is still better than nothing.
    if (STATEISH.has(p.toLowerCase()) && nameToTheLeft(i)) continue;
    return p;
  }
  // Everything looked like a country or a number. A country is still a
  // useful chip, so fall back to it — but a number never is, and falling
  // back to one is how "0.0000" became a city with two people filed under
  // it. No name is the right answer there.
  const last = parts[parts.length - 1];
  return NUMERIC.test(last) ? "" : last;
}
