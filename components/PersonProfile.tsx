"use client";

import { useEffect, useState } from "react";
import { sectorById, stageById, topicById } from "@/lib/intents";
import Avatar from "./Avatar";
import PanelNote from "./PanelNote";
import {
  IconBriefcase,
  IconCheck,
  IconCity,
  IconLock,
  IconPeople,
  IconPin,
  IconSparkle,
} from "./Icons";

type Person = {
  id: string;
  name: string;
  headline: string | null;
  company: string | null;
  bio: string | null;
  workingOn: string | null;
  photoUrl: string | null;
  stage: string | null;
  lookingFor: string[];
  canHelpWith: string[];
  interests: string[];
  skills: string[];
  linkedinUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  phone: string | null;
  hasPhone: boolean;
  locationLabel: string | null;
  placed: string;
  joinedAt: string;
  openToMentor: boolean;
  seekingMentor: boolean;
};

/**
 * Everything we actually know about one person, laid out to be read.
 *
 * Fetched on open rather than taken from the map payload, because the two
 * want opposite things: the map carries hundreds of people and has to stay
 * lean and safe, this carries one and can afford to be complete. It is also
 * the only place a phone number can appear, and only to somebody with an
 * accepted connection.
 *
 * Ordered the way you'd read a stranger: who they are, why you'd talk, what
 * they want, what they offer, then how to reach them.
 */
export default function PersonProfile({
  personId,
  reason,
  twoWay,
  children,
}: {
  personId: string;
  /** The matcher's sentence, when this person came from a recommendation. */
  reason?: string;
  twoWay?: boolean;
  /** The connect / message controls, owned by the caller. */
  children?: React.ReactNode;
}) {
  const [data, setData] = useState<{
    person: Person;
    connection: { status: string; isSelf: boolean };
    shared: Array<{ slug: string; name: string; type: string }>;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  // Reset keyed off the id rather than cleared in the effect: a synchronous
  // setState there is a cascading render, and the stale-profile flash it
  // would guard against is handled by checking the id on arrival instead.
  const [shownId, setShownId] = useState(personId);
  const stale = shownId !== personId;

  useEffect(() => {
    let alive = true;
    fetch(`/api/person/${personId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        setShownId(personId);
        if (json.person) {
          setData(json);
          setFailed(false);
        } else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [personId]);

  if (failed && !stale) return <PanelNote title="Couldn't load that profile." />;
  if (!data || stale) return <PanelNote title="Loading…" />;

  const p = data.person;
  const stage = stageById(p.stage);
  const wants = p.lookingFor.map(topicById).filter(Boolean);
  const offers = p.canHelpWith.map(topicById).filter(Boolean);
  const sectors = p.interests.map(sectorById).filter(Boolean);
  const connected = data.connection.status === "connected";

  return (
    <div className="flex flex-col gap-4">
      {/* ----------------------------------------------------- identity */}
      <div className="flex items-start gap-3.5">
        <Avatar name={p.name} photoUrl={p.photoUrl} size={76} ring={3} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold leading-tight">{p.name}</h3>
          {p.headline && <p className="mt-0.5 text-[13px] leading-[1.4]">{p.headline}</p>}
          {p.company && (
            <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[var(--ink-soft)]">
              <IconBriefcase size={12} /> {p.company}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {stage && (
              <span className="pill" style={{ background: "var(--sunk)", color: "var(--ink-soft)" }}>
                {stage.label}
              </span>
            )}
            {connected && (
              <span
                className="pill"
                style={{ background: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good)" }}
              >
                <IconCheck size={10} /> Connected
              </span>
            )}
          </div>
          {p.locationLabel && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
              {p.placed === "base" ? <IconCity size={11} /> : <IconPin size={11} />}
              {p.locationLabel}
              {p.placed === "base" ? " · city only" : p.placed === "live" ? " · live" : ""}
            </p>
          )}
        </div>
      </div>

      {reason && (
        <div className="rounded-xl p-2.5" style={{ background: "var(--sunk)" }}>
          <p className="label label-icon mb-1">
            <IconSparkle size={12} />
            {twoWay ? "You can help each other" : "Why them"}
          </p>
          <p className="text-[12.5px] leading-[1.45]">{reason}</p>
        </div>
      )}

      {/* The strongest thing a stranger can read: somebody already vouched
          for both of you. */}
      {data.shared.length > 0 && (
        <Section title="You're both in">
          <div className="flex flex-wrap gap-1.5">
            {data.shared.map((b) => (
              <span key={b.slug} className="pill" style={{ background: "var(--sunk)" }}>
                <IconPeople size={11} /> {b.name}
              </span>
            ))}
          </div>
        </Section>
      )}

      {p.workingOn && (
        <Section title="Working on">
          <p className="text-[12.5px] leading-[1.5]">{p.workingOn}</p>
        </Section>
      )}

      {p.bio && (
        <Section title="About">
          <p className="whitespace-pre-line text-[12.5px] leading-[1.55]">{p.bio}</p>
        </Section>
      )}

      {wants.length > 0 && (
        <Section title="Looking for">
          <Chips items={wants.map((t) => t!.need)} tone="brand" />
        </Section>
      )}

      {offers.length > 0 && (
        <Section title="Can help with">
          <Chips items={offers.map((t) => t!.offer)} tone="good" />
        </Section>
      )}

      {sectors.length > 0 && (
        <Section title="Interested in">
          <Chips items={sectors.map((s) => s!.label)} tone="muted" />
        </Section>
      )}

      {p.skills.length > 0 && (
        <Section title="Skills">
          <Chips items={p.skills} tone="muted" />
        </Section>
      )}

      {(p.openToMentor || p.seekingMentor) && (
        <Section title="Mentoring">
          <Chips
            items={[p.openToMentor ? "Open to mentoring" : null, p.seekingMentor ? "Looking for a mentor" : null].filter(
              (x): x is string => Boolean(x)
            )}
            tone="muted"
          />
        </Section>
      )}

      {/* ------------------------------------------------------ contact */}
      <Section title="Reach them">
        <div className="flex flex-col gap-1.5">
          {p.linkedinUrl && <LinkRow href={p.linkedinUrl} label="LinkedIn" />}
          {p.websiteUrl && <LinkRow href={p.websiteUrl} label="Website" />}
          {p.instagramUrl && <LinkRow href={p.instagramUrl} label="Instagram" />}

          {p.phone ? (
            <a href={`tel:${p.phone}`} className="text-[12.5px] font-semibold" style={{ color: "var(--brand)" }}>
              {p.phone}
            </a>
          ) : p.hasPhone ? (
            // Said out loud rather than hidden: knowing a number exists and
            // is earned by connecting is the point of asking.
            <p className="flex items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
              <IconLock size={11} /> Phone number shared once you connect
            </p>
          ) : null}

          {!p.linkedinUrl && !p.websiteUrl && !p.instagramUrl && !p.hasPhone && (
            <p className="text-[12px] text-[var(--ink-soft)]">
              {p.name.split(" ")[0]} hasn&rsquo;t added any contact details yet.
            </p>
          )}
        </div>
      </Section>

      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label">{title}</p>
      {children}
    </div>
  );
}

function Chips({ items, tone }: { items: string[]; tone: "brand" | "good" | "muted" }) {
  const color = tone === "brand" ? "var(--brand)" : tone === "good" ? "var(--good)" : "var(--ink-soft)";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span
          key={t}
          className="pill"
          style={
            tone === "muted"
              ? { background: "var(--sunk)", color: "var(--ink)" }
              : { background: `color-mix(in srgb, ${color} 12%, transparent)`, color }
          }
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="truncate text-[12.5px] font-semibold"
      style={{ color: "var(--brand)" }}
    >
      {label} →
    </a>
  );
}
