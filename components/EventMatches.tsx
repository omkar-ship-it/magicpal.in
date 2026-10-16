"use client";

import { useEffect, useState } from "react";
import type { RunResult } from "@/lib/recommendations";
import Avatar from "./Avatar";
import ForYouPanel from "./ForYouPanel";
import { Section } from "./Panel";
import { IconSparkle } from "./Icons";

/**
 * Who is worth meeting at this event, shown where the decision is made.
 *
 * An event page is where somebody decides whether to go and who to find,
 * so "who here is worth my time" is the most actionable thing on it.
 * Putting that behind a dock button meant leaving the page that holds the
 * date, the venue and the roster in order to see it.
 *
 * Two faces and a count, then the whole run in place.
 *
 * A preview rather than the run itself, because the criteria panel, the
 * deck and the follow-up list would triple the length of the page and turn
 * a reference into a workspace. And it *reads* the run without recording
 * anything — glancing at a page is not the same as having been shown
 * somebody, and marking them seen here would quietly empty the deck before
 * it was ever opened. The GET does no writing, which is what makes that
 * possible.
 */
export default function EventMatches({
  slug,
  signedIn,
  onboarded,
  hasSignals,
  onOpenPerson,
  onProfile,
  onSignIn,
}: {
  slug: string;
  signedIn: boolean;
  onboarded: boolean;
  hasSignals: boolean;
  onOpenPerson: (id: string) => void;
  onProfile: () => void;
  onSignIn: () => void;
}) {
  const [peek, setPeek] = useState<RunResult | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!signedIn || !onboarded || !hasSignals) return;
    let alive = true;
    fetch(`/api/recommendations?event=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.run) setPeek(d.run as RunResult);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug, signedIn, onboarded, hasSignals]);

  // Quiet rather than a pitch: somebody who hasn't said what they're after
  // is told so once, on the For You panel, not again on every event page.
  if (!signedIn || !onboarded || !hasSignals) return null;

  if (open) {
    return (
      <Section title="Worth meeting here" icon={<IconSparkle size={12} />}>
        <ForYouPanel
          scope={`event=${encodeURIComponent(slug)}`}
          signedIn={signedIn}
          onboarded={onboarded}
          hasSignals={hasSignals}
          embedded
          onOpenPerson={onOpenPerson}
          onProfile={onProfile}
          onSignIn={onSignIn}
        />
      </Section>
    );
  }

  // Nothing at all is said with one line rather than an empty section: a
  // roster of four nobody matches is normal, not a failure to report.
  if (!peek) return null;
  if (peek.total === 0) {
    return (
      <Section title="Worth meeting here" icon={<IconSparkle size={12} />}>
        <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => setOpen(true)}>
          Nobody obvious yet — run it yourself
        </button>
      </Section>
    );
  }

  const top = peek.deck.slice(0, 2);

  return (
    <Section
      title="Worth meeting here"
      icon={<IconSparkle size={12} />}
      aside={`${peek.total} of ${peek.eligible}`}
    >
      <div className="stagger flex flex-col gap-2">
        {top.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpenPerson(p.id)}
            className="card lift flex items-start gap-2.5 p-2.5 text-left"
          >
            <Avatar name={p.name} photoUrl={p.photoUrl} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold">{p.name}</span>
              <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">
                {p.headline}
                {p.company ? ` · ${p.company}` : ""}
              </span>
              <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--brand)" }}>
                {p.reason}
              </span>
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-sm mt-2 w-full" onClick={() => setOpen(true)}>
        {peek.total > top.length ? `See all ${peek.total} worth meeting` : "Open the full run"}
      </button>
    </Section>
  );
}
