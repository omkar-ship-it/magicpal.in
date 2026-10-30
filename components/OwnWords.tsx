"use client";

import { useState } from "react";
import { customKey } from "@/lib/intents";
import { MAX_CUSTOM, MAX_CUSTOM_LENGTH } from "@/lib/rules";
import { IconPlus, IconX } from "./Icons";

/**
 * "Not on the list? Say it in your own words."
 *
 * Sits under each of the three chip pickers rather than replacing them,
 * because the chips are what make a match explainable — they mean the same
 * thing on everybody's profile. A typed phrase only ever matches somebody
 * who typed the same phrase, which is a narrower promise, so it's offered
 * as the overflow rather than the front door.
 *
 * Added on Enter or on the + button, never on blur: a half-typed phrase
 * becoming a permanent tag because somebody tabbed away is the standard
 * failure of this control.
 *
 * Folded away until asked for. Three of these under three chip rows meant
 * three text boxes and three lines of explanation on a form whose whole
 * problem was looking like work — and the chips are the front door anyway,
 * because a typed phrase only ever matches somebody who typed the same
 * phrase. Anyone who has already written one sees it open, since there is
 * something in it to see.
 */
export default function OwnWords({
  values,
  placeholder,
  hint,
  onChange,
}: {
  values: string[];
  placeholder: string;
  hint?: string;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(values.length > 0);
  const atCap = values.length >= MAX_CUSTOM;

  function add() {
    const label = draft.trim().replace(/\s+/g, " ").slice(0, MAX_CUSTOM_LENGTH);
    if (!label) return;
    if (atCap) {
      setNote(`${MAX_CUSTOM} is the limit — remove one first.`);
      return;
    }
    // The same key the server and the matcher use, so the rejection here
    // matches exactly what would have been dropped on save.
    const key = customKey(label);
    if (!key) {
      setNote("Use a word or two, not punctuation.");
      return;
    }
    if (values.some((v) => customKey(v) === key)) {
      setNote("You've already got that one.");
      setDraft("");
      return;
    }
    onChange([...values, label]);
    setDraft("");
    setNote("");
  }

  if (!open && values.length === 0) {
    return (
      <button
        type="button"
        className="tap mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium"
        style={{ color: "var(--brand)" }}
        onClick={() => setOpen(true)}
      >
        <IconPlus size={11} /> Add your own
      </button>
    );
  }

  return (
    <div className="mt-2">
      {values.length > 0 && (
        <ul className="mb-1.5 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <li key={v}>
              <span
                className="pill"
                style={{
                  background: "color-mix(in srgb, var(--brand) 11%, transparent)",
                  color: "var(--brand)",
                }}
              >
                {v}
                <button
                  type="button"
                  aria-label={`Remove ${v}`}
                  className="tap -mr-0.5 ml-0.5 opacity-70 hover:opacity-100"
                  onClick={() => {
                    onChange(values.filter((x) => x !== v));
                    setNote("");
                  }}
                >
                  <IconX size={10} strokeWidth={3} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1.5">
        <input
          className="input"
          value={draft}
          maxLength={MAX_CUSTOM_LENGTH}
          // Never the example once something is in the list: an empty box
          // echoing the chip directly above it reads as already filled in.
          placeholder={
            atCap ? `${MAX_CUSTOM} of ${MAX_CUSTOM} added` : values.length > 0 ? "Add another…" : placeholder
          }
          disabled={atCap}
          aria-label={placeholder}
          onChange={(e) => {
            setDraft(e.target.value);
            setNote("");
          }}
          onKeyDown={(e) => {
            // Inside a form, so Enter would otherwise submit the whole
            // profile with the phrase still sitting in the box unsaved.
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm flex-none"
          disabled={atCap || draft.trim() === ""}
          onClick={add}
        >
          <IconPlus size={13} /> Add
        </button>
      </div>

      {note ? (
        <p className="mt-1.5 text-[12px] leading-[1.45]" style={{ color: "var(--warn)" }}>
          {note}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">{hint}</p>
      )}
    </div>
  );
}
