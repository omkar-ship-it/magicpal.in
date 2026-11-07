"use client";

import PanelNote from "./PanelNote";

/**
 * What every people-shaped panel says to a reader who has stated nothing.
 *
 * One component rather than three near-identical notes, because this is a
 * single promise and it has to be made in the same words wherever somebody
 * runs into it. The argument is the product's: a group chat is push — you
 * broadcast and hope somebody is listening — and a stated need is pull,
 * sitting there until the right person reads it. The price of the second
 * is saying your own.
 *
 * Deliberately no number anywhere in it. On a map this young the true
 * headcount is the least persuasive fact available, and a newcomer reads a
 * small one as "nobody is here" rather than as "here is what you're
 * missing". The blurred pins behind the panel make the only argument that
 * works at this size: somebody is there.
 */
export default function LockedNote({
  what,
  onProfile,
}: {
  /** The surface's own word for what's hidden — "who's here", "what people are up to". */
  what: string;
  onProfile?: () => void;
}) {
  return (
    <PanelNote title={`Say what you're here for, and ${what} opens up`}>
      Everyone on this map has said what they&rsquo;re looking for and what they can help with. Add yours and
      you&rsquo;ll see theirs.
      <span className="mt-2 block">
        It takes a minute, and it&rsquo;s the part that makes the right people come to you instead of you
        chasing them.
      </span>
      {onProfile && (
        <button type="button" className="btn btn-primary btn-sm mt-3" onClick={onProfile}>
          Add what you&rsquo;re looking for
        </button>
      )}
    </PanelNote>
  );
}
