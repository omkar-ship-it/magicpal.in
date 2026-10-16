"use client";

import { useCallback, useEffect, useState } from "react";
import type { Criteria, RunCard, RunResult } from "@/lib/recommendations";
import { reachLabel, type Reach } from "@/lib/rules";
import { TOPICS } from "@/lib/intents";
import Avatar from "./Avatar";
import PanelNote from "./PanelNote";
import VerifiedBadge from "./VerifiedBadge";
import { Row, Section } from "./Panel";
import { IconCheck, IconSparkle, IconUser, IconX } from "./Icons";

/**
 * "For you" as a run you can aim.
 *
 * The deck is five at a time out of however many qualified, refilling as
 * you act — because in a room of two hundred the answer to "who should I
 * talk to" is never a list of two hundred. Depth is shown as a number, not
 * as scroll.
 *
 * Nobody has to configure anything: opening this runs a sensible default
 * from your profile and the board you're standing on. "Refine" is a control
 * you reach for, never a gate you pass through.
 */
export default function ForYouPanel({
  scope,
  signedIn,
  onboarded,
  hasSignals,
  embedded = false,
  onOpenPerson,
  onSignIn,
  onProfile,
}: {
  /**
   * The board, as query params. Scope is never the run's to choose — the
   * shell knows which board the map is showing and this panel inherits it.
   */
  scope: string;
  signedIn: boolean;
  onboarded: boolean;
  /** False when the viewer has stated no needs, offers or interests. */
  hasSignals: boolean;
  /**
   * Inside a page that already scrolls — the event page, say. Two nested
   * scrollers on one surface is the bug where the inner list reaches its
   * end and the page underneath refuses to move.
   */
  embedded?: boolean;
  onOpenPerson: (id: string) => void;
  onSignIn: () => void;
  onProfile: () => void;
}) {
  const [run, setRun] = useState<RunResult | null>(null);
  const [error, setError] = useState(false);
  const [refining, setRefining] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  // Only what the viewer changed. Everything left out is the server's to
  // seed from their profile, and the run reports back what it settled on.
  const [edits, setEdits] = useState<Partial<Criteria>>({});

  const load = useCallback(
    async (over: Partial<Criteria>) => {
      const q = new URLSearchParams(scope);
      if (over.reach) q.set("reach", over.reach);
      // An empty list has to be sent as a present-but-empty param: dropping
      // it would re-seed from the profile and silently undo the clearing.
      if (over.lookingFor) {
        q.set("looking", "");
        for (const t of over.lookingFor) q.append("looking", t);
      }
      if (over.canHelpWith) {
        q.set("offering", "");
        for (const t of over.canHelpWith) q.append("offering", t);
      }
      if (over.twoWayOnly != null) q.set("twoWay", over.twoWayOnly ? "1" : "0");
      if (over.skipSeen != null) q.set("skipSeen", over.skipSeen ? "1" : "0");
      const res = await fetch(`/api/recommendations?${q}`);
      if (!res.ok) throw new Error("run failed");
      const data = await res.json();
      return data.run as RunResult;
    },
    [scope]
  );

  useEffect(() => {
    if (!signedIn || !onboarded) return;
    let alive = true;
    load(edits)
      .then((r) => {
        if (alive) setRun(r);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [signedIn, onboarded, load, edits]);

  /**
   * Being shown somebody is what puts them on the follow-up list if you
   * never act on them.
   *
   * Written without re-reading the run, deliberately: `shown` has no effect
   * on the deck in front of you — only connecting or dismissing removes
   * anybody — so nobody slides out of the deck into "seen but not
   * contacted" while they are still being read. It lands on the next action
   * or the next time the board is opened, which is when it means something.
   */
  const deckKey = run?.deck.map((d) => d.id).join(",") ?? "";
  useEffect(() => {
    if (deckKey === "") return;
    void fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, state: "shown", ids: deckKey.split(",") }),
    });
  }, [deckKey, scope]);

  async function act(id: string, state: "connected" | "dismissed") {
    await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, state, ids: [id] }),
    });
    setRun(await load(edits).catch(() => null));
  }

  async function reset() {
    await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, reset: true }),
    });
    setRun(await load(edits).catch(() => null));
  }

  if (!signedIn) {
    return (
      <PanelNote title="Sign in to get recommendations">
        The map is public. Who you should meet on it isn&rsquo;t — that needs to know what you&rsquo;re looking for.
        <button type="button" className="btn btn-primary btn-sm mt-3" onClick={onSignIn}>
          Sign in
        </button>
      </PanelNote>
    );
  }
  if (!onboarded) {
    return (
      <PanelNote title="Say what you're here for">
        Two questions — what you need, and what you can offer. Every recommendation is built from those.
        <button type="button" className="btn btn-primary btn-sm mt-3" onClick={onProfile}>
          Finish your profile
        </button>
      </PanelNote>
    );
  }
  // Checked before any empty result: with nothing stated there is nothing
  // to run on, and "nobody here lines up with what you're after" blames the
  // room for a blank in your own profile.
  if (!hasSignals) {
    return (
      <PanelNote title="Tell us what you're looking for">
        Recommendations are built from what you need, what you can offer and what you&rsquo;re into. Without any of
        those there&rsquo;s nothing to match on — the People tab still shows everyone.
        <button type="button" className="btn btn-primary btn-sm mt-3" onClick={onProfile}>
          Add your signals
        </button>
      </PanelNote>
    );
  }
  if (error) return <PanelNote title="Couldn't run that">Try again in a moment.</PanelNote>;
  if (!run) return <PanelNote title="Looking for people worth your time…" />;

  const c = run.criteria;

  return (
    <div
      className={
        embedded
          ? "flex flex-col gap-3"
          : "scroll-clean flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
      }
    >
      {/* The query, said out loud. If it can't be a sentence, it shouldn't
          be a control. */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-[1.45] text-[var(--ink-soft)]">{run.sentence}</p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--brand)" }}>
            {run.total === 0 ? "No matches" : `${run.deck.length} of ${run.total} worth meeting`}
            <span className="text-[var(--ink-soft)]"> · {run.eligible} on this board</span>
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm flex-none"
          aria-expanded={refining}
          onClick={() => setRefining((v) => !v)}
        >
          {refining ? "Done" : "Refine"}
        </button>
      </div>

      {refining && (
        <div className="card flex flex-col gap-3 p-3">
          <Control label="How far">
            <div className="flex flex-wrap gap-1.5">
              {run.reaches.map((r) => {
                // A distance can't be answered from a city centroid, at
                // either end — offered but inert, with the reason, rather
                // than silently returning nothing.
                const blocked = r.startsWith("km") && !run.canUseDistance;
                return (
                  <Chip
                    key={r}
                    on={run.reach === r}
                    dim={blocked}
                    title={blocked ? "Share your live location to use this" : undefined}
                    onClick={() => {
                      if (!blocked) setEdits((e) => ({ ...e, reach: r }));
                    }}
                  >
                    {reachLabel(r)}
                  </Chip>
                );
              })}
            </div>
          </Control>

          {/* Seeded from your profile, changed for this run only — editing
              your profile to change your results would change how everyone
              else sees you, permanently, for a need you have today. */}
          <Control label="I'm looking for help with" hint="For this run only — your profile doesn't change.">
            <TopicPicker
              side="need"
              chosen={c.lookingFor}
              onChange={(next) => setEdits((e) => ({ ...e, lookingFor: next }))}
            />
          </Control>

          <Control label="I can help with">
            <TopicPicker
              side="offer"
              chosen={c.canHelpWith}
              onChange={(next) => setEdits((e) => ({ ...e, canHelpWith: next }))}
            />
          </Control>

          <div className="flex flex-wrap gap-1.5">
            <Chip on={c.twoWayOnly} onClick={() => setEdits((e) => ({ ...e, twoWayOnly: !c.twoWayOnly }))}>
              Both ways only
            </Chip>
            <Chip on={c.skipSeen} onClick={() => setEdits((e) => ({ ...e, skipSeen: !c.skipSeen }))}>
              Skip people I&rsquo;ve seen
            </Chip>
          </div>

          <button
            type="button"
            className="self-start text-[11.5px] font-semibold"
            style={{ color: "var(--ink-soft)" }}
            onClick={() => void reset()}
          >
            Start this board over
          </button>
        </div>
      )}

      {/* A dead end that names what's blocking turns into the next run. */}
      {run.blocked && (
        <div className="card p-3.5">
          <p className="text-[12.5px] leading-[1.5]">{run.blocked.line}</p>
          {run.blocked.widenTo && (
            <button
              type="button"
              className="btn btn-primary btn-sm mt-2.5"
              onClick={() => setEdits((e) => ({ ...e, reach: run.blocked!.widenTo as Reach }))}
            >
              {reachLabel(run.blocked.widenTo)} instead
            </button>
          )}
        </div>
      )}

      <div className="stagger flex flex-col gap-2.5">
        {run.deck.map((card) => (
          <Card key={card.id} card={card} onOpen={() => onOpenPerson(card.id)} onAct={act} />
        ))}
      </div>

      {run.deck.length > 0 && run.total > run.deck.length && (
        <p className="text-center text-[11.5px] text-[var(--ink-soft)]">
          {run.total - run.deck.length} more behind these — act on one and the next appears.
        </p>
      )}

      {/* Not a list anybody curates. It is what the deck left behind, which
          is exactly "who did I miss" after an event. */}
      {run.followUp.length > 0 && (
        <Section
          title={`Seen but not contacted · ${run.followUp.length}`}
          icon={<IconUser size={12} />}
          aside={
            <button type="button" style={{ color: "var(--brand)" }} onClick={() => setShowFollowUp((v) => !v)}>
              {showFollowUp ? "Hide" : "Show"}
            </button>
          }
        >
          {showFollowUp && (
            <ul className="flex flex-col">
              {run.followUp.slice(0, 10).map((p) => (
                <li key={p.id}>
                  <Row onClick={() => onOpenPerson(p.id)}>
                    <Avatar name={p.name} photoUrl={p.photoUrl} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold">{p.name}</span>
                      <span className="block truncate text-[11px] text-[var(--ink-soft)]">{p.reason}</span>
                    </span>
                  </Row>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}

/**
 * One card in the deck.
 *
 * Not `PersonCard`: that one takes a full map profile and ends in "open
 * profile". A deck card ends in a decision — kept or passed over — and the
 * pass is what makes the deck move.
 */
function Card({
  card,
  onOpen,
  onAct,
}: {
  card: RunCard;
  onOpen: () => void;
  onAct: (id: string, state: "connected" | "dismissed") => void;
}) {
  const near =
    card.distanceKm == null ? null : card.distanceKm < 1 ? "under 1 km" : `${Math.round(card.distanceKm)} km`;
  return (
    <article className="card lift p-3.5">
      <div className="flex items-start gap-2.5">
        <button type="button" onClick={onOpen} className="flex-none tap" aria-label={`Open ${card.name}`}>
          <Avatar name={card.name} photoUrl={card.photoUrl} size={46} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpen}
              className="min-w-0 truncate text-[13.5px] font-semibold hover:underline"
            >
              {card.name}
            </button>
            {card.verified && <VerifiedBadge size={13} label="Verified by a community you're both in" />}
            {card.hereNow && (
              <span
                className="pill flex-none"
                style={{ background: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good)" }}
              >
                Here now
              </span>
            )}
          </div>
          <p className="truncate text-[12px] text-[var(--ink-soft)]">
            {card.headline}
            {card.company ? ` · ${card.company}` : ""}
          </p>
          <p className="truncate text-[11.5px] text-[var(--ink-soft)]">
            {card.locationLabel || "Somewhere"}
            {near ? ` · ${near}` : ""}
            {card.placed === "base" ? " · city only" : ""}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Pass on ${card.name}`}
          title="Not right now"
          className="flex-none text-[var(--ink-soft)] hover:text-[var(--warn)]"
          onClick={() => void onAct(card.id, "dismissed")}
        >
          <IconX size={13} />
        </button>
      </div>

      <div className="mt-2.5 rounded-xl p-2.5" style={{ background: "var(--sunk)" }}>
        <p className="label label-icon mb-1">
          <IconSparkle size={12} />
          {card.twoWay ? "You can help each other" : "Why them"}
        </p>
        <p className="text-[12.5px] leading-[1.45]">{card.reason}</p>
      </div>

      <div className="mt-2.5 flex gap-2">
        <button type="button" className="btn btn-primary btn-sm flex-1" onClick={onOpen}>
          Open profile
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          title="Keeps them on this board's record and moves the deck on"
          onClick={() => void onAct(card.id, "connected")}
        >
          Got it from here
        </button>
      </div>
    </article>
  );
}

function Control({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label m-0 mb-1">{label}</p>
      {hint && <p className="mb-1.5 text-[11px] text-[var(--ink-soft)]">{hint}</p>}
      {children}
    </div>
  );
}

function Chip({
  on,
  dim,
  title,
  onClick,
  children,
}: {
  on: boolean;
  dim?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="chip-toggle tap"
      data-on={on ? "true" : "false"}
      aria-pressed={on}
      aria-disabled={dim}
      title={title}
      style={dim ? { opacity: 0.45 } : undefined}
      onClick={onClick}
    >
      {on && <IconCheck size={11} />}
      {children}
    </button>
  );
}

/** Eight visible, the rest behind "more" — the whole vocabulary is a form. */
function TopicPicker({
  side,
  chosen,
  onChange,
}: {
  side: "need" | "offer";
  chosen: string[];
  onChange: (next: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // Whatever is already picked stays visible, however far down the list it
  // sits — a chip that vanishes behind "more" reads as having been dropped.
  const head = expanded ? TOPICS : TOPICS.filter((t, i) => i < 8 || chosen.includes(t.id));
  return (
    <div className="flex flex-wrap gap-1.5">
      {head.map((t) => (
        <Chip
          key={t.id}
          on={chosen.includes(t.id)}
          onClick={() => onChange(chosen.includes(t.id) ? chosen.filter((x) => x !== t.id) : [...chosen, t.id])}
        >
          {t[side]}
        </Chip>
      ))}
      {!expanded && TOPICS.length > head.length && (
        <button
          type="button"
          className="chip-toggle tap"
          data-on="false"
          style={{ color: "var(--brand)" }}
          onClick={() => setExpanded(true)}
        >
          +{TOPICS.length - head.length} more
        </button>
      )}
    </div>
  );
}
