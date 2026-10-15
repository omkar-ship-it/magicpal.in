"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Message, Thread } from "@/lib/messages";
import type { ChatAttachment } from "@/lib/db/schema";
import { sinceLabel } from "@/lib/time";
import Avatar from "./Avatar";
import PanelNote from "./PanelNote";
import ChatComposer, { MessageAttachments } from "./ChatComposer";
import DirectoryPanel from "./DirectoryPanel";
import { IconChevronLeft, IconCheck, IconX } from "./Icons";

/**
 * Conversations, and the requests that haven't become conversations yet.
 *
 * Both live in one list on purpose: the question somebody opens this to
 * answer is "is anyone waiting on me", and splitting requests onto their own
 * screen is how requests go unanswered for a week. Anything awaiting you
 * sorts to the top regardless of age.
 *
 * Chats are the one surface the network switcher does not scope. A
 * conversation belongs to the two people in it, not to the board they met
 * on, and hiding it because you changed networks would lose messages.
 */
export default function ChatsPanel({
  signedIn,
  openWith,
  onOpened,
  onChanged,
}: {
  signedIn: boolean;
  /**
   * A person id the shell wants opened — set when somebody taps Message on
   * a profile. Consumed once and handed back, so reopening Chats later
   * doesn't keep yanking them into the same thread.
   */
  openWith?: string | null;
  onOpened?: () => void;
  /** Lets the dock badge refresh when a request is answered or a thread read. */
  onChanged: () => void;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  // Lazy initial rather than cleared in an effect: a signed-out viewer
  // was never loading, and saying so during render avoids a cascading
  // re-render on mount.
  const [loading, setLoading] = useState(signedIn);
  const [open, setOpen] = useState<Thread | null>(null);
  // Search only — there is nothing to filter conversations *by*. A chip row
  // here would be chrome pretending to be a feature.
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/threads");
      const data = await res.json();
      setThreads(data.threads ?? []);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetched inline with setState in the promise callback rather than by
  // calling load(): the React compiler rejects a synchronous setState in an
  // effect body, and doing it this way also gives the cancellation `load`
  // lacks — open Chats, close it, reopen, and two responses race.
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    fetch("/api/threads")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const list = (d.threads ?? []) as Thread[];
        setThreads(list);
        setLoading(false);
        // Opened straight into the right conversation when the shell asked
        // for one — the request is consumed here so reopening Chats later
        // lands on the list, which is what somebody expects the second time.
        if (openWith) {
          const match = list.find((t) => t.other.id === openWith);
          if (match) setOpen(match);
          onOpened?.();
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [signedIn, openWith, onOpened]);

  if (!signedIn) {
    return (
      <PanelNote title="Sign in to see your conversations">
        You can message someone once they&rsquo;ve accepted your request.
        <Link href="/login" className="btn btn-primary btn-sm mt-3">
          Sign in
        </Link>
      </PanelNote>
    );
  }

  if (open) {
    return (
      <ThreadView
        thread={open}
        onBack={() => {
          setOpen(null);
          void load();
          onChanged();
        }}
        onChanged={onChanged}
      />
    );
  }

  if (loading) return <PanelNote title="Loading…" />;

  if (threads.length === 0) {
    return (
      <PanelNote title="No conversations yet">
        Open someone&rsquo;s profile and ask to connect. Once they accept, the thread opens here — there&rsquo;s no way
        to message a stranger before that, by design.
      </PanelNote>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = q
    ? threads.filter((t) =>
        [t.other.name, t.other.headline, t.lastMessage].filter(Boolean).some((f) => f!.toLowerCase().includes(q))
      )
    : threads;

  const waiting = threads.filter((t) => t.awaitingYou).length;

  return (
    <DirectoryPanel
      query={query}
      onQuery={setQuery}
      placeholder={`Search ${threads.length} ${threads.length === 1 ? "conversation" : "conversations"}…`}
      note={
        waiting > 0 ? (
          <>
            <span className="font-semibold text-[var(--ink)]">{waiting}</span>{" "}
            {waiting === 1 ? "person is" : "people are"} waiting on you.
          </>
        ) : null
      }
    >
    {shown.length === 0 ? (
      <PanelNote title="Nothing matches that" />
    ) : (
    <ul className="stagger flex flex-col gap-1">
      {shown.map((t) => (
        <li key={t.connectionId}>
          <button
            type="button"
            onClick={() => setOpen(t)}
            className="flex w-full items-start gap-2.5 rounded-xl p-2 text-left tap hover:bg-[var(--sunk)]"
          >
            <Avatar name={t.other.name} photoUrl={t.other.photoUrl} size={38} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="min-w-0 truncate text-[13px] font-semibold">{t.other.name}</span>
                {t.awaitingYou && (
                  <span className="pill" style={{ background: "var(--brand)", color: "#fff" }}>
                    Wants to connect
                  </span>
                )}
                {t.unread > 0 && (
                  <span
                    className="ml-auto grid h-[18px] min-w-[18px] flex-none place-items-center rounded-full px-1 text-[10px] font-bold text-white"
                    style={{ background: "var(--brand)" }}
                  >
                    {t.unread}
                  </span>
                )}
              </span>
              <span className="block truncate text-[12px] text-[var(--ink-soft)]">
                {t.lastMessage ?? (t.status === "pending" ? "Request sent" : "Say hello")}
              </span>
              {t.lastAt && <span className="block text-[11px] text-[var(--ink-soft)]">{sinceLabel(t.lastAt)}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
    )}
    </DirectoryPanel>
  );
}

function ThreadView({
  thread,
  onBack,
  onChanged,
}: {
  thread: Thread;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(thread.status);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?connectionId=${thread.connectionId}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    }
  }, [thread.connectionId]);

  useEffect(() => {
    if (status !== "accepted") return;
    let alive = true;
    fetch(`/api/messages?connectionId=${thread.connectionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setMessages(d.messages ?? []);
      })
      .catch(() => {
        if (alive) setMessages([]);
      });
    return () => {
      alive = false;
    };
  }, [status, thread.connectionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function respond(accept: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/connections/${thread.connectionId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't do that.");
      onChanged();
      if (accept) setStatus("accepted");
      else onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * The composer owns the draft now, so this takes the text and the files
   * and answers whether it went — which is what tells the composer it may
   * clear itself. Clearing optimistically here instead would throw away
   * somebody's uploads on a failed send.
   */
  async function send(body: string, attachments: ChatAttachment[]): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: thread.connectionId, body, attachments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't send that.");
      await load();
      onChanged();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex flex-none items-center gap-2">
        <button type="button" onClick={onBack} className="btn btn-ghost btn-sm" aria-label="Back to conversations">
          <IconChevronLeft size={13} />
        </button>
        <Avatar name={thread.other.name} photoUrl={thread.other.photoUrl} size={28} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold">{thread.other.name}</span>
          {thread.other.headline && (
            <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">{thread.other.headline}</span>
          )}
        </span>
      </div>

      {status === "pending" ? (
        thread.awaitingYou ? (
          <div className="card p-3.5">
            <p className="text-[13px] font-semibold">{thread.other.name} wants to connect</p>
            {thread.lastMessage && (
              <p className="mt-1.5 rounded-xl p-2.5 text-[12.5px] leading-[1.5]" style={{ background: "var(--sunk)" }}>
                {thread.lastMessage}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => respond(true)}>
                <IconCheck size={13} /> Accept
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => respond(false)}>
                <IconX size={13} /> Decline
              </button>
            </div>
            {error && <p className="mt-2 text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}
          </div>
        ) : (
          <PanelNote title="Waiting on them">
            You asked to connect. The thread opens as soon as {thread.other.name.split(" ")[0]} accepts.
          </PanelNote>
        )
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="px-1 py-3 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
                You&rsquo;re connected. Say something — a specific question gets a reply far more often than
                &ldquo;hi&rdquo;.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 py-1">
                {messages.map((m) => (
                  <li key={m.id} className={m.mine ? "self-end" : "self-start"} style={{ maxWidth: "85%" }}>
                    <div
                      className="rounded-2xl px-3 py-2 text-[12.5px] leading-[1.45]"
                      style={
                        m.mine
                          ? { background: "var(--brand)", color: "#fff" }
                          : { background: "var(--sunk)", color: "var(--ink)" }
                      }
                    >
                      {m.body && <p className="whitespace-pre-line">{m.body}</p>}
                      <MessageAttachments items={m.attachments ?? []} mine={m.mine} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div ref={endRef} />
          </div>

          <ChatComposer busy={busy} onSend={send} />
          {error && <p className="mt-1 text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}
        </>
      )}
    </div>
  );
}
