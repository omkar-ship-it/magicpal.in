"use client";

import { IconBeacon, IconCity, IconHidden, IconPin } from "./Icons";

export type Visibility = "off" | "base" | "exact" | "live";

const OPTIONS: Array<{
  id: Visibility;
  label: string;
  detail: string;
  icon: React.ReactNode;
}> = [
  {
    id: "off",
    label: "Off the map",
    detail: "Nobody sees you on the public map. Boards you join still show you — that's what joining them means.",
    icon: <IconHidden size={15} />,
  },
  {
    id: "base",
    label: "My city only",
    detail: "A circle over the city, not a pin. People can find that you're here; they can't find where you are.",
    icon: <IconCity size={15} />,
  },
  {
    id: "exact",
    label: "A fixed location",
    detail: "A pin at the place you chose, street level. For a conference or a co-working day, when being findable is the point.",
    icon: <IconPin size={15} />,
  },
  {
    id: "live",
    label: "My live location",
    detail:
      "Follows your phone while this is open, and stops on its own if you close it. Falls back to your city rather than leaving an old pin behind.",
    icon: <IconBeacon size={15} />,
  },
];

/**
 * The location promise, as three choices rather than a toggle and some
 * fine print.
 *
 * Each option states the consequence in the words a person would use to
 * complain about it, because a privacy control is only as good as the
 * reader's ability to predict what it does. "City only" in particular has
 * to say *why* it's safe — a circle rather than a blurred pin — or people
 * assume it's a pin with the label removed.
 *
 * Defaults to off. The prototype defaulted to visible on the grounds that
 * an empty map sells nothing; boards solve the empty map now, so this
 * doesn't have to.
 */
export default function VisibilityPicker({
  value,
  onChange,
  hasExact,
  hasBase,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
  /** Whether a pin / a city is actually saved — an option without one can't be honoured. */
  hasExact: boolean;
  hasBase: boolean;
}) {
  return (
    <fieldset>
      <legend className="label">On the public map, show</legend>
      <div className="flex flex-col gap-2">
        {OPTIONS.map((o) => {
          // Live needs a city too — it's where the pin falls back to when
          // the session goes stale, which is the whole reason it's safe.
          const missing =
            (o.id === "exact" && !hasExact) || (o.id === "base" && !hasBase) || (o.id === "live" && !hasBase);
          const on = value === o.id;
          return (
            <label
              key={o.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 tap"
              style={{
                borderColor: on ? "var(--brand)" : "var(--line)",
                background: on ? "var(--sunk)" : "var(--card)",
              }}
            >
              <input
                type="radio"
                name="visibility"
                className="mt-0.5"
                checked={on}
                onChange={() => onChange(o.id)}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                  {o.icon}
                  {o.label}
                </span>
                <span className="mt-0.5 block text-[12px] leading-[1.45] text-[var(--ink-soft)]">{o.detail}</span>
                {/* Said here rather than by disabling the option, so the
                    choice stays visible and the fix is obvious. */}
                {missing && (
                  <span className="mt-1 block text-[12px] font-medium" style={{ color: "var(--warn)" }}>
                    {o.id === "exact" ? "Set your location below first." : "Pick your city below first."}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
