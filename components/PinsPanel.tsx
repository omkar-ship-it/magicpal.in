"use client";

import { useState } from "react";
import type { PinRef } from "@/lib/pins";
import { MAX_PIN_MESSAGE, PIN_DURATIONS } from "@/lib/rules";
import { TOPICS, topicById } from "@/lib/intents";
import Avatar from "./Avatar";
import PanelNote from "./PanelNote";
import VenuePicker from "./VenuePicker";
import { type Place } from "./PlaceSearch";
import { resolveTypedPlace } from "@/lib/resolvePlace";
import { IconBeacon, IconCheck, IconChevronLeft, IconClock, IconPin, IconPlus, IconX } from "./Icons";

/**
 * Ad-hoc pins: who is somewhere right now, and whether you'd join them.
 *
 * The opposite of the Events window in every way that matters. An event is
 * planned, belongs to a community and goes in a calendar; a pin is somebody
 * in a café for the next two hours. So there's no title, no date, no host —
 * one line about what you're up for, how long, and who can see it.
 */
export default function PinsPanel({
  pins,
  signedIn,
  onboarded,
  myPinId,
  onChanged,
  onShow,
  onOpenPerson,
  onSignIn,
}: {
  pins: PinRef[];
  signedIn: boolean;
  onboarded: boolean;
  myPinId: string | null;
  onChanged: () => void;
  onShow: (pin: PinRef) => void;
  onOpenPerson: (id: string) => void;
  onSignIn: () => void;
}) {
  const [dropping, setDropping] = useState(false);

  if (dropping) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DropPin
          onCancel={() => setDropping(false)}
          onDropped={() => {
            setDropping(false);
            onChanged();
          }}
        />
      </div>
    );
  }

  const sorted = [...pins].sort((a, b) => {
    if (a.mine !== b.mine) return a.mine ? -1 : 1;
    return (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9);
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
      {sorted.length === 0 ? (
        <PanelNote title="Nobody's dropped a pin nearby">
          A pin says &ldquo;I&rsquo;m at this café for the next two hours, come say hello&rdquo;. It needs no
          community and no planning, and it disappears on its own.
        </PanelNote>
      ) : (
        <ul className="stagger flex flex-col gap-2">
          {sorted.map((pin) => (
            <li key={pin.id}>
              <PinCard
                pin={pin}
                signedIn={signedIn}
                onChanged={onChanged}
                onShow={() => onShow(pin)}
                onOpenPerson={() => onOpenPerson(pin.person.id)}
                onSignIn={onSignIn}
              />
            </li>
          ))}
        </ul>
      )}

      {signedIn && onboarded && (
        <button
          type="button"
          className={myPinId ? "btn btn-ghost btn-sm w-full" : "btn btn-primary btn-sm w-full"}
          onClick={() => setDropping(true)}
        >
          <IconPlus size={13} /> {myPinId ? "Replace my pin" : "Drop a pin"}
        </button>
      )}
      {signedIn && !onboarded && (
        <PanelNote title="Finish your profile to drop a pin">
          Whoever walks over needs to know who they&rsquo;d be meeting.
        </PanelNote>
      )}
      {!signedIn && (
        <PanelNote title="Sign in to drop a pin">
          <button type="button" className="btn btn-primary btn-sm mt-3" onClick={onSignIn}>
            Sign in
          </button>
        </PanelNote>
      )}
    </div>
  );
}

function PinCard({
  pin,
  signedIn,
  onChanged,
  onShow,
  onOpenPerson,
  onSignIn,
}: {
  pin: PinRef;
  signedIn: boolean;
  onChanged: () => void;
  onShow: () => void;
  onOpenPerson: () => void;
  onSignIn: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const topic = topicById(pin.topic ?? "");

  async function toggleJoin() {
    if (!signedIn) return onSignIn();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/pins/${pin.id}/join`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't do that.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function takeDown() {
    setBusy(true);
    try {
      await fetch(`/api/pins/${pin.id}`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card p-3">
      <div className="flex items-start gap-2.5">
        <button type="button" onClick={onOpenPerson} className="flex-none tap">
          <Avatar name={pin.person.name} photoUrl={pin.person.photoUrl} size={42} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <button type="button" onClick={onOpenPerson} className="min-w-0 truncate text-[13px] font-semibold hover:underline">
              {pin.mine ? "You" : pin.person.name}
            </button>
            <span
              className="pill flex-none"
              style={{ background: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good)" }}
            >
              <IconBeacon size={10} /> now
            </span>
          </p>
          <p className="mt-0.5 text-[12.5px] leading-[1.45]">{pin.message}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--ink-soft)]">
            {pin.placeLabel && (
              <span className="flex items-center gap-1">
                <IconPin size={10} /> {pin.placeLabel}
              </span>
            )}
            {pin.distanceKm != null && <span>{pin.distanceKm < 1 ? "under 1 km" : `${Math.round(pin.distanceKm)} km`}</span>}
            <span className="flex items-center gap-1">
              <IconClock size={10} />
              {pin.minutesLeft > 60 ? `${Math.round(pin.minutesLeft / 60)}h left` : `${pin.minutesLeft}m left`}
            </span>
            {pin.audience === "communities" && <span>· your communities only</span>}
          </p>
          {topic && (
            <span
              className="pill mt-1.5"
              style={{ background: "color-mix(in srgb, var(--brand) 12%, transparent)", color: "var(--brand)" }}
            >
              {topic.need}
            </span>
          )}
        </div>
      </div>

      {pin.joined.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <span className="flex -space-x-2">
            {pin.joined.slice(0, 4).map((j) => (
              <Avatar key={j.id} name={j.name} photoUrl={j.photoUrl} size={22} ring={2} />
            ))}
          </span>
          <span className="text-[11.5px] text-[var(--ink-soft)]">
            {pin.joined.length} {pin.joined.length === 1 ? "person is" : "people are"} coming
          </span>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        {pin.mine ? (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={takeDown}>
            <IconX size={12} /> Take it down
          </button>
        ) : (
          <button
            type="button"
            className={pin.joinedByMe ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}
            disabled={busy}
            onClick={toggleJoin}
          >
            {pin.joinedByMe ? <IconCheck size={12} /> : <IconBeacon size={12} />}
            {pin.joinedByMe ? "I'm coming" : "I'll join"}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onShow}>
          <IconPin size={12} /> Show on map
        </button>
      </div>
      {error && <p className="mt-1.5 text-[12px] font-medium text-[var(--warn)]">{error}</p>}
    </article>
  );
}

function DropPin({ onCancel, onDropped }: { onCancel: () => void; onDropped: () => void }) {
  const [message, setMessage] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [typed, setTyped] = useState("");
  const [minutes, setMinutes] = useState<number>(180);
  const [audience, setAudience] = useState<"open" | "communities">("open");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      // Same rescue as the event forms: typing a café and pressing the
      // button must work, or the pin saves with no location and is invisible
      // — which is the entire failure mode this feature can have.
      let pin = place;
      if (!pin && typed.trim()) {
        pin = await resolveTypedPlace(typed);
        if (!pin) {
          setError(`Couldn't find "${typed.trim()}" — pick somewhere from the list, or use "I'm here now".`);
          setBusy(false);
          return;
        }
        setPlace(pin);
      }
      if (!pin) {
        setError("Pick where you are — that's the whole point of a pin.");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          lat: pin.lat,
          lng: pin.lng,
          placeLabel: pin.label,
          minutes,
          audience,
          topic: topic || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't drop that.");
      onDropped();
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
        <label className="label" htmlFor="pin-msg">
          What are you up for?
        </label>
        <textarea
          id="pin-msg"
          className="input"
          rows={2}
          autoFocus
          maxLength={MAX_PIN_MESSAGE}
          placeholder="Working on a pitch deck at the Roastery — happy to talk fundraising for an hour"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
          The specific thing is what makes someone walk over.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="pin-where">
          Where are you?
        </label>
        <VenuePicker
          id="pin-where"
          value={place?.label ?? null}
          placeholder="A café, a floor, a carriage"
          onPick={(pl) => {
            setPlace(pl);
            setTyped("");
          }}
          onTyped={setTyped}
        />
        {/* Said plainly: a pin publishes an exact spot whatever your profile
            says, which is why it's a deliberate act each time. */}
        <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--ink-soft)]">
          This shows your exact spot while the pin is live, whatever your profile setting says. It stops when the pin
          does.
        </p>
      </div>

      <div>
        <p className="label">For how long</p>
        <div className="flex flex-wrap gap-1.5">
          {PIN_DURATIONS.map((d) => (
            <button
              key={d.minutes}
              type="button"
              className="chip-toggle tap"
              data-on={minutes === d.minutes ? "true" : "false"}
              aria-pressed={minutes === d.minutes}
              onClick={() => setMinutes(d.minutes)}
            >
              {minutes === d.minutes && <IconCheck size={11} />}
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="label">Who can see it</p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["open", "Anyone nearby"],
              ["communities", "My communities only"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="chip-toggle tap"
              data-on={audience === id ? "true" : "false"}
              aria-pressed={audience === id}
              onClick={() => setAudience(id)}
            >
              {audience === id && <IconCheck size={11} />}
              {label}
            </button>
          ))}
        </div>
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

      <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !message.trim()}>
        <IconBeacon size={13} /> {busy ? "Dropping…" : "Drop the pin"}
      </button>
    </form>
  );
}
