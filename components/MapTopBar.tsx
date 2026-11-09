"use client";

import { useState } from "react";
import { SECTORS, STAGES, TOPICS } from "@/lib/intents";
import { PROXIMITY_STEPS } from "@/lib/rules";
import type { NetworkOption } from "@/lib/shell";
import BoardLogo from "./BoardLogo";
import { facetsActive, NO_FACETS, type Facets } from "@/lib/search";
import { IconBell, IconCalendar, IconCheck, IconChevronDown, IconGlobe, IconPeople, IconSearch, IconX } from "./Icons";

/**
 * Network, search, filters — in that order of how often they're used.
 *
 * Filters are summoned, not laid out. The prototype shipped them as a
 * permanent row of dropdowns and it made the map feel like a database
 * admin screen; here the bar is a switcher and a search box until you ask
 * for more, and the count on the Filters button is what tells you a
 * previous search is still narrowing what you see.
 */
export default function MapTopBar({
  networks,
  activeSlug,
  scopeName,
  scopeKind,
  facets,
  onFacets,
  alerts,
  signedIn,
  onAlerts,
  countLabel,
  onNetwork,
  isLive,
  onGoLive,
  onHome,
}: {
  networks: NetworkOption[];
  activeSlug: string | null;
  /**
   * What the current scope calls itself, for the scopes the switcher
   * deliberately doesn't list.
   *
   * `networks` is communities plus the open network — an event is left out
   * on purpose, because events are things that happen *inside* a network
   * rather than networks you belong to. But the lookup below used to fall
   * back to `networks[0]` on a miss, so standing inside an event the chip
   * announced "Open network" while every other panel correctly said the
   * event's name. A miss is the expected case here, not an error.
   */
  scopeName: string;
  scopeKind: "open" | "event" | "community";
  facets: Facets;
  onFacets: (f: Facets) => void;
  countLabel: string;
  /** Unread proximity alerts, badged on the bell. */
  alerts: number;
  signedIn: boolean;
  onAlerts: () => void;
  onNetwork: (slug: string | null) => void;
  /** Room and building scale need live location to mean anything. */
  isLive: boolean;
  onGoLive: () => void;
  /** Tapping the community's name opens its home — where people look for it. */
  onHome: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const isOpen = activeSlug === null;
  /** The scope's own name wins over the list, which may not contain it. */
  const label = isOpen ? "Open network" : scopeName;
  const activeCount = facetsActive(facets);

  function toggleTopic(id: string) {
    onFacets({
      ...facets,
      topics: facets.topics.includes(id) ? facets.topics.filter((t) => t !== id) : [...facets.topics, id],
    });
  }

  // Above the windows only while something is dropped down. The bar sits at
  // z-30 and a floating window at 30 + its own z, so on a phone — where a
  // window is a full-width sheet starting just under the bar — an open
  // picker rendered *behind* whatever was already up. Raised only while
  // open, so the bar otherwise stays under the panel a reader is working in.
  return (
    <header
      className={`pointer-events-none absolute inset-x-0 top-0 p-2.5 ${picking || filtering ? "z-50" : "z-30"}`}
    >
      <div className="pointer-events-auto mx-auto max-w-2xl">
        {/* Two rows on a phone, and only two.
            One row truncated the search to "Search peo|", so it moved to
            its own line — but a column stretches every child to full
            width, which gave the bell and "My network" a bare row each
            and cost four rows of a phone screen to show four controls.
            Wrapping instead: the small controls share the first line and
            the search, alone in being full-width, takes the second. */}
        <div
          className="flex flex-wrap items-center gap-2 rounded-[22px] border px-2.5 py-2 backdrop-blur sm:flex-nowrap sm:rounded-full"
          style={{
            background: "color-mix(in srgb, var(--chrome) 94%, transparent)",
            borderColor: "var(--chrome-line)",
            boxShadow: "var(--shadow-lift)",
          }}
        >
          {/* ------------------------------------------- network switcher */}
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full py-1 pl-1 pr-2 tap sm:flex-none"
            style={{ background: "color-mix(in srgb, var(--chrome-ink) 10%, transparent)" }}
            aria-expanded={picking}
          >
            <span
              className="grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] text-white"
              style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-deep))" }}
            >
              {isOpen ? (
                <IconGlobe size={13} />
              ) : scopeKind === "event" ? (
                <IconCalendar size={13} />
              ) : (
                <IconPeople size={13} />
              )}
            </span>
            <span
              className="min-w-0 flex-1 truncate text-[12.5px] font-semibold sm:max-w-[140px] sm:flex-none"
              style={{ color: "var(--chrome-ink)" }}
            >
              {label}
            </span>
            <IconChevronDown size={13} style={{ color: "var(--chrome-soft)" }} />
          </button>

          <button
            type="button"
            onClick={() => setFiltering((v) => !v)}
            className="flex-none rounded-full border px-2.5 py-1.5 text-[12px] font-semibold tap sm:hidden"
            style={{
              borderColor: activeCount > 0 ? "var(--brand)" : "var(--chrome-line)",
              color: activeCount > 0 ? "var(--brand)" : "var(--chrome-ink)",
            }}
            aria-expanded={filtering}
          >
            Filters{activeCount > 0 ? ` ${activeCount}` : ""}
          </button>

          {/* Last on a phone and a full basis, so it wraps to its own line
              while everything else stays on the first.
              `basis-full`, not `w-full`: a flex item's width is ignored
              once flex-basis is set, so pairing w-full with flex-1 — whose
              basis is 0 — collapsed the search to a circle on the first
              row instead of moving it to the second. */}
          <div className="relative order-last min-w-0 basis-full sm:order-none sm:basis-auto sm:flex-1">
            <IconSearch
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--chrome-soft)" }}
            />
            <input
              value={facets.q}
              onChange={(e) => onFacets({ ...facets, q: e.target.value })}
              placeholder="Search people, roles, what they do"
              aria-label="Search people"
              className="w-full rounded-full border bg-transparent py-1.5 pl-7 pr-7 text-[12.5px] outline-none"
              style={{ borderColor: "var(--chrome-line)", color: "var(--chrome-ink)" }}
            />
            {facets.q && (
              <button
                type="button"
                onClick={() => onFacets({ ...facets, q: "" })}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                aria-label="Clear search"
                style={{ color: "var(--chrome-soft)" }}
              >
                <IconX size={12} />
              </button>
            )}
          </div>

          {/* Out in the chrome rather than inside Filters, because this one
              isn't a way of narrowing a search — it's a different question
              about the same map, and the answer is the only thing here
              that belongs to the person looking. Open network only: inside
              a community everyone is already a deliberate set. */}
          {isOpen && signedIn && (
            <button
              type="button"
              onClick={() => onFacets({ ...facets, connectedOnly: !facets.connectedOnly })}
              aria-pressed={facets.connectedOnly}
              className="flex flex-none items-center gap-1 rounded-full border px-2.5 py-1.5 text-[12px] font-semibold tap"
              style={
                facets.connectedOnly
                  ? { borderColor: "var(--brand)", background: "var(--brand)", color: "#fff" }
                  : { borderColor: "var(--chrome-line)", color: "var(--chrome-ink)" }
              }
            >
              <IconPeople size={13} />
              My network
            </button>
          )}

          <button
            type="button"
            onClick={() => setFiltering((v) => !v)}
            className="hidden flex-none rounded-full border px-2.5 py-1.5 text-[12px] font-semibold tap sm:block"
            style={{
              borderColor: activeCount > 0 ? "var(--brand)" : "var(--chrome-line)",
              color: activeCount > 0 ? "var(--brand)" : "var(--chrome-ink)",
            }}
            aria-expanded={filtering}
          >
            Filters{activeCount > 0 ? ` ${activeCount}` : ""}
          </button>

          {/* The bell lives here rather than in the dock: the dock is eight
              slots wide already and full on a phone, and a notification
              belongs with the chrome you glance at, not the surfaces you
              open. Visible on every width — an alert you only see on a
              desktop is an alert for a product nobody carries. */}
          {signedIn && (
            <button
              type="button"
              onClick={onAlerts}
              className="relative flex-none rounded-full border px-2.5 py-1.5 tap"
              aria-label={alerts > 0 ? `${alerts} new alerts` : "Alerts"}
              style={{
                borderColor: alerts > 0 ? "var(--brand)" : "var(--chrome-line)",
                color: alerts > 0 ? "var(--brand)" : "var(--chrome-ink)",
              }}
            >
              <IconBell size={15} />
              {alerts > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ background: "var(--brand)", boxShadow: "0 0 0 2px var(--chrome)" }}
                >
                  {alerts}
                </span>
              )}
            </button>
          )}
        </div>

        {/* ------------------------------------------------ network list */}
        {picking && (
          <div className="floating-panel panel-enter mt-1.5 max-h-[60dvh] overflow-y-auto p-1.5">
            {/* Where you actually are, when the list can't say it.
                An event is not a network you belong to, so it is correctly
                absent from the options below — but that left the picker
                showing three rows with none of them ticked, which reads as
                being nowhere. This row is the scope itself: ticked, and it
                opens the event rather than switching anything. */}
            {scopeKind === "event" && (
              <button
                type="button"
                onClick={() => {
                  onHome();
                  setPicking(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left tap hover:bg-[var(--sunk)]"
                style={{ background: "var(--sunk)" }}
              >
                <span
                  className="grid h-8 w-8 flex-none place-items-center rounded-xl"
                  style={{ background: "var(--card)", color: "var(--layer-event)" }}
                >
                  <IconCalendar size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{scopeName}</span>
                  <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">
                    Event · where you are now
                  </span>
                </span>
                <IconCheck size={14} style={{ color: "var(--brand)" }} />
              </button>
            )}
            {networks.map((n) => (
              <button
                key={n.slug ?? "open"}
                type="button"
                onClick={() => {
                  onNetwork(n.slug);
                  setPicking(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left tap hover:bg-[var(--sunk)]"
                style={n.slug === activeSlug ? { background: "var(--sunk)" } : undefined}
              >
                {/* The open network is a query, not a group, so it keeps
                    the globe. Everything else is somebody's own mark —
                    picking by recognition beats reading a list of names. */}
                {n.slug === null ? (
                  <span
                    className="grid h-8 w-8 flex-none place-items-center rounded-xl"
                    style={{ background: "var(--sunk)", color: "var(--brand)" }}
                  >
                    <IconGlobe size={15} />
                  </span>
                ) : (
                  <BoardLogo name={n.name} logoUrl={n.logoUrl} size={32} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-semibold">{n.name}</span>
                    {n.live && (
                      <span className="pill" style={{ background: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good)" }}>
                        Live
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">
                    {n.slug === null
                      ? "Everyone who opted in, near you"
                      : `${n.type === "event" ? "Event" : "Community"} · ${n.memberCount} ${n.memberCount === 1 ? "member" : "members"}`}
                  </span>
                </span>
                {n.slug === activeSlug && <IconCheck size={14} style={{ color: "var(--brand)" }} />}
              </button>
            ))}
            {/* An event already has the row above, which does the same thing. */}
            {activeSlug && scopeKind !== "event" && (
              <button
                type="button"
                onClick={() => {
                  onHome();
                  setPicking(false);
                }}
                className="mt-1 w-full rounded-xl p-2.5 text-left text-[12.5px] font-semibold tap hover:bg-[var(--sunk)]"
                style={{ color: "var(--brand)" }}
              >
                About {label} →
              </button>
            )}
            {networks.length === 1 && (
              <p className="px-2.5 pb-2 pt-1 text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
                Boards you join appear here. Scan a QR code or create one.
              </p>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- filters */}
        {filtering && (
          <div className="floating-panel panel-enter mt-1.5 max-h-[66dvh] overflow-y-auto p-3.5">
            <p className="label">What they&rsquo;re here for</p>
            <div className="flex flex-wrap gap-1.5">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="chip-toggle tap"
                  data-on={facets.topics.includes(t.id) ? "true" : "false"}
                  aria-pressed={facets.topics.includes(t.id)}
                  onClick={() => toggleTopic(t.id)}
                >
                  {facets.topics.includes(t.id) && <IconCheck size={11} />}
                  {t.need}
                </button>
              ))}
            </div>
            {/* Matches either side of the topic, because "find me investors"
                and "find me founders raising" are the same filter from two
                directions and nobody should have to pick which. */}
            <p className="mt-1.5 text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
              Matches people looking for it or offering it.
            </p>

            <p className="label mt-3.5">What they&rsquo;re into</p>
            <div className="flex flex-wrap gap-1.5">
              {SECTORS.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  className="chip-toggle tap"
                  data-on={facets.sectors.includes(sec.id) ? "true" : "false"}
                  aria-pressed={facets.sectors.includes(sec.id)}
                  onClick={() =>
                    onFacets({
                      ...facets,
                      sectors: facets.sectors.includes(sec.id)
                        ? facets.sectors.filter((x) => x !== sec.id)
                        : [...facets.sectors, sec.id],
                    })
                  }
                >
                  {facets.sectors.includes(sec.id) && <IconCheck size={11} />}
                  {sec.label}
                </button>
              ))}
            </div>

            <p className="label mt-3.5">Where they are</p>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  className="chip-toggle tap"
                  data-on={facets.stage === st.id ? "true" : "false"}
                  aria-pressed={facets.stage === st.id}
                  onClick={() => onFacets({ ...facets, stage: facets.stage === st.id ? "" : st.id })}
                >
                  {facets.stage === st.id && <IconCheck size={11} />}
                  {st.label}
                </button>
              ))}
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {isOpen && (
                <div className="w-full">
                  <p className="label">How close</p>
                  <div className="flex flex-wrap gap-1.5">
                    {/* Everybody, and it is the default. Narrowing is a
                        thing the reader chooses; it is not the state they
                        are put in before they have asked for anything. */}
                    <button
                      type="button"
                      className="chip-toggle tap"
                      data-on={facets.withinKm == null ? "true" : "false"}
                      aria-pressed={facets.withinKm == null}
                      onClick={() => onFacets({ ...facets, withinKm: null })}
                    >
                      {facets.withinKm == null && <IconCheck size={11} />}
                      Anywhere
                    </button>
                    {PROXIMITY_STEPS.map((step) => {
                      const needsLive = "needsLive" in step && step.needsLive && !isLive;
                      const on = facets.withinKm === step.km;
                      return (
                        <button
                          key={step.km}
                          type="button"
                          className="chip-toggle tap"
                          data-on={on ? "true" : "false"}
                          aria-pressed={on}
                          // Not disabled: tapping it turns live sharing on,
                          // which is the thing the person actually wants.
                          onClick={() =>
                            needsLive ? onGoLive() : onFacets({ ...facets, withinKm: on ? null : step.km })
                          }
                          title={needsLive ? "Needs your live location" : undefined}
                          style={needsLive ? { opacity: 0.6 } : undefined}
                        >
                          {on && <IconCheck size={11} />}
                          {step.label}
                        </button>
                      );
                    })}
                  </div>
                  {!isLive && (
                    <p className="mt-1.5 text-[11.5px] leading-[1.45] text-[var(--ink-soft)]">
                      Room and building need your live location — a city pin can&rsquo;t tell who&rsquo;s in the room.
                    </p>
                  )}
                </div>
              )}
              {!isOpen && (
                <button
                  type="button"
                  className="chip-toggle tap"
                  data-on={facets.hereNow ? "true" : "false"}
                  aria-pressed={facets.hereNow}
                  onClick={() => onFacets({ ...facets, hereNow: !facets.hereNow })}
                >
                  {facets.hereNow && <IconCheck size={11} />} In the room now
                </button>
              )}
              <button
                type="button"
                className="chip-toggle tap"
                data-on={facets.exactOnly ? "true" : "false"}
                aria-pressed={facets.exactOnly}
                onClick={() => onFacets({ ...facets, exactOnly: !facets.exactOnly })}
              >
                {facets.exactOnly && <IconCheck size={11} />} Precise location only
              </button>
            </div>

            <div className="mt-3.5 flex items-center justify-between gap-3">
              <span className="text-[12px] text-[var(--ink-soft)]">{countLabel}</span>
              <div className="flex gap-2">
                {activeCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => onFacets(NO_FACETS)}
                  >
                    Clear
                  </button>
                )}
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setFiltering(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
