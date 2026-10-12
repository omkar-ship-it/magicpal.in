"use client";

import { TOPICS } from "@/lib/intents";
import { MAX_TOPICS } from "@/lib/rules";
import { IconCheck } from "./Icons";

/**
 * The two questions the whole product runs on.
 *
 * Asked as two separate passes over the same vocabulary rather than one
 * combined grid, because "what do you need" and "what can you offer" get
 * answered in different moods — the first is why you came, the second is
 * what you'll give — and interleaving them produces people who tick the
 * same row twice without noticing.
 *
 * The cap is shown as a count rather than by disabling the remaining
 * options: a greyed-out checkbox reads as broken, a "3 of 4" reads as a
 * budget you're spending.
 */
export default function TopicPicker({
  side,
  selected,
  onChange,
}: {
  side: "need" | "offer";
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const atCap = selected.length >= MAX_TOPICS;

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else if (!atCap) {
      onChange([...selected, id]);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="label">
          {side === "need" ? "I'm looking for" : "I can help with"}
        </p>
        <span className="text-[11.5px] text-[var(--ink-soft)]">
          {selected.length} of {MAX_TOPICS}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TOPICS.map((t) => {
          const on = selected.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              aria-pressed={on}
              disabled={!on && atCap}
              className="chip-toggle tap"
              data-on={on ? "true" : undefined}
            >
              {on && <IconCheck size={12} />}
              {side === "need" ? t.need : t.offer}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[12px] leading-4 text-[var(--ink-soft)]">
        {side === "need"
          ? "This is what your recommendations are built from. Pick the thing you'd actually cross a room for."
          : "What someone else gets out of meeting you — the other half of every match."}
      </p>
    </div>
  );
}
