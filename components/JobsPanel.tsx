"use client";

import { useState } from "react";
import type { JobOrigin, JobRef } from "@/lib/jobs";
import type { SelfMarker } from "@/lib/shell";
import {
  DEFAULT_JOB_DAYS,
  JOB_DURATIONS,
  JOB_MODES,
  MAX_JOB_BLURB,
  MAX_JOB_COMPANY,
  MAX_JOB_TITLE,
  jobIsPlaced,
  jobModeLabel,
} from "@/lib/rules";
import { TOPICS, topicById } from "@/lib/intents";
import { resolveTypedPlace } from "@/lib/resolvePlace";
import Avatar from "./Avatar";
import PanelNote from "./PanelNote";
import VenuePicker from "./VenuePicker";
import { type Place } from "./PlaceSearch";
import {
  IconBriefcase,
  IconCheck,
  IconChevronLeft,
  IconClock,
  IconGlobe,
  IconPin,
  IconPlus,
  IconX,
} from "./Icons";

/**
 * Roles people are hiring for, nearest first.
 *
 * This replaced the Feed on the open network, and the swap is the point
 * rather than a substitution. A feed is a chronological list of things
 * that have already happened, which works inside a community — two
 * hundred people who joined the same group genuinely want to know who
 * arrived this week. On the open network it was a stream of strangers'
 * events with nothing asked of the reader and nothing for them to do.
 *
 * A job is the opposite in every respect that matters. It is a standing
 * ask rather than a past event, it is specific, and it is the one thing
 * on a map-first product that a map answers better than anybody: not
 * what the role is, but whether you could get there on a Tuesday. So the
 * commute leads every card, and it is the sort order.
 */
export default function JobsPanel({
  jobs,
  origin,
  signedIn,
  onboarded,
  you,
  onChanged,
  onShow,
  onOpenPerson,
  onSignIn,
  onProfile,
}: {
  jobs: JobRef[];
  origin: JobOrigin;
  signedIn: boolean;
  onboarded: boolean;
  /** Your own marker, for pre-filling the form. Null before onboarding. */
  you: SelfMarker | null;
  onChanged: () => void;
  onShow: (job: JobRef) => void;
  onOpenPerson: (id: string) => void;
  onSignIn: () => void;
  onProfile: () => void;
}) {
  const [posting, setPosting] = useState(false);

  if (posting) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PostJob
          you={you}
          onCancel={() => setPosting(false)}
          onPosted={() => {
            setPosting(false);
            onChanged();
          }}
        />
      </div>
    );
  }

  const mineCount = jobs.filter((j) => j.mine).length;
  /** Where the "Remote" group starts, so it can be labelled rather than
   *  left looking like the furthest-away roles. Only meaningful when
   *  there is an origin — without one the list is by recency. */
  const firstRemote = origin ? jobs.findIndex((j) => !j.mine && j.distanceKm == null) : -1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
      {jobs.length === 0 ? (
        <PanelNote title="No roles up right now">
          When somebody here is hiring, it shows up on the map where the work actually happens — so the first thing
          you see about a role is whether you could get there.
        </PanelNote>
      ) : (
        <>
          <OriginNote origin={origin} signedIn={signedIn} onProfile={onProfile} />
          <ul className="stagger flex flex-col gap-2">
            {jobs.map((job, i) => (
              <li key={job.id}>
                {i === firstRemote && <GroupLabel n={jobs.length - firstRemote} />}
                <JobCard
                  job={job}
                  onChanged={onChanged}
                  onShow={() => onShow(job)}
                  onOpenPerson={() => onOpenPerson(job.person.id)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {signedIn && onboarded && (
        <button type="button" className="btn btn-primary btn-sm w-full" onClick={() => setPosting(true)}>
          <IconPlus size={13} /> {mineCount > 0 ? "Post another role" : "Post a role"}
        </button>
      )}
      {signedIn && !onboarded && (
        <PanelNote title="Finish your profile to post a role">
          Whoever applies needs to know who they&rsquo;d be applying to.
        </PanelNote>
      )}
      {!signedIn && (
        <button type="button" className="btn btn-primary btn-sm w-full" onClick={onSignIn}>
          Sign in to post a role
        </button>
      )}
    </div>
  );
}

/**
 * Where the distances came from, said rather than implied.
 *
 * The three states are genuinely different and a reader can act on the
 * difference: sorted from where you are, sorted from where the map is
 * pointed, or not sorted by distance at all. Silently ordering a list by
 * proximity to a default viewport is the version of this that makes
 * people distrust every number on the screen.
 */
function OriginNote({
  origin,
  signedIn,
  onProfile,
}: {
  origin: JobOrigin;
  signedIn: boolean;
  onProfile: () => void;
}) {
  if (origin === "you") return null;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-0.5 text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
      {origin === "map" ? (
        <>Distances are from where the map is pointed.</>
      ) : (
        <>Newest first — there&rsquo;s nowhere to measure from yet.</>
      )}
      {signedIn ? (
        <button type="button" className="font-semibold text-[var(--brand)] hover:underline" onClick={onProfile}>
          Set your location to sort by commute
        </button>
      ) : null}
    </p>
  );
}

function GroupLabel({ n }: { n: number }) {
  return (
    <p className="mb-1.5 mt-1 flex items-center gap-1.5 px-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
      <IconGlobe size={11} /> Remote · {n}
    </p>
  );
}

function JobCard({
  job,
  onChanged,
  onShow,
  onOpenPerson,
}: {
  job: JobRef;
  onChanged: () => void;
  onShow: () => void;
  onOpenPerson: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const topic = topicById(job.topic ?? "");
  const placed = jobIsPlaced(job.workMode);

  async function close() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't close that.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card p-3">
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold leading-[1.3]">{job.title}</p>
          <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">{job.company}</p>
        </div>
        {/* The commute, as the first thing read on the card rather than a
            detail underneath it. Remote says so in the same slot, because
            "no commute" is an answer to the same question. */}
        <span className="flex-none text-right">
          <span className="block text-[13px] font-bold leading-none">
            {placed ? <Distance km={job.distanceKm} /> : "Remote"}
          </span>
          {/* Only when it adds something. On a remote role the line above
              already *is* the mode, and printing it twice reads as a bug. */}
          {placed && (
            <span className="mt-1 block text-[10.5px] text-[var(--ink-soft)]">{jobModeLabel(job.workMode)}</span>
          )}
        </span>
      </div>

      {job.blurb && <p className="mt-1.5 text-[12.5px] leading-[1.45]">{job.blurb}</p>}

      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--ink-soft)]">
        {job.placeLabel && (
          <span className="flex items-center gap-1">
            <IconPin size={10} /> {job.placeLabel}
          </span>
        )}
        <span className="flex items-center gap-1">
          <IconClock size={10} />
          {job.daysLeft === 0 ? "closes today" : job.daysLeft === 1 ? "1 day left" : `${job.daysLeft} days left`}
        </span>
      </p>

      {topic && (
        <span
          className="pill mt-1.5"
          style={{ background: "color-mix(in srgb, var(--brand) 12%, transparent)", color: "var(--brand)" }}
        >
          {topic.need}
        </span>
      )}

      <button type="button" onClick={onOpenPerson} className="mt-2.5 flex items-center gap-2 text-left tap">
        <Avatar name={job.person.name} photoUrl={job.person.photoUrl} size={26} />
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-semibold hover:underline">
            {job.mine ? "You" : job.person.name}
          </span>
          {job.person.headline && (
            <span className="block truncate text-[11px] text-[var(--ink-soft)]">{job.person.headline}</span>
          )}
        </span>
      </button>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {job.applyUrl && (
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="btn btn-primary btn-sm"
          >
            <IconBriefcase size={12} /> Apply
          </a>
        )}
        {!job.applyUrl && !job.mine && (
          // No link, so the action is the product: open the person who
          // posted it and talk to them.
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenPerson}>
            <IconBriefcase size={12} /> Ask about it
          </button>
        )}
        {placed && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onShow}>
            <IconPin size={12} /> Show on map
          </button>
        )}
        {job.mine && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={close}>
            <IconX size={12} /> {busy ? "Closing…" : "Close it"}
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-[12px] font-medium text-[var(--warn)]">{error}</p>}
    </article>
  );
}

/**
 * Null is "we don't know", and it must not read as zero.
 *
 * A dash is the honest render. "0 km" on a role whose distance could not
 * be measured is the same class of lie as a remote job pinned to Null
 * Island, and it is the one a reader would act on.
 */
function Distance({ km }: { km: number | null }) {
  if (km == null) return <span className="text-[var(--ink-soft)]">—</span>;
  if (km < 1) return <>under 1 km</>;
  return <>{Math.round(km)} km</>;
}

/**
 * Posting, in one screen.
 *
 * Two fields are already on the poster's profile — their employer and
 * where they work — so both arrive filled in and the common case is a
 * title, a line, and send. That is most of what decides whether a
 * posting feature gets used or gets meant to be used later.
 */
function PostJob({
  you,
  onCancel,
  onPosted,
}: {
  you: SelfMarker | null;
  onCancel: () => void;
  onPosted: () => void;
}) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState(you?.company ?? "");
  const [blurb, setBlurb] = useState("");
  const [workMode, setWorkMode] = useState<string>("onsite");
  /**
   * Pre-filled from the profile, and only when it is a real place.
   *
   * `you.lat/lng` is whatever the profile publishes — a street address
   * for somebody on `exact`, a city centroid for somebody on `base`.
   * Either is a fair answer to "where is the office" and both are
   * labelled, so the form can name what it is about to use instead of
   * silently attaching a coordinate.
   */
  const myPlace: Place | null =
    you && you.placeLabel ? { label: you.placeLabel, lat: you.lat, lng: you.lng } : null;
  const [place, setPlace] = useState<Place | null>(myPlace);
  const [typed, setTyped] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [days, setDays] = useState<number>(DEFAULT_JOB_DAYS);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needsPlace = jobIsPlaced(workMode);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let where = place;
      if (needsPlace) {
        // Same rescue as the pin and event forms: typing an office and
        // pressing the button has to work, or the role saves with no
        // location and is invisible on the one surface that matters.
        if (!where && typed.trim()) {
          where = await resolveTypedPlace(typed);
          if (!where) {
            setError(`Couldn't find "${typed.trim()}" — pick somewhere from the list, or set the role to Remote.`);
            setBusy(false);
            return;
          }
          setPlace(where);
        }
        if (!where) {
          setError("Pick where the work happens — or set it to Remote.");
          setBusy(false);
          return;
        }
      }

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          company,
          blurb: blurb || undefined,
          workMode,
          lat: needsPlace ? where!.lat : undefined,
          lng: needsPlace ? where!.lng : undefined,
          placeLabel: needsPlace ? where!.label : undefined,
          applyUrl: applyUrl || undefined,
          days,
          topic: topic || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't post that.");
      onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <button type="button" className="btn btn-ghost btn-sm self-start" onClick={onCancel}>
        <IconChevronLeft size={13} /> Back
      </button>

      <div>
        <label className="label" htmlFor="job-title">
          What&rsquo;s the role?
        </label>
        <input
          id="job-title"
          className="input"
          autoFocus
          maxLength={MAX_JOB_TITLE}
          placeholder="Senior backend engineer"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="job-company">
          Who&rsquo;s hiring?
        </label>
        <input
          id="job-company"
          className="input"
          maxLength={MAX_JOB_COMPANY}
          placeholder="Your company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="job-blurb">
          One line about it (optional)
        </label>
        <textarea
          id="job-blurb"
          className="input"
          rows={2}
          maxLength={MAX_JOB_BLURB}
          placeholder="Payments team, four engineers, you'd own the ledger rewrite."
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
        />
        <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
          The specific thing is what makes somebody read the rest.
        </p>
      </div>

      <div>
        <p className="label">How it works</p>
        <div className="flex flex-wrap gap-1.5">
          {JOB_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className="chip-toggle tap"
              data-on={workMode === m.id ? "true" : "false"}
              aria-pressed={workMode === m.id}
              onClick={() => setWorkMode(m.id)}
            >
              {workMode === m.id && <IconCheck size={11} />}
              {m.label}
            </button>
          ))}
        </div>
        {/* The consequence stated while choosing, because "remote" quietly
            decides whether the role is on the map at all. */}
        <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
          {JOB_MODES.find((m) => m.id === workMode)?.hint}
        </p>
      </div>

      {needsPlace && (
        <div>
          <label className="label" htmlFor="job-where">
            Where is the work?
          </label>
          {/* Offered, not assumed. A profile location is where *you* are,
              which is usually but not always where the job is. */}
          {myPlace && place?.label !== myPlace.label && (
            <button
              type="button"
              className="btn btn-ghost btn-sm mb-1.5"
              onClick={() => {
                setPlace(myPlace);
                setTyped("");
              }}
            >
              <IconPin size={12} /> Use {myPlace.label}
            </button>
          )}
          <VenuePicker
            id="job-where"
            value={place?.label ?? null}
            placeholder="An office, a floor, a city"
            onPick={(pl) => {
              setPlace(pl);
              setTyped("");
            }}
            onTyped={setTyped}
          />
          <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
            This is the office, not you — it stays on the map while the role is open, whatever your own visibility
            setting is.
          </p>
        </div>
      )}

      <div>
        <label className="label" htmlFor="job-url">
          Link to apply (optional)
        </label>
        <input
          id="job-url"
          className="input"
          inputMode="url"
          placeholder="careers.example.com/backend"
          value={applyUrl}
          onChange={(e) => setApplyUrl(e.target.value)}
        />
        <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
          Leave it empty and people will message you here instead.
        </p>
      </div>

      <div>
        <p className="label">Keep it up for</p>
        <div className="flex flex-wrap gap-1.5">
          {JOB_DURATIONS.map((d) => (
            <button
              key={d.days}
              type="button"
              className="chip-toggle tap"
              data-on={days === d.days ? "true" : "false"}
              aria-pressed={days === d.days}
              onClick={() => setDays(d.days)}
            >
              {days === d.days && <IconCheck size={11} />}
              {d.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
          It takes itself down afterwards. You can close it sooner the moment it&rsquo;s filled.
        </p>
      </div>

      <div>
        <p className="label">About (optional)</p>
        <div className="flex flex-wrap gap-1.5">
          {TOPICS.slice(0, 6).map((t) => (
            <button
              key={t.id}
              type="button"
              className="chip-toggle tap"
              data-on={topic === t.id ? "true" : "false"}
              aria-pressed={topic === t.id}
              onClick={() => setTopic(topic === t.id ? "" : t.id)}
            >
              {topic === t.id && <IconCheck size={11} />}
              {t.need}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-[12.5px] font-medium text-[var(--warn)]">{error}</p>}

      <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !title.trim() || !company.trim()}>
        <IconBriefcase size={13} /> {busy ? "Posting…" : "Post the role"}
      </button>
    </form>
  );
}
