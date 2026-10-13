"use client";

import Link from "next/link";
import { useState } from "react";
import type { FeedItem } from "@/lib/feed";
import type { EventRef } from "@/lib/shell";
import PostComposer from "./PostComposer";
import { IconCalendar, IconX } from "./Icons";
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
  scopeSlug,
  events,
  canPost,
  onOpenPerson,
  onChanged,
}: {
  items: FeedItem[];
  loading: boolean;
  signedIn: boolean;
  scopeName: string;
  /** Null on the open network, which nobody owns and nobody posts to. */
  scopeSlug: string | null;
  events: EventRef[];
  canPost: boolean;
  onOpenPerson: (id: string) => void;
  onChanged: () => void;
}) {
  const composer =
    canPost && scopeSlug ? (
      <div className="mb-2.5">
        <PostComposer boardSlug={scopeSlug} boardName={scopeName} events={events} onPosted={onChanged} />
      </div>
    ) : null;

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
      <>
        {composer}
        <PanelNote title={`Nothing's happened in ${scopeName} yet`}>
          {canPost && scopeSlug
            ? "Post something, or wait — arrivals and new events show up here too. Nothing is invented to make it look busy."
            : "Arrivals, new events and people turning their map on show up here. It fills as the network does."}
        </PanelNote>
      </>
    );
  }

  return (
    <>
    {composer}
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
              {item.kind === "post" ? (
                <PostBody item={item} onChanged={onChanged} />
              ) : (
                item.person?.headline && (
                  <p className="truncate text-[11.5px] text-[var(--ink-soft)]">{item.person.headline}</p>
                )
              )}
              <p className="mt-0.5 text-[11px] text-[var(--ink-soft)]">{sinceLabel(item.at)}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
    </>
  );
}

/** A post's own body, pictures, link and attached event. */
function PostBody({ item, onChanged }: { item: FeedItem; onChanged: () => void }) {
  const [removing, setRemoving] = useState(false);
  const post = item.post!;

  async function remove() {
    setRemoving(true);
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) onChanged();
    else setRemoving(false);
  }

  return (
    <div className="mt-1">
      {post.body && <p className="whitespace-pre-line text-[12.5px] leading-[1.5]">{post.body}</p>}

      {post.images.length > 0 && (
        <div className={`mt-1.5 grid gap-1 ${post.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {post.images.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="max-h-44 w-full rounded-lg object-cover" loading="lazy" />
          ))}
        </div>
      )}

      {post.event && (
        <p className="mt-1.5 flex items-center gap-1.5 rounded-lg p-1.5 text-[11.5px] font-semibold" style={{ background: "var(--sunk)", color: "var(--layer-event)" }}>
          <IconCalendar size={11} /> {post.event.name}
        </p>
      )}

      {post.url && (
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1 block truncate text-[11.5px] font-semibold"
          style={{ color: "var(--brand)" }}
        >
          {post.url}
        </a>
      )}

      {post.canDelete && (
        <button
          type="button"
          onClick={remove}
          disabled={removing}
          className="mt-1 flex items-center gap-1 text-[11px] text-[var(--ink-soft)] hover:text-[var(--warn)]"
        >
          <IconX size={10} /> {removing ? "Removing…" : "Remove"}
        </button>
      )}
    </div>
  );
}
