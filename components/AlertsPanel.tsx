"use client";

import { useEffect, useState } from "react";
import type { AlertRow } from "@/lib/alerts";
import { sinceLabel } from "@/lib/time";
import Avatar from "./Avatar";
import PanelNote from "./PanelNote";
import { Row } from "./Panel";
import { IconBeacon, IconCity, IconSparkle } from "./Icons";

/**
 * What you were told while you weren't looking.
 *
 * Each line is a moment that has already passed, so it leads with *who*
 * and *how near*, and the matcher's sentence sits underneath as the reason
 * it was worth interrupting you. The time is on every row because a
 * proximity alert from yesterday is a different thing from one from ten
 * minutes ago — one is a note, the other is an opportunity.
 */
export default function AlertsPanel({
  signedIn,
  onOpenPerson,
  onOpenForYou,
  onOpenSettings,
  onRead,
}: {
  signedIn: boolean;
  onOpenPerson: (id: string) => void;
  /** Where a crowd notice leads — the one surface built to rank a room. */
  onOpenForYou: () => void;
  onOpenSettings: () => void;
  /** Clears the badge once the list has actually been looked at. */
  onRead: () => void;
}) {
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setAlerts(d.alerts ?? []);
        // Marked read on open, not on fetch of the badge — the dot should
        // only clear for a list somebody actually saw.
        void fetch("/api/alerts", { method: "POST" }).then(onRead);
      })
      .catch(() => alive && setAlerts([]));
    return () => {
      alive = false;
    };
  }, [signedIn, onRead]);

  if (!signedIn) {
    return (
      <PanelNote title="Sign in to be told who's around">
        MagicPal can tell you when somebody worth meeting turns up near you.
      </PanelNote>
    );
  }
  if (alerts === null) return <PanelNote title="Catching up…" />;

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <PanelNote title="Nothing yet">
          You&rsquo;ll hear when somebody you&rsquo;re connected to, or somebody worth meeting, turns up near you.
          Nothing is invented to fill this — it stays empty until it isn&rsquo;t.
        </PanelNote>
        <button type="button" className="btn btn-ghost btn-sm w-full" onClick={onOpenSettings}>
          Choose what you&rsquo;re told about
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <ul className="stagger flex min-h-0 flex-1 flex-col overflow-y-auto">
        {alerts.map((a) =>
          a.kind === "crowd_nearby" ? (
            <li key={a.id}>
              {/* A room, not a person. No notification can carry twenty
                  people usefully, so this one is a doorway: it says how many
                  and what they're mostly good for, and For You does the
                  ranking it was built for. */}
              <Row onClick={onOpenForYou}>
                <span
                  className="grid h-9 w-9 flex-none place-items-center rounded-xl"
                  style={{ background: "color-mix(in srgb, var(--brand) 13%, transparent)", color: "var(--brand)" }}
                >
                  <IconSparkle size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate text-[13px] font-semibold">
                      {a.count} people worth meeting {a.placeLabel ? `in ${a.placeLabel}` : "near you"}
                    </span>
                    <span className="flex-none text-[11px] text-[var(--ink-soft)]">{sinceLabel(a.at)}</span>
                  </span>
                  <span className="block text-[11.5px]" style={{ color: "var(--brand)" }}>
                    {a.reason ?? "Open For you to see who"}
                  </span>
                </span>
                <span className="flex-none text-[11.5px] font-semibold" style={{ color: "var(--brand)" }}>
                  Open →
                </span>
              </Row>
            </li>
          ) : (
          <li key={a.id}>
            <Row onClick={() => a.person && onOpenPerson(a.person.id)}>
              <span className="relative flex-none">
                <Avatar name={a.person?.name ?? "?"} photoUrl={a.person?.photoUrl ?? null} size={36} />
                {!a.read && (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full"
                    style={{ background: "var(--brand)", boxShadow: "0 0 0 2px var(--card)" }}
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 truncate text-[13px] font-semibold">
                    {a.person?.name ?? "Someone"}
                  </span>
                  <span className="flex-none text-[11px] text-[var(--ink-soft)]">{sinceLabel(a.at)}</span>
                </span>
                <span className="flex items-center gap-1 text-[11.5px]" style={{ color: tone(a.kind) }}>
                  {icon(a.kind)}
                  {headline(a)}
                </span>
                {a.reason && (
                  <span className="mt-0.5 block text-[11.5px] leading-[1.4] text-[var(--ink-soft)]">{a.reason}</span>
                )}
              </span>
            </Row>
          </li>
          )
        )}
      </ul>
      <button type="button" className="btn btn-ghost btn-sm w-full flex-none" onClick={onOpenSettings}>
        Choose what you&rsquo;re told about
      </button>
    </div>
  );
}

/**
 * How near, in the words the subject's own privacy setting allows.
 *
 * `distanceKm` is null for anybody publishing only their city — so the
 * line says "in your city" and never invents a number they didn't share.
 */
function headline(a: AlertRow): string {
  const near =
    a.distanceKm == null
      ? a.placeLabel
        ? `is in ${a.placeLabel}`
        : "is in your city"
      : a.distanceKm < 1
        ? "is under 1 km away"
        : `is ${Math.round(a.distanceKm)} km away`;

  if (a.kind === "connection_nearby") return `You're connected · ${near}`;
  if (a.kind === "match_nearby") return `Worth meeting · ${near}`;
  return `Shares your interests · ${near}`;
}

function tone(kind: AlertRow["kind"]): string {
  return kind === "connection_nearby" ? "var(--good)" : "var(--brand)";
}

function icon(kind: AlertRow["kind"]) {
  if (kind === "connection_nearby") return <IconBeacon size={11} />;
  if (kind === "match_nearby") return <IconSparkle size={11} />;
  return <IconCity size={11} />;
}
