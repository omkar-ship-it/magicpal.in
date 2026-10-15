"use client";

import { useState } from "react";
import type { FeedItem } from "@/lib/feed";
import { COMMENTS_PREVIEWED, MAX_COMMENT_LENGTH, REACTIONS } from "@/lib/rules";
import { sinceLabel } from "@/lib/time";
import Avatar from "./Avatar";
import { IconCalendar, IconCheck, IconChat, IconPin, IconX } from "./Icons";

/**
 * One post, with the two things that make a feed a conversation.
 *
 * The old feed rendered a post exactly like "somebody joined" — same row,
 * same weight — which made a group that was talking look identical to one
 * that wasn't. A post is now a card and the derived lines stay as quiet
 * one-liners, so the shape of the feed tells you whether anything is
 * actually happening before you read a word.
 *
 * Reactions are optimistic: the tally moves on tap and is reconciled on the
 * next load. A one-tap control that waits for a round trip stops feeling
 * like one tap, and the cost of being briefly wrong about a count is zero.
 */
export default function PostCard({
  item,
  signedIn,
  onOpenPerson,
  onChanged,
}: {
  item: FeedItem;
  signedIn: boolean;
  onOpenPerson: (id: string) => void;
  onChanged: () => void;
}) {
  const post = item.post!;
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  // Local echo over the server's numbers, so a tap lands immediately.
  const [echo, setEcho] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<string[] | null>(null);
  const chosen = mine ?? post.myReactions;

  async function react(kind: string) {
    if (!signedIn) return;
    const on = !chosen.includes(kind);
    setMine(on ? [...chosen, kind] : chosen.filter((k) => k !== kind));
    setEcho((e) => ({ ...e, [kind]: (e[kind] ?? 0) + (on ? 1 : -1) }));
    const res = await fetch(`/api/posts/${post.id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    }).catch(() => null);
    // Put it back if the server disagreed — a silent wrong count is worse
    // than a control that visibly snaps back.
    if (!res?.ok) {
      setMine(chosen);
      setEcho((e) => ({ ...e, [kind]: (e[kind] ?? 0) + (on ? -1 : 1) }));
    }
  }

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't post that.");
      setDraft("");
      setReplying(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function act(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, {
      method,
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    }).catch(() => null);
    if (res?.ok) onChanged();
    else setBusy(false);
  }

  const shownComments = showAll ? post.comments : post.comments.slice(-COMMENTS_PREVIEWED);
  const hidden = post.comments.length - shownComments.length;

  return (
    <article
      className="card p-3.5"
      style={post.pinned ? { borderColor: "var(--brand)" } : undefined}
    >
      {post.pinned && (
        <p className="label label-icon mb-2" style={{ color: "var(--brand)" }}>
          <IconPin size={11} /> Pinned by the owner
        </p>
      )}

      <div className="flex items-start gap-2.5">
        <button type="button" onClick={() => item.person && onOpenPerson(item.person.id)} className="flex-none tap">
          <Avatar name={item.person?.name ?? "?"} photoUrl={item.person?.photoUrl ?? null} size={38} />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="block max-w-full truncate text-[13px] font-semibold hover:underline"
            onClick={() => item.person && onOpenPerson(item.person.id)}
          >
            {item.person?.name ?? "Someone"}
          </button>
          <p className="truncate text-[11.5px] text-[var(--ink-soft)]">
            {item.person?.headline ? `${item.person.headline} · ` : ""}
            {sinceLabel(item.at)}
          </p>
        </div>
      </div>

      {post.body && <p className="mt-2.5 whitespace-pre-line text-[13px] leading-[1.55]">{post.body}</p>}

      {post.images.length > 0 && (
        <div className={`mt-2 grid gap-1 ${post.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {post.images.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="max-h-52 w-full rounded-xl object-cover" loading="lazy" />
          ))}
        </div>
      )}

      {post.event && (
        <p
          className="mt-2 flex items-center gap-1.5 rounded-xl p-2 text-[12px] font-semibold"
          style={{ background: "var(--sunk)", color: "var(--layer-event)" }}
        >
          <IconCalendar size={12} /> {post.event.name}
        </p>
      )}

      {post.url && (
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1.5 block truncate text-[12px] font-semibold"
          style={{ color: "var(--brand)" }}
        >
          {post.url}
        </a>
      )}

      {/* ------------------------------------------------------ reactions */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {REACTIONS.map((r) => {
          const n = (post.reactions[r.id] ?? 0) + (echo[r.id] ?? 0);
          const on = chosen.includes(r.id);
          // An unreacted option stays visible but quiet; once anybody has
          // used it, the count is the thing worth seeing.
          return (
            <button
              key={r.id}
              type="button"
              className="chip-toggle tap"
              data-on={on ? "true" : "false"}
              aria-pressed={on}
              aria-label={r.label}
              title={r.label}
              disabled={!signedIn}
              onClick={() => react(r.id)}
            >
              <span aria-hidden>{r.emoji}</span>
              {n > 0 && <span className="font-semibold">{n}</span>}
            </button>
          );
        })}

        {signedIn && (
          <button
            type="button"
            className="chip-toggle tap"
            data-on="false"
            onClick={() => setReplying((v) => !v)}
          >
            <IconChat size={11} /> {post.commentCount > 0 ? post.commentCount : "Reply"}
          </button>
        )}
      </div>

      {/* ------------------------------------------------------- comments */}
      {post.comments.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-2 border-t pt-2.5" style={{ borderColor: "var(--line)" }}>
          {hidden > 0 && (
            <button
              type="button"
              className="self-start text-[11.5px] font-semibold"
              style={{ color: "var(--brand)" }}
              onClick={() => setShowAll(true)}
            >
              Show {hidden} earlier {hidden === 1 ? "reply" : "replies"}
            </button>
          )}
          {shownComments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <button type="button" onClick={() => onOpenPerson(c.author.id)} className="flex-none tap">
                <Avatar name={c.author.name} photoUrl={c.author.photoUrl} size={26} />
              </button>
              <div className="min-w-0 flex-1 rounded-xl px-2.5 py-1.5" style={{ background: "var(--sunk)" }}>
                <p className="text-[12px] font-semibold leading-tight">{c.author.name}</p>
                <p className="mt-0.5 whitespace-pre-line text-[12.5px] leading-[1.45]">{c.body}</p>
              </div>
              {c.canDelete && (
                <button
                  type="button"
                  className="mt-1 flex-none text-[var(--ink-soft)] hover:text-[var(--warn)]"
                  aria-label="Remove reply"
                  disabled={busy}
                  onClick={() => act(`/api/comments/${c.id}`, "DELETE")}
                >
                  <IconX size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {replying && (
        <form onSubmit={reply} className="mt-2.5 flex items-end gap-2">
          <textarea
            className="input"
            rows={2}
            autoFocus
            maxLength={MAX_COMMENT_LENGTH}
            placeholder="Say something useful…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm flex-none" disabled={busy || !draft.trim()}>
            {busy ? "…" : "Reply"}
          </button>
        </form>
      )}
      {error && <p className="mt-1.5 text-[12px] font-medium text-[var(--warn)]">{error}</p>}

      {/* ----------------------------------------------- owner / author */}
      {(post.canPin || post.canDelete) && (
        <div className="mt-2 flex flex-wrap gap-3">
          {post.canPin && (
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] text-[var(--ink-soft)] hover:text-[var(--brand)]"
              disabled={busy}
              onClick={() => act(`/api/posts/${post.id}/pin`, "POST", { pinned: !post.pinned })}
            >
              {post.pinned ? <IconX size={10} /> : <IconCheck size={10} />}
              {post.pinned ? "Unpin" : "Pin to top"}
            </button>
          )}
          {post.canDelete && (
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] text-[var(--ink-soft)] hover:text-[var(--warn)]"
              disabled={busy}
              onClick={() => act(`/api/posts/${post.id}`, "DELETE")}
            >
              <IconX size={10} /> Remove
            </button>
          )}
        </div>
      )}
    </article>
  );
}
