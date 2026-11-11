"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// The default export of react-map-gl is named `Map`, which shadows the
// global `Map` constructor used below for grouping. Aliased, not imported
// bare — this exact collision has broken this file before.
import MapGL, { Marker, NavigationControl, type ViewStateChangeEvent } from "react-map-gl/mapbox";
import type { MapProfile } from "@/lib/profiles";
import type { SelfMarker } from "@/lib/shell";
import type { PinRef } from "@/lib/pins";
import type { JobRef } from "@/lib/jobs";
import { jobModeLabel } from "@/lib/rules";
import Avatar from "./Avatar";
import { whenLabel } from "@/lib/time";
import { IconBriefcase, IconCalendar, IconCity, IconMeetup, IconPin, IconUser } from "./Icons";
import VerifiedBadge from "./VerifiedBadge";
import { Ask, askLines } from "./Asks";

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

/** Above this, faces are drawn individually; below it, co-located ones stack. */
const PRECISE_ZOOM = 11;

/**
 * Neighbourhood level: the middle rung of how finely pins are grouped.
 *
 * A pile here used to open out into a ring of faces on spokes. It is
 * gone — at any real density the spokes crossed into a web over the
 * streets, and the honest answer to "who are these forty people" was
 * never a drawing, it was the directory. The zoom band earns its keep as
 * a grouping precision and nothing more.
 */
const NEIGHBOURHOOD_ZOOM = 13;

/**
 * Below this, even a spread map goes back to piling up.
 *
 * `spread` exists so a city's worth of people stop landing on one pixel.
 * Pulled right out to a continent they are on one pixel whatever the
 * setting says, and sixteen labelled chips stacked on Hyderabad is a
 * worse drawing than one stack of faces.
 */
const SPREAD_ZOOM = 8;

/**
 * Street level, where a stack should mean "the same doorway" and nothing
 * looser than that.
 */
const CLOSE_ZOOM = 16;

/**
 * How big a face is drawn, as a multiple of its natural size.
 *
 * A fixed 40px avatar is two different mistakes at the two ends of the
 * zoom. Pulled right out, forty pins at 40px is a continent made of faces
 * and you cannot see the land underneath; pushed right in, the same 40px
 * on a phone is a small target for a thumb, looking at the one street you
 * actually care about.
 *
 * So it tracks the zoom. The range is deliberately narrow — people still
 * have to read as the same object at both ends — and eased rather than
 * linear, so most of the change happens across the middle zooms where the
 * reader is actually navigating rather than in the last few levels.
 */
const PIN_MIN = 0.62;
const PIN_MAX = 1.25;
const PIN_FROM = 2;
const PIN_TO = 14;

/**
 * Written straight to the DOM, never through state.
 *
 * `move` fires on every frame of every pan, flight and pinch. Putting the
 * zoom in React state would re-render every marker on the map sixty times
 * a second, which is the exact mistake `precise` is a boolean to avoid —
 * so this sets one inherited custom property on the map container and lets
 * the compositor do the rest.
 */
function applyPinScale(el: HTMLElement | undefined | null, zoom: number) {
  if (!el) return;
  const t = Math.min(1, Math.max(0, (zoom - PIN_FROM) / (PIN_TO - PIN_FROM)));
  const eased = t * t * (3 - 2 * t);
  el.style.setProperty("--pin-scale", (PIN_MIN + (PIN_MAX - PIN_MIN) * eased).toFixed(3));
}

/**
 * The one Earth, and the furthest anybody may travel on it.
 *
 * Mercator is undefined at the poles, so it is cut at the latitude Mapbox
 * itself uses. Clamping the camera to this is what guarantees the frame is
 * always full: with one world copy and no bound, panning east of New
 * Zealand walks off the edge into empty background.
 */
const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-180, -85.0511],
  [180, 85.0511],
];

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
  pins = [],
  jobs = [],
  onSelectPin,
  onSelectJob,
  layer = "people",
  activeEventSlug = null,
  initialLat,
  initialLng,
  initialZoom = 10,
  fitToPeople = false,
  bottomInset = 0,
  showZoom = false,
  highlightIds = [],
  spread = false,
  chip = false,
  onSelectPerson,
  onSelectEvent,
  onMoveEnd,
  onOpenStack,
  focus = null,
  goTo = null,
}: {
  people: Array<MapProfile & { hereNow?: boolean; verified?: boolean; unplaced?: boolean; self?: boolean }>;
  /** The viewer, drawn distinctly so they can verify their own visibility. */
  you?: SelfMarker | null;
  events?: MapEvent[];
  /** Ad-hoc "I'm here now" markers. Always drawn — they're the live layer. */
  pins?: PinRef[];
  /**
   * Open roles, drawn where the work happens.
   *
   * Only the placed ones ever arrive here — a remote job has no
   * coordinates by database constraint, and inventing one for it would
   * put a false fact on a map whose whole claim is that its positions
   * are real.
   */
  jobs?: JobRef[];
  onSelectPin?: (id: string) => void;
  onSelectJob?: (id: string) => void;
  /**
   * Which single thing the map is of.
   *
   * One layer at a time, because each panel asks a different question and
   * a map carrying all three answers none of them: open Events and the
   * evenings disappear into a crowd of faces; open Jobs and the offices
   * do. Somebody who opened a panel has already said which question they
   * are asking, so the map follows rather than hedging.
   *
   * `people` is the default and carries the live pins with it — somebody
   * in a café two streets away right now is the most time-sensitive thing
   * on the screen, and it belongs with the faces.
   */
  layer?: "people" | "events" | "jobs";
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
  /**
   * Draw every pin where it says it is, without collapsing piles.
   *
   * On for anybody whose coordinates have been scattered server-side —
   * a gated member, or a visitor — because the scatter exists precisely
   * so the pile has somewhere to spread to, and regrouping it here would
   * undo the thing it was for.
   */
  spread?: boolean;
  /**
   * Labelled chips instead of bare faces.
   *
   * For the signed-out map, where the pins are the pitch: a stranger
   * reading "Looking for a technical co-founder" across a city is being
   * shown the product, and a grid of anonymous avatars is not.
   */
  chip?: boolean;
  onSelectPerson?: (id: string) => void;
  onSelectEvent?: (slug: string) => void;
  onMoveEnd?: (c: { lat: number; lng: number; zoom: number }) => void;
  /**
   * Somebody picked out of a list, for the camera to go and find.
   *
   * Carries a counter rather than being a bare id so that asking twice
   * works: opening the same person again after panning away has to move the
   * camera back, and an unchanged id would look like nothing happened.
   */
  focus?: { id: string; at: number } | null;
  /** An explicit camera instruction, for things that aren't people. */
  goTo?: { lat: number; lng: number; at: number } | null;
  /** A whole stack of co-located people, opened as a directory. */
  onOpenStack?: (ids: string[]) => void;
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
  // Whoever was just opened from a list is ringed too, so the thing the
  // camera flew to is the thing that stands out when it lands.
  const highlighted = useMemo(() => {
    const set = new Set(highlightIds);
    if (focus?.id) set.add(focus.id);
    return set;
  }, [highlightIds, focus]);

  /**
   * The live map, kept for the one thing that has to be imperative.
   *
   * Flying is an instruction, not a rendered value — expressing it as state
   * would mean re-rendering every marker to move a camera.
   */
  const mapObj = useRef<{ flyTo: (o: Record<string, unknown>) => void; getZoom: () => number } | null>(null);
  const flown = useRef(0);
  useEffect(() => {
    if (!focus || focus.at === flown.current) return;
    const p = people.find((x) => x.id === focus.id);
    // Somebody with no position cannot be pointed at, and jumping the camera
    // somewhere arbitrary would be worse than not moving it.
    if (!p || p.unplaced || (p.lat === 0 && p.lng === 0)) return;
    const m = mapObj.current;
    if (!m) return;
    flown.current = focus.at;
    m.flyTo({
      center: [p.lng, p.lat],
      // Close enough to see them, never further out than you already are.
      zoom: Math.max(m.getZoom(), 14),
      duration: 900,
      // The card and the dock cover the bottom; aim at what is still visible.
      padding: { top: 0, left: 0, right: 0, bottom: bottomInset },
    });
  }, [focus, people, bottomInset]);

  /**
   * Point at a coordinate rather than at a person.
   *
   * `focus` above resolves an id against the people on the map, which is
   * right for "show me Ananya" and useless for "show me this office" —
   * a job has a position and no row in `people`, so it needs the camera
   * instruction without the lookup. Same shape, same once-per-`at` guard.
   */
  const went = useRef(0);
  useEffect(() => {
    if (!goTo || goTo.at === went.current) return;
    const m = mapObj.current;
    if (!m) return;
    went.current = goTo.at;
    m.flyTo({
      center: [goTo.lng, goTo.lat],
      zoom: Math.max(m.getZoom(), 13),
      duration: 900,
      padding: { top: 0, left: 0, right: 0, bottom: bottomInset },
    });
  }, [goTo, bottomInset]);

  /**
   * Past this zoom, people are shown individually; below it, co-located
   * people stack. The threshold is deliberately generous — a stack that
   * explodes into overlapping faces is worse than one that stays stacked a
   * level too long.
   *
   * Held as the *answer* rather than the zoom level, which is the whole
   * point: `onMove` fires every animation frame of every pan and flight,
   * and storing the float re-rendered every marker on the map sixty times
   * a second. Storing the boolean means React bails out of all but the two
   * frames where the threshold is actually crossed.
   */
  const [precise, setPrecise] = useState(initialZoom >= PRECISE_ZOOM);
  /** Same reasoning as `precise`: a boolean, so only the crossing re-renders. */
  const [neighbourhood, setNeighbourhood] = useState(initialZoom >= NEIGHBOURHOOD_ZOOM);
  const [close, setClose] = useState(initialZoom >= CLOSE_ZOOM);
  const [regional, setRegional] = useState(initialZoom >= SPREAD_ZOOM);

  /**
   * How far out the viewer may zoom before the world stops filling the
   * frame.
   *
   * With world copies off (see below) there is exactly one Earth, and
   * zooming past the point where it covers the viewport leaves bands of
   * empty background either side of it. Mapbox draws the world 512px wide
   * at zoom 0 and doubles per level, so the zoom at which it just covers a
   * box is log2(box / 512) — measured from the real element and recomputed
   * on resize, because a phone in portrait and a desktop window are two
   * very different numbers.
   *
   * `bottomInset` is added to the height rather than ignored: that padding
   * moves the camera's centre up by half of it, so a world sized to the
   * bare viewport sits high and leaves a band of background along the
   * bottom edge. Sizing to the padded box is what makes "filled" true on a
   * phone, where the dock is a tenth of the screen.
   */
  const [minZoom, setMinZoom] = useState(0);
  const observed = useRef<ResizeObserver | null>(null);
  // Measured from Mapbox's own container rather than a wrapper of our own:
  // it is the element the projection actually uses, and there is no second
  // box to keep in step with it.
  const measureFrom = useCallback((el: HTMLElement) => {
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      // The larger side decides: filling the width while the height still
      // shows background is no better than the other way round. The 1.02 is
      // slack for sub-pixel rounding — a one-pixel seam of background along
      // an edge is the kind of thing that only ever shows on someone else's
      // screen.
      const need = Math.max(width, height + bottomInset) * 1.02;
      setMinZoom(Math.max(0, Math.log2(need / 512)));
    };
    measure();
    observed.current?.disconnect();
    observed.current = new ResizeObserver(measure);
    observed.current.observe(el);
  }, [bottomInset]);
  useEffect(() => () => observed.current?.disconnect(), []);

  const onMove = useCallback((e: ViewStateChangeEvent) => {
    // Same value on most frames; React compares and does nothing.
    setPrecise(e.viewState.zoom >= PRECISE_ZOOM);
    setNeighbourhood(e.viewState.zoom >= NEIGHBOURHOOD_ZOOM);
    setRegional(e.viewState.zoom >= SPREAD_ZOOM);
    setClose(e.viewState.zoom >= CLOSE_ZOOM);
    applyPinScale(e.target?.getContainer(), e.viewState.zoom);
  }, []);

  const stacks = useMemo(() => {
    /**
     * How close two people have to be before they count as one pin, and it
     * follows the zoom because "close" is a question about the screen.
     *
     * This was a kilometre from zoom 11 upwards, which is most of a city
     * block at 15 and considerably wider than the whole viewport at 18 — so
     * zooming in to separate a crowd did nothing at all, and people several
     * streets apart were served as a single stack with a "+9" on it. The
     * one action anybody takes to pull a pile apart was the one action that
     * could not.
     *
     * 11km, 1.1km, 110m, 11m. By street level a stack means the same
     * doorway, and a stack of those is a "+N" into the directory.
     */
    /**
     * Locked readers get every pin drawn separately.
     *
     * Grouping exists so forty faces at one centroid read as one object
     * you can open. Nothing opens here, and the collapse was actively
     * lying about the size of the room: sixteen people pinned to one city
     * centroid became three smudges, which is a map that looks empty
     * because of how it is drawn rather than because of who is on it.
     * The coordinates are already scattered server-side (see `anonymise`),
     * so each one has somewhere of its own to go.
     */
    const digits = spread && regional ? 6 : close ? 4 : neighbourhood ? 3 : precise ? 2 : 1;
    const groups = new Map<string, Array<MapProfile & { hereNow?: boolean }>>();
    for (const p of people) {
      // Somebody who has not published a position has no pin. `unplaced`
      // was written for exactly this and nothing read it, so board members
      // with no location were being drawn at 0°, 0° in the Gulf of Guinea
      // — the coordinate pair is the carrier for "absent", not a place.
      // The viewer is in this list so the directory can show them, and is
      // skipped here because they already have a marker of their own —
      // drawn from their real position rather than their published one.
      if (p.self || p.unplaced || (p.lat === 0 && p.lng === 0)) continue;
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
  }, [people, precise, neighbourhood, close, spread, regional]);

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
      /**
       * One Earth, not a filmstrip of them.
       *
       * Mercator tiles repeat horizontally by default, so zooming out far
       * enough to see a country puts three copies of it on screen with
       * three copies of every marker — and clicking the wrong India is a
       * bug nobody can describe. Off, bounded, and floored at a zoom where
       * the single copy still covers the frame.
       */
      renderWorldCopies={false}
      maxBounds={WORLD_BOUNDS}
      minZoom={minZoom}
      // Tiles and labels cross-fade over 300ms by default, which on a map
      // you pan constantly reads as lag rather than polish.
      //
      // Deliberately NOT `reuseMaps`: the shell remounts this on every
      // network switch, and a reused instance keeps the old camera instead
      // of applying the new `initialViewState` — which is exactly the
      // framing `fitToPeople` exists to get right.
      fadeDuration={120}
      mapStyle={dark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11"}
      style={{ width: "100%", height: "100%" }}
      onLoad={(e) => {
        mapObj.current = e.target;
        measureFrom(e.target.getContainer());
        // Before the first move there is nothing to inherit, and the
        // fallback in the stylesheet is 1 — which at world zoom is the
        // wrong end of the range.
        applyPinScale(e.target.getContainer(), e.target.getZoom());
      }}
      onMove={onMove}
      onMoveEnd={(e: ViewStateChangeEvent) =>
        onMoveEnd?.({ lat: e.viewState.latitude, lng: e.viewState.longitude, zoom: e.viewState.zoom })
      }
    >
      {showZoom && <NavigationControl position="bottom-right" showCompass={false} />}

      {layer === "events" &&
        events.map((ev) =>
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

      {/* Roles, at the office rather than at the person who posted them. */}
      {layer === "jobs" &&
        jobs.map((job) =>
          job.lat != null && job.lng != null ? (
            <Marker key={job.id} latitude={job.lat} longitude={job.lng} anchor="bottom" style={{ zIndex: 5 }}>
              <span className="hover-host relative">
                <button
                  type="button"
                  className="layer-pin tap"
                  style={{ borderColor: "var(--layer-job)", color: "var(--layer-job)" }}
                  onClick={() => onSelectJob?.(job.id)}
                  aria-label={`${job.title} at ${job.company}`}
                >
                  <IconBriefcase size={14} />
                </button>
                <JobCardHover job={job} />
              </span>
            </Marker>
          ) : null
        )}

      {/* Pins ride with the faces. "Somebody is in a café two streets away,
          right now" is the most time-sensitive thing on the screen and it is
          a fact about a person — so it belongs on the people map and nowhere
          else. A jobs map with a stranger's coffee on it is not a jobs map. */}
      {layer === "people" &&
        pins.map((pin) => (
        <Marker key={pin.id} latitude={pin.lat} longitude={pin.lng} anchor="bottom" style={{ zIndex: 6 }}>
          <span className="hover-host relative">
            <button
              type="button"
              className="pin-drop tap"
              onClick={() => onSelectPin?.(pin.id)}
              aria-label={`${pin.person.name}: ${pin.message}`}
            >
              <span className="pin-drop-glow" aria-hidden="true" />
              <span className="pin-drop-pill">
                <IconMeetup size={14} strokeWidth={2.1} />
                Meet up
                <span className="pin-drop-face">
                  <Avatar name={pin.person.name} photoUrl={pin.person.photoUrl} size={18} />
                </span>
              </span>
              <span className="pin-drop-tail" aria-hidden="true" />
            </button>
            <PinCardHover pin={pin} />
          </span>
          </Marker>
        ))}

      {layer !== "events" && you && (
        <Marker latitude={you.lat} longitude={you.lng} anchor="center">
          <span className="pin-scale relative flex items-center">
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
              <Avatar name={you.name} photoUrl={you.photoUrl} size={42} ring={3} />
              {/* A ring that closes as the profile fills.
                  Drawn around your own face because that is where the
                  question lives — "how do I look to this room" — and a
                  number on a pin is read without being opened, which a
                  panel is not. Gone at a hundred: a full ring says
                  nothing a plain face doesn't. */}
              {you.completion && (
                <span
                  className="pointer-events-none absolute -inset-[3px] rounded-full"
                  style={{
                    background: `conic-gradient(var(--brand) ${you.completion.percent}%, color-mix(in srgb, var(--ink-soft) 25%, transparent) 0)`,
                    WebkitMask: "radial-gradient(circle, transparent 0 22px, #000 22px)",
                    mask: "radial-gradient(circle, transparent 0 22px, #000 22px)",
                  }}
                />
              )}
            </span>
            <span
              className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9.5px] font-bold"
              style={{
                background: you.visibility === "off" ? "var(--ink-soft)" : "var(--brand)",
                color: "#fff",
              }}
            >
              {you.completion
                ? `${you.completion.percent}%`
                : you.visibility === "off"
                  ? "Hidden"
                  : "You"}
            </span>
          </span>
        </Marker>
      )}

      {layer === "people" &&
        stacks.map((s) => (
          <Marker key={s.key} latitude={s.lat} longitude={s.lng} anchor="center">
            <FaceStack
              chip={chip}
              group={s.group}
              highlighted={highlighted}
              onSelect={onSelectPerson}
              onOpenStack={onOpenStack}
            />
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
function PinCard({ person }: { person: MapProfile & { hereNow?: boolean; verified?: boolean } }) {
  const needs = askLines(person.lookingFor, person.customLookingFor, "need");
  const offers = askLines(person.canHelpWith, person.customCanHelpWith, "offer");
  return (
    <span
      className="hover-card pointer-events-none absolute z-50 block w-[252px] rounded-2xl border border-[var(--line)] p-2.5 text-left"
      style={{ background: "var(--card)", boxShadow: "var(--shadow-lift)" }}
      aria-hidden="true"
    >
      {/* The badge belongs here as much as on the profile: this card is
          where somebody decides whether the face is worth a click. */}
      <span className="flex items-center gap-1.5">
        <span className="min-w-0 truncate text-[12.5px] font-semibold">{person.name}</span>
        {person.verified && <VerifiedBadge size={12} label="Verified by a community you're both in" />}
      </span>
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
      {/* The two lines somebody is actually hovering to read. Both of
          them: an offer with no need beside it is a CV, and a need with no
          offer is an ask — the pair is what makes a stranger worth
          crossing a room for. */}
      {(needs.length > 0 || offers.length > 0) && (
        <span className="mt-2 flex flex-col gap-1">
          <Ask side="need" lines={needs} compact />
          <Ask side="offer" lines={offers} compact />
        </span>
      )}
      {needs.length === 0 && offers.length === 0 && (
        <span className="mt-1.5 block text-[11px] italic text-[var(--ink-soft)]">
          Hasn&rsquo;t said what they&rsquo;re after yet.
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

/** Hover preview for a role — the title, the employer, and the commute. */
function JobCardHover({ job }: { job: JobRef }) {
  return (
    <span
      className="hover-card pointer-events-none absolute z-50 block w-[228px] rounded-2xl border border-[var(--line)] p-2.5 text-left"
      style={{ background: "var(--card)", boxShadow: "var(--shadow-lift)" }}
      aria-hidden="true"
    >
      <span className="block text-[12.5px] font-semibold leading-[1.3]">{job.title}</span>
      <span className="block truncate text-[11.5px] text-[var(--ink-soft)]">{job.company}</span>
      {job.placeLabel && (
        <span className="mt-0.5 block truncate text-[11px] text-[var(--ink-soft)]">{job.placeLabel}</span>
      )}
      <span className="mt-1 block text-[11px] font-semibold" style={{ color: "var(--layer-job)" }}>
        {job.distanceKm == null
          ? jobModeLabel(job.workMode)
          : job.distanceKm < 1
            ? "under 1 km away"
            : `${Math.round(job.distanceKm)} km away`}
      </span>
    </span>
  );
}

/** Hover preview for an ad-hoc pin — the message is the whole point. */
function PinCardHover({ pin }: { pin: PinRef }) {
  return (
    <span
      className="hover-card pointer-events-none absolute z-50 block w-[230px] rounded-2xl border border-[var(--line)] p-2.5 text-left"
      style={{ background: "var(--card)", boxShadow: "var(--shadow-lift)" }}
      aria-hidden="true"
    >
      <span className="block truncate text-[12.5px] font-semibold">{pin.person.name}</span>
      <span className="mt-0.5 block text-[12px] leading-[1.4]">{pin.message}</span>
      <span className="mt-1 block text-[11px]" style={{ color: "var(--good)" }}>
        {pin.placeLabel ? `${pin.placeLabel} · ` : ""}
        {pin.minutesLeft > 60 ? `${Math.round(pin.minutesLeft / 60)}h left` : `${pin.minutesLeft}m left`}
        {pin.joined.length > 0 ? ` · ${pin.joined.length} coming` : ""}
      </span>
    </span>
  );
}

/** One person, wherever they are drawn. */

/**
 * A person as a labelled chip, for the shop-window view.
 *
 * A face alone says somebody is there; it does not say why you would
 * cross a room for them. On the one screen that has to persuade a
 * stranger, the map itself should carry the argument — so each pin
 * becomes a name and the single most useful line about them, and the
 * whole map reads as a page of reasons rather than a scatter of
 * avatars.
 *
 * Surname reduced to an initial. It is enough for a name to read as a
 * real person's, and it keeps a wall of them from being scraped as a
 * directory by somebody who never signed in.
 */
function Chip({
  p,
  side,
  line,
  onSelect,
}: {
  p: MapProfile;
  side: "need" | "offer";
  line: string;
  onSelect?: (id: string) => void;
}) {
  /**
   * "Priya S.", but not "M R." — plenty of people here write their name
   * as an initial and a given name ("M SAI KUMAR REDDY"), and taking the
   * first token blind turned that into two letters that name nobody.
   */
  const parts = p.name.trim().split(/\s+/).filter(Boolean);
  const lead = parts[0].replace(/\.$/, "").length <= 1 && parts.length > 1 ? parts.slice(0, 2) : parts.slice(0, 1);
  const tail = parts.length > lead.length ? `${parts[parts.length - 1][0]}.` : "";
  const shown = [...lead, tail].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      onClick={() => onSelect?.(p.id)}
      className="map-pin flex max-w-[190px] items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-left"
      style={{ background: "var(--card)", boxShadow: "0 0 0 1px var(--line), var(--shadow)" }}
    >
      <Avatar name={p.name} photoUrl={p.photoUrl} size={24} />
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-semibold leading-[1.2]">{shown}</span>
        <span className="block truncate text-[10px] leading-[1.25]" style={{ color: `var(--${side})` }}>
          <span className="font-semibold">{side === "need" ? "Looking for " : "Can help with "}</span>
          {line.toLowerCase()}
        </span>
      </span>
    </button>
  );
}

function Face({
  p,
  lit,
  chip,
  onSelect,
}: {
  p: MapProfile & { hereNow?: boolean; verified?: boolean };
  lit: boolean;
  /** Draw the labelled version — see Chip. */
  chip?: boolean;
  onSelect?: (id: string) => void;
}) {
  if (chip && p.name) {
    const needs = askLines(p.lookingFor, p.customLookingFor, "need");
    const offers = askLines(p.canHelpWith, p.customCanHelpWith, "offer");
    /**
     * Mixed, when somebody has both.
     *
     * Preferring needs made every chip on the map read "Looking for",
     * which paints the place as a queue of people wanting things rather
     * than a room where help goes both ways. Split on the id so the
     * choice is stable per person and roughly even across the map.
     */
    let h = 0;
    for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) >>> 0;
    const both = needs.length > 0 && offers.length > 0;
    const side = both ? (h % 2 ? "offer" : "need") : needs.length > 0 ? "need" : offers.length > 0 ? "offer" : null;
    const line = side === "offer" ? offers[0] : side === "need" ? needs[0] : null;
    // Nothing stated, so nothing to label — a chip reading just a name is
    // a wider pin that says less. They stay a face.
    if (side && line) return <Chip p={p} side={side} line={line} onSelect={onSelect} />;
  }
  return (
    <>
      <button
        type="button"
        className="map-pin"
        onClick={() => onSelect?.(p.id)}
        aria-label={p.name}
        style={lit ? { boxShadow: "0 0 0 2.5px var(--brand), var(--shadow)", borderRadius: 999 } : undefined}
      >
        <Avatar name={p.name} photoUrl={p.photoUrl} size={40} ring={2.5} />
        {/* Bottom-right, so it never collides with the live dot above. */}
        {p.verified && (
          <span className="absolute -bottom-0.5 -right-0.5">
            <VerifiedBadge size={14} label="Verified by a community you're both in" />
          </span>
        )}
        {p.placed === "live" && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full"
            style={{ background: "var(--good)", boxShadow: "0 0 0 2px var(--card)" }}
            title="Live location"
          />
        )}
      </button>
      <PinCard person={p} />
    </>
  );
}

function FaceStack({
  group,
  highlighted,
  chip,
  onSelect,
  onOpenStack,
}: {
  group: Array<MapProfile & { hereNow?: boolean; verified?: boolean }>;
  highlighted: Set<string>;
  chip?: boolean;
  onSelect?: (id: string) => void;
  /** The whole pile, handed to the directory. See the +N button below. */
  onOpenStack?: (ids: string[]) => void;
}) {
  // A recommended face is pulled to the front of its own stack — otherwise
  // the one person the surface just told you to meet can end up as the
  // hidden fourth face behind a "+3".
  const sorted = useMemo(
    () => [...group].sort((a, b) => Number(highlighted.has(b.id)) - Number(highlighted.has(a.id))),
    [group, highlighted]
  );

  const more = (n: number, ids: string[]) => (
    <button
      type="button"
      className="map-pin grid h-[40px] w-[40px] place-items-center rounded-full text-[12px] font-semibold"
      style={{ background: "var(--card)", color: "var(--ink-soft)", boxShadow: "0 0 0 2px var(--card), var(--shadow)" }}
      /**
       * The pile, not the fourth person in it.
       *
       * This used to open whoever happened to be sorted fourth, which is an
       * arbitrary answer to "who else is here" and no answer at all once a
       * stack is forty deep. It opens the directory scoped to this stack
       * instead, filtered by what people offer and need rather than by city
       * — every one of them is in the same place, which is why they piled up.
       */
      onClick={() => (onOpenStack ? onOpenStack(ids) : onSelect?.(sorted[sorted.length - n].id))}
      aria-label={`${n} more people here — open the directory`}
    >
      +{n}
    </button>
  );

  /**
   * Close in, a pile opens out into a ring around where it actually is.
   *
   * Everybody who pins themselves at the same venue — a co-working floor, a
   * conference hall — lands on one coordinate, and overlapping avatars mean
   * the thing the map is for stops working at exactly the moment it matters
   * most: you can see that people are there and not who any of them is.
   *
   * The fan is not a claim about where anybody is standing, and it is drawn
   * so it cannot be read as one: a dot marks the real point and a line runs
   * from it to every face. The ring is sized in screen pixels, so it shrinks
   * in metres as you zoom in — which is the right way round, since the
   * further in you are the more precisely the dot locates them.
   */
  const faces = sorted.slice(0, 3);
  const extra = sorted.length - faces.length;

  return (
    <span className="pin-scale flex items-center -space-x-3">
      {faces.map((p) => (
        <span key={p.id} className="hover-host relative">
          <Face p={p} lit={highlighted.has(p.id)} chip={chip && group.length === 1} onSelect={onSelect} />
        </span>
      ))}
      {extra > 0 && more(extra, sorted.map((p) => p.id))}
    </span>
  );
}
