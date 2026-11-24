import { TRAIT_PRAISE, type Trait } from "./archetypes";
import type { Traits } from "./score";

/**
 * The insight: one line at the end of the reveal that gives words to
 * something the player has felt but never said.
 *
 * Built from a *tension* — two of their own traits pulling against (or
 * amplifying) each other — rather than from the archetype, so two
 * Visionaries can read different lines. Each tension names the pair it
 * needs: `+` means that trait runs high, `-` low. The strongest pairing
 * the player actually has wins; the weaker of its two scores is its
 * strength, so both halves have to be genuinely true of them.
 *
 * Reactions ("That's so me" / "Not quite") are stored per insight id, so
 * the weak lines can be found and rewritten later.
 */

type Pole = [Trait, 1 | -1];
export type Tension = { id: string; when: [Pole, Pole]; line: string };

export const TENSIONS: Tension[] = [
  { id: "vision-finish", when: [["V", 1], ["D", -1]], line: "You can see the finished thing so clearly that starting something new feels more alive than finishing this one." },
  { id: "vision-route", when: [["V", 1], ["S", -1]], line: "You know exactly where you're going — you just refuse to be told the route." },
  { id: "vision-quiet", when: [["V", 1], ["A", -1]], line: "You dream bigger than you let on. Most people around you have no idea how far you're actually aiming." },
  { id: "vision-people", when: [["V", 1], ["C", 1]], line: "You don't just want to get somewhere — you want to take people with you, and it quietly stings when they don't come." },
  { id: "vision-peace", when: [["V", 1], ["H", 1]], line: "You aim high but hate the friction it takes to get there, so you carry more of the weight alone than anyone realises." },
  { id: "imagine-plan", when: [["O", 1], ["S", 1]], line: "You plan so you can stop thinking about it — the structure is how you buy yourself room to imagine." },
  { id: "imagine-build", when: [["O", 1], ["D", 1]], line: "Ideas don't feel real to you until they exist. A brilliant thought you never built still bothers you years later." },
  { id: "imagine-hunch", when: [["O", 1], ["I", -1]], line: "You trust a hunch long before you can explain it — and you're right more often than you get credit for." },
  { id: "depth-quiet", when: [["I", 1], ["E", -1]], line: "You'd rather understand one thing completely than know a little about everything — small talk feels like a waiting room." },
  { id: "solved-done", when: [["I", 1], ["D", -1]], line: "Once you've figured out how something works, part of you is already done with it." },
  { id: "curious-care", when: [["I", 1], ["C", 1]], line: "You ask questions because you genuinely want to know people — that's why they tell you things they tell no one else." },
  { id: "right-comfort", when: [["I", 1], ["H", -1]], line: "You'd rather be right than comfortable, and you assume everyone else would too. They don't always." },
  { id: "craft-pride", when: [["D", 1], ["V", -1]], line: "You don't need a grand vision to feel proud. A thing done well, start to finish, is its own reward." },
  { id: "open-loops", when: [["D", 1], ["S", 1]], line: "Unfinished things live rent-free in your head. You'll stay up to close a loop no one else would even notice." },
  { id: "care-by-doing", when: [["D", 1], ["C", 1]], line: "You show care by doing, not saying — the person who quietly fixed it was usually you." },
  { id: "quiet-output", when: [["D", 1], ["E", -1]], line: "You get more done in one quiet afternoon than most people do in a week of meetings — and you know it." },
  { id: "calm-crisis", when: [["S", 1], ["A", 1]], line: "You're often the calmest person in a crisis — not because you don't feel it, but because you already had a plan B." },
  { id: "spontaneous-yes", when: [["S", -1], ["E", 1]], line: "Your best days are the unplanned ones. A spontaneous yes has given you more than any schedule ever has." },
  { id: "invisible-glue", when: [["S", 1], ["H", 1]], line: "You keep things running so smoothly that people forget how much you're quietly holding together." },
  { id: "noticed", when: [["E", 1], ["C", 1]], line: "You light up a room, but what people remember is that you noticed them." },
  { id: "centre-not-charge", when: [["E", 1], ["A", -1]], line: "You love being in the middle of things, but you rarely need to be in charge of them." },
  { id: "midnight-friend", when: [["E", -1], ["C", 1]], line: "You're the one people call at midnight. Few know how much that takes out of you — or that you give it anyway." },
  { id: "collect-people", when: [["E", 1], ["I", 1]], line: "You collect people the way others collect books — every conversation is a chance to learn something new." },
  { id: "hard-thing-care", when: [["A", 1], ["C", 1]], line: "You say the hard thing because you care — and you're surprised every time it lands as harsh." },
  { id: "wrong-over-wait", when: [["A", 1], ["H", -1]], line: "You'd rather make the wrong call than no call. Waiting feels worse to you than being wrong." },
  { id: "see-it-first", when: [["A", -1], ["H", 1]], line: "You often see the answer first and wait for someone else to say it — you'd rather the group gets there together." },
  { id: "lead-instinct", when: [["A", 1], ["S", -1]], line: "You lead on instinct, not process — people follow because you sound sure, even while you're still figuring it out." },
  { id: "room-weather", when: [["C", 1], ["H", 1]], line: "You feel a room's mood like weather — when things are tense, you know before anyone says a word." },
  { id: "fix-is-care", when: [["C", -1], ["I", 1]], line: "You show respect by solving the problem, not talking about feelings — and it quietly hurts when that isn't seen as care." },
  { id: "honest-argument", when: [["H", -1], ["C", 1]], line: "You'd rather have the honest argument than the polite silence — because you care enough to bother." },
];

/** Below this, a pairing isn't true enough of them to say out loud. */
const MIN_STRENGTH = 0.25;

/** The one insight this player gets: their strongest real tension, or their strongest trait said plainly. */
export function insightFor(t: Traits): { id: string; line: string } {
  let best: { id: string; line: string; s: number } | null = null;
  for (const x of TENSIONS) {
    const s = Math.min(x.when[0][1] * t[x.when[0][0]], x.when[1][1] * t[x.when[1][0]]);
    if (s >= MIN_STRENGTH && (!best || s > best.s)) best = { id: x.id, line: x.line, s };
  }
  if (best) return { id: best.id, line: best.line };
  // A very even profile: say their strongest trait, plainly.
  const k = (Object.keys(t) as Trait[]).sort((a, b) => Math.abs(t[b]) - Math.abs(t[a]))[0];
  const [, line] = TRAIT_PRAISE[k][t[k] >= 0 ? "hi" : "lo"];
  return { id: `trait-${k}-${t[k] >= 0 ? "hi" : "lo"}`, line };
}

export const INSIGHT_VERDICTS = ["so_me", "not_quite"] as const;
export type InsightVerdict = (typeof INSIGHT_VERDICTS)[number];
