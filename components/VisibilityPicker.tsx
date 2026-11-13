"use client";

import { IconBeacon, IconCity, IconPin } from "./Icons";

export type Visibility = "off" | "base" | "exact" | "live";

const OPTIONS: Array<{
  id: Visibility;
  label: string;
  detail: string;
  icon: React.ReactNode;
  recommended?: boolean;
}> = [
  {
    id: "exact",
    label: "A fixed location",
    detail:
      "A pin at the place you chose, street level — and it stays there until you move it. Most people use their office, which is the one that makes the map work.",
    icon: <IconPin size={15} />,
    /**
     * The one setting this product actually works at, and now the one
     * onboarding starts on.
     *
     * A city circle makes you discoverable but not findable, and nothing
     * downstream can answer a question about metres from it — not a pin's
     * reach, not "within 2 km", not the distance steps in For you. Live is
     * better still while you're out, and worse the rest of the time,
     * because it lapses and leaves you on your city.
     *
     * It used to be badged here and defaulted nowhere, on the reasoning
     * that a location setting which picks itself is not consent. That
     * reasoning held when the alternative was no selection at all; it does
     * not describe what onboarding actually did, which was pre-select "my
     * city only" — a default either way, just the quieter one. Given that,
     * the honest choice is to start on the option the product is for and
     * keep the consequence written on the card. Nothing is published until
     * a place is picked and the step is submitted, and the two steps below
     * are one tap away.
     */
    recommended: true,
  },
  {
    id: "base",
    label: "My city only",
    detail: "A circle over the city, not a pin. People can find that you're here; they can't find where you are.",
    icon: <IconCity size={15} />,
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
 * The location promise, as four choices rather than a toggle and some
 * fine print.
 *
 * Each option states the consequence in the words a person would use to
 * complain about it, because a privacy control is only as good as the
 * reader's ability to predict what it does. "City only" in particular has
 * to say *why* it's safe — a circle rather than a blurred pin — or people
 * assume it's a pin with the label removed.
 *
 * Listed with the recommended option first rather than in order of
 * increasing exposure. The ladder was the better argument while the
 * product was arguing for restraint; what it produced was a map of city
 * circles, which is discoverable and not findable, and on which none of
 * the distance features can answer anything. So the list now leads with
 * the setting the product is actually for, badged as the popular choice,
 * with the two quieter options directly beneath it and the consequence
 * of each still written on its own card.
 *
 * "Off the map" is no longer one of the choices. It was the most protective
 * of the four and it had stopped being the one that protects anybody: the
 * public network became its own tick, so somebody who wants to be seen by
 * their board and nobody else turns that off instead and keeps a pin where
 * they joined. What `off` produced in practice was members who were in a
 * room and invisible inside it — which is the state every complaint about
 * this product so far has turned out to be.
 *
 * The value still exists. It is the column's default, so it is what
 * everybody is until they answer, and rows that chose it keep it — they
 * are told so below rather than shown a picker with nothing selected and
 * left to guess.
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
      <legend className="label">Show my location as</legend>
      {/* Said plainly, because the option that would have explained it is
          no longer in the list: an unanswered picker and a deliberate "off"
          look identical, and both mean no pin. */}
      {value === "off" && (
        <p className="mb-2 text-[12px] leading-[1.45]" style={{ color: "var(--warn)" }}>
          You have no pin at the moment, on your boards or anywhere else. Pick one of these to appear.
        </p>
      )}
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
                <span className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold">
                  {o.icon}
                  {o.label}
                  {o.recommended && (
                    <span
                      className="pill"
                      style={{
                        background: "color-mix(in srgb, var(--brand) 13%, transparent)",
                        color: "var(--brand)",
                      }}
                    >
                      Popular choice
                    </span>
                  )}
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
