"use client";

import { useState } from "react";
import { SECTORS, STAGES, TOPICS } from "@/lib/intents";
import { PROXIMITY_STEPS } from "@/lib/rules";
import type { NetworkOption } from "@/lib/shell";
import { facetsActive, NO_FACETS, type Facets } from "@/lib/search";
import { IconCheck, IconChevronDown, IconGlobe, IconPeople, IconSearch, IconX } from "./Icons";

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
  facets,
  onFacets,
  radiusKm,
  onRadius,
  countLabel,
  onNetwork,
  isLive,
  onGoLive,
  onHome,
}: {
  networks: NetworkOption[];
  activeSlug: string | null;
  facets: Facets;
  onFacets: (f: Facets) => void;
  radiusKm: number;
  onRadius: (km: number) => void;
  countLabel: string;
  onNetwork: (slug: string | null) => void;
  /** Room and building scale need live location to mean anything. */
  isLive: boolean;
  onGoLive: () => void;
  /** Tapping the community's name opens its home — where people look for it. */
  onHome: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const active = networks.find((n) => n.slug === activeSlug) ?? networks[0];
  const isOpen = activeSlug === null;
  const activeCount = facetsActive(facets);

  function toggleTopic(id: string) {
    onFacets({
      ...facets,
      topics: facets.topics.includes(id) ? facets.topics.filter((t) => t !== id) : [...facets.topics, id],
    });
  }

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 p-2.5">
      <div className="pointer-events-auto mx-auto max-w-2xl">
        {/* Two rows on a phone. One row meant the switcher, a search box and
            a Filters button sharing 390px, which truncated the search to
            "Search peo|" — the one control that has to be readable. */}
        <div
          className="flex flex-col gap-2 rounded-[22px] border px-2.5 py-2 backdrop-blur sm:flex-row sm:items-center sm:rounded-full"
          style={{
            background: "color-mix(in srgb, var(--chrome) 94%, transparent)",
            borderColor: "var(--chrome-line)",
            boxShadow: "var(--shadow-lift)",
          }}
        >
          <div className="flex items-center gap-2">
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
              {isOpen ? <IconGlobe size={13} /> : <IconPeople size={13} />}
            </span>
            <span
              className="min-w-0 flex-1 truncate text-[12.5px] font-semibold sm:max-w-[140px] sm:flex-none"
              style={{ color: "var(--chrome-ink)" }}
            >
              {active?.name ?? "Open network"}
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
          </div>

          {/* -------------------------------------------------- search box */}
          <div className="relative min-w-0 flex-1">
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
        </div>

        {/* ------------------------------------------------ network list */}
        {picking && (
          <div className="floating-panel panel-enter mt-1.5 max-h-[60dvh] overflow-y-auto p-1.5">
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
                <span
                  className="grid h-8 w-8 flex-none place-items-center rounded-xl"
                  style={{
                    background: "var(--sunk)",
                    color: n.slug === null ? "var(--brand)" : "var(--layer-event)",
                  }}
                >
                  {n.slug === null ? <IconGlobe size={15} /> : <IconPeople size={15} />}
                </span>
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
            {activeSlug && (
              <button
                type="button"
                onClick={() => {
                  onHome();
                  setPicking(false);
                }}
                className="mt-1 w-full rounded-xl p-2.5 text-left text-[12.5px] font-semibold tap hover:bg-[var(--sunk)]"
                style={{ color: "var(--brand)" }}
              >
                About {active?.name} →
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
                    {PROXIMITY_STEPS.map((step) => {
                      const needsLive = "needsLive" in step && step.needsLive && !isLive;
                      return (
                        <button
                          key={step.km}
                          type="button"
                          className="chip-toggle tap"
                          data-on={radiusKm === step.km ? "true" : "false"}
                          aria-pressed={radiusKm === step.km}
                          // Not disabled: tapping it turns live sharing on,
                          // which is the thing the person actually wants.
                          onClick={() => (needsLive ? onGoLive() : onRadius(step.km))}
                          title={needsLive ? "Needs your live location" : undefined}
                          style={needsLive ? { opacity: 0.6 } : undefined}
                        >
                          {radiusKm === step.km && <IconCheck size={11} />}
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
