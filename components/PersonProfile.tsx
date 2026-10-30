"use client";

import { useEffect, useState } from "react";
import { sectorById, stageById, topicById } from "@/lib/intents";
import Avatar from "./Avatar";
import VerifiedBadge from "./VerifiedBadge";
import { Hero, Page, Section } from "./Panel";
import PanelNote from "./PanelNote";
import {
  IconBriefcase,
  IconCheck,
  IconCity,
  IconLock,
  IconPeople,
  IconPin,
  IconSparkle,
  IconUser,
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
  customLookingFor: string[];
  customCanHelpWith: string[];
  customInterests: string[];
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
    shared: Array<{ slug: string; name: string; type: string; verified: boolean }>;
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
  // Falls through to what they typed: an unrecognised id is now a role
  // in their own words, not a broken one.
  const stageLabel = stageById(p.stage)?.label ?? p.stage;
  // Their own words sit in the same rows as the vocabulary chips: both are
  // claims the same person made about themselves, and splitting them into
  // "official" and "other" would read as the product doubting one of them.
  const wants = [...p.lookingFor.map((id) => topicById(id)?.need).filter(Boolean), ...p.customLookingFor];
  const offers = [...p.canHelpWith.map((id) => topicById(id)?.offer).filter(Boolean), ...p.customCanHelpWith];
  const sectors = [...p.interests.map((id) => sectorById(id)?.label).filter(Boolean), ...p.customInterests];
  const connected = data.connection.status === "connected";
  // Verification is a claim by a particular community, so the profile names
  // which ones are making it rather than showing a bare, unattributable tick.
  const vouchers = data.shared.filter((b) => b.verified);

  return (
    <Page>
      {/* ----------------------------------------------------- identity */}
      <Hero
        avatar={<Avatar name={p.name} photoUrl={p.photoUrl} size={76} ring={3} />}
        title={p.name}
        subtitle={p.headline}
        eyebrow={
          <>
            {stageLabel && (
              <span className="pill" style={{ background: "var(--sunk)", color: "var(--ink-soft)" }}>
                {stageLabel}
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
            {vouchers.length > 0 && (
              <span
                className="pill"
                style={{ background: "color-mix(in srgb, var(--brand) 12%, transparent)", color: "var(--brand)" }}
              >
                <VerifiedBadge size={11} label={`Verified by ${vouchers.map((v) => v.name).join(", ")}`} />
                Verified
              </span>
            )}
          </>
        }
        meta={
          <>
            {p.company && (
              <span className="flex items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
                <IconBriefcase size={11} /> {p.company}
              </span>
            )}
            {p.locationLabel && (
              <span className="flex items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
                {p.placed === "base" ? <IconCity size={11} /> : <IconPin size={11} />}
                {p.locationLabel}
                {p.placed === "base" ? " · city only" : p.placed === "live" ? " · live" : ""}
              </span>
            )}
          </>
        }
      />

      {/* The reason this person is in front of you, first — everything
          below is the evidence for it. */}
      {reason && (
        <div className="reveal rounded-2xl p-3" style={{ background: "var(--sunk)" }}>
          <p className="label label-icon mb-1">
            <IconSparkle size={12} />
            {twoWay ? "You can help each other" : "Why them"}
          </p>
          <p className="text-[12.5px] leading-[1.5]">{reason}</p>
        </div>
      )}

      {/* The strongest thing a stranger can read: somebody already vouched
          for both of you. */}
      {data.shared.length > 0 && (
        <Section title="You're both in" icon={<IconPeople size={12} />}>
          <div className="flex flex-wrap gap-1.5">
            {data.shared.map((b) => (
              <span
                key={b.slug}
                className="pill"
                style={
                  b.verified
                    ? { background: "color-mix(in srgb, var(--brand) 12%, transparent)", color: "var(--brand)" }
                    : { background: "var(--sunk)" }
                }
              >
                {b.verified ? <VerifiedBadge size={11} label={`Verified by ${b.name}`} /> : <IconPeople size={11} />}
                {b.name}
              </span>
            ))}
          </div>
          {vouchers.length > 0 && (
            <p className="mt-1.5 text-[12px] leading-[1.45]" style={{ color: "var(--brand)" }}>
              {vouchers.length === 1 ? vouchers[0].name : `${vouchers.length} of your communities`} confirmed{" "}
              {p.name.split(" ")[0]} really is who they say.
            </p>
          )}
        </Section>
      )}

      {p.workingOn && (
        <Section title="Working on" icon={<IconSparkle size={12} />}>
          <p className="text-[12.5px] leading-[1.5]">{p.workingOn}</p>
        </Section>
      )}

      {p.bio && (
        <Section title="About" icon={<IconUser size={12} />}>
          <p className="whitespace-pre-line text-[12.5px] leading-[1.55]">{p.bio}</p>
        </Section>
      )}

      {/* Wants and offers side by side: the pair is the point, and stacked
          they read as two unrelated lists. */}
      {(wants.length > 0 || offers.length > 0) && (
        <Section title="What they're here for" icon={<IconSparkle size={12} />}>
          <div className="flex flex-col gap-2.5">
            {wants.length > 0 && (
              <div>
                <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                  Looking for
                </p>
                <Chips items={wants as string[]} tone="brand" />
              </div>
            )}
            {offers.length > 0 && (
              <div>
                <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                  Can help with
                </p>
                <Chips items={offers as string[]} tone="good" />
              </div>
            )}
          </div>
        </Section>
      )}

      {(sectors.length > 0 || p.skills.length > 0) && (
        <Section title="Into" icon={<IconSparkle size={12} />}>
          <Chips items={[...(sectors as string[]), ...p.skills]} tone="muted" />
        </Section>
      )}

      {(p.openToMentor || p.seekingMentor) && (
        <Section title="Mentoring" icon={<IconPeople size={12} />}>
          <Chips
            items={[p.openToMentor ? "Open to mentoring" : null, p.seekingMentor ? "Looking for a mentor" : null].filter(
              (x): x is string => Boolean(x)
            )}
            tone="muted"
          />
        </Section>
      )}

      {/* ------------------------------------------------------ contact */}
      <Section title="Reach them" icon={<IconBriefcase size={12} />}>
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

      <div className="reveal">{children}</div>
    </Page>
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
