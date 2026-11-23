"use client";

import { useState } from "react";
import { GOALS, GOAL_GROUPS } from "@/lib/goals";
import { MAX_CUSTOM_LENGTH } from "@/lib/rules";
import { IconCheck } from "./Icons";

/**
 * "What brings you here?" — thirty goals in five groups, so a doctor, a
 * student, an investor and a chef all find themselves in a glance, plus a
 * "Something else?" box for anyone who doesn't. Picks count together, up
 * to `max`.
 */
export default function GoalPicker({
  selected,
  typed,
  max,
  onToggle,
  onAddTyped,
  onRemoveTyped,
}: {
  selected: string[];
  typed: string[];
  max: number;
  onToggle: (id: string) => void;
  onAddTyped: (text: string) => void;
  onRemoveTyped: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const count = selected.length + typed.length;
  const full = count >= max;
  const add = () => {
    const t = text.trim().replace(/\s+/g, " ").slice(0, MAX_CUSTOM_LENGTH);
    if (t.length < 2 || full) return;
    onAddTyped(t);
    setText("");
  };

  const chip = (on: boolean) => ({
    borderColor: on ? "var(--brand)" : "var(--line)",
    background: on ? "color-mix(in srgb, var(--brand) 10%, var(--card))" : "var(--card)",
    color: on ? "var(--brand-deep)" : "var(--ink)",
  });

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[11.5px] font-semibold text-[var(--ink-soft)]">
        {count === 0 ? `Pick up to ${max}` : full ? `${count} of ${max} picked — untick one to change` : `${count} of ${max} picked`}
      </p>
      {GOAL_GROUPS.map((group) => (
        <div key={group}>
          <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-[var(--ink-soft)]">{group.toUpperCase()}</p>
          <div className="flex flex-wrap gap-1.5">
            {GOALS.filter((x) => x.group === group).map((x) => {
              const on = selected.includes(x.id);
              return (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => onToggle(x.id)}
                  className="tap flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-40"
                  style={chip(on)}
                >
                  <span aria-hidden="true">{x.emoji}</span>
                  {x.label}
                  {on && <IconCheck size={12} />}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-[var(--ink-soft)]">SOMETHING ELSE?</p>
        {typed.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {typed.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onRemoveTyped(t)}
                className="tap flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium"
                style={chip(true)}
                aria-label={`Remove ${t}`}
              >
                ✍️ {t} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={text}
            maxLength={MAX_CUSTOM_LENGTH}
            disabled={full}
            placeholder={full ? `Up to ${max} — remove one to add your own` : "In your own words, e.g. A studio space to rent"}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            aria-label="What brings you here, in your own words"
          />
          <button type="button" className="btn btn-ghost" disabled={full || text.trim().length < 2} onClick={add}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
