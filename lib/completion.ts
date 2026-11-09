/**
 * How finished somebody's profile is, as a number they can watch move.
 *
 * Shown only to the person themselves, on their own marker and their own
 * directory row, and only until it reaches a hundred. Arriving by
 * LinkedIn no longer costs a three-step form, so this is what carries
 * the ask instead: a percentage you can see from the map is a better
 * nudge than a panel somebody has to open, because it is attached to the
 * thing it is about — you, as the room sees you.
 *
 * Five parts, not three, even though onboarding has three steps. The
 * steps are groupings of questions and a third of a bar barely moves;
 * five is fine enough that answering one thing visibly pays, and coarse
 * enough that nobody is chasing a last percent for a field that doesn't
 * matter. Each part is a thing that changes what the product can do for
 * you, which is why "bio" and "company" are not among them.
 */

export type Completion = {
  percent: number;
  /** The next thing worth doing, in the order onboarding would ask. */
  next: string | null;
};

type Profile = {
  name?: string | null;
  headline?: string | null;
  photoUrl?: string | null;
  lat?: number | null;
  baseLat?: number | null;
  visibility?: string | null;
  lookingFor?: readonly string[] | null;
  customLookingFor?: readonly string[] | null;
  canHelpWith?: readonly string[] | null;
  customCanHelpWith?: readonly string[] | null;
  interests?: readonly string[] | null;
  customInterests?: readonly string[] | null;
};

const some = (...lists: Array<readonly string[] | null | undefined>) =>
  lists.some((l) => (l?.length ?? 0) > 0);

export function completion(p: Profile): Completion {
  /**
   * Ordered the way onboarding asks, so "what's next" is never a step
   * backwards from where somebody already is.
   *
   * A photo earns a fifth of the bar because it is the single thing that
   * most changes whether a stranger opens your card, and it is also the
   * one people most often skip — LinkedIn brings it for free, which is
   * most of why arriving that way is worth preferring.
   */
  const parts: Array<{ done: boolean; ask: string }> = [
    { done: (p.name?.trim().length ?? 0) >= 2, ask: "Add your name" },
    { done: (p.headline?.trim().length ?? 0) >= 2, ask: "Say what you do" },
    {
      done: p.visibility !== "off" && (p.baseLat != null || p.lat != null),
      ask: "Put yourself on the map",
    },
    {
      done: some(p.lookingFor, p.customLookingFor) || some(p.canHelpWith, p.customCanHelpWith),
      ask: "Say what you're looking for",
    },
    { done: Boolean(p.photoUrl), ask: "Add a photo" },
  ];

  const done = parts.filter((x) => x.done).length;
  return {
    percent: Math.round((done / parts.length) * 100),
    next: parts.find((x) => !x.done)?.ask ?? null,
  };
}
