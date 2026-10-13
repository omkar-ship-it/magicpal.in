"use client";

import { useEffect, useMemo, useState } from "react";
// The default export of react-map-gl is named `Map`, which shadows the
// global `Map` constructor used below for grouping. Aliased, not imported
// bare — this exact collision has broken this file before.
import MapGL, { Marker, NavigationControl, type ViewStateChangeEvent } from "react-map-gl/mapbox";
import type { MapProfile } from "@/lib/profiles";
import type { SelfMarker } from "@/lib/shell";
import Avatar from "./Avatar";
import { topicById } from "@/lib/intents";
import { whenLabel } from "@/lib/time";
import { IconCalendar, IconCity, IconPin } from "./Icons";

/**
 * Which Mapbox style to draw, following the viewer's theme.
 *
 * Three states, same as the CSS: an explicit `data-theme` stamp wins in
 * either direction, and the common un-stamped case falls back to the OS
 * preference. Read from the DOM rather than passed as a prop because the
 * stamp can change after mount, and a bright map behind dark chrome is the
 * one combination that looks broken rather than merely unstyled.
 */
function prefersDark(): boolean {
  if (typeof document === "undefined") return false;
  const stamped = document.documentElement.getAttribute("data-theme");
  if (stamped === "dark") return true;
  if (stamped === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export type MapEvent = {
  slug: string;
  name: string;
  place: string | null;
  lat: number | null;
  lng: number | null;
  startsAt: string | null;
  going?: number;
};

/**
 * The map, for every surface.
 *
 * Faces, not counts. A bubble reading "23" is a number you have to decide
 * to expand; three faces and a "+20" is a crowd you already want to look
 * at — and on a networking map the only reason to zoom anywhere is that
 * you saw somebody.
 *
 * Markers stack by rounded coordinate rather than by true clustering: at
 * city-only precision dozens of people share one centroid exactly, so the
 * real job is collapsing identical points, not finding nearby ones. A
 * clustering library would be a dependency doing a harder job than this
 * needs.
 */
export default function MapCanvas({
  people,
  you = null,
  events = [],
  eventsOnly = false,
  activeEventSlug = null,
  initialLat,
  initialLng,
  initialZoom = 10,
  fitToPeople = false,
  bottomInset = 0,
  showZoom = false,
  highlightIds = [],
  onSelectPerson,
  onSelectEvent,
  onMoveEnd,
}: {
  people: Array<MapProfile & { hereNow?: boolean }>;
  /** The viewer, drawn distinctly so they can verify their own visibility. */
  you?: SelfMarker | null;
  events?: MapEvent[];
  /**
   * Events instead of faces.
   *
   * When somebody opens Events they're asking what's happening, not who's
   * nearby — and a map carrying both at once answers neither question well,
   * since the events disappear into a crowd of people.
   */
  eventsOnly?: boolean;
  activeEventSlug?: string | null;
  initialLat: number;
  initialLng: number;
  initialZoom?: number;
  /**
   * Frame everybody instead of centring on a fixed point. A board's venue
   * is where the *event* is, which on a community board is nowhere and on
   * an event board is one corner of where the members actually live — so
   * centring on it reliably pushes half the faces off the edge.
   */
  fitToPeople?: boolean;
  /**
   * Height of chrome covering the bottom of the map (a sheet, a dock).
   * Handed to Mapbox as viewport padding so its idea of "centre" is the
   * centre of what the viewer can actually see — otherwise the initial
   * framing drops people underneath the sheet, where they are not merely
   * hidden but unclickable, the sheet having swallowed the pointer events.
   */
  bottomInset?: number;
  /** Zoom buttons. Worth it on a pannable full-screen map, noise in a card. */
  showZoom?: boolean;
  /** Recommended people — drawn with a ring so the list and map agree. */
  highlightIds?: string[];
  onSelectPerson?: (id: string) => void;
  onSelectEvent?: (slug: string) => void;
  onMoveEnd?: (c: { lat: number; lng: number; zoom: number }) => void;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Lazy initialiser rather than a setState in the effect below: this
  // component only ever renders client-side (every caller wraps it in an
  // ssr:false loader), so the DOM is already there on the first render.
  const [dark, setDark] = useState(prefersDark);
  useEffect(() => {
    const sync = () => setDark(prefersDark());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    // Also watch the stamp, so a theme toggle repaints the map and not just
    // the chrome around it.
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  /**
   * Computed once, from the first render's people. Deliberately not
   * reactive: this feeds `initialViewState`, and recomputing it as people
   * load would yank the camera out from under somebody who has already
   * started panning.
   */
  const [fitted] = useState(() => {
    if (!fitToPeople || people.length === 0) return null;
    const lats = people.map((p) => p.lat);
    const lngs = people.map((p) => p.lng);
    return {
      bounds: [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ] as [[number, number], [number, number]],
    };
  });
  const [zoom, setZoom] = useState(initialZoom);
  const highlighted = useMemo(() => new Set(highlightIds), [highlightIds]);

  /**
   * Past this zoom, people are shown individually; below it, co-located
   * people stack. The threshold is deliberately generous — a stack that
   * explodes into overlapping faces is worse than one that stays stacked a
   * level too long.
   */
  const precise = zoom >= 11;

  const stacks = useMemo(() => {
    // Rounding to ~1km at precise zoom and ~10km below it. Both are coarse
    // enough that two pins never visually collide, which is the only
    // property that matters here.
    const digits = precise ? 2 : 1;
    const groups = new Map<string, Array<MapProfile & { hereNow?: boolean }>>();
    for (const p of people) {
      const key = `${p.lat.toFixed(digits)},${p.lng.toFixed(digits)}`;
      const list = groups.get(key);
      if (list) list.push(p);
      else groups.set(key, [p]);
    }
    return [...groups.values()].map((group) => ({
      key: group.map((g) => g.id).join("-"),
      lat: group[0].lat,
      lng: group[0].lng,
      group,
    }));
  }, [people, precise]);

  if (!token) {
    return (
      <div className="grid h-full place-items-center p-8 text-center" style={{ background: "var(--sunk)" }}>
        <p className="max-w-sm text-[13px] text-[var(--ink-soft)]">
          The map needs a Mapbox token. Set <span className="mono">NEXT_PUBLIC_MAPBOX_TOKEN</span> to see it.
        </p>
      </div>
    );
  }

  return (
    <MapGL
      mapboxAccessToken={token}
      initialViewState={
        fitted
          ? {
              bounds: fitted.bounds,
              fitBoundsOptions: { padding: { top: 48, left: 48, right: 48, bottom: 48 + bottomInset }, maxZoom: 13 },
            }
          : {
              latitude: initialLat,
              longitude: initialLng,
              zoom: initialZoom,
              padding: { top: 0, left: 0, right: 0, bottom: bottomInset },
            }
      }
      // Mercator, always. The globe projection reprojects markers during
      // flight and the face stacks visibly slide off their coordinates.
      projection="mercator"
      mapStyle={dark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11"}
      style={{ width: "100%", height: "100%" }}
      onMove={(e: ViewStateChangeEvent) => setZoom(e.viewState.zoom)}
      onMoveEnd={(e: ViewStateChangeEvent) =>
        onMoveEnd?.({ lat: e.viewState.latitude, lng: e.viewState.longitude, zoom: e.viewState.zoom })
      }
    >
      {showZoom && <NavigationControl position="bottom-right" showCompass={false} />}

      {events.map((ev) =>
        ev.lat != null && ev.lng != null ? (
          <Marker key={ev.slug} latitude={ev.lat} longitude={ev.lng} anchor="bottom">
            <span className="hover-host relative">
              <button
                type="button"
                className="layer-pin tap"
                style={{
                  borderColor: "var(--layer-event)",
                  color: "var(--layer-event)",
                  // The one being read sits proud of the rest.
                  transform: activeEventSlug === ev.slug ? "scale(1.25)" : undefined,
                  boxShadow: activeEventSlug === ev.slug ? "0 0 0 3px var(--layer-event)" : undefined,
                }}
                onClick={() => onSelectEvent?.(ev.slug)}
                aria-label={ev.name}
              >
                <IconCalendar size={14} />
              </button>
              <EventCard event={ev} />
            </span>
          </Marker>
        ) : null
      )}

      {!eventsOnly && you && (
        <Marker latitude={you.lat} longitude={you.lng} anchor="center">
          <span className="relative flex items-center">
            <span
              className="map-pin"
              title={
                you.visibility === "off"
                  ? "You — only you can see this"
                  : you.visibility === "base"
                    ? "You — showing your city"
                    : "You — showing your exact location"
              }
              style={{
                borderRadius: 999,
                // Off the map is drawn faded rather than hidden: the whole
                // question somebody has is "where would I be, and am I
                // showing?", and an absent marker answers neither.
                opacity: you.visibility === "off" ? 0.45 : 1,
                boxShadow:
                  you.visibility === "off"
                    ? "0 0 0 2px var(--ink-soft), var(--shadow)"
                    : "0 0 0 3px var(--brand), var(--shadow)",
              }}
            >
              <Avatar name={you.name} photoUrl={you.photoUrl} size={32} ring={2} />
            </span>
            <span
              className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9.5px] font-bold"
              style={{
                background: you.visibility === "off" ? "var(--ink-soft)" : "var(--brand)",
                color: "#fff",
              }}
            >
              {you.visibility === "off" ? "Hidden" : "You"}
            </span>
          </span>
        </Marker>
      )}

      {!eventsOnly &&
        stacks.map((s) => (
          <Marker key={s.key} latitude={s.lat} longitude={s.lng} anchor="center">
            <FaceStack group={s.group} highlighted={highlighted} onSelect={onSelectPerson} />
          </Marker>
        ))}
    </MapGL>
  );
}

/**
 * The hover preview.
 *
 * Enough to decide whether to click and no more: face, name, what they do,
 * and the one or two things they're after. Rendered inside the marker and
 * revealed by CSS (.hover-host) rather than by React state, so moving the
 * pointer across a crowded stack doesn't re-render the whole map.
 */
function PinCard({ person }: { person: MapProfile & { hereNow?: boolean } }) {
  const wants = person.lookingFor.map(topicById).filter(Boolean).slice(0, 2);
  return (
    <span
      className="hover-card pointer-events-none absolute z-50 block w-[220px] rounded-2xl border border-[var(--line)] p-2.5 text-left"
      style={{ background: "var(--card)", boxShadow: "var(--shadow-lift)" }}
      aria-hidden="true"
    >
      <span className="block truncate text-[12.5px] font-semibold">{person.name}</span>
      {person.headline && (
        <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">
          {person.headline}
          {person.company ? ` · ${person.company}` : ""}
        </span>
      )}
      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--ink-soft)]">
        {person.placed === "base" ? <IconCity size={10} /> : <IconPin size={10} />}
        <span className="truncate">
          {person.locationLabel || "Somewhere"}
          {person.placed === "base" ? " · city only" : person.placed === "live" ? " · live" : ""}
        </span>
      </span>
      {wants.length > 0 && (
        <span className="mt-1.5 flex flex-wrap gap-1">
          {wants.map((t) => (
            <span
              key={t!.id}
              className="pill"
              style={{ background: "color-mix(in srgb, var(--brand) 12%, transparent)", color: "var(--brand)", fontSize: 10 }}
            >
              {t!.need}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/** Hover preview for an event marker — the same idea as a person's. */
function EventCard({ event }: { event: MapEvent }) {
  return (
    <span
      className="hover-card pointer-events-none absolute z-50 block w-[220px] rounded-2xl border border-[var(--line)] p-2.5 text-left"
      style={{ background: "var(--card)", boxShadow: "var(--shadow-lift)" }}
      aria-hidden="true"
    >
      <span className="block truncate text-[12.5px] font-semibold">{event.name}</span>
      {event.place && <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">{event.place}</span>}
      {event.startsAt && (
        <span className="mt-0.5 block text-[11px] text-[var(--ink-soft)]">{whenLabel(event.startsAt)}</span>
      )}
      {event.going != null && (
        <span className="mt-1 block text-[11px] font-semibold" style={{ color: "var(--layer-event)" }}>
          {event.going} going
        </span>
      )}
    </span>
  );
}

function FaceStack({
  group,
  highlighted,
  onSelect,
}: {
  group: Array<MapProfile & { hereNow?: boolean }>;
  highlighted: Set<string>;
  onSelect?: (id: string) => void;
}) {
  // A recommended face is pulled to the front of its own stack — otherwise
  // the one person the surface just told you to meet can end up as the
  // hidden fourth face behind a "+3".
  const sorted = useMemo(
    () => [...group].sort((a, b) => Number(highlighted.has(b.id)) - Number(highlighted.has(a.id))),
    [group, highlighted]
  );
  const faces = sorted.slice(0, 3);
  const extra = sorted.length - faces.length;

  return (
    <span className="flex items-center -space-x-2.5">
      {faces.map((p) => (
        <span key={p.id} className="hover-host relative">
          <button
            type="button"
            className="map-pin"
            onClick={() => onSelect?.(p.id)}
            aria-label={p.name}
            style={
              highlighted.has(p.id)
                ? { boxShadow: "0 0 0 2.5px var(--brand), var(--shadow)", borderRadius: 999 }
                : undefined
            }
          >
            <Avatar name={p.name} photoUrl={p.photoUrl} size={30} ring={2} />
            {p.placed === "live" && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full"
                style={{ background: "var(--good)", boxShadow: "0 0 0 2px var(--card)" }}
                title="Live location"
              />
            )}
          </button>
          <PinCard person={p} />
        </span>
      ))}
      {extra > 0 && (
        <button
          type="button"
          className="map-pin grid h-[30px] w-[30px] place-items-center rounded-full text-[11px] font-semibold"
          style={{ background: "var(--card)", color: "var(--ink-soft)", boxShadow: "0 0 0 2px var(--card), var(--shadow)" }}
          onClick={() => onSelect?.(sorted[faces.length].id)}
          aria-label={`${extra} more people here`}
        >
          +{extra}
        </button>
      )}
    </span>
  );
}
