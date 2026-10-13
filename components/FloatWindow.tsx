"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconX } from "./Icons";

export type WindowState = {
  open: boolean;
  min: boolean;
  max: boolean;
  x: number;
  y: number;
  z: number;
  /**
   * Null until somebody resizes, which is the difference between "no
   * opinion" and "exactly this". Left null, a window takes the width its
   * caller suggested and the height of its contents up to a cap — which is
   * right for a panel holding one empty-state card and wrong the moment
   * somebody has dragged it to the size they wanted.
   */
  w: number | null;
  h: number | null;
};

export const DEFAULT_WINDOW: WindowState = {
  open: false,
  min: false,
  max: false,
  x: 0,
  y: 0,
  z: 1,
  w: null,
  h: null,
};

/** Small enough to be out of the way, big enough to still show its title bar. */
const MIN_W = 260;
const MIN_H = 140;

/**
 * A panel that floats over the map instead of hanging off the dock.
 *
 * The dock opens windows; it doesn't own them. Several can be up at once —
 * the point of a map with people on it is comparing things side by side,
 * and a single slot that swaps content makes you close the thing you were
 * reading to look at the thing you want to compare it with.
 *
 * Moved and resized with pointer events rather than a library: between them
 * these are about seventy lines, and pointer events already unify mouse,
 * touch and pen, which is most of what such a library is for.
 */
export default function FloatWindow({
  title,
  state,
  onChange,
  onClose,
  onFocus,
  children,
  width = 380,
}: {
  title: React.ReactNode;
  state: WindowState;
  onChange: (next: Partial<WindowState>) => void;
  onClose: () => void;
  onFocus: () => void;
  children: React.ReactNode;
  /** The width before anybody has an opinion. `state.w` wins once set. */
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  /** Which edges the current resize is pulling, plus where it started. */
  const size = useRef<{
    edge: string;
    startX: number;
    startY: number;
    w: number;
    h: number;
    x: number;
    y: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Buttons in the title bar must not start a drag, or the close
      // control becomes a one-pixel nudge instead of a close.
      if ((e.target as HTMLElement).closest("button")) return;
      if (state.max) return;
      onFocus();
      drag.current = { dx: e.clientX - state.x, dy: e.clientY - state.y };
      setBusy(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [state.x, state.y, state.max, onFocus]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current) return;
      const w = ref.current?.offsetWidth ?? width;
      // Clamped so a window can always be grabbed again: at least part of
      // the title bar stays on screen in every direction.
      const x = Math.min(Math.max(e.clientX - drag.current.dx, -(w - 120)), window.innerWidth - 120);
      const y = Math.min(Math.max(e.clientY - drag.current.dy, 0), window.innerHeight - 90);
      onChange({ x, y });
    },
    [onChange, width]
  );

  const endDrag = useCallback(() => {
    drag.current = null;
    size.current = null;
    setBusy(false);
  }, []);

  /**
   * Resize from any edge or corner.
   *
   * Pulling a left or top edge moves the window as well as resizing it,
   * which is what makes dragging that side feel like moving the edge rather
   * than scaling from the opposite one.
   */
  const startResize = useCallback(
    (edge: string) => (e: React.PointerEvent) => {
      e.stopPropagation();
      if (state.max) return;
      onFocus();
      const el = ref.current;
      size.current = {
        edge,
        startX: e.clientX,
        startY: e.clientY,
        w: el?.offsetWidth ?? width,
        h: el?.offsetHeight ?? MIN_H,
        x: state.x,
        y: state.y,
      };
      setBusy(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [state.max, state.x, state.y, width, onFocus]
  );

  const onResizeMove = useCallback(
    (e: React.PointerEvent) => {
      const s = size.current;
      if (!s) return;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      const next: Partial<WindowState> = {};

      if (s.edge.includes("e")) next.w = Math.max(MIN_W, s.w + dx);
      if (s.edge.includes("s")) next.h = Math.max(MIN_H, s.h + dy);
      if (s.edge.includes("w")) {
        const w = Math.max(MIN_W, s.w - dx);
        next.w = w;
        next.x = s.x + (s.w - w);
      }
      if (s.edge.includes("n")) {
        const h = Math.max(MIN_H, s.h - dy);
        next.h = h;
        next.y = s.y + (s.h - h);
      }
      // Never taller or wider than the screen it has to live on.
      if (next.w != null) next.w = Math.min(next.w, window.innerWidth - 16);
      if (next.h != null) next.h = Math.min(next.h, window.innerHeight - 40);
      onChange(next);
    },
    [onChange]
  );

  // A window dropped off-screen by a resize is unreachable, so pull it back.
  useEffect(() => {
    const onResize = () => {
      const x = Math.min(state.x, window.innerWidth - 140);
      const y = Math.min(state.y, window.innerHeight - 90);
      if (x !== state.x || y !== state.y) onChange({ x, y });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [state.x, state.y, onChange]);

  if (!state.open) return null;

  const maximised = state.max;
  const resizable = !maximised && !state.min;

  return (
    // Two elements on purpose. The panel's 18px border-radius plus
    // overflow-hidden clips its own children, which silently swallowed the
    // corner resize handle — a pointer three pixels inside the corner landed
    // on the map behind. The outer box does position and size and clips
    // nothing, so the handles are reachable; the inner one carries the
    // rounding and the clipping for the content.
    <div
      ref={ref}
      className="panel-enter pointer-events-auto absolute flex flex-col"
      role="dialog"
      aria-label={typeof title === "string" ? title : undefined}
      onMouseDown={onFocus}
      style={
        maximised
          ? { left: 8, right: 8, top: 60, bottom: 86, zIndex: 30 + state.z }
          : {
              left: state.x,
              top: state.y,
              width: state.w ?? width,
              height: state.min ? undefined : (state.h ?? undefined),
              maxWidth: "calc(100vw - 16px)",
              // Once a height is chosen it is the height. Until then, grow
              // with the content up to a cap.
              maxHeight: state.min ? undefined : state.h ? undefined : "min(62dvh, 540px)",
              zIndex: 30 + state.z,
              // Dropped while moving so a fast pointer doesn't lag behind.
              transition: busy ? "none" : undefined,
            }
      }
    >
      <div className="floating-panel flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div
        className="flex flex-none cursor-grab items-center gap-2 border-b border-[var(--line)] px-2.5 py-2 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: "none" }}
      >
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{title}</span>

        <button
          type="button"
          className="win-dot"
          onClick={() => onChange({ min: !state.min, max: false })}
          aria-label={state.min ? "Restore" : "Minimise"}
          title={state.min ? "Restore" : "Minimise"}
        >
          <span className="block h-[2px] w-[9px] rounded-full" style={{ background: "currentColor" }} />
        </button>
        <button
          type="button"
          className="win-dot"
          onClick={() => onChange({ max: !state.max, min: false })}
          aria-label={state.max ? "Restore down" : "Maximise"}
          title={state.max ? "Restore down" : "Maximise"}
        >
          <span className="block h-[9px] w-[9px] rounded-[2px]" style={{ border: "1.5px solid currentColor" }} />
        </button>
        {/* Only offered once a size has been chosen — "reset" is meaningless
            against a window that has never been resized. */}
        {(state.w != null || state.h != null) && !maximised && (
          <button
            type="button"
            className="win-dot"
            onClick={() => onChange({ w: null, h: null })}
            aria-label="Reset size"
            title="Reset size"
          >
            <span
              className="block h-[9px] w-[9px] rounded-[2px]"
              style={{ border: "1.5px dashed currentColor" }}
            />
          </button>
        )}
        <button type="button" className="win-dot" onClick={onClose} aria-label="Close" title="Close">
          <IconX size={11} />
        </button>
      </div>

      {!state.min && <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">{children}</div>}
      </div>

      {resizable && (
        <>
          {/* Edges and corners. Each is a thin invisible strip; the corner
              grip is the only one drawn, because it's the one people look
              for. */}
          {(
            [
              ["n", "top-0 left-2 right-2 h-1.5 cursor-ns-resize"],
              ["s", "bottom-0 left-2 right-2 h-1.5 cursor-ns-resize"],
              ["w", "left-0 top-2 bottom-2 w-1.5 cursor-ew-resize"],
              ["e", "right-0 top-2 bottom-2 w-1.5 cursor-ew-resize"],
              ["nw", "-left-1 -top-1 h-4 w-4 cursor-nwse-resize"],
              ["ne", "-right-1 -top-1 h-4 w-4 cursor-nesw-resize"],
              ["sw", "-left-1 -bottom-1 h-4 w-4 cursor-nesw-resize"],
              // The one people reach for, so it gets the biggest target.
              ["se", "-right-1 -bottom-1 h-5 w-5 cursor-nwse-resize"],
            ] as const
          ).map(([edge, cls]) => (
            <div
              key={edge}
              role="presentation"
              className={`absolute z-10 ${cls}`}
              style={{ touchAction: "none" }}
              onPointerDown={startResize(edge)}
              onPointerMove={onResizeMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          ))}

          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[5px] right-[5px] h-2.5 w-2.5"
            style={{
              borderRight: "2px solid var(--line)",
              borderBottom: "2px solid var(--line)",
              borderBottomRightRadius: 3,
            }}
          />
        </>
      )}
    </div>
  );
}
