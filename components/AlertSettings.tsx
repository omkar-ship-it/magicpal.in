"use client";

import { useEffect, useState } from "react";
import { ALERT_KINDS, ALERT_RADIUS_OPTIONS_KM } from "@/lib/rules";
import { BRAND_NAME } from "@/lib/brand";
import { Section } from "./Panel";
import { IconCheck } from "./Icons";

/**
 * How loud this is, and how to make it stop.
 *
 * Until now these preferences existed as four columns and no control: they
 * came out of onboarding to shorten it, and nothing replaced them. That is
 * survivable for a silent inbox. It is not survivable for a lock screen —
 * a notification nobody can turn down is the most reliable way there is to
 * get an app deleted, and shipping push without this would have been
 * shipping the uninstall with it.
 *
 * Everything here is reachable from the alerts panel itself, which is
 * where somebody is standing when they decide this is too much. Burying it
 * in profile settings means the only control they can find is the one in
 * the operating system, and that one never gets switched back.
 */

type Prefs = {
  notifyConnections: boolean;
  notifyMatches: boolean;
  notifyInterests: boolean;
  notifyRadiusKm: number;
};

type PushState = {
  /** The deployment has VAPID keys at all. */
  configured: boolean;
  /** Comes from the server rather than the bundle — see lib/push. */
  publicKey: string;
  devices: number;
};

/** How long "not now" lasts. Named, because nobody wants a time picker. */
const PAUSES = [
  { hours: 2, label: "2 hours" },
  { hours: 24, label: "the rest of today" },
  { hours: 168, label: "a week" },
];

export default function AlertSettings({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [push, setPush] = useState<PushState | null>(null);
  /**
   * When the pause ends, and whether it is still running.
   *
   * Two pieces of state for one fact, because the comparison needs the
   * clock and the clock cannot be read during render — the compiler is
   * right to refuse `Date.now()` there. Decided wherever the value
   * actually changes instead: on load, and on each press.
   */
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [quiet, setQuiet] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  /**
   * What this browser can actually do, read once at mount.
   *
   * The three states are genuinely different and only one of them is a
   * button. Pretending otherwise — offering "Turn on notifications" to an
   * iPhone in a Safari tab, where the API exists and silently never
   * delivers — is worse than offering nothing.
   */
  const [env] = useState(() => {
    if (typeof window === "undefined") return { can: false, ios: false, standalone: false };
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const can = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    return { can, ios, standalone };
  });

  useEffect(() => {
    let alive = true;
    void Promise.all([
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/push").then((r) => r.json()),
    ])
      .then(([p, s]) => {
        if (!alive) return;
        // /api/profile wraps its payload; /api/push answers flat.
        const pr = p.profile ?? {};
        setPrefs({
          notifyConnections: pr.notifyConnections ?? true,
          notifyMatches: pr.notifyMatches ?? true,
          notifyInterests: pr.notifyInterests ?? false,
          notifyRadiusKm: pr.notifyRadiusKm ?? 5,
        });
        setMutedUntil(s.mutedUntil ?? null);
        setPaused(s.mutedUntil != null && new Date(s.mutedUntil).getTime() > Date.now());
        setQuiet(s.quietHours ?? true);
        setPush({ configured: Boolean(s.configured), publicKey: s.publicKey ?? "", devices: s.devices ?? 0 });
      })
      .catch(() => alive && setPrefs(null));
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Saved on the switch, not behind a Save button.
   *
   * Somebody opening this is usually here to make something stop. Making
   * them find a second button to confirm it is how they decide the
   * operating system's switch is simpler.
   */
  async function save(patch: Partial<Prefs>) {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }

  async function pushPatch(body: Record<string, unknown>) {
    await fetch("/api/push", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  async function enablePush() {
    setBusy(true);
    setNote(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNote(
          permission === "denied"
            ? "Your browser is blocking notifications for this site. You can allow them again in its site settings."
            : "No change made."
        );
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = push?.publicKey ?? "";
      if (!key) throw new Error("Push isn't set up on this deployment.");
      const sub = await reg.pushManager.subscribe({
        // Required to be true, and honestly so: every push this sends
        // shows a notification. There is no silent channel here.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          // The device's own offset, so quiet hours are this phone's night.
          tzOffsetMinutes: -new Date().getTimezoneOffset(),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not turn these on.");
      setPush((cur) => ({ configured: true, publicKey: cur?.publicKey ?? "", devices: d.devices ?? 1 }));
      setNote("This device will now be told when somebody worth meeting is near you.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not turn these on.");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      await sub?.unsubscribe();
      const res = await fetch("/api/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      const d = await res.json().catch(() => ({}));
      setPush((cur) => ({ configured: true, publicKey: cur?.publicKey ?? "", devices: d.devices ?? 0 }));
      setNote("This device won't be notified. The list here still fills up.");
    } finally {
      setBusy(false);
    }
  }

  if (!prefs) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] text-[var(--ink-soft)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" className="btn btn-ghost btn-sm self-start" onClick={onBack}>
        ← Back to what you were told
      </button>

      {/* ── pause, first ──
          Top of the panel on purpose. Somebody who has just been
          interrupted once too often is looking for an off switch, and
          making them read three sections of preferences first is how they
          find the operating system's one instead. */}
      <Section title={paused ? "Paused" : "Too much right now?"}>
        {paused ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] text-[var(--ink-soft)]">
              Nothing will reach you until {new Date(mutedUntil!).toLocaleString()}.
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                setMutedUntil(null);
                setPaused(false);
                await pushPatch({ muteHours: null });
              }}
            >
              Resume
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {PAUSES.map((p) => (
              <button
                key={p.hours}
                type="button"
                className="chip-toggle tap"
                onClick={async () => {
                  setMutedUntil(new Date(Date.now() + p.hours * 3600_000).toISOString());
                  setPaused(true);
                  await pushPatch({ muteHours: p.hours });
                }}
              >
                Pause for {p.label}
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* ── the phone ── */}
      <Section title="On your phone">
        {!push?.configured ? (
          <p className="text-[12.5px] text-[var(--ink-soft)]">
            Not available on this deployment yet. The list here still fills up.
          </p>
        ) : !env.can ? (
          <p className="text-[12.5px] text-[var(--ink-soft)]">
            This browser can&rsquo;t show notifications. Everything still arrives in this list.
          </p>
        ) : env.ios && !env.standalone ? (
          /* iOS grants push only to a web app that has been added to the
             Home Screen. The API exists in a Safari tab and quietly never
             delivers, so a button here would be a lie. */
          <p className="text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
            On iPhone, {BRAND_NAME} has to be on your Home Screen first — tap{" "}
            <strong className="text-[var(--ink)]">Share</strong> then{" "}
            <strong className="text-[var(--ink)]">Add to Home Screen</strong>, open it from there, and this
            turns on.
          </p>
        ) : push.devices > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] text-[var(--ink-soft)]">
              On for {push.devices === 1 ? "this device" : `${push.devices} devices`}.
            </p>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={disablePush}>
              Turn off on this device
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <button type="button" className="btn btn-primary btn-sm self-start" disabled={busy} onClick={enablePush}>
              {busy ? "Just a moment…" : "Tell me when someone's near"}
            </button>
            <p className="text-[11.5px] leading-[1.5] text-[var(--ink-soft)]">
              Proximity is perishable — by the time you next open the app, they&rsquo;ve gone. Nothing new is
              shared about you; this only changes when you find out.
            </p>
          </div>
        )}

        {push?.configured && env.can && (
          <label className="mt-2.5 flex items-start gap-2.5 text-[12.5px]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={quiet}
              onChange={async (e) => {
                setQuiet(e.target.checked);
                await pushPatch({ quietHours: e.target.checked });
              }}
            />
            <span>
              Stay quiet overnight
              <span className="block text-[11.5px] text-[var(--ink-soft)]">
                No buzzes between 10pm and 8am, your phone&rsquo;s time. The list still fills up.
              </span>
            </span>
          </label>
        )}

        {note && <p className="mt-2 text-[11.5px] text-[var(--brand)]">{note}</p>}
      </Section>

      {/* ── what, and how near ── */}
      <Section title="What you're told about">
        <div className="flex flex-col gap-2.5">
          {ALERT_KINDS.map((k) => (
            <label key={k.id} className="flex items-start gap-2.5 text-[12.5px]">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={prefs[k.pref]}
                onChange={(e) => void save({ [k.pref]: e.target.checked } as Partial<Prefs>)}
              />
              <span>
                {k.label}
                <span className="block text-[11.5px] leading-[1.4] text-[var(--ink-soft)]">{k.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="How near is near">
        <div className="flex flex-wrap gap-1.5">
          {ALERT_RADIUS_OPTIONS_KM.map((km) => {
            const on = prefs.notifyRadiusKm === km;
            return (
              <button
                key={km}
                type="button"
                className="chip-toggle tap"
                data-on={on ? "true" : undefined}
                aria-pressed={on}
                onClick={() => void save({ notifyRadiusKm: km })}
              >
                {on && <IconCheck size={12} />}
                {km < 1 ? `${km * 1000} m` : `${km} km`}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11.5px] leading-[1.5] text-[var(--ink-soft)]">
          Somebody who publishes only their city can trigger &ldquo;is in your city&rdquo; and never a
          distance — a coarse position can&rsquo;t support a street-level claim.
        </p>
      </Section>
    </div>
  );
}

/**
 * The VAPID public key, as the browser wants it.
 *
 * `applicationServerKey` takes raw bytes; the key is distributed as
 * base64url. Browsers reject a mismatch with an error that names neither
 * problem, so this conversion is the usual reason push "doesn't work".
 */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  // Returned as the ArrayBuffer rather than the view: lib.dom types
  // applicationServerKey as a BufferSource over a plain ArrayBuffer, and a
  // Uint8Array over ArrayBufferLike is not assignable to it.
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}
