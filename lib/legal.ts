import { BRAND_NAME } from "./brand";

/**
 * The facts a policy needs that aren't in the code.
 *
 * Kept here rather than typed into two pages so the privacy policy, the
 * terms, the consent checkbox and the consent *record* can never drift
 * apart — and so that updating a contact address is one edit rather than a
 * search across prose.
 *
 * ── STILL OUTSTANDING ─────────────────────────────────────────────────
 *
 * `registeredAddress` is null. India's IT Rules 2021 require an
 * intermediary to publish a working address for its grievance officer, and
 * a private limited company has a registered office precisely so that one
 * exists. Until it is filled in, every clause that would print the address
 * simply omits it rather than inventing one.
 *
 * None of this is legal advice, and nothing here has been reviewed by a
 * lawyer. The documents are drafted to match what the code actually does,
 * which is the half a lawyer cannot write without reading it.
 */
export const LEGAL = {
  /** The legal person who runs the service, and holds copyright in it. */
  operator: "Bandico Ventures Pvt Ltd",
  /** Null until there is a registered entity with an address to publish. */
  registeredAddress: null as string | null,
  jurisdiction: "India",
  /** Courts with exclusive jurisdiction over disputes. */
  venue: "Hyderabad, Telangana",
  /**
   * One address for everything.
   *
   * Deliberately not three — a privacy@, a support@ and a grievance@ that
   * all land in the same inbox are three ways for a person to feel they
   * wrote to the wrong one, and three addresses to keep alive. The fields
   * stay separate so a larger operator can split them later without
   * touching the prose.
   */
  contactEmail: "support@bandicoventures.com",
  supportEmail: "support@bandicoventures.com",
  grievanceOfficer: {
    name: "Omkar Bandi",
    email: "support@bandicoventures.com",
  },
  /** Minimum age. Enforced as a representation at sign-up, not verified. */
  minimumAge: 18,
  site: "https://www.opennetworks.in",
  brand: BRAND_NAME,
} as const;

/**
 * The copyright line, with the year resolved when the page renders.
 *
 * Computed rather than written down: a footer that still says 2026 in
 * March 2027 is the single most common sign that nobody is home.
 */
export function copyrightLine(): string {
  return `© ${new Date().getFullYear()} ${LEGAL.operator}. All rights reserved.`;
}

/**
 * Bumped whenever the wording of either document changes in a way that
 * affects what somebody agreed to.
 *
 * Raised from .1 to .2 when the operator changed from an individual to
 * Bandico Ventures Pvt Ltd: the identity of the party holding the data is
 * the most material fact in a privacy policy, so an agreement to the
 * earlier wording was an agreement with somebody else.
 *
 * The version is written into the consent row, so "when did they agree, and
 * to what" is answerable from the log alone — which is the only question an
 * audit, a complaint or a deletion request ever asks of it. Never reuse a
 * version after editing the text.
 */
export const LEGAL_VERSION = "2026-10-29.2";

/** Shown on both documents. Human-readable twin of LEGAL_VERSION. */
export const LEGAL_EFFECTIVE = "29 October 2026";

/**
 * The single consent kind covering both documents.
 *
 * One kind rather than two because they are accepted together in one tick,
 * and a log that records half of an indivisible agreement cannot answer the
 * question it exists for. Location consent stays separate — that one really
 * is granted and withdrawn on its own. See lib/rules CONSENT_COPY_VERSION.
 */
export const TERMS_CONSENT_KIND = "terms_privacy";

/**
 * Every third party that receives personal data, and exactly what reaches
 * them.
 *
 * Enumerated in code rather than prose because the privacy policy renders
 * from this list: a processor added to the stack and not to this array is a
 * processor missing from the policy, and that is the failure mode worth
 * engineering against.
 */
export const PROCESSORS: Array<{ name: string; role: string; data: string; where: string }> = [
  {
    name: "Vercel Inc.",
    role: "Hosting and content delivery",
    data: "Every request to the site, including IP address, and files you upload",
    where: "United States and global edge locations",
  },
  {
    name: "Neon Inc.",
    role: "Managed Postgres database",
    data: "Everything stored in your account — profile, location, messages, posts, memberships",
    where: "Region configured for the database",
  },
  {
    name: "MSG91 (Walkover Web Solutions Pvt. Ltd.)",
    role: "Transactional email delivery",
    data: "Your email address and the one-time sign-in code sent to it",
    where: "India",
  },
  {
    name: "Mapbox Inc.",
    role: "Map tiles, search and geocoding",
    data: "Map view coordinates, and any place text you type into the location search",
    where: "United States",
  },
  {
    name: "OpenStreetMap Foundation (Nominatim)",
    role: "Fallback geocoding when Mapbox is unavailable",
    data: "Place text you type into the location search, sent from our server, not your browser",
    where: "European Union",
  },
];
