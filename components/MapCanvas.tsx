"use client";

import { useMemo, useState } from "react";
// The default export of react-map-gl is named `Map`, which shadows the
// global `Map` constructor used below for grouping. Aliased, not imported
// bare — this exact collision has broken this file before.
import MapGL, { Marker, type ViewStateChangeEvent } from "react-map-gl/mapbox";
import type { MapProfile } from "@/lib/profiles";
import Avatar from "./Avatar";
import { IconCalendar } from "./Icons";

export type MapEvent = {
  slug: string;
  name: string;
  place: string | null;
  lat: number | null;
  lng: number | null;
  startsAt: string | null;
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
  events = [],
  initialLat,
  initialLng,
  initialZoom = 10,
  fitToPeople = false,
  bottomInset = 0,
  highlightIds = [],
  onSelectPerson,
  onSelectEvent,
  onMoveEnd,
}: {
  people: Array<MapProfile & { hereNow?: boolean }>;
  events?: MapEvent[];
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
  /** Recommended people — drawn with a ring so the list and map agree. */
  highlightIds?: string[];
  onSelectPerson?: (id: string) => void;
  onSelectEvent?: (slug: string) => void;
  onMoveEnd?: (c: { lat: number; lng: number; zoom: number }) => void;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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
      mapStyle="mapbox://styles/mapbox/light-v11"
      style={{ width: "100%", height: "100%" }}
      onMove={(e: ViewStateChangeEvent) => setZoom(e.viewState.zoom)}
      onMoveEnd={(e: ViewStateChangeEvent) =>
        onMoveEnd?.({ lat: e.viewState.latitude, lng: e.viewState.longitude, zoom: e.viewState.zoom })
      }
    >
      {events.map((ev) =>
        ev.lat != null && ev.lng != null ? (
          <Marker key={ev.slug} latitude={ev.lat} longitude={ev.lng} anchor="bottom">
            <button
              type="button"
              className="layer-pin tap"
              style={{ borderColor: "var(--layer-event)", color: "var(--layer-event)" }}
              onClick={() => onSelectEvent?.(ev.slug)}
              title={ev.name}
              aria-label={ev.name}
            >
              <IconCalendar size={14} />
            </button>
          </Marker>
        ) : null
      )}

      {stacks.map((s) => (
        <Marker key={s.key} latitude={s.lat} longitude={s.lng} anchor="center">
          <FaceStack
            group={s.group}
            highlighted={highlighted}
            onSelect={onSelectPerson}
          />
        </Marker>
      ))}
    </MapGL>
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
        <button
          key={p.id}
          type="button"
          className="map-pin"
          onClick={() => onSelect?.(p.id)}
          title={p.name}
          aria-label={p.name}
          style={
            highlighted.has(p.id)
              ? { boxShadow: "0 0 0 2.5px var(--brand), var(--shadow)", borderRadius: 999 }
              : undefined
          }
        >
          <Avatar name={p.name} photoUrl={p.photoUrl} size={30} ring={2} />
        </button>
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
