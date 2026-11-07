import { topicById } from "@/lib/intents";

/**
 * What somebody needs and what they can give, said plainly.
 *
 * The product's whole argument is that a map beats a group chat because a
 * chat is push — you broadcast and hope — while a stated need sits there
 * and pulls the right person to you. That only works if the two lines are
 * legible at a glance, on the surface people actually look at. Until now
 * the hover card showed two unlabelled pills from `lookingFor` and nothing
 * whatsoever from `canHelpWith`: half the mechanism was invisible.
 *
 * Own words first. "A technical co-founder (ML)" is what somebody actually
 * typed; "A co-founder" is the nearest box they could tick. The vocabulary
 * is what makes overlap exactly computable, so it stays — but when a
 * person has gone to the trouble of writing the specific thing, that is
 * the sentence worth showing.
 */
export function askLines(
  topics: readonly string[],
  own: readonly string[],
  side: "need" | "offer"
): string[] {
  const fromVocab = topics
    .map((id) => topicById(id))
    .filter(Boolean)
    .map((t) => (side === "need" ? t!.need : t!.offer));
  return [...own.filter((s) => s && s.trim()), ...fromVocab];
}

/**
 * One labelled block. Warm for what they're after, cool for what they
 * offer — the pair is the only distinction on a card that has to survive
 * being read in a second, so it carries a colour rather than a heading
 * alone.
 */
export function Ask({
  side,
  lines,
  max = 2,
  compact = false,
}: {
  side: "need" | "offer";
  lines: string[];
  /** Hover has room for two; a full profile shows the lot. */
  max?: number;
  compact?: boolean;
}) {
  if (lines.length === 0) return null;
  const colour = side === "need" ? "var(--need)" : "var(--offer)";
  const shown = lines.slice(0, max);
  const rest = lines.length - shown.length;
  return (
    <span
      className={`block rounded-xl ${compact ? "px-2 py-1.5" : "px-2.5 py-2"}`}
      style={{ background: `color-mix(in srgb, ${colour} 10%, transparent)` }}
    >
      <span
        className="block text-[9.5px] font-bold uppercase tracking-[0.07em]"
        style={{ color: colour }}
      >
        {side === "need" ? "Looking for" : "Can help with"}
      </span>
      <span className={`mt-0.5 block font-semibold leading-[1.35] ${compact ? "text-[11.5px]" : "text-[12.5px]"}`}>
        {shown.join(" · ")}
        {rest > 0 && <span className="font-normal text-[var(--ink-soft)]"> +{rest} more</span>}
      </span>
    </span>
  );
}
