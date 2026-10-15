"use client";

import { useEffect, useState } from "react";
import type { FeedItem } from "@/lib/feed";
import PostCard from "./PostCard";
import PostComposer from "./PostComposer";
import { IconChat } from "./Icons";

/**
 * The event's own thread.
 *
 * An event is a board, so this is the same feed machinery the community
 * uses, pointed at the event's slug — which means reactions, replies and
 * host moderation all work here without a second implementation.
 *
 * Worth having separately from the community's feed because the questions
 * are different and short-lived: where exactly is the entrance, is anyone
 * sharing a cab, has it started. In the community feed those would be noise
 * to the two hundred people who aren't going.
 */
export default function EventDiscussion({
  slug,
  onOpenPerson,
}: {
  slug: string;
  onOpenPerson: (id: string) => void;
}) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`/api/feed?net=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setItems(d.items ?? []);
      })
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [slug, reload]);

  if (items === null) return null;

  const posts = items.filter((i) => i.kind === "post");

  return (
    <div>
      <p className="label label-icon">
        <IconChat size={12} /> Discussion{posts.length > 0 ? ` · ${posts.length}` : ""}
      </p>

      <PostComposer
        boardSlug={slug}
        boardName="this event"
        events={[]}
        onPosted={() => setReload((n) => n + 1)}
      />

      {posts.length === 0 ? (
        <p className="mt-2 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
          Nothing yet. &ldquo;Anyone sharing a cab from the metro?&rdquo; is the kind of thing that gets answered
          here.
        </p>
      ) : (
        <ul className="stagger mt-2 flex flex-col gap-2.5">
          {posts.map((item) => (
            <li key={item.id}>
              <PostCard
                item={item}
                signedIn
                onOpenPerson={onOpenPerson}
                onChanged={() => setReload((n) => n + 1)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
