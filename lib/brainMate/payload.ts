import type { ArchetypeId } from "./archetypes";
import type { Comparison } from "./compare";
import type { Answers, Traits } from "./score";

/**
 * What the Brain-Mate overlay loads from the server. Type-only, so client
 * components can import it without pulling in the database.
 */

export type MyLinkSummary = {
  slug: string;
  direction: "sent" | "received";
  otherName: string;
  relation: "friend" | "colleague";
  state: "waiting" | "done" | "expired";
  otherArchetype?: ArchetypeId;
  outcome?: Comparison["outcome"];
  similarity?: number;
};

export type CardPayload = {
  name: string;
  answers: Answers;
  archetype: ArchetypeId;
  streak: ArchetypeId;
  cusp: boolean;
  mix: { id: ArchetypeId; pct: number }[];
  traits: Traits;
  /** Share of players with this archetype, once there are enough of them. */
  rarity: number | null;
  know: string;
  views: { by: string; traits: Traits }[];
  today: { slug: string; recipient: string; state: "waiting" | "done" | "expired" } | null;
  links: MyLinkSummary[];
  origin: string;
  intentMissing: boolean;
  energy: string | null;
};

export type MeState =
  | { signedIn: false }
  | {
      signedIn: true;
      /** Null when they haven't played the current version. */
      card: CardPayload | null;
      /** Their previous archetype, when the result is from an older version. */
      previous: ArchetypeId | null;
      defaultName: string;
      needsTerms: boolean;
      stats: { n: number; share: Record<string, number>; archetypes: Record<string, number> } | null;
    };

export type LinkPayload = {
  slug: string;
  state: "waiting" | "done" | "expired";
  role: "sender" | "recipient" | "other" | "guest";
  senderName: string;
  recipientName: string;
  relation: "friend" | "colleague";
  expiresAt: string;
  nudged: boolean;
  /** Has the viewer played the current version? */
  viewerPlayed: boolean;
  comparison: Comparison | null;
  /** On a finished link from older results: who still has to retake. */
  waitingOnRetake: string[];
  /** Has the viewer already shared how the other comes across? */
  viewGiven: boolean;
  origin: string;
};
