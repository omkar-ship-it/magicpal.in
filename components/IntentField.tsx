"use client";

import { useState } from "react";
import { IconCheck, IconChevronDown } from "./Icons";
import OwnWords from "./OwnWords";

export type IntentOption = { id: string; label: string };

/**
 * One of the three questions the matcher runs on, asked in the person's
 * own words first and from a list second.
 *
 * It used to be the other way round. The argument for leading with chips
 * was that an enumerated overlap is exactly computable and exactly
 * explainable — "funding" means the same thing on everybody's profile,
 * where a typed phrase only matches somebody who typed the same phrase.
 *
 * That argument was sound and the outcome was not. A fixed list in front
 * of somebody who has not decided what they want is a list they answer
 * approximately: four taps, none of them wrong enough to notice, and the
 * profile now claims things they did not mean. The matcher then does
 * exactly what it promised and produces a confident, explainable,
 * useless match — which is worse than no match, because somebody acts on
 * it. Free text is harder to match and much harder to answer carelessly,
 * and the second property turns out to matter more.
 *
 * It is also no longer true that a typed phrase only matches an
 * identical one. lib/ai embeds these into the similarity vectors
 * alongside the headline and what somebody is working on, so "a
 * co-founder who has shipped hardware" and "technical cofounder,
 * hardware background" already find each other. Exact wording still
 * earns the written reason; meaning does the rest.
 *
 * The list stays, one fold down, for the people who genuinely want it
 * and for the reasons above — and it opens itself whenever something in
 * it is already ticked, so a choice made earlier is never hidden behind
 * a toggle somebody has to discover.
 */
export default function IntentField({
  label,
  hint,
  placeholder,
  custom,
  onCustom,
  options,
  selected,
  onSelected,
  max,
  listLabel = "Or pick from a list",
}: {
  label: string;
  hint: string;
  placeholder: string;
  custom: string[];
  onCustom: (next: string[]) => void;
  options: IntentOption[];
  selected: string[];
  onSelected: (next: string[]) => void;
  max: number;
  listLabel?: string;
}) {
  // Open when something is already ticked — see the note above.
  const [open, setOpen] = useState(selected.length > 0);
  const atCap = selected.length >= max;

  const toggle = (id: string) => {
    if (selected.includes(id)) onSelected(selected.filter((x) => x !== id));
    else if (!atCap) onSelected([...selected, id]);
  };

  return (
    <div>
      <p className="label">{label}</p>
      <p className="mb-2 text-[12px] leading-[1.45] text-[var(--ink-soft)]">{hint}</p>

      <OwnWords primary values={custom} placeholder={placeholder} onChange={onCustom} />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="tap mt-2 inline-flex items-center gap-1 text-[12px] font-medium"
        style={{ color: "var(--ink-soft)" }}
      >
        <span
          className="inline-block transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        >
          <IconChevronDown size={12} />
        </span>
        {listLabel}
        {selected.length > 0 && <span style={{ color: "var(--brand)" }}>· {selected.length}</span>}
      </button>

      {open && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
              const on = selected.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  aria-pressed={on}
                  disabled={!on && atCap}
                  className="chip-toggle tap"
                  data-on={on ? "true" : undefined}
                >
                  {on && <IconCheck size={12} />}
                  {o.label}
                </button>
              );
            })}
          </div>
          {/* The cap as a budget rather than as a disabled control, same
              reasoning the chip picker always used. */}
          <p className="mt-1.5 text-[11.5px] text-[var(--ink-soft)]">
            {selected.length} of {max} — these are broad on purpose; your own words above are what people search.
          </p>
        </div>
      )}
    </div>
  );
}
