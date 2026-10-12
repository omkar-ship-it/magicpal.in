"use client";

import Link from "next/link";
import type { FeedItem } from "@/lib/feed";
import { sinceLabel } from "@/lib/time";
import Avatar from "./Avatar";
import PanelNote from "./PanelNote";

/**
 * What's happened lately on this network.
 *
 * Every line is a real timestamp from a real row — somebody joined, somebody
 * started a board, somebody turned their map on. There is nothing here to
 * pad it out, which means a new network's feed is genuinely empty, and the
 * empty state says so rather than implying the feature is broken.
 */
export default function FeedPanel({
  items,
  loading,
  signedIn,
  scopeName,
  onOpenPerson,
}: {
  items: FeedItem[];
  loading: boolean;
  signedIn: boolean;
  scopeName: string;
  onOpenPerson: (id: string) => void;
}) {
  if (loading) return <PanelNote title="Catching up…" />;

  if (!signedIn) {
    return (
      <PanelNote title="Sign in to see what's happening">
        The feed follows the networks you&rsquo;re part of.
        <Link href="/login" className="btn btn-primary btn-sm mt-3">
          Sign in
        </Link>
      </PanelNote>
    );
  }

  if (items.length === 0) {
    return (
      <PanelNote title={`Nothing's happened on ${scopeName} yet`}>
        Arrivals, new events and people turning their map on show up here. It fills as the network does — nothing is
        invented to make it look busy.
      </PanelNote>
    );
  }

  return (
    <ul className="stagger flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.id}>
          <div className="flex items-start gap-2.5 rounded-xl p-2 hover:bg-[var(--sunk)]">
            {item.person ? (
              <button type="button" onClick={() => onOpenPerson(item.person!.id)} className="flex-none tap">
                <Avatar name={item.person.name} photoUrl={item.person.photoUrl} size={34} />
              </button>
            ) : (
              <span className="h-[34px] w-[34px] flex-none rounded-full" style={{ background: "var(--sunk)" }} />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-[1.4]">
                <button
                  type="button"
                  className="font-semibold hover:underline"
                  onClick={() => item.person && onOpenPerson(item.person.id)}
                >
                  {item.person?.name ?? "Someone"}
                </button>{" "}
                <span className="text-[var(--ink-soft)]">{item.line}</span>
              </p>
              {item.person?.headline && (
                <p className="truncate text-[11.5px] text-[var(--ink-soft)]">{item.person.headline}</p>
              )}
              <p className="mt-0.5 text-[11px] text-[var(--ink-soft)]">{sinceLabel(item.at)}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
